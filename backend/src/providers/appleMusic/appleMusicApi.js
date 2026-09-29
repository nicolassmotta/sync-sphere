import { getMusicUserToken, resolveDeveloperToken, WEB_PLAYER_ORIGIN } from './appleMusicAuth.js';

/**
 * Cliente mínimo da Apple Music API (https://api.music.apple.com/v1).
 */
const API_BASE = 'https://api.music.apple.com';
export const APPLE_ADD_TRACKS_LIMIT = 100;
const PAGE_LIMIT = 100;

const authError = (message) => {
    const error = new Error(message);
    error.status = 401;
    return error;
};

export const appleRequest = async (path, { params = {}, method = 'GET', body, user = false } = {}) => {
    const developer = await resolveDeveloperToken();
    if (!developer) {
        throw authError('Configure o Apple Music em Integrações (chave MusicKit no .env ou token do web player).');
    }

    const headers = { Authorization: `Bearer ${developer.token}`, Accept: 'application/json' };
    if (developer.webPlayer) headers.Origin = WEB_PLAYER_ORIGIN;
    if (user) {
        const musicUserToken = getMusicUserToken();
        if (!musicUserToken) throw authError('Conecte sua conta Apple Music em Integrações para continuar.');
        headers['Music-User-Token'] = musicUserToken;
    }
    if (body) headers['Content-Type'] = 'application/json';

    const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    });

    const response = await fetch(url.toString(), { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (response.status === 204) return null;

    const data = await response.json().catch(() => null);
    if (!response.ok) {
        const detail = data?.errors?.map((item) => item.detail || item.title).filter(Boolean).join('; ');
        const error = new Error(detail || `Apple Music respondeu HTTP ${response.status}.`);
        // 403 do Apple Music é token inválido/expirado, não falta de permissão da playlist.
        error.status = response.status === 403 ? 401 : response.status;
        error.retryAfter = response.headers?.get?.('retry-after') ?? null;
        throw error;
    }
    return data;
};

const paginate = async (path, { params, user, limit = Infinity }) => {
    const items = [];
    let next = path;
    let query = { limit: PAGE_LIMIT, ...params };

    while (next && items.length < limit) {
        const page = await appleRequest(next, { params: query, user });
        items.push(...(page?.data || []));
        next = page?.next || null;
        query = {};
    }
    return items.slice(0, limit);
};

export const toAppleTrack = (song) => {
    const attributes = song.attributes || {};
    const catalog = song.relationships?.catalog?.data?.[0];
    const catalogId = attributes.playParams?.catalogId || catalog?.id || (song.type === 'songs' ? song.id : null);

    return {
        appleId: catalogId || song.id,
        sourceId: catalogId || song.id,
        name: attributes.name || '',
        artists: [attributes.artistName].filter(Boolean),
        artist: attributes.artistName || 'Unknown',
        album: attributes.albumName || '',
        durationMs: attributes.durationInMillis || 0,
        isrc: attributes.isrc || catalog?.attributes?.isrc || null,
        uri: attributes.url || catalog?.attributes?.url || null,
    };
};

export const getStorefront = async () => {
    const data = await appleRequest('/v1/me/storefront', { user: true });
    return data?.data?.[0]?.id || null;
};

export const getCatalogPlaylist = async ({ storefront, playlistId, limit }) => {
    const data = await appleRequest(`/v1/catalog/${storefront}/playlists/${encodeURIComponent(playlistId)}`);
    const playlist = data?.data?.[0];
    const songs = await paginate(`/v1/catalog/${storefront}/playlists/${encodeURIComponent(playlistId)}/tracks`, { limit });
    return { playlist, songs };
};

export const getLibraryPlaylist = async ({ playlistId, limit }) => {
    const data = await appleRequest(`/v1/me/library/playlists/${encodeURIComponent(playlistId)}`, { user: true });
    const playlist = data?.data?.[0];
    const songs = await paginate(`/v1/me/library/playlists/${encodeURIComponent(playlistId)}/tracks`, {
        params: { include: 'catalog' },
        user: true,
        limit,
    });
    return { playlist, songs };
};

export const listLibraryPlaylists = () => paginate('/v1/me/library/playlists', { user: true, limit: 1000 });

export const findSongsByIsrc = async ({ storefront, isrc }) => {
    const data = await appleRequest(`/v1/catalog/${storefront}/songs`, { params: { 'filter[isrc]': isrc } });
    return data?.data || [];
};

export const searchSongs = async ({ storefront, term, limit = 10 }) => {
    const data = await appleRequest(`/v1/catalog/${storefront}/search`, { params: { term, types: 'songs', limit } });
    return data?.results?.songs?.data || [];
};

export const createLibraryPlaylist = async ({ name, description }) => {
    const data = await appleRequest('/v1/me/library/playlists', {
        method: 'POST',
        user: true,
        body: { attributes: { name, description: description || '' } },
    });
    return data?.data?.[0]?.id;
};

export const addLibraryPlaylistTracks = async ({ playlistId, songIds }) => {
    for (let index = 0; index < songIds.length; index += APPLE_ADD_TRACKS_LIMIT) {
        await appleRequest(`/v1/me/library/playlists/${encodeURIComponent(playlistId)}/tracks`, {
            method: 'POST',
            user: true,
            body: { data: songIds.slice(index, index + APPLE_ADD_TRACKS_LIMIT).map((id) => ({ id, type: 'songs' })) },
        });
    }
};
