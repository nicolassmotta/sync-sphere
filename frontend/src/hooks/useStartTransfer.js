import { useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';

export const useStartTransfer = ({
    sourcePlaylistId,
    sourcePlaylistIds = [],
    youtubeReady,
    setActiveTab,
    onBeforeStart,
    onTransferQueued,
    onTransferFailed,
}) => {
    return useCallback(async () => {
        const selectedPlaylistIds = sourcePlaylistIds.length ? sourcePlaylistIds : [sourcePlaylistId].filter(Boolean);

        if (!selectedPlaylistIds.length || selectedPlaylistIds.some((playlistId) => playlistId.length < 10)) {
            toast.error('Selecione playlists reais do Spotify.');
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
                ? { sourcePlaylistId: selectedPlaylistIds[0] }
                : { sourcePlaylistIds: selectedPlaylistIds };

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
        setActiveTab,
        sourcePlaylistId,
        sourcePlaylistIds,
        youtubeReady,
    ]);
};
