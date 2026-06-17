import { useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { TRANSFER_DIRECTIONS } from '../constants/transferDirections';

export const useStartTransfer = ({
    direction = TRANSFER_DIRECTIONS.SPOTIFY_TO_YOUTUBE,
    sourcePlaylistId,
    sourcePlaylistIds = [],
    spotifyReady,
    youtubeReady,
    setActiveTab,
    onBeforeStart,
    onTransferQueued,
    onTransferFailed,
}) => {
    return useCallback(async () => {
        const selectedPlaylistIds = sourcePlaylistIds.length ? sourcePlaylistIds : [sourcePlaylistId].filter(Boolean);
        const isYoutubeToSpotify = direction === TRANSFER_DIRECTIONS.YOUTUBE_TO_SPOTIFY;

        if (!selectedPlaylistIds.length || selectedPlaylistIds.some((playlistId) => playlistId.length < 10)) {
            toast.error(isYoutubeToSpotify
                ? 'Informe uma playlist real do YouTube Music.'
                : 'Selecione playlists reais do Spotify.');
            return;
        }
        if (isYoutubeToSpotify && !spotifyReady) {
            toast.error('Conecte o Spotify antes de criar playlists de destino.');
            setActiveTab('integrations');
            return;
        }
        if (!youtubeReady) {
            toast.error('Configure o cookie do YouTube Music no back-end antes de iniciar a migração.');
            setActiveTab('integrations');
            return;
        }

        onBeforeStart?.();

        try {
            const payload = selectedPlaylistIds.length === 1
                ? { direction, sourcePlaylistId: selectedPlaylistIds[0] }
                : { direction, sourcePlaylistIds: selectedPlaylistIds };

            const response = await api.post('/transfer/start', payload);

            const transferIds = response.data.data.transferIds || [response.data.data.transferId].filter(Boolean);
            onTransferQueued?.(transferIds);
            toast.success(selectedPlaylistIds.length === 1
                ? 'Playlist enviada para migração.'
                : `${selectedPlaylistIds.length} playlists enviadas para migração.`);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Não foi possível iniciar a migração.');
            onTransferFailed?.();
        }
    }, [
        onBeforeStart,
        onTransferFailed,
        onTransferQueued,
        direction,
        setActiveTab,
        spotifyReady,
        sourcePlaylistId,
        sourcePlaylistIds,
        youtubeReady,
    ]);
};
