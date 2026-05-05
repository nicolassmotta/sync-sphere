import { useCallback, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
    Plus,
    Radio,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Button from '../ui/Button';
import FadeInPage from '../ui/FadeInPage';
import SetupChecklist from '../setup/SetupChecklist';
import ActiveTransferCard from './home/ActiveTransferCard';
import DestinationCard from './home/DestinationCard';
import SourceSelectionCard from './home/SourceSelectionCard';
import SpotifyPlaylistSelectionCard from './home/SpotifyPlaylistSelectionCard';
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

const HomeTab = ({
    user,
    showModal,
    setShowModal,
    sourcePlaylistId,
    setSourcePlaylistId,
    sourcePlaylistIds,
    setSourcePlaylistIds,
    isTransferring,
    progress,
    progressMessage,
    startTransferProcess,
    integrations,
    integrationsLoading,
    systemStatus,
    systemStatusLoading,
    refreshIntegrations,
    refreshSystemStatus,
    spotifyPlaylists,
    spotifyPlaylistsSummary,
    spotifyPlaylistsLoading,
    spotifyPlaylistsError,
    refreshSpotifyPlaylists,
    setActiveTab
}) => {
    const youtubeReady = integrations?.youtubeMusic?.connected;
    const spotifyConnected = integrations?.spotify?.connected;
    const [trackPreviews, setTrackPreviews] = useState({});
    const selectedPlaylistIdSet = useMemo(() => new Set(sourcePlaylistIds), [sourcePlaylistIds]);
    const blockedPlaylistIdSet = useMemo(() => new Set(
        Object.entries(trackPreviews)
            .filter(([, preview]) => preview?.blocked)
            .map(([playlistId]) => playlistId)
    ), [trackPreviews]);
    const selectedPlaylists = useMemo(
        () => spotifyPlaylists.filter((playlist) => selectedPlaylistIdSet.has(playlist.id)),
        [spotifyPlaylists, selectedPlaylistIdSet]
    );
    const hasManualPlaylist = Boolean(sourcePlaylistId);
    const selectedCount = sourcePlaylistIds.length || (hasManualPlaylist ? 1 : 0);
    const readyToTransfer = Boolean(youtubeReady && selectedCount > 0);

    const openTransferModal = useCallback(() => {
        setShowModal(true);
    }, [setShowModal]);

    const loadTrackPreview = useCallback(async (playlistId, { open = true } = {}) => {
        setTrackPreviews((current) => ({
            ...current,
            [playlistId]: {
                open,
                loading: true,
                tracks: [],
                totalTracks: 0,
                hasMore: false,
                error: '',
                blocked: false,
            },
        }));

        try {
            const response = await api.get(`/integrations/spotify/playlists/${playlistId}/tracks`, {
                params: { limit: 30 },
            });
            setTrackPreviews((current) => ({
                ...current,
                [playlistId]: {
                    open,
                    loading: false,
                    tracks: response.data.data.tracks || [],
                    totalTracks: response.data.data.totalTracks || 0,
                    hasMore: Boolean(response.data.data.hasMore),
                    error: '',
                    blocked: false,
                },
            }));
            return { ok: true };
        } catch (err) {
            const message = err.response?.data?.message || 'Não foi possível carregar as faixas dessa playlist.';
            const blocked = message.includes('Spotify não permitiu ler as faixas');
            setTrackPreviews((current) => ({
                ...current,
                [playlistId]: {
                    open: true,
                    loading: false,
                    tracks: [],
                    totalTracks: 0,
                    hasMore: false,
                    error: message,
                    blocked,
                },
            }));
            setSourcePlaylistIds((currentIds) => currentIds.filter((id) => id !== playlistId));
            toast.error(message);
            return { ok: false, blocked, message };
        }
    }, [setSourcePlaylistIds]);

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
                [playlistId]: {
                    ...current[playlistId],
                    open: true,
                },
            }));
            toast.error(currentPreview.error || 'O Spotify bloqueou as faixas dessa playlist.');
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
        trackPreviews,
    ]);

    const selectAllPlaylists = useCallback(() => {
        const selectablePlaylists = spotifyPlaylists.filter((playlist) => !blockedPlaylistIdSet.has(playlist.id));
        setSourcePlaylistId('');
        setSourcePlaylistIds(selectablePlaylists.map((playlist) => playlist.id));

        if (selectablePlaylists.length < spotifyPlaylists.length) {
            toast.error('Playlists bloqueadas pelo Spotify ficaram fora da seleção.');
        }
    }, [blockedPlaylistIdSet, setSourcePlaylistId, setSourcePlaylistIds, spotifyPlaylists]);

    const clearSelectedPlaylists = useCallback(() => {
        setSourcePlaylistIds([]);
    }, [setSourcePlaylistIds]);

    const toggleTrackPreview = useCallback(async (playlistId) => {
        const currentPreview = trackPreviews[playlistId];

        if (currentPreview?.open) {
            setTrackPreviews((current) => ({
                ...current,
                [playlistId]: {
                    ...current[playlistId],
                    open: false,
                },
            }));
            return;
        }

        if (currentPreview && !currentPreview.error) {
            setTrackPreviews((current) => ({
                ...current,
                [playlistId]: {
                    ...current[playlistId],
                    open: true,
                },
            }));
            return;
        }

        await loadTrackPreview(playlistId, { open: true });
    }, [loadTrackPreview, trackPreviews]);

    const handleManualPlaylistChange = useCallback((event) => {
        setSourcePlaylistIds([]);
        setSourcePlaylistId(event.target.value);
    }, [setSourcePlaylistId, setSourcePlaylistIds]);

    const handlePrimaryAction = useCallback(() => {
        if (!youtubeReady) {
            setActiveTab('integrations');
            return;
        }

        openTransferModal();
    }, [openTransferModal, setActiveTab, youtubeReady]);

    return (
        <FadeInPage className="mx-auto w-full max-w-7xl">
            <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <p className="mb-3 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.045] px-3 py-2 text-xs font-bold text-white/65">
                        <Radio size={15} className="text-spotify" />
                        Olá, {user?.name || 'usuário local'} · configuração e migração no mesmo painel
                    </p>
                    <h1 className="max-w-3xl text-4xl font-black leading-tight text-white md:text-5xl">
                        SyncSphere: migrador local Spotify -&gt; YouTube Music.
                    </h1>
                    <p className="mt-3 max-w-2xl text-base leading-7 text-muted">
                        Valide back-end, MongoDB, Redis, Spotify OAuth e YTMUSIC_COOKIE antes de enfileirar a migração.
                    </p>
                </div>

                <Button
                    onClick={handlePrimaryAction}
                    variant="primary"
                    size="lg"
                    leftIcon={<Plus size={19} />}
                >
                    {youtubeReady ? 'Nova transferência' : 'Configurar destino'}
                </Button>
            </div>

            <div className="mb-5">
                <SetupChecklist
                    integrations={integrations}
                    isTransferring={isTransferring}
                    onOpenHistory={() => setActiveTab('history')}
                    onOpenIntegrations={() => setActiveTab('integrations')}
                    onRefreshIntegrations={refreshIntegrations}
                    onRefreshSystemStatus={refreshSystemStatus}
                    refreshLoading={integrationsLoading || systemStatusLoading}
                    selectedCount={selectedCount}
                    systemStatus={systemStatus}
                />
            </div>

            <TransferConfirmModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                selectedPlaylists={selectedPlaylists}
                sourcePlaylistId={sourcePlaylistId}
                onManualPlaylistChange={handleManualPlaylistChange}
                onStartTransfer={startTransferProcess}
                selectedCount={selectedCount}
                isTransferring={isTransferring}
            />

            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 gap-5 xl:grid-cols-[1.15fr_0.85fr]"
            >
                <motion.section variants={cardVariants} className="space-y-5">
                    <SourceSelectionCard
                        spotifyConnected={spotifyConnected}
                        hasManualPlaylist={hasManualPlaylist}
                        onRefreshSpotifyPlaylists={() => refreshSpotifyPlaylists()}
                        onOpenManualPlaylist={openTransferModal}
                        onOpenIntegrations={() => setActiveTab('integrations')}
                    />

                    <SpotifyPlaylistSelectionCard
                        spotifyConnected={spotifyConnected}
                        spotifyPlaylists={spotifyPlaylists}
                        spotifyPlaylistsSummary={spotifyPlaylistsSummary}
                        spotifyPlaylistsLoading={spotifyPlaylistsLoading}
                        spotifyPlaylistsError={spotifyPlaylistsError}
                        sourcePlaylistIds={sourcePlaylistIds}
                        selectedPlaylistIdSet={selectedPlaylistIdSet}
                        trackPreviews={trackPreviews}
                        onRefreshSpotifyPlaylists={() => refreshSpotifyPlaylists()}
                        onSelectAllPlaylists={selectAllPlaylists}
                        onClearSelectedPlaylists={clearSelectedPlaylists}
                        onTogglePlaylist={togglePlaylist}
                        onToggleTrackPreview={toggleTrackPreview}
                        onOpenIntegrations={() => setActiveTab('integrations')}
                    />
                </motion.section>

                <motion.aside variants={cardVariants} className="space-y-5">
                    <WorkflowCard />
                    <DestinationCard
                        youtubeReady={youtubeReady}
                        selectedCount={selectedCount}
                        readyToTransfer={readyToTransfer}
                        onConfigureDestination={() => setActiveTab('integrations')}
                        onReviewTransfer={openTransferModal}
                    />
                    <ActiveTransferCard
                        isTransferring={isTransferring}
                        progress={progress}
                        progressMessage={progressMessage}
                    />
                </motion.aside>
            </motion.div>
        </FadeInPage>
    );
};

export default HomeTab;
