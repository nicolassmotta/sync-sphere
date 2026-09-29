import { lazy, Suspense, useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import toast from 'react-hot-toast';
import { useLocation, useNavigate } from 'react-router-dom';
import { useIntegrationStatus } from '../hooks/useIntegrationStatus';
import { useLocalSystemStatus } from '../hooks/useLocalSystemStatus';
import { useStartTransfer } from '../hooks/useStartTransfer';
import { useSpotifyPlaylists } from '../hooks/useSpotifyPlaylists';
import { useTransferSocket } from '../hooks/useTransferSocket';
import { TRANSFER_DIRECTIONS } from '../constants/transferDirections';
import api from '../services/api';

import DashboardLayout from '../components/layout/DashboardLayout';

const HomeTab = lazy(() => import('../components/dashboard/HomeTab'));
const SettingsTab = lazy(() => import('../components/dashboard/SettingsTab'));
const HistoryTab = lazy(() => import('../components/dashboard/HistoryTab'));
const IntegrationsTab = lazy(() => import('../components/dashboard/IntegrationsTab'));

const ACTIVE_TRANSFER_STATUSES = ['pending', 'processing', 'paused', 'needs_auth'];

const DashboardTabFallback = () => (
    <div className="mx-auto grid min-h-[320px] w-full max-w-5xl place-items-center">
        <div className="rounded-lg border border-white/10 bg-white/[0.045] px-5 py-4 text-sm font-bold text-white/65">
            Carregando painel...
        </div>
    </div>
);

const Dashboard = () => {
    const user = useAuthStore((state) => state.user);
    const location = useLocation();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('home');
    const { integrations, loading: integrationsLoading, refreshIntegrations } = useIntegrationStatus();
    const {
        loading: systemStatusLoading,
        refreshSystemStatus,
        systemStatus,
    } = useLocalSystemStatus();
    
    const [showModal, setShowModal] = useState(false);
    const [transferDirection, setTransferDirection] = useState(TRANSFER_DIRECTIONS.SPOTIFY_TO_YOUTUBE);
    const [sourcePlaylistId, setSourcePlaylistId] = useState('');
    const [sourcePlaylistIds, setSourcePlaylistIds] = useState([]);
    const [transferIds, setTransferIds] = useState([]);
    const {
        playlists: spotifyPlaylists,
        summary: spotifyPlaylistsSummary,
        loading: spotifyPlaylistsLoading,
        error: spotifyPlaylistsError,
        refreshPlaylists: refreshSpotifyPlaylists,
    } = useSpotifyPlaylists({
        enabled: integrations.spotify.connected && transferDirection === TRANSFER_DIRECTIONS.SPOTIFY_TO_YOUTUBE,
    });
    const {
        isTransferring,
        progress,
        progressMessage,
        transfers,
        prepareTransferProgress,
        stopTransferProgress,
    } = useTransferSocket(transferIds);

    // Depois de recarregar a página, volta a acompanhar o que ainda não terminou.
    useEffect(() => {
        let cancelled = false;

        api.get('/transfer')
            .then((response) => {
                if (cancelled) return;
                const activeIds = (response.data.data.transfers || [])
                    .filter((transfer) => ACTIVE_TRANSFER_STATUSES.includes(transfer.status))
                    .map((transfer) => transfer._id);
                if (activeIds.length) {
                    setTransferIds((currentIds) => (currentIds.length ? currentIds : activeIds));
                }
            })
            .catch(() => {});

        return () => {
            cancelled = true;
        };
    }, []);

    const followTransfers = useCallback((nextTransferIds) => {
        const ids = (Array.isArray(nextTransferIds) ? nextTransferIds : [nextTransferIds]).filter(Boolean).map(String);
        // Sempre um array novo: reconecta o socket mesmo se a transferência já estava na lista.
        setTransferIds((currentIds) => [...new Set([...currentIds.map(String), ...ids])]);
    }, []);

    const resumeTransfer = useCallback(async (transferId) => {
        try {
            const response = await api.post(`/transfer/${transferId}/resume`);
            toast.success(response.data.message || 'Transferência retomada.');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Não foi possível retomar a transferência.');
        }
    }, []);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const tab = params.get('tab');
        const spotifyStatus = params.get('spotify');

        if (tab) setActiveTab(tab);
        if (spotifyStatus === 'connected') toast.success('Spotify conectado com sucesso.');
        if (spotifyStatus === 'denied') toast.error('Conexão com Spotify cancelada.');

        if (tab || spotifyStatus) {
            refreshIntegrations();
            navigate('/dashboard', { replace: true });
        }
    }, [location.search, navigate, refreshIntegrations]);

    // Nova migração entra na lista sem esconder as que ainda estão pausadas ou na fila.
    const handleTransferQueued = useCallback((nextTransferIds) => {
        const ids = (Array.isArray(nextTransferIds) ? nextTransferIds : [nextTransferIds]).filter(Boolean).map(String);
        const stillActiveIds = transfers
            .filter((transfer) => ACTIVE_TRANSFER_STATUSES.includes(transfer.status))
            .map((transfer) => String(transfer.transferId));
        setTransferIds([...new Set([...stillActiveIds, ...ids])]);
    }, [transfers]);

    const handleBeforeTransferStart = useCallback(() => {
        setShowModal(false);
        prepareTransferProgress('Preparando sua migração...');
    }, [prepareTransferProgress]);

    const handleTransferDirectionChange = useCallback((nextDirection) => {
        setTransferDirection(nextDirection);
        setSourcePlaylistId('');
        setSourcePlaylistIds([]);
    }, []);

    const startTransferProcess = useStartTransfer({
        direction: transferDirection,
        sourcePlaylistId,
        sourcePlaylistIds,
        spotifyReady: integrations.spotify.connected,
        youtubeReady: integrations.youtubeMusic.connected,
        setActiveTab,
        onBeforeStart: handleBeforeTransferStart,
        onTransferQueued: handleTransferQueued,
        onTransferFailed: stopTransferProgress,
    });

    return (
        <DashboardLayout user={user} activeTab={activeTab} setActiveTab={setActiveTab}>
            <Suspense fallback={<DashboardTabFallback />}>
                {activeTab === 'home' && (
                    <HomeTab 
                        user={user}
                        transferDirection={transferDirection}
                        onTransferDirectionChange={handleTransferDirectionChange}
                        showModal={showModal}
                        setShowModal={setShowModal}
                        sourcePlaylistId={sourcePlaylistId}
                        setSourcePlaylistId={setSourcePlaylistId}
                        sourcePlaylistIds={sourcePlaylistIds}
                        setSourcePlaylistIds={setSourcePlaylistIds}
                        isTransferring={isTransferring}
                        progress={progress}
                        progressMessage={progressMessage}
                        transfers={transfers}
                        onResumeTransfer={resumeTransfer}
                        startTransferProcess={startTransferProcess}
                        integrations={integrations}
                        integrationsLoading={integrationsLoading}
                        systemStatus={systemStatus}
                        systemStatusLoading={systemStatusLoading}
                        refreshIntegrations={refreshIntegrations}
                        refreshSystemStatus={refreshSystemStatus}
                        spotifyPlaylists={spotifyPlaylists}
                        spotifyPlaylistsSummary={spotifyPlaylistsSummary}
                        spotifyPlaylistsLoading={spotifyPlaylistsLoading}
                        spotifyPlaylistsError={spotifyPlaylistsError}
                        refreshSpotifyPlaylists={refreshSpotifyPlaylists}
                        setActiveTab={setActiveTab}
                    />
                )}

                {activeTab === 'integrations' && (
                    <IntegrationsTab
                        integrations={integrations}
                        integrationsLoading={integrationsLoading}
                        refreshIntegrations={refreshIntegrations}
                        systemStatus={systemStatus}
                        systemStatusLoading={systemStatusLoading}
                        refreshSystemStatus={refreshSystemStatus}
                    />
                )}

                {activeTab === 'history' && (
                    <HistoryTab onTransfersQueued={followTransfers} />
                )}

                {activeTab === 'settings' && (
                    <SettingsTab
                        integrations={integrations}
                        integrationsLoading={integrationsLoading}
                        refreshIntegrations={refreshIntegrations}
                        systemStatus={systemStatus}
                        systemStatusLoading={systemStatusLoading}
                        refreshSystemStatus={refreshSystemStatus}
                        setActiveTab={setActiveTab}
                    />
                )}
            </Suspense>
        </DashboardLayout>
    );
};

export default Dashboard;
