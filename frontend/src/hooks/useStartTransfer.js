import { useText } from '../i18n/useText';
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
    const { t } = useText();
    return useCallback(async () => {
        const selectedPlaylistIds = sourcePlaylistIds.length ? sourcePlaylistIds : [sourcePlaylistId].filter(Boolean);

        if (!selectedPlaylistIds.length || selectedPlaylistIds.some((playlistId) => playlistId.trim().length < 10)) {
            toast.error(t("Selecione ou cole uma playlist real do {{value0}}.", { value0: sourceLabel }));
            return;
        }
        if (sourceProvider === targetProvider && !allowSameProvider) {
            toast.error(t("Escolha plataformas diferentes para origem e destino."));
            return;
        }
        if (!sourceReady) {
            toast.error(t("Conecte o {{value0}} antes de ler a playlist de origem.", { value0: sourceLabel }));
            setActiveTab('integrations');
            return;
        }
        if (!targetReady) {
            toast.error(t("Conecte o {{value0}} antes de criar playlists no destino.", { value0: targetLabel }));
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
                ? t("Playlist enviada para migração.")
                : t("{{value0}} playlists enviadas para migração.", { value0: selectedPlaylistIds.length }));
        } catch (err) {
            toast.error(err.response?.data?.message || t("Não foi possível iniciar a migração."));
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
        targetReady, t]);
};
