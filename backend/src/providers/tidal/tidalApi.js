/**
 * Cliente mínimo da TIDAL API v2 (JSON:API, https://openapi.tidal.com/v2).
 * Paginação por cursor (`links.next`), relações só com `include`.
 */
const API_BASE = 'https://openapi.tidal.com/v2';
const JSON_API = 'application/vnd.api+json';
export const TIDAL_ADD_ITEMS_LIMIT = 50;
const TRACK_BATCH_SIZE = 20;

export const tidalRequest = async (path, { token, method = 'GET', params = {}, body } = {}) => {
    const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    });

    const response = await fetch(url.toString(), {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: JSON_API,
            ...(body ? { 'Content-Type': JSON_API } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    if (response.status === 204) return null;
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        const detail = data.errors?.map((item) => item.detail).filter(Boolean).join('; ');
        const error = new Error(detail || `TIDAL respondeu HTTP ${response.status}.`);
        error.status = response.status;
        error.retryAfter = response.headers?.get?.('retry-after') ?? null;
        throw error;
    }

    return data;
};

// Links `next` vêm relativos à base da API.
const nextPath = (link) => (link ? (link.startsWith('http') ? link : `${API_BASE}${link}`) : null);

/**
 * Duração ISO 8601 (`PT3M5S`, `PT1H2M`) em milissegundos.
 */
export const parseIsoDuration = (value) => {
    const match = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?$/.exec(String(value || ''));
    if (!match) return 0;
    const [, days, hours, minutes, seconds] = match.map((part) => Number(part) || 0);
    return Math.round((((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000);
};

const indexIncluded = (included = []) => new Map(included.map((item) => [`${item.type}:${item.id}`, item]));

const toTrack = (resource, included) => {
    const artists = (resource.relationships?.artists?.data || [])
        .map((ref) => included.get(`artists:${ref.id}`)?.attributes?.name)
        .filter(Boolean);
    const albumRef = resource.relationships?.albums?.data?.[0];
    const title = resource.attributes?.title || '';
    const version = resource.attributes?.version;

    return {
        tidalId: resource.id,
        sourceId: resource.id,
        name: version ? `${title} (${version})` : title,
        artists,
        artist: artists.join(', ') || 'Unknown',
        album: albumRef ? included.get(`albums:${albumRef.id}`)?.attributes?.title || '' : '',
        durationMs: parseIsoDuration(resource.attributes?.duration),
        isrc: resource.attributes?.isrc || null,
        uri: `https://tidal.com/track/${resource.id}`,
    };
};

/**
 * Faixas completas (com artistas e álbum) para uma lista de IDs.
 */
export const getTracksByIds = async ({ token, countryCode, ids }) => {
    const tracks = [];
    for (let index = 0; index < ids.length; index += TRACK_BATCH_SIZE) {
        const batch = ids.slice(index, index + TRACK_BATCH_SIZE);
        const data = await tidalRequest('/tracks', {
            token,
            params: { countryCode, 'filter[id]': batch.join(','), include: 'artists,albums' },
        });
        const included = indexIncluded(data.included);
        const byId = new Map((data.data || []).map((resource) => [resource.id, toTrack(resource, included)]));
        batch.forEach((id) => {
            if (byId.has(id)) tracks.push(byId.get(id));
        });
    }
    return tracks;
};

export const getTracksByIsrc = async ({ token, countryCode, isrc }) => {
    const data = await tidalRequest('/tracks', {
        token,
        params: { countryCode, 'filter[isrc]': isrc, include: 'artists,albums' },
    });
    const included = indexIncluded(data.included);
    return (data.data || []).map((resource) => toTrack(resource, included));
};

export const searchTrackIds = async ({ token, countryCode, query, limit = 8 }) => {
    const data = await tidalRequest(`/searchResults/${encodeURIComponent(query)}/relationships/tracks`, {
        token,
        params: { countryCode },
    });
    return (data.data || []).filter((ref) => ref.type === 'tracks').slice(0, limit).map((ref) => ref.id);
};

export const getPlaylist = async ({ token, countryCode, playlistId }) => {
    const data = await tidalRequest(`/playlists/${encodeURIComponent(playlistId)}`, { token, params: { countryCode } });
    return data.data;
};

export const getPlaylistTrackIds = async ({ token, countryCode, playlistId, limit = Infinity, withReadInfo = false }) => {
    const ids = [];
    let next = `/playlists/${encodeURIComponent(playlistId)}/relationships/items`;
    let params = { countryCode };

    while (next && ids.length < limit) {
        const page = await tidalRequest(next, { token, params });
        (page.data || []).forEach((ref) => {
            if (ref.type === 'tracks') ids.push(ref.id);
        });
        next = nextPath(page.links?.next);
        params = {};
    }
    const result = ids.slice(0, limit);
    return withReadInfo ? { ids: result, truncated: Boolean(next) || ids.length > limit } : result;
};

export const listUserPlaylists = async ({ token, countryCode }) => {
    const playlists = [];
    let next = '/playlists';
    let params = { countryCode, 'filter[owners.id]': 'me' };

    while (next && playlists.length < 1000) {
        const page = await tidalRequest(next, { token, params });
        playlists.push(...(page.data || []));
        next = nextPath(page.links?.next);
        params = {};
    }
    return playlists;
};

export const getCurrentUser = async ({ token }) => {
    const data = await tidalRequest('/users/me', { token });
    return data.data;
};

export const createPlaylist = async ({ token, name, description }) => {
    const data = await tidalRequest('/playlists', {
        token,
        method: 'POST',
        body: {
            data: {
                type: 'playlists',
                // A API não cria playlist privada; UNLISTED só abre por link.
                attributes: { name, description: description || '', accessType: 'UNLISTED' },
            },
        },
    });
    return data?.data?.id;
};

export const addPlaylistItems = async ({ token, playlistId, trackIds }) => {
    for (let index = 0; index < trackIds.length; index += TIDAL_ADD_ITEMS_LIMIT) {
        await tidalRequest(`/playlists/${encodeURIComponent(playlistId)}/relationships/items`, {
            token,
            method: 'POST',
            body: {
                data: trackIds.slice(index, index + TIDAL_ADD_ITEMS_LIMIT).map((id) => ({ id, type: 'tracks' })),
                // O adaptador reconcilia as ocorrências antes de escrever.
                meta: { onDuplicates: 'ADD' },
            },
        });
    }
};
