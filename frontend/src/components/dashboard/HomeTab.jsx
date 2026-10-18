import { translate as text } from '../../i18n';
import { useText } from '../../i18n/useText';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, CircleDashed, Heart, PlayCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useTransferEstimate } from '../../hooks/useTransferEstimate';
import Button from '../ui/Button';
import FadeInPage from '../ui/FadeInPage';
import Modal from '../ui/Modal';
import ProviderIcon from '../ui/ProviderIcon';
import ActiveTransferCard from './home/ActiveTransferCard';
import { ProviderRow } from './home/ProviderRow';
import MigrationSteps from './home/MigrationSteps';
import ProviderPlaylistLinkCard from './home/ProviderPlaylistLinkCard';
import ProviderPlaylistListCard from './home/ProviderPlaylistListCard';
import TransferConfirmModal from './home/TransferConfirmModal';

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

const isBlockedPreviewMessage = (message) => text(message, undefined, 'pt-BR').includes('não permitiu ler as faixas');

// Linha da etapa Conexões: o que a plataforma precisa fazer e se já está pronta.
const ConnectionRow = ({ provider, ready, role, note, onConnect }) => {
    const { t } = useText();
    return <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/15 p-4">
        <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-white/10 bg-black/35">
                <ProviderIcon providerId={provider.id} />
            </span>
            <div className="min-w-0">
                <h2 className="text-lg font-semibold text-white">{t(provider.label)}</h2>
                <p className={`mt-1 inline-flex items-center gap-1.5 text-sm ${ready ? 'text-green-300' : 'text-amber-200'}`}>
                    {ready ? <CheckCircle2 size={15} aria-hidden="true" /> : <CircleDashed size={15} aria-hidden="true" />}
                    {role}: {ready ? t("pronto para usar") : t("precisa de conexão")}.
                </p>
                {note && <p className="mt-1 text-xs leading-5 text-muted">{note}</p>}
            </div>
        </div>
        {!ready && <Button variant="primary" onClick={onConnect} rightIcon={<ArrowRight size={16} />}>{t("Conectar ")}{t(provider.label)}</Button>}
    </div>;
};

const HomeTab = ({
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
    connectionState,
    transfers,
    onResumeTransfer,
    startTransferProcess,
    integrationsLoading,
    systemStatus,
    sourcePlaylists,
    sourcePlaylistsSummary,
    sourcePlaylistsLoading,
    sourcePlaylistsError,
    refreshSourcePlaylists,
    setActiveTab,
    onOpenIntegrations,
    onOpenHistory,
    wizardStep,
    setWizardStep,
    onStartDemo,
    demoLoading,
    demoMode,
    onRestartMigration,
}) => {
    const { t } = useText();
    // Sem conta conectada, plataformas que leem por link (Deezer) mostram o campo de link.
    const listMode = Boolean(source.capabilities?.listUserPlaylists)
        && Boolean(source.connected || !source.capabilities?.readByLink);
    const [trackPreviews, setTrackPreviews] = useState({});
    const [linkPreview, setLinkPreview] = useState(null);
    const [removingPlaylist, setRemovingPlaylist] = useState(null);
    const headingRef = useRef(null);
    const previousStepRef = useRef(wizardStep);
    useEffect(() => {
        if (previousStepRef.current !== wizardStep) headingRef.current?.focus();
        previousStepRef.current = wizardStep;
    }, [wizardStep]);
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
            name: linkPreview?.name || t("Playlist do {{value0}}", { value0: source.label }),
            imageUrl: linkPreview?.imageUrl,
            trackCount: linkPreview?.totalTracks || linkPreview?.tracks?.length || 0,
        }];
    }, [linkPreview, selectedPlaylistIdSet, source.label, sourcePlaylistId, sourcePlaylistIds.length, sourcePlaylists, t]);

    const selectedCount = sourcePlaylistIds.length || (sourcePlaylistId ? 1 : 0);
    const providersReady = Boolean(source.canRead && target.canWrite);
    const readyToTransfer = providersReady && selectedCount > 0;
    const missingProvider = !source.canRead ? source : !target.canWrite ? target : null;

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
            const message = err.response?.data?.message || t("Não foi possível carregar as faixas dessa playlist.");
            const blocked = isBlockedPreviewMessage(message);
            setTrackPreviews((current) => ({
                ...current,
                [playlistId]: emptyPreview({ error: message, blocked }),
            }));
            setSourcePlaylistIds((currentIds) => currentIds.filter((id) => id !== playlistId));
            toast.error(message);
            return { ok: false, blocked, message };
        }
    }, [setSourcePlaylistIds, source.id, t]);

    const loadLinkPreview = useCallback(async () => {
        const playlistId = sourcePlaylistId.trim();
        if (!playlistId) {
            toast.error(t("Cole o link ou ID da playlist do {{value0}}.", { value0: source.label }));
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
            const message = err.response?.data?.message || t("Não foi possível carregar as faixas dessa playlist.");
            setLinkPreview(emptyPreview({ error: message, blocked: true }));
            toast.error(message);
            return { ok: false, message };
        }
    }, [source.id, source.label, sourcePlaylistId, t]);

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
            toast.error(currentPreview.error || t("O {{value0}} bloqueou as faixas dessa playlist.", { value0: source.label }));
            return;
        }

        if (!currentPreview || currentPreview.error) {
            const result = await loadTrackPreview(playlistId, { open: false });
            if (!result.ok) return;
        }

        setSourcePlaylistId('');
        setLinkPreview(null);
        setSourcePlaylistIds((currentIds) => (
            currentIds.includes(playlistId) ? currentIds : [...currentIds, playlistId]
        ));
    }, [
        loadTrackPreview,
        selectedPlaylistIdSet,
        setSourcePlaylistId,
        setSourcePlaylistIds,
        source.label,
        trackPreviews, t]);

    // Com busca ativa, seleciona somente as playlists visíveis.
    const selectAllPlaylists = useCallback((visiblePlaylists = sourcePlaylists) => {
        const selectablePlaylists = visiblePlaylists.filter((playlist) => !blockedPlaylistIdSet.has(playlist.id));
        setSourcePlaylistId('');
        setLinkPreview(null);
        setSourcePlaylistIds((currentIds) => [...new Set([...currentIds, ...selectablePlaylists.map((playlist) => playlist.id)])]);

        if (selectablePlaylists.length < visiblePlaylists.length) {
            toast.error(t("Playlists bloqueadas pelo {{value0}} ficaram fora da seleção.", { value0: source.label }));
        }
    }, [blockedPlaylistIdSet, setSourcePlaylistId, setSourcePlaylistIds, source.label, sourcePlaylists, t]);

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

    const importFile = useCallback(async (file) => {
        try {
            const content = await file.text();
            const response = await api.post('/integrations/file/imports', content, {
                params: { filename: file.name },
                headers: { 'Content-Type': 'text/plain' },
            });
            const imported = response.data.data.playlist;
            toast.success(response.data.message);
            await refreshSourcePlaylists({ force: true, silent: true });
            setSourcePlaylistId('');
            setSourcePlaylistIds((currentIds) => [...new Set([...currentIds, imported.id])]);
        } catch (err) {
            toast.error(err.response?.data?.message || t("Não foi possível importar o arquivo."));
        }
    }, [refreshSourcePlaylists, setSourcePlaylistId, setSourcePlaylistIds, t]);

    const deleteImportedPlaylist = useCallback(async (playlistId) => {
        try {
            await api.delete(`/integrations/file/imports/${playlistId}`);
            setSourcePlaylistIds((currentIds) => currentIds.filter((id) => id !== playlistId));
            await refreshSourcePlaylists({ force: true, silent: true });
            toast.success(t("Arquivo removido."));
        } catch (err) {
            toast.error(err.response?.data?.message || t("Não foi possível remover o arquivo."));
        }
    }, [refreshSourcePlaylists, setSourcePlaylistIds, t]);

    const handleManualPlaylistChange = useCallback((event) => {
        setSourcePlaylistIds([]);
        setSourcePlaylistId(event.target.value);
        setLinkPreview(null);
    }, [setSourcePlaylistId, setSourcePlaylistIds]);


    const selectProvider = (id, role) => {
        const next = { sourceProvider: source.id, targetProvider: target.id };
        const other = role === 'sourceProvider' ? 'targetProvider' : 'sourceProvider';
        if (id === next[other] && !providers.find((provider) => provider.id === id)?.capabilities?.sameProviderTransfer) next[other] = next[role];
        next[role] = id;
        onProvidersChange(next);
    };
    const goBack = () => setWizardStep(Math.max(0, wizardStep - 1));
    const openIntegrations = (providerId) => (onOpenIntegrations ? onOpenIntegrations(providerId) : setActiveTab('integrations'));
    const openHistory = (transferId) => (onOpenHistory ? onOpenHistory(transferId) : setActiveTab('history'));
    const experimental = target.validation?.write === 'experimental';
    const titles = [t("De onde vêm suas playlists?"), t("Para onde você quer levar suas músicas?"), t("Vamos preparar suas conexões"), t("Escolha as playlists que quer migrar"), t("Acompanhe sua migração")];
    // No destino, a origem só aparece como opção quando a plataforma aceita o mesmo par (Arquivo).
    const sameProviderBlocked = wizardStep === 1 && !source.capabilities?.sameProviderTransfer;
    const sourceNote = !source.connected && source.canRead && source.capabilities?.listUserPlaylists
        ? t("Sem login, cole o link de uma playlist pública. Conecte a conta para escolher na lista das suas playlists.")
        : null;

    return (
        <FadeInPage className="mx-auto w-full max-w-5xl">
            <MigrationSteps step={wizardStep} onChange={setWizardStep} />
            <div className="mb-7">
                <h1 ref={headingRef} tabIndex={-1} className="max-w-3xl text-3xl font-bold leading-tight text-white sm:text-4xl">{titles[wizardStep]}</h1>
                <p className="mt-3 max-w-2xl text-base leading-7 text-muted">
                    {wizardStep === 0 ? t("Você escolhe o caminho. Nós ajudamos a conectar, copiar e conferir cada música.") : t("{{value0}} para {{value1}}. Suas playlists de origem serão preservadas.", { value0: source.label, value1: target.label })}
                </p>
            </div>
            {demoMode && <p role="status" className="mb-5 rounded-lg border border-sky-400/30 bg-sky-400/10 p-4 text-sm text-sky-100">{t("Demonstração com três músicas fictícias, incluindo uma repetição. Nenhuma conta de música será acessada.")}</p>}
            {experimental && wizardStep > 0 && <p className="mb-5 rounded-lg border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">{t("Escrita no ")}{t(target.label)}{t(" experimental: os testes automatizados usam respostas simuladas. A validação com uma conta real ainda está pendente.")}</p>}

            {wizardStep < 2 && <section className="elevated-card p-5 sm:p-7">
                <ProviderRow showExperimental={wizardStep === 1} title={wizardStep === 0 ? t("Escolha a origem") : t("Escolha o destino")}
                    role={wizardStep === 0 ? 'source' : 'target'}
                    providers={providers.filter((provider) => provider.capabilities?.[wizardStep === 0 ? 'read' : 'write'] !== false)}
                    selectedId={wizardStep === 0 ? source.id : target.id}
                    disabledIds={sameProviderBlocked ? [source.id] : []} disabledReason="escolhida como origem"
                    onSelect={(id) => selectProvider(id, wizardStep === 0 ? 'sourceProvider' : 'targetProvider')} />
                <div className="mt-6 flex flex-wrap justify-between gap-3">
                    {wizardStep > 0 ? <Button onClick={goBack} leftIcon={<ArrowLeft size={16} />}>{t("Voltar")}</Button>
                        : <Button onClick={onStartDemo} loading={demoLoading} loadingLabel={t("Carregando exemplo...")} disabled={integrationsLoading} leftIcon={<PlayCircle size={18} />}>{t("Experimentar sem contas")}</Button>}
                    <Button variant="primary" disabled={integrationsLoading} onClick={() => setWizardStep(wizardStep + 1)} rightIcon={<ArrowRight size={16} />}>{t("Continuar")}</Button>
                </div>
            </section>}

            {wizardStep === 2 && <section className="elevated-card space-y-5 p-5 sm:p-7">
                <p className="text-muted">{t("Só precisamos preparar as duas plataformas escolhidas.")}</p>
                <ConnectionRow provider={source} ready={Boolean(source.canRead)} role={t("Ler playlists")} note={sourceNote} onConnect={() => openIntegrations(source.id)} />
                <ConnectionRow provider={target} ready={Boolean(target.canWrite)} role={t("Criar a saída")} onConnect={() => openIntegrations(target.id)} />
                {systemStatus?.backend?.status === 'offline' && <p role="alert" className="text-amber-200">{t("O aplicativo local não respondeu. Abra Ajuda para conferir como iniciar.")}</p>}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <Button onClick={goBack} leftIcon={<ArrowLeft size={16} />}>{t("Voltar")}</Button>
                    <div className="flex flex-wrap items-center justify-end gap-3">
                        {!providersReady && missingProvider && <p className="text-sm text-muted">{t("Conecte o {{value0}} para continuar.", { value0: t(missingProvider.label) })}</p>}
                        <Button variant="primary" disabled={!providersReady || integrationsLoading} onClick={() => setWizardStep(3)} rightIcon={<ArrowRight size={16} />}>{t("Escolher playlists")}</Button>
                    </div>
                </div>
            </section>}

            {wizardStep === 3 && <div className="space-y-5">
                {listMode ? <ProviderPlaylistListCard provider={source} connected={Boolean(source.connected)}
                    playlists={sourcePlaylists} playlistsSummary={sourcePlaylistsSummary} playlistsLoading={sourcePlaylistsLoading} playlistsError={sourcePlaylistsError}
                    sourcePlaylistIds={sourcePlaylistIds} selectedPlaylistIdSet={selectedPlaylistIdSet} trackPreviews={trackPreviews}
                    onRefreshPlaylists={() => refreshSourcePlaylists({ force: true })} onSelectAllPlaylists={selectAllPlaylists} onClearSelectedPlaylists={clearSelectedPlaylists}
                    onTogglePlaylist={togglePlaylist} onToggleTrackPreview={toggleTrackPreview} onOpenIntegrations={() => openIntegrations(source.id)}
                    onImportFile={source.auth?.type === 'file' ? importFile : undefined} onDeletePlaylist={source.auth?.type === 'file' ? setRemovingPlaylist : undefined}
                    link={source.capabilities?.readByLink ? { value: sourcePlaylistId, preview: linkPreview, onChange: handleManualPlaylistChange, onPreview: loadLinkPreview } : null} />
                    : <ProviderPlaylistLinkCard source={source} target={target} preview={linkPreview} sourcePlaylistId={sourcePlaylistId}
                        onLoadPreview={loadLinkPreview} onOpenIntegrations={openIntegrations} onPlaylistChange={handleManualPlaylistChange} onReviewTransfer={openTransferModal} />}
                {source.id === 'spotify' && listMode && <p className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-muted">
                    <Heart size={17} aria-hidden="true" className="mt-0.5 shrink-0 text-spotify" />
                    <span>{t("Suas Músicas Curtidas não aparecem como playlist. No app do Spotify, abra Músicas Curtidas, selecione todas (Ctrl+A ou Cmd+A), adicione a uma nova playlist e atualize esta lista.")}</span>
                </p>}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <Button onClick={goBack} leftIcon={<ArrowLeft size={16} />}>{t("Voltar")}</Button>
                    <p role="status" className="text-sm text-muted">{selectedCount} {selectedCount === 1 ? t("playlist selecionada") : t("playlists selecionadas")}</p>
                    <div className="flex flex-wrap items-center justify-end gap-3">
                        {selectedCount > 0 && missingProvider && <Button variant="secondary" onClick={() => openIntegrations(missingProvider.id)}>{t("Conectar ")}{t(missingProvider.label)}</Button>}
                        <Button variant="primary" disabled={!readyToTransfer || isTransferring} onClick={openTransferModal} rightIcon={<ArrowRight size={16} />}>{t("Conferir e migrar")}</Button>
                    </div>
                </div>
            </div>}

            {wizardStep === 4 && <div className="space-y-5">
                <ActiveTransferCard connectionState={connectionState} isTransferring={isTransferring} progress={progress} progressMessage={progressMessage} transfers={transfers}
                    onResume={onResumeTransfer} onOpenIntegrations={openIntegrations} onOpenHistory={openHistory} />
                <div className="flex flex-wrap gap-3">
                    <Button variant={isTransferring ? 'secondary' : 'primary'} onClick={() => openHistory(transfers.length === 1 ? transfers[0].transferId : null)}>{t("Ver resultado e baixar relatório")}</Button>
                    <Button onClick={() => (onRestartMigration ? onRestartMigration() : setWizardStep(0))}>{t("Migrar outra playlist")}</Button>
                </div>
            </div>}
            {transfers.length > 0 && wizardStep !== 4 && <Button className="mt-5" onClick={() => setWizardStep(4)}>{t("Acompanhar minhas transferências")}</Button>}
            <p className="mt-6 text-sm leading-6 text-muted">{t("Precisa de orientação? ")}<button type="button" className="font-semibold text-white underline underline-offset-4" onClick={() => setActiveTab('settings')}>{t("Abrir ajuda")}</button>{t(". Seus dados ficam neste computador.")}</p>
            <Modal isOpen={Boolean(removingPlaylist)} onClose={() => setRemovingPlaylist(null)} title={t("Remover o arquivo importado?")} size="sm"
                description={t("A playlist será removida da lista local de importações. Exportações e playlists nas plataformas serão preservadas.")}
                footer={<Button variant="danger" onClick={async () => { await deleteImportedPlaylist(removingPlaylist); setRemovingPlaylist(null); }}>{t("Remover importação")}</Button>} />
            <TransferConfirmModal isOpen={showModal} onClose={() => setShowModal(false)} sourceLabel={t(source.label)} targetLabel={t(target.label)} targetProvider={target.id}
                playlistUrlExample={source.playlistUrlExample} allowLink={false} selectedPlaylists={selectedPlaylists} sourcePlaylistId={sourcePlaylistId}
                onManualPlaylistChange={handleManualPlaylistChange} onStartTransfer={startTransferProcess} selectedCount={selectedCount} isTransferring={isTransferring} estimate={transferEstimate} />
        </FadeInPage>
    );
};
export default HomeTab;
