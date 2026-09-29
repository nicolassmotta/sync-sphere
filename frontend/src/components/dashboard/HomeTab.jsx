import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
    Plus,
    Radio,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useTransferEstimate } from '../../hooks/useTransferEstimate';
import Button from '../ui/Button';
import FadeInPage from '../ui/FadeInPage';
import SetupChecklist from '../setup/SetupChecklist';
import ActiveTransferCard from './home/ActiveTransferCard';
import DestinationCard from './home/DestinationCard';
import ProviderPairCard from './home/ProviderPairCard';
import ProviderPlaylistLinkCard from './home/ProviderPlaylistLinkCard';
import ProviderPlaylistListCard from './home/ProviderPlaylistListCard';
import TransferConfirmModal from './home/TransferConfirmModal';
import WorkflowCard from './home/WorkflowCard';

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.08 }
    }
};

const cardVariants = {
    hidden: { y: 16, opacity: 0 },
    visible: { y: 0, opacity: 1 }
};

const emptyPreview = (overrides = {}) => ({
    open: true,
    loading: false,
    tracks: [],
    totalTracks: 0,
    hasMore: false,
    error: '',
    blocked: false,
    ...overrides,
});

const isBlockedPreviewMessage = (message) => message.includes('não permitiu ler as faixas');

const HomeTab = ({
    user,
    providers,
    source,
    target,
    onProvidersChange,
    showModal,
    setShowModal,
    sourcePlaylistId,
    setSourcePlaylistId,
    sourcePlaylistIds,
    setSourcePlaylistIds,
    isTransferring,
    progress,
    progressMessage,
    transfers,
    onResumeTransfer,
    startTransferProcess,
    integrations,
    integrationsLoading,
    systemStatus,
    systemStatusLoading,
    refreshIntegrations,
    refreshSystemStatus,
    sourcePlaylists,
    sourcePlaylistsSummary,
    sourcePlaylistsLoading,
    sourcePlaylistsError,
    refreshSourcePlaylists,
    setActiveTab
}) => {
    const listMode = Boolean(source.capabilities?.listUserPlaylists);
    const [trackPreviews, setTrackPreviews] = useState({});
    const [linkPreview, setLinkPreview] = useState(null);
    const selectedPlaylistIdSet = useMemo(() => new Set(sourcePlaylistIds), [sourcePlaylistIds]);
    const blockedPlaylistIdSet = useMemo(() => new Set(
        Object.entries(trackPreviews)
            .filter(([, preview]) => preview?.blocked)
            .map(([playlistId]) => playlistId)
    ), [trackPreviews]);

    const selectedPlaylists = useMemo(() => {
        if (sourcePlaylistIds.length) {
            return sourcePlaylists.filter((playlist) => selectedPlaylistIdSet.has(playlist.id));
        }
        if (!sourcePlaylistId) return [];

        return [{
            id: sourcePlaylistId,
            name: linkPreview?.name || `Playlist do ${source.label}`,
            imageUrl: linkPreview?.imageUrl,
            trackCount: linkPreview?.totalTracks || linkPreview?.tracks?.length || 0,
        }];
    }, [linkPreview, selectedPlaylistIdSet, source.label, sourcePlaylistId, sourcePlaylistIds.length, sourcePlaylists]);

    const selectedCount = sourcePlaylistIds.length || (sourcePlaylistId ? 1 : 0);
    const providersReady = Boolean(source.connected && target.connected);
    const readyToTransfer = providersReady && selectedCount > 0;

    const selectedTrackCount = useMemo(
        () => selectedPlaylists.reduce((sum, playlist) => sum + (Number(playlist.trackCount) || 0), 0),
        [selectedPlaylists]
    );
    const transferEstimate = useTransferEstimate({
        enabled: showModal,
        targetProvider: target.id,
        trackCount: selectedTrackCount,
    });

    useEffect(() => {
        setTrackPreviews({});
        setLinkPreview(null);
    }, [source.id]);

    const openTransferModal = useCallback(() => {
        setShowModal(true);
    }, [setShowModal]);

    const loadTrackPreview = useCallback(async (playlistId, { open = true } = {}) => {
        setTrackPreviews((current) => ({
            ...current,
            [playlistId]: emptyPreview({ open, loading: true }),
        }));

        try {
            const response = await api.get(`/integrations/${source.id}/playlists/${playlistId}/tracks`, {
                params: { limit: 30 },
            });
            const data = response.data.data;
            setTrackPreviews((current) => ({
                ...current,
                [playlistId]: emptyPreview({
                    open,
                    tracks: data.tracks || [],
                    totalTracks: data.totalTracks || 0,
                    hasMore: Boolean(data.hasMore),
                }),
            }));
            return { ok: true };
        } catch (err) {
            const message = err.response?.data?.message || 'Não foi possível carregar as faixas dessa playlist.';
            const blocked = isBlockedPreviewMessage(message);
            setTrackPreviews((current) => ({
                ...current,
                [playlistId]: emptyPreview({ error: message, blocked }),
            }));
            setSourcePlaylistIds((currentIds) => currentIds.filter((id) => id !== playlistId));
            toast.error(message);
            return { ok: false, blocked, message };
        }
    }, [setSourcePlaylistIds, source.id]);

    const loadLinkPreview = useCallback(async () => {
        const playlistId = sourcePlaylistId.trim();
        if (!playlistId) {
            toast.error(`Cole o link ou ID da playlist do ${source.label}.`);
            return { ok: false };
        }

        setLinkPreview(emptyPreview({ loading: true }));

        try {
            const response = await api.get(`/integrations/${source.id}/playlist-tracks`, {
                params: { playlistId, limit: 30 },
            });
            const data = response.data.data;
            setLinkPreview(emptyPreview({
                name: data.name,
                imageUrl: data.imageUrl,
                tracks: data.tracks || [],
                totalTracks: data.totalTracks || 0,
                hasMore: Boolean(data.hasMore),
            }));
            return { ok: true };
        } catch (err) {
            const message = err.response?.data?.message || 'Não foi possível carregar as faixas dessa playlist.';
            setLinkPreview(emptyPreview({ error: message, blocked: true }));
            toast.error(message);
            return { ok: false, message };
        }
    }, [source.id, source.label, sourcePlaylistId]);

    const togglePlaylist = useCallback(async (playlistId) => {
        if (selectedPlaylistIdSet.has(playlistId)) {
            setSourcePlaylistIds((currentIds) => currentIds.filter((id) => id !== playlistId));
            return;
        }

        const currentPreview = trackPreviews[playlistId];
        if (currentPreview?.loading) return;
        if (currentPreview?.blocked) {
            setTrackPreviews((current) => ({
                ...current,
                [playlistId]: { ...current[playlistId], open: true },
            }));
            toast.error(currentPreview.error || `O ${source.label} bloqueou as faixas dessa playlist.`);
            return;
        }

        if (!currentPreview || currentPreview.error) {
            const result = await loadTrackPreview(playlistId, { open: false });
            if (!result.ok) return;
        }

        setSourcePlaylistId('');
        setSourcePlaylistIds((currentIds) => (
            currentIds.includes(playlistId) ? currentIds : [...currentIds, playlistId]
        ));
    }, [
        loadTrackPreview,
        selectedPlaylistIdSet,
        setSourcePlaylistId,
        setSourcePlaylistIds,
        source.label,
        trackPreviews,
    ]);

    const selectAllPlaylists = useCallback(() => {
        const selectablePlaylists = sourcePlaylists.filter((playlist) => !blockedPlaylistIdSet.has(playlist.id));
        setSourcePlaylistId('');
        setSourcePlaylistIds(selectablePlaylists.map((playlist) => playlist.id));

        if (selectablePlaylists.length < sourcePlaylists.length) {
            toast.error(`Playlists bloqueadas pelo ${source.label} ficaram fora da seleção.`);
        }
    }, [blockedPlaylistIdSet, setSourcePlaylistId, setSourcePlaylistIds, source.label, sourcePlaylists]);

    const clearSelectedPlaylists = useCallback(() => {
        setSourcePlaylistIds([]);
    }, [setSourcePlaylistIds]);

    const toggleTrackPreview = useCallback(async (playlistId) => {
        const currentPreview = trackPreviews[playlistId];

        if (currentPreview && (currentPreview.open || !currentPreview.error)) {
            setTrackPreviews((current) => ({
                ...current,
                [playlistId]: { ...current[playlistId], open: !currentPreview.open },
            }));
            return;
        }

        await loadTrackPreview(playlistId, { open: true });
    }, [loadTrackPreview, trackPreviews]);

    const handleManualPlaylistChange = useCallback((event) => {
        setSourcePlaylistIds([]);
        setSourcePlaylistId(event.target.value);
        setLinkPreview(null);
    }, [setSourcePlaylistId, setSourcePlaylistIds]);

    const handlePrimaryAction = useCallback(() => {
        if (!providersReady) {
            setActiveTab('integrations');
            return;
        }
        openTransferModal();
    }, [openTransferModal, providersReady, setActiveTab]);

    return (
        <FadeInPage className="mx-auto w-full max-w-7xl">
            <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <p className="mb-3 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.045] px-3 py-2 text-xs font-bold text-white/65">
                        <Radio size={15} className="text-spotify" />
                        Olá, {user?.name || 'usuário local'} · {source.label} -&gt; {target.label}
                    </p>
                    <h1 className="max-w-3xl text-4xl font-black leading-tight text-white md:text-5xl">
                        SyncSphere: migrador local de playlists entre plataformas.
                    </h1>
                    <p className="mt-3 max-w-2xl text-base leading-7 text-muted">
                        Escolha origem e destino, conecte as duas plataformas em Integrações e acompanhe a migração em tempo real.
                    </p>
                </div>

                <Button
                    onClick={handlePrimaryAction}
                    variant="primary"
                    size="lg"
                    leftIcon={<Plus size={19} />}
                >
                    {readyToTransfer ? 'Nova transferência' : 'Configurar fluxo'}
                </Button>
            </div>

            <div className="mb-5">
                <SetupChecklist
                    integrations={integrations}
                    source={source}
                    target={target}
                    isTransferring={isTransferring}
                    onOpenHistory={() => setActiveTab('history')}
                    onOpenIntegrations={() => setActiveTab('integrations')}
                    onRefreshIntegrations={refreshIntegrations}
                    onRefreshSystemStatus={refreshSystemStatus}
                    refreshLoading={integrationsLoading || systemStatusLoading}
                    readyToTransfer={readyToTransfer}
                    selectedCount={selectedCount}
                    systemStatus={systemStatus}
                />
            </div>

            <TransferConfirmModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                sourceLabel={source.label}
                targetLabel={target.label}
                playlistUrlExample={source.playlistUrlExample}
                selectedPlaylists={selectedPlaylists}
                sourcePlaylistId={sourcePlaylistId}
                onManualPlaylistChange={handleManualPlaylistChange}
                onStartTransfer={startTransferProcess}
                selectedCount={selectedCount}
                isTransferring={isTransferring}
                estimate={transferEstimate}
            />

            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 gap-5 xl:grid-cols-[1.15fr_0.85fr]"
            >
                <motion.section variants={cardVariants} className="space-y-5">
                    <ProviderPairCard
                        providers={providers}
                        sourceProvider={source.id}
                        targetProvider={target.id}
                        onChange={onProvidersChange}
                    />

                    {listMode ? (
                        <ProviderPlaylistListCard
                            provider={source}
                            connected={Boolean(source.connected)}
                            playlists={sourcePlaylists}
                            playlistsSummary={sourcePlaylistsSummary}
                            playlistsLoading={sourcePlaylistsLoading}
                            playlistsError={sourcePlaylistsError}
                            sourcePlaylistIds={sourcePlaylistIds}
                            selectedPlaylistIdSet={selectedPlaylistIdSet}
                            trackPreviews={trackPreviews}
                            onRefreshPlaylists={() => refreshSourcePlaylists({ force: true })}
                            onSelectAllPlaylists={selectAllPlaylists}
                            onClearSelectedPlaylists={clearSelectedPlaylists}
                            onTogglePlaylist={togglePlaylist}
                            onToggleTrackPreview={toggleTrackPreview}
                            onOpenIntegrations={() => setActiveTab('integrations')}
                        />
                    ) : (
                        <ProviderPlaylistLinkCard
                            source={source}
                            target={target}
                            preview={linkPreview}
                            sourcePlaylistId={sourcePlaylistId}
                            onLoadPreview={loadLinkPreview}
                            onOpenIntegrations={() => setActiveTab('integrations')}
                            onPlaylistChange={handleManualPlaylistChange}
                            onReviewTransfer={openTransferModal}
                        />
                    )}
                </motion.section>

                <motion.aside variants={cardVariants} className="space-y-5">
                    <WorkflowCard sourceLabel={source.label} targetLabel={target.label} />
                    <DestinationCard
                        source={source}
                        target={target}
                        selectedCount={selectedCount}
                        readyToTransfer={readyToTransfer}
                        onConfigureDestination={() => setActiveTab('integrations')}
                        onReviewTransfer={openTransferModal}
                    />
                    <ActiveTransferCard
                        isTransferring={isTransferring}
                        progress={progress}
                        progressMessage={progressMessage}
                        transfers={transfers}
                        onResume={onResumeTransfer}
                        onOpenIntegrations={() => setActiveTab('integrations')}
                        onOpenHistory={() => setActiveTab('history')}
                    />
                </motion.aside>
            </motion.div>
        </FadeInPage>
    );
};

export default HomeTab;
