import { lazy, Suspense, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import toast from 'react-hot-toast';
import { useLocation, useNavigate } from 'react-router-dom';
import { useIntegrationStatus } from '../hooks/useIntegrationStatus';
import { useLocalSystemStatus } from '../hooks/useLocalSystemStatus';
import { useStartTransfer } from '../hooks/useStartTransfer';
import { useProviderPlaylists } from '../hooks/useProviderPlaylists';
import { useTransferSocket } from '../hooks/useTransferSocket';
import {
    DEFAULT_SOURCE_PROVIDER,
    DEFAULT_TARGET_PROVIDER,
    getProviderLabel,
    PROVIDER_UI,
} from '../constants/providers';
import api from '../services/api';

import DashboardLayout from '../components/layout/DashboardLayout';

const HomeTab = lazy(() => import('../components/dashboard/HomeTab'));
const SettingsTab = lazy(() => import('../components/dashboard/SettingsTab'));
const HistoryTab = lazy(() => import('../components/dashboard/HistoryTab'));
const IntegrationsTab = lazy(() => import('../components/dashboard/IntegrationsTab'));

const ACTIVE_TRANSFER_STATUSES = ['pending', 'processing', 'paused', 'needs_auth'];

// Antes do primeiro `GET /integrations/status`, mostra as plataformas conhecidas como pendentes.
const FALLBACK_PROVIDERS = Object.entries(PROVIDER_UI).map(([id, ui]) => ({
    id,
    label: ui.label,
    connected: false,
    capabilities: { read: true, write: true, listUserPlaylists: id === 'spotify' },
}));

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
    const {
        integrations,
        providers: loadedProviders,
        loading: integrationsLoading,
        refreshIntegrations,
    } = useIntegrationStatus();
    const providers = loadedProviders.length ? loadedProviders : FALLBACK_PROVIDERS;
    const {
        loading: systemStatusLoading,
        refreshSystemStatus,
        systemStatus,
    } = useLocalSystemStatus();
    
    const [showModal, setShowModal] = useState(false);
    const [providerPair, setProviderPair] = useState({
        sourceProvider: DEFAULT_SOURCE_PROVIDER,
        targetProvider: DEFAULT_TARGET_PROVIDER,
    });
    const source = useMemo(() => (
        providers.find((provider) => provider.id === providerPair.sourceProvider)
        || { id: providerPair.sourceProvider, label: getProviderLabel(providerPair.sourceProvider), capabilities: {} }
    ), [providerPair.sourceProvider, providers]);
    const target = useMemo(() => (
        providers.find((provider) => provider.id === providerPair.targetProvider)
        || { id: providerPair.targetProvider, label: getProviderLabel(providerPair.targetProvider), capabilities: {} }
    ), [providerPair.targetProvider, providers]);
    const [sourcePlaylistId, setSourcePlaylistId] = useState('');
    const [sourcePlaylistIds, setSourcePlaylistIds] = useState([]);
    const [transferIds, setTransferIds] = useState([]);
    const {
        playlists: sourcePlaylists,
        summary: sourcePlaylistsSummary,
        loading: sourcePlaylistsLoading,
        error: sourcePlaylistsError,
        refreshPlaylists: refreshSourcePlaylists,
    } = useProviderPlaylists({
        providerId: source.id,
        providerLabel: source.label,
        enabled: Boolean(source.connected && source.capabilities?.listUserPlaylists),
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
        const providerId = params.get('provider');
        const connectionStatus = params.get('status');
        const providerLabel = getProviderLabel(providerId);

        if (tab) setActiveTab(tab);
        if (providerId && connectionStatus === 'connected') toast.success(`${providerLabel} conectado com sucesso.`);
        if (providerId && connectionStatus === 'denied') toast.error(`Conexão com ${providerLabel} cancelada.`);

        if (tab || providerId) {
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

    // Trocar a origem descarta a seleção: IDs de playlist não valem entre plataformas.
    const handleProvidersChange = useCallback((nextPair) => {
        if (nextPair.sourceProvider !== providerPair.sourceProvider) {
            setSourcePlaylistId('');
            setSourcePlaylistIds([]);
        }
        setProviderPair(nextPair);
    }, [providerPair.sourceProvider]);

    const startTransferProcess = useStartTransfer({
        sourceProvider: source.id,
        targetProvider: target.id,
        sourceLabel: source.label,
        targetLabel: target.label,
        sourceReady: Boolean(source.connected),
        targetReady: Boolean(target.connected),
        allowSameProvider: Boolean(source.capabilities?.sameProviderTransfer),
        sourcePlaylistId,
        sourcePlaylistIds,
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
                        providers={providers}
                        source={source}
                        target={target}
                        onProvidersChange={handleProvidersChange}
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
                        sourcePlaylists={sourcePlaylists}
                        sourcePlaylistsSummary={sourcePlaylistsSummary}
                        sourcePlaylistsLoading={sourcePlaylistsLoading}
                        sourcePlaylistsError={sourcePlaylistsError}
                        refreshSourcePlaylists={refreshSourcePlaylists}
                        setActiveTab={setActiveTab}
                    />
                )}

                {activeTab === 'integrations' && (
                    <IntegrationsTab
                        providers={providers}
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
