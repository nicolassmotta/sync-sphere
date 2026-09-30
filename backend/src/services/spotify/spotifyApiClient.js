import {
    buildSpotifyPlaylistAccessErrorMessage,
    isSpotifyPlaylistAccessDenied,
    SpotifyPlaylistAccessError,
} from './spotifyErrors.js';

export const fetchSpotifyJson = async (url, accessToken, fallbackMessage, options = {}) => {
    const response = await fetch(url, {
        ...options,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            ...(options.headers || {}),
        },
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const spotifyMessage = data.error?.message || data.error_description || data.error;
        const shouldUseFallback = fallbackMessage && isSpotifyPlaylistAccessDenied({
            status: response.status,
            message: spotifyMessage,
        });
        if (shouldUseFallback) {
            throw new SpotifyPlaylistAccessError(fallbackMessage);
        }

        const error = new Error(spotifyMessage || fallbackMessage || `Spotify respondeu HTTP ${response.status}.`);
        error.status = response.status;
        error.retryAfter = response.headers?.get?.('retry-after') ?? null;
        throw error;
    }

    return data;
};

export const fetchSpotifyJsonPage = async ({ url, offset }, accessToken, fallbackMessage) => {
    const data = await fetchSpotifyJson(url, accessToken, fallbackMessage);
    return { offset, data };
};

export const fetchSpotifyText = async (url, fallbackMessage) => {
    const response = await fetch(url, {
        headers: {
            Accept: 'text/html,application/xhtml+xml',
            'User-Agent': 'SyncSphere playlist migration bot (+http://localhost:8000)',
        },
    });

    if (!response.ok) {
        throw new SpotifyPlaylistAccessError(fallbackMessage || `Spotify respondeu HTTP ${response.status}.`);
    }

    return response.text();
};

export const getSpotifyPlaylistDetails = async ({ playlistId, accessToken }) => {
    const url = new URL(`https://api.spotify.com/v1/playlists/${playlistId}`);
    url.searchParams.set('market', 'from_token');

    return fetchSpotifyJson(
        url.toString(),
        accessToken,
        'Falha ao consultar detalhes da playlist do Spotify.'
    );
};

export const getSpotifyPlaylistItemsPageUrl = ({ playlistId, itemsReference, limit, offset }) => {
    const url = new URL(itemsReference?.href || `https://api.spotify.com/v1/playlists/${playlistId}/items`);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('market', 'from_token');
    return url.toString();
};

export const fetchSpotifyPlaylistItemsPage = ({ playlistId, itemsReference, offset, limit }, accessToken) => (
    fetchSpotifyJson(
        getSpotifyPlaylistItemsPageUrl({ playlistId, itemsReference, limit, offset }),
        accessToken,
        buildSpotifyPlaylistAccessErrorMessage()
    )
);
