import { useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';

export const useStartTransfer = ({
    sourceProvider,
    targetProvider,
    sourceLabel,
    targetLabel,
    sourceReady,
    targetReady,
    allowSameProvider = false,
    sourcePlaylistId,
    sourcePlaylistIds = [],
    setActiveTab,
    onBeforeStart,
    onTransferQueued,
    onTransferFailed,
}) => {
    return useCallback(async () => {
        const selectedPlaylistIds = sourcePlaylistIds.length ? sourcePlaylistIds : [sourcePlaylistId].filter(Boolean);

        if (!selectedPlaylistIds.length || selectedPlaylistIds.some((playlistId) => playlistId.trim().length < 10)) {
            toast.error(`Selecione ou cole uma playlist real do ${sourceLabel}.`);
            return;
        }
        if (sourceProvider === targetProvider && !allowSameProvider) {
            toast.error('Escolha plataformas diferentes para origem e destino.');
            return;
        }
        if (!sourceReady) {
            toast.error(`Conecte o ${sourceLabel} antes de ler a playlist de origem.`);
            setActiveTab('integrations');
            return;
        }
        if (!targetReady) {
            toast.error(`Conecte o ${targetLabel} antes de criar playlists no destino.`);
            setActiveTab('integrations');
            return;
        }

        onBeforeStart?.();

        try {
            const payload = selectedPlaylistIds.length === 1
                ? { sourceProvider, targetProvider, sourcePlaylistId: selectedPlaylistIds[0] }
                : { sourceProvider, targetProvider, sourcePlaylistIds: selectedPlaylistIds };

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
        allowSameProvider,
        onBeforeStart,
        onTransferFailed,
        onTransferQueued,
        setActiveTab,
        sourceLabel,
        sourcePlaylistId,
        sourcePlaylistIds,
        sourceProvider,
        sourceReady,
        targetLabel,
        targetProvider,
        targetReady,
    ]);
};
