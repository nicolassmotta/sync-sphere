const SPOTIFY_PLAYLIST_ACCESS_GUIDANCE = 'A API oficial só libera faixas de playlists criadas por você ou colaborativas, e a alternativa pública não conseguiu recuperar uma lista migrável.';

export class SpotifyPlaylistAccessError extends Error {
    constructor(message) {
        super(message);
        this.name = 'SpotifyPlaylistAccessError';
        this.isPermanentTransferError = true;
    }
}

export const buildSpotifyPlaylistAccessErrorMessage = (playlistName) => (
    `O Spotify não permitiu ler as faixas${playlistName ? ` de "${playlistName}"` : ' desta playlist'}. ${SPOTIFY_PLAYLIST_ACCESS_GUIDANCE}`
);

export const decorateSpotifyPlaylistAccessError = (error, playlist) => {
    if (error instanceof SpotifyPlaylistAccessError || error?.isPermanentTransferError) {
        throw new SpotifyPlaylistAccessError(buildSpotifyPlaylistAccessErrorMessage(playlist?.name));
    }

    throw error;
};

export const isSpotifyPlaylistAccessDenied = ({ status, message }) => {
    const normalizedMessage = String(message || '').toLowerCase();
    return status === 403
        || normalizedMessage === 'forbidden'
        || normalizedMessage.includes('missing token')
        || normalizedMessage.includes('token ausente');
};
