/**
 * API pública do Deezer (https://api.deezer.com): leitura de playlists
 * públicas, busca e busca por ISRC, sem login. Limite de 50 requisições a
 * cada 5 segundos por IP. Erros chegam com HTTP 200 e `{ error: { code } }`.
 */
const API_BASE = 'https://api.deezer.com';
const PAGE_LIMIT = 100;
export const DEEZER_PLAYLIST_MAX_ITEMS = 2000;

// Códigos de erro documentados da API pública.
const ERROR_STATUS = {
    4: 429, // Quota limit exceeded
    700: 503, // Service busy
    800: 404, // Data not found
    200: 401, // OAuthException
    300: 401, // Invalid/expired token
};

export class DeezerApiError extends Error {
    constructor(message, { code, status } = {}) {
        super(message);
        this.name = 'DeezerApiError';
        this.code = code;
        this.status = status;
    }
}

export const deezerGet = async (path, params = {}) => {
    const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    });

    const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
    if (!response.ok) {
        throw new DeezerApiError(`Deezer respondeu HTTP ${response.status}.`, { status: response.status });
    }

    const data = await response.json();
    if (data?.error) {
        const code = Number(data.error.code);
        throw new DeezerApiError(data.error.message || 'Erro na API do Deezer.', {
            code,
            status: ERROR_STATUS[code] || 400,
        });
    }

    return data;
};

export const normalizeDeezerTrack = (track) => ({
    deezerId: String(track.id),
    sourceId: String(track.id),
    name: track.title,
    artist: track.artist?.name || 'Unknown',
    album: track.album?.title || '',
    durationMs: (Number(track.duration) || 0) * 1000,
    isrc: track.isrc || null,
    uri: track.link || `https://www.deezer.com/track/${track.id}`,
});

export const getPublicPlaylist = async (playlistId, { limit = DEEZER_PLAYLIST_MAX_ITEMS } = {}) => {
    const playlist = await deezerGet(`/playlist/${playlistId}`);
    const tracks = (playlist.tracks?.data || []).map(normalizeDeezerTrack);
    let next = playlist.tracks?.next;

    while (next && tracks.length < limit) {
        const page = await deezerGet(next);
        tracks.push(...(page.data || []).map(normalizeDeezerTrack));
        next = page.next;
    }

    // Faixa `readable: false` não toca na região; mesmo assim vale migrar.
    return {
        id: String(playlist.id),
        name: playlist.title || 'Playlist Deezer',
        description: playlist.description || '',
        ownerName: playlist.creator?.name || '',
        imageUrl: playlist.picture_xl || playlist.picture_big || null,
        totalTracks: playlist.nb_tracks ?? tracks.length,
        tracks: tracks.slice(0, limit),
    };
};

export const getPublicPlaylistPreview = async (playlistId, limit) => {
    const playlist = await deezerGet(`/playlist/${playlistId}`);
    const page = await deezerGet(`/playlist/${playlistId}/tracks`, { index: 0, limit: Math.min(limit, PAGE_LIMIT) });
    return {
        id: String(playlist.id),
        name: playlist.title,
        imageUrl: playlist.picture_xl || playlist.picture_big || null,
        totalTracks: playlist.nb_tracks ?? page.total ?? 0,
        tracks: (page.data || []).map(normalizeDeezerTrack),
    };
};

const toCandidate = (track) => ({
    id: String(track.id),
    name: track.title,
    artists: [track.artist?.name, ...(track.contributors || []).map((artist) => artist.name)].filter(Boolean),
    durationMs: (Number(track.duration) || 0) * 1000,
    isrc: track.isrc || null,
});

export const findTrackByIsrc = async (isrc) => {
    try {
        return toCandidate(await deezerGet(`/track/isrc:${encodeURIComponent(isrc)}`));
    } catch (error) {
        if (error.code === 800) return null;
        throw error;
    }
};

export const searchTracks = async (query, { limit = 10 } = {}) => {
    const data = await deezerGet('/search/track', { q: query, limit });
    return (data.data || []).map(toCandidate);
};
