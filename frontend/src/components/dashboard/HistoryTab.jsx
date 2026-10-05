import { safeExternalUrl } from '../../utils/safeExternalUrl';
import { currentLocale } from '../../i18n';
import { useText } from '../../i18n/useText';
import { translate as text } from '../../i18n/index';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    AlertTriangle,
    CheckCircle2,
    ArrowRightLeft,
    ExternalLink,
    History,
    ListVideo,
    MinusCircle,
    RotateCw,
    Search,
    XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { downloadFile, getDownloadError } from '../../utils/downloadFile';
import api, { resolveApiUrl } from '../../services/api';
import { FILE_EXPORT_FORMATS, getProviderLabel, getTransferProviders } from '../../constants/providers';
import { cn } from '../../utils/cn';
import { formatTime } from '../../utils/formatDuration';
import Button from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import FadeInPage from '../ui/FadeInPage';
import LoadingState from '../ui/LoadingState';
import Modal from '../ui/Modal';
import StatusBadge from '../ui/StatusBadge';
import TextField from '../ui/TextField';
import ManualTrackReview from './ManualTrackReview';
import TransferResultSummary from './TransferResultSummary';
import { filterHistory, getDisplayPendingCount, getInsertedCount, getPendingCount, HISTORY_FILTERS, isActiveTransfer } from './historyPresentation';

const formatDate = (date) => {
    if (!date || !Number.isFinite(new Date(date).getTime())) return text("Data indisponível");
    return new Intl.DateTimeFormat(currentLocale(), {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(date));
};

const getDirectionLabel = (item) => {
    const { sourceProvider, targetProvider } = getTransferProviders(item);
    return `${getProviderLabel(sourceProvider)} -> ${getProviderLabel(targetProvider)}`;
};

const getStatusLabel = (item) => {
    if (item.status === 'completed' && (getPendingCount(item) || item.needsReviewCount)) return text("Concluída com pendências");
    if (item.status === 'completed' && item.notFoundCount > 0) return text("Concluída com músicas não encontradas");
    if (item.status === 'completed') return text("Concluída");
    if (item.status === 'failed') return text("Precisa de atenção");
    if (item.status === 'paused') return text('Pausada');
    if (item.status === 'needs_auth') return text("Aguardando reconexão");
    if (item.status === 'pending') return text("Na fila");
    return text("Em andamento");
};

const TransferStatusBadge = ({ item }) => {
    const { t } = useText();
    return item.status === 'completed' && (getPendingCount(item) || item.notFoundCount > 0 || item.needsReviewCount > 0 || item.sourceTruncated)
        ? <StatusBadge status="completed" label={t("Revisar resultado")} tone="warning" />
        : <StatusBadge status={item.status} />;
};

const canRetry = (item) => !item.sourceTruncated && ['failed', 'completed'].includes(item.status) && (getPendingCount(item) > 0
    || (item.status === 'failed' && item.matchedCount == null && item.analyzedCount == null));

const DETAIL_TABS = [
    { id: 'pending', label: 'Pendências', statuses: ['failed', 'retry_queued', 'matched', 'needs_review'] },
    { id: 'not_found', label: 'Não encontradas', statuses: ['not_found'] },
    { id: 'inserted', label: 'Adicionadas', statuses: ['matched'] },
    { id: 'skipped', label: 'Ignoradas', statuses: ['skipped'] },
];

// Transferências antigas não têm estado por faixa: usa o `errors` legado.
const legacyTracks = (item) => (item.errors || []).map((error, index) => ({
    index: error.index ?? index,
    name: error.trackName,
    artist: error.artistName,
    lastError: error.reason,
    status: error.status || (error.reason?.includes(text("Nenhum resultado")) ? 'not_found' : 'failed'),
}));

const TransferDetails = ({ item, onQueued }) => {
    const { t } = useText();
    const [tracks, setTracks] = useState(null);
    const [activeTab, setActiveTab] = useState('pending');
    const [reviewing, setReviewing] = useState(null);
    const [corrections, setCorrections] = useState({});
    const [selections, setSelections] = useState({});
    const [copySummary, setCopySummary] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [showBatchSummary, setShowBatchSummary] = useState(false);
    const [hasTrackStore, setHasTrackStore] = useState(false);
    const [downloading, setDownloading] = useState(null);
    const [trackError, setTrackError] = useState('');
    const [trackAttempt, setTrackAttempt] = useState(0);
    const createCopy = async () => {
        setConfirming(true);
        try {
            const response = await api.post(`/transfer/${item._id}/ordered-copy`, { choices: Object.values(corrections).map(({ trackIndex, candidateId, revision }) => ({ trackIndex, candidateId, revision })) });
            onQueued(response.data);
        } catch (error) { setTrackError(error.response?.data?.message || t('Não foi possível criar a cópia.')); }
        finally { setConfirming(false); }
    };
    const forgetChoice = async (track) => {
        try {
            await api.delete(`/transfer/${item._id}/tracks/${track.index}/choice`);
            toast.success(t('Escolha esquecida para futuras transferências.'));
        } catch (error) { setTrackError(error.response?.data?.message || t('Não foi possível esquecer a escolha.')); }
    };
    const confirmBatch = async () => {
        setConfirming(true);
        setTrackError('');
        try {
            const response = await api.post(`/transfer/${item._id}/review`, { choices: Object.values(selections).map(({ trackIndex, action, candidateId, revision }) => ({ trackIndex, action, ...(action === 'choose' ? { candidateId, revision } : {}) })) });
            onQueued(response.data);
        } catch (error) { setTrackError(error.response?.data?.message || t('Não foi possível confirmar a escolha.')); }
        finally { setConfirming(false); }
    };
    const downloadReport = async (format) => {
        setDownloading(format);
        try {
            const response = await api.get(`/transfer/${item._id}/report`, { params: { format }, responseType: 'blob' });
            downloadFile(response.data, `syncsphere-relatorio.${format}`);
        } catch (error) { toast.error(await getDownloadError(error, t("Não foi possível baixar o relatório."))); }
        finally { setDownloading(null); }
    };

    useEffect(() => {
        let cancelled = false;
        setTracks(null);
        setReviewing(null);
        setHasTrackStore(false);
        setTrackError('');

        api.get(`/transfer/${item._id}/tracks`, { params: { status: 'failed,retry_queued,not_found,needs_review,matched,skipped' } })
            .then((response) => {
                if (cancelled) return;
                const loaded = response.data.data.tracks || [];
                setHasTrackStore(Boolean(response.data.data.counts?.total));
                const resolved = loaded.length || response.data.data.counts?.total ? loaded : legacyTracks(item);
                setTracks(resolved);
                setActiveTab(resolved.some((track) => ['failed', 'retry_queued', 'needs_review'].includes(track.status) || (track.status === 'matched' && !track.inserted))
                    ? 'pending' : resolved.some((track) => track.status === 'not_found') ? 'not_found'
                        : resolved.some((track) => track.inserted) ? 'inserted' : resolved.some((track) => track.status === 'skipped') ? 'skipped' : 'pending');
            })
            .catch((error) => {
                if (!cancelled) setTrackError(error.response?.data?.message || t("Não foi possível carregar as faixas deste relatório."));
            });

        return () => {
            cancelled = true;
        };
    }, [item, trackAttempt, t]);

    const tab = DETAIL_TABS.find((candidate) => candidate.id === activeTab);
    const visibleTracks = (tracks || []).filter((track) => tab.statuses.includes(track.status) && (tab.id === 'inserted' ? track.inserted : !(track.status === 'matched' && track.inserted)));
    const canReview = hasTrackStore && ['completed', 'failed'].includes(item.status)
        && getTransferProviders(item).targetProvider !== 'file';
    const hasAdvancedOptions = ['completed', 'failed'].includes(item.status) && Boolean(item.targetPlaylistId);

    if (reviewing) return (
        <ManualTrackReview transferId={item._id} track={reviewing}
            providerLabel={getProviderLabel(getTransferProviders(item).targetProvider)}
            onBack={() => setReviewing(null)} onQueued={onQueued}
            selection={(reviewing.inserted ? corrections : selections)[reviewing.index]} correction={reviewing.inserted}
            onSelect={(choice, candidate) => {
                const selected = { ...choice, preview: candidate };
                if (reviewing.inserted) { setCorrections((previous) => ({ ...previous, [choice.trackIndex]: selected })); setCopySummary(true); }
                else setSelections((previous) => ({ ...previous, [choice.trackIndex]: selected }));
                setShowBatchSummary(false);
            }} />
    );

    return (
        <div className="space-y-4 text-sm leading-relaxed text-gray-300">
            <TransferResultSummary item={item} />
            <details className="rounded-lg border border-white/10 bg-black/30 p-4">
                <summary className="cursor-pointer font-semibold text-white focus-visible:outline-spotify">{t('Detalhes da migração')}</summary>
                <div className="mt-3 break-words">
                    <div className="mb-2 text-muted">{t("Situação: ")}{getStatusLabel(item)}</div>
                    <div className="mb-2">{t("Resumo: ")}{t(item.lastMessage) || t("Nenhuma observação registrada.")}</div>
                    {item.status === 'paused' && item.resumeAt && (
                        <div className="mb-2 text-yellow-300">{t("Retomada automática às ")}{formatTime(item.resumeAt)}.</div>
                    )}
                    {item.targetPlaylistUrl && getTransferProviders(item).targetProvider !== 'file' && (
                        <div className="mb-2 text-spotify">{t("Playlist criada: ")}{item.targetPlaylistUrl}</div>
                    )}
                    {item.targetPlaylistDescription && (
                        <div>{t("Descrição: ")}{item.targetPlaylistDescription}</div>
                    )}
                    <p className="mt-2">{t('Falhas técnicas')}: {item.failedCount || 0}</p>
                </div>
            </details>
            {Object.keys(selections).length > 0 ? (
                <div className="space-y-3 rounded-lg border border-spotify/30 p-4">
                    <p>{t('Escolhas selecionadas')}: {Object.keys(selections).length}</p>
                    {showBatchSummary ? <><ul className="space-y-3">{Object.values(selections).map((choice) => <li key={choice.trackIndex} className="flex items-start justify-between gap-3 rounded-lg bg-black/30 p-3">
                        <div className="min-w-0 break-words"><p className="font-semibold text-white">{choice.trackIndex + 1}. {(tracks || []).find((track) => track.index === choice.trackIndex)?.name}</p>
                            <p className="mt-1 text-muted">{choice.action === 'skip' ? t('Ignorada') : `${choice.preview?.name || t('Alternativa selecionada')} · ${choice.preview?.artist || ''}`}</p>
                            {choice.preview?.album ? <p className="text-xs text-muted">{choice.preview.album}</p> : null}
                        </div>
                        <Button variant="ghost" size="sm" disabled={confirming} aria-label={t('Remover escolha da faixa {{value0}}', { value0: choice.trackIndex + 1 })} onClick={() => setSelections((previous) => {
                            const next = { ...previous }; delete next[choice.trackIndex]; return next;
                        })}>{t('Remover escolha')}</Button>
                    </li>)}</ul>
                        <p>{t('As escolhas confirmadas serão adicionadas ao fim da playlist.')}</p>
                        <div className="flex flex-wrap gap-2"><Button variant="primary" onClick={confirmBatch} loading={confirming} loadingLabel={t('Confirmando...')}>{t('Confirmar escolhas')}</Button>
                            <Button disabled={confirming} onClick={() => setShowBatchSummary(false)}>{t('Continuar revisando')}</Button></div></>
                        : <Button onClick={() => setShowBatchSummary(true)}>{t('Revisar escolhas antes de confirmar')}</Button>}
                </div>
            ) : null}
            {item.targetPlaylistId && getTransferProviders(item).targetProvider === 'file' && (
                <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-spotify">{t("Baixar arquivo:")}</span>
                    {FILE_EXPORT_FORMATS.map(({ format, label }) => (
                        <a
                            key={format}
                            href={resolveApiUrl(`/api/v1/integrations/file/exports/${item.targetPlaylistId}/download?format=${format}`)}
                            className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-extrabold text-white hover:bg-white/15"
                        >
                            {t(label)}
                        </a>
                    ))}
                </div>
            )}
            <div className="flex flex-wrap gap-2">
                <Button size="sm" loading={downloading === 'csv'} disabled={Boolean(downloading)} onClick={() => downloadReport('csv')}>{t("Baixar relatório CSV")}</Button>
                <Button size="sm" loading={downloading === 'json'} disabled={Boolean(downloading)} onClick={() => downloadReport('json')}>{t("Baixar relatório JSON")}</Button>
            </div>
            <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("Situação das músicas")}>
                {DETAIL_TABS.map((candidate) => {
                    const count = (tracks || []).filter((track) => candidate.statuses.includes(track.status) && (candidate.id === 'inserted' ? track.inserted : !(track.status === 'matched' && track.inserted))).length;
                    return (
                        <button
                            key={candidate.id}
                            type="button"
                            role="tab"
                            id={`track-tab-${candidate.id}`}
                            aria-controls="track-details-panel"
                            aria-selected={activeTab === candidate.id}
                            tabIndex={activeTab === candidate.id ? 0 : -1}
                            onKeyDown={(event) => {
                                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                                event.preventDefault();
                                const current = DETAIL_TABS.findIndex((entry) => entry.id === candidate.id);
                                const next = event.key === 'Home' ? 0 : event.key === 'End' ? DETAIL_TABS.length - 1
                                    : (current + (event.key === 'ArrowRight' ? 1 : -1) + DETAIL_TABS.length) % DETAIL_TABS.length;
                                setActiveTab(DETAIL_TABS[next].id);
                                document.getElementById(`track-tab-${DETAIL_TABS[next].id}`)?.focus();
                            }}
                            onClick={() => setActiveTab(candidate.id)}
                            className={cn(
                                'rounded-lg border px-3 py-2 text-xs font-extrabold transition-colors',
                                activeTab === candidate.id
                                    ? 'border-spotify/40 bg-spotify/10 text-spotify'
                                    : 'border-white/10 bg-white/[0.04] text-white/60 hover:text-white'
                            )}
                        >
                            {t(candidate.label)} ({count})
                        </button>
                    );
                })}
            </div>

            <div id="track-details-panel" role="tabpanel" aria-labelledby={`track-tab-${activeTab}`} className="rounded-lg border border-white/10 bg-black/30 p-3">
                {trackError && <div role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 p-4">
                    <p>{t(trackError)}</p>
                    <Button className="mt-3" size="sm" variant="secondary" onClick={() => setTrackAttempt((attempt) => attempt + 1)}>{t("Tentar carregar as faixas novamente")}</Button>
                </div>}
                {tracks === null && !trackError && <LoadingState label={t("Carregando faixas...")} />}
                {tracks !== null && visibleTracks.length === 0 && (
                    <p className="p-2 text-gray-400">
                        {activeTab === 'pending' ? t("Nenhuma faixa pendente.") : activeTab === 'not_found' ? t("Todas as faixas foram encontradas.") : t('Nenhuma faixa nesta situação.')}
                    </p>
                )}
                {visibleTracks.map((track) => (
                    <div key={`${track.index}-${track.name}`} className="flex flex-wrap items-start gap-3 border-b border-white/10 px-2 py-4 last:border-0">
                        {track.inserted
                            ? <CheckCircle2 size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-green-300" /> : track.status === 'not_found'
                            ? <XCircle size={15} className="mt-0.5 shrink-0 text-yellow-300" />
                            : track.status === 'skipped' ? <MinusCircle aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-muted" />
                                : <AlertTriangle aria-hidden="true" size={18} className={cn('mt-0.5 shrink-0', track.status === 'needs_review' ? 'text-amber-200' : 'text-red-400')} />}
                        <div className="min-w-0 flex-1">
                            <p className="break-words font-semibold text-white">{track.index + 1}. {track.name}</p>
                            <p className="break-words text-sm text-muted">{track.artist}</p>
                            {selections[track.index] ? <p className="text-xs text-spotify">{t('Escolha aguardando confirmação')}</p> : null}
                            <p className="text-xs text-muted">{track.inserted ? t('Inserção confirmada no destino.') : track.status === 'matched' ? t("Correspondência preservada. Aguardando inserção no destino.") : t(track.lastError)}</p>
                        </div>
                        {canReview && ['not_found', 'needs_review', 'failed'].includes(track.status) && !track.inserted && (
                            <Button variant="secondary" size="sm" className="max-sm:ml-7" onClick={() => setReviewing(track)}>{t("Escolher alternativa")}</Button>
                        )}
                    </div>
                ))}
            </div>
            {hasAdvancedOptions && <details open={copySummary || undefined} className="rounded-lg border border-white/10 p-4">
                <summary className="cursor-pointer font-semibold text-white focus-visible:outline-spotify">{t('Correções e preferências')}</summary>
                <div className="mt-4 space-y-5">
                    {(tracks || []).some((track) => track.inserted && ['manual', 'manual_cache'].includes(track.matchSource)) ? (
                        <div className="space-y-2"><p>{t('Escolhas manuais reaproveitáveis')}</p>
                            {(tracks || []).filter((track) => track.inserted && ['manual', 'manual_cache'].includes(track.matchSource)).map((track) => (
                                <div key={track.index} className="flex flex-wrap items-center gap-3"><span>{track.name}</span>
                                    <Button variant="secondary" size="sm" onClick={() => forgetChoice(track)}>{t('Esquecer escolha futura')}</Button></div>
                            ))}
                        </div>
                    ) : null}
                    {canReview && (tracks || []).some((track) => track.inserted) ? (
                        <details><summary>{t('Corrigir faixas em uma nova playlist')}</summary>
                            <p className="my-2">{t('A correção afeta somente a cópia. A playlist atual será preservada.')}</p>
                            {(tracks || []).filter((track) => track.inserted).map((track) => (
                                <div key={track.index} className="my-2 flex flex-wrap items-center gap-3"><span>{track.index + 1}. {track.name}</span>
                                    <Button variant="secondary" size="sm" onClick={() => setReviewing(track)}>{t('Escolher correção')}</Button></div>
                            ))}
                        </details>
                    ) : null}
                    {['completed', 'failed'].includes(item.status) && item.targetPlaylistId ? (
                        <div className="space-y-2">
                            {copySummary ? <><p>{t('Criar uma nova playlist com as faixas resolvidas na ordem da origem? A playlist atual será preservada. Resolva ou ignore todas as pendências primeiro.')}</p>
                                <ul className="space-y-2">{Object.values(corrections).map((choice) => <li key={choice.trackIndex} className="break-words rounded-lg bg-black/30 p-3">
                                    <p className="font-semibold">{choice.trackIndex + 1}. {(tracks || []).find((track) => track.index === choice.trackIndex)?.name}</p>
                                    <p className="mt-1 text-muted">{choice.preview?.name || t('Alternativa selecionada')} · {choice.preview?.artist}</p>
                                    {choice.preview?.album ? <p className="text-xs text-muted">{choice.preview.album}</p> : null}
                                </li>)}</ul>
                                <Button onClick={createCopy} loading={confirming} disabled={getDisplayPendingCount(item) > 0 || item.notFoundCount > 0 || !tracks || tracks.some((track) => !track.inserted && track.status !== 'skipped')}>{t('Confirmar nova playlist')}</Button></>
                                : <Button variant="secondary" onClick={() => setCopySummary(true)}>{t('Criar cópia na ordem da origem')}</Button>}
                        </div>
                    ) : null}
                    <p className="text-xs text-muted">{t('A correção afeta somente a cópia. A playlist atual será preservada.')}</p>
                </div>
            </details>}
            {activeTab === 'pending' && visibleTracks.length > 0 && !showBatchSummary && (
                <p className="text-xs text-muted">{t('As escolhas confirmadas serão adicionadas ao fim da playlist.')}</p>
            )}
        </div>
    );
};

const HistoryTab = ({ onTransfersQueued }) => {
    const { t } = useText();
    const [searchTerm, setSearchTerm] = useState('');
    const [historyFilter, setHistoryFilter] = useState('all');
    const [selectedLog, setSelectedLog] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [retrying, setRetrying] = useState(null);
    const [historyError, setHistoryError] = useState('');
    const requestRef = useRef(null);

    const fetchHistory = useCallback(async () => {
        requestRef.current?.abort();
        const controller = new AbortController();
        requestRef.current = controller;
        setLoading(true);
        setHistoryError('');
        try {
            const response = await api.get('/transfer', { signal: controller.signal });
            if (!controller.signal.aborted) {
                const transfers = response.data.data.transfers;
                setHistory(transfers);
                setSelectedLog((previous) => previous ? transfers.find((item) => item._id === previous._id) || previous : null);
            }
        } catch (err) {
            if (!controller.signal.aborted) setHistoryError(err.response?.data?.message || t("Não foi possível carregar o histórico."));
        } finally {
            if (!controller.signal.aborted) setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        fetchHistory();
        return () => requestRef.current?.abort();
    }, [fetchHistory]);

    const retryTransfer = useCallback(async (item) => {
        setRetrying(item._id);
        try {
            const response = await api.post(`/transfer/${item._id}/retry`);
            toast.success(response.data.message);
            onTransfersQueued?.([item._id]);
            setSelectedLog(null);
            await fetchHistory();
        } catch (err) {
            toast.error(err.response?.data?.message || t("Não foi possível tentar de novo."));
        } finally {
            setRetrying(null);
        }
    }, [fetchHistory, onTransfersQueued, t]);

    const retryAll = useCallback(async () => {
        setRetrying('all');
        const pendingIds = history.filter(canRetry).map((item) => item._id);
        try {
            const response = await api.post('/transfer/retry-all');
            toast.success(response.data.message);
            if (response.data.data.requeuedTransfers) onTransfersQueued?.(pendingIds);
            await fetchHistory();
        } catch (err) {
            toast.error(err.response?.data?.message || t("Não foi possível tentar de novo."));
        } finally {
            setRetrying(null);
        }
    }, [fetchHistory, history, onTransfersQueued, t]);

    const handleReviewQueued = (response) => {
        toast.success(response.message);
        onTransfersQueued?.([response.data.transfer._id]);
        setSelectedLog(null);
        fetchHistory();
    };

    const filteredHistory = filterHistory(history, historyFilter, searchTerm);
    const filtered = historyFilter !== 'all' || Boolean(searchTerm.trim());
    const retryableHistory = history.filter(canRetry);
    const totalPending = retryableHistory.reduce((sum, item) => sum + getPendingCount(item), 0);
    const playlistsWithPending = retryableHistory.filter((item) => getPendingCount(item) > 0).length;

    return (
        <FadeInPage className="w-full max-w-6xl mx-auto">
            <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="mb-2 flex items-center gap-3 text-3xl font-bold text-white sm:text-4xl">
                        <History className="text-spotify" aria-hidden="true" />{t(" Histórico de migrações")}</h1>
                    <p className="text-muted">{t("Veja o que já foi migrado e quais músicas precisam de atenção.")}</p>
                </div>

                <div className="flex w-full items-center gap-2 md:w-80">
                    <TextField
                        containerClassName="min-w-0 flex-1"
                        aria-label={t("Buscar playlist")}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        leadingIcon={<Search size={18} className="text-gray-400" />}
                        placeholder={t("Buscar playlist...")}
                    />
                    <Button variant="ghost" aria-label={t('Atualizar histórico')} onClick={fetchHistory} disabled={loading} leftIcon={<RotateCw aria-hidden="true" size={18} />} />
                </div>
            </div>

            {!historyError && history.length > 0 && <div className="mb-6 space-y-3">
                <div role="group" aria-label={t('Filtrar migrações')} className="flex flex-wrap gap-2">
                    {HISTORY_FILTERS.map((filter) => <button key={filter.id} type="button" aria-pressed={historyFilter === filter.id}
                        onClick={() => setHistoryFilter(filter.id)}
                        className={cn('inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-spotify',
                            historyFilter === filter.id ? 'border-spotify/40 bg-spotify/10 text-green-300' : 'border-white/10 text-muted hover:bg-white/5 hover:text-white')}>
                        {t(filter.label)}<span className="rounded bg-white/10 px-1.5 text-xs tabular-nums">{history.filter(filter.matches).length}</span>
                    </button>)}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
                    <p role="status">{t('Mostrando {{value0}} de {{value1}} migrações', { value0: filteredHistory.length, value1: history.length })}</p>
                    {filtered && <button type="button" onClick={() => { setHistoryFilter('all'); setSearchTerm(''); }} className="min-h-11 px-2 text-white underline underline-offset-4 focus-visible:outline-spotify">{t('Limpar filtros')}</button>}
                </div>
            </div>}

            {retryableHistory.length > 0 && !historyError && (
                <div className="mb-6 flex flex-col gap-4 rounded-lg border border-sky-400/20 bg-sky-400/10 p-5 md:flex-row md:items-center md:justify-between">
                    <div>
                        <p className="flex items-center gap-2 text-base font-extrabold text-white">
                            <RotateCw size={18} className="text-sky-300" />
                            {totalPending > 0 ? <>{totalPending} {totalPending === 1 ? t("faixa pendente") : t("faixas pendentes")}{t(" em ")}{playlistsWithPending} {playlistsWithPending === 1 ? 'playlist' : 'playlists'}</> : (retryableHistory.length === 1 ? t("1 playlist pode ser tentada novamente.") : t("{{value0}} playlists podem ser tentadas novamente.", { value0: retryableHistory.length }))}
                        </p>
                        <p className="mt-1 text-sm text-white/65">{t("Inclui falhas de busca e faixas encontradas que ainda aguardam inserção. Tentar de novo preserva as correspondências já resolvidas.")}</p>
                    </div>
                    <Button
                        variant="secondary"
                        leftIcon={<RotateCw size={15} />}
                        onClick={retryAll}
                        loading={retrying === 'all'}
                        loadingLabel={t("Reenfileirando...")}
                    >{t("Tentar todas")}</Button>
                </div>
            )}

            {historyError && <div role="alert" className="mb-6 rounded-lg border border-red-400/30 bg-red-400/10 p-5">
                <p className="font-semibold text-white">{t(historyError)}</p>
                <p className="mt-2 text-sm text-muted">{t("Confira se o aplicativo continua aberto e tente carregar novamente. Seus registros não foram apagados.")}</p>
                <Button className="mt-4" variant="secondary" onClick={fetchHistory}>{t("Tentar novamente")}</Button>
            </div>}

            {!historyError && <div className="mb-6 space-y-4 md:hidden">
                {loading ? <LoadingState label={t("Carregando histórico...")} /> : filteredHistory.map((item) => (
                    <article key={item._id} className="elevated-card min-w-0 p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <h2 className="min-w-0 flex-1 break-words text-lg font-bold text-white">{item.playlistName}</h2>
                            <TransferStatusBadge item={item} />
                        </div>
                        <p className="mt-2 text-sm text-muted">{getDirectionLabel(item)}</p>
                        <dl className="my-4 grid grid-cols-2 gap-4 text-sm">
                            <div><dt className="text-muted">{t("Adicionadas")}</dt><dd className="mt-1 text-lg font-semibold tabular-nums text-green-300">{getInsertedCount(item)}</dd></div>
                            <div><dt className="text-muted">{t("Total")}</dt><dd className="mt-1 text-lg font-semibold tabular-nums text-white">{item.totalTracks}</dd></div>
                            <div><dt className="text-muted">{t("Pendentes")}</dt><dd className="mt-1 text-lg font-semibold tabular-nums text-sky-300">{getDisplayPendingCount(item)}</dd></div>
                            <div><dt className="text-muted">{t("Não encontradas")}</dt><dd className="mt-1 text-lg font-semibold tabular-nums text-amber-200">{item.notFoundCount || 0}</dd></div>
                        </dl>
                        <p className="mb-4 text-xs text-muted">{formatDate(item.createdAt)}</p>
                        <Button fullWidth variant="secondary" onClick={() => setSelectedLog(item)} aria-label={t("Ver detalhes de {{value0}}", { value0: item.playlistName })}>{t("Ver detalhes")}</Button>
                    </article>
                ))}
                {!loading && filteredHistory.length === 0 && <EmptyState title={t(filtered ? 'Nenhuma migração neste filtro.' : 'Nenhuma migração listada.')} description={filtered ? t('Mude o filtro ou busque por outro nome de playlist.') : t("As próximas transferências aparecerão aqui.")} />}
            </div>}

            {!historyError && <div className="elevated-card hidden overflow-hidden md:block">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/10 bg-white/5">
                                <th className="p-5 text-xs font-bold uppercase text-gray-300">{t("Playlist")}</th>
                                <th className="p-5 text-xs font-bold uppercase text-gray-300">{t("Direção")}</th>
                                <th className="p-5 text-xs font-bold uppercase text-gray-300">{t("Status")}</th>
                                <th className="p-5 text-xs font-bold text-gray-300">{t('Músicas adicionadas')}</th>
                                <th className="p-5 text-xs font-bold uppercase text-gray-300">{t("Data")}</th>
                                <th className="p-5 text-right text-xs font-bold uppercase text-gray-300">{t("Ação")}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading && (
                                <tr>
                                    <td colSpan="6" className="p-6">
                                        <LoadingState
                                            label={t("Carregando histórico...")}
                                            description={t("Buscando suas migrações recentes.")}
                                        />
                                    </td>
                                </tr>
                            )}
                            {!loading && filteredHistory.map((item) => (
                                <tr key={item._id} className="hover:bg-white/5 transition-colors group">
                                    <td className="p-5 font-bold text-white flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 transition-colors group-hover:border-spotify/50">
                                            <ListVideo size={18} className="text-gray-300" />
                                        </div>
                                        <span className="min-w-0 max-w-xs break-words">{item.playlistName}</span>
                                    </td>
                                    <td className="p-5">
                                        <span className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.045] px-3 py-2 text-xs font-extrabold text-white/65">
                                            <ArrowRightLeft size={13} className="text-spotify" />
                                            {getDirectionLabel(item)}
                                        </span>
                                    </td>
                                    <td className="p-5"><TransferStatusBadge item={item} /></td>
                                    <td className="p-5 font-medium text-gray-300">
                                        <p className="whitespace-nowrap tabular-nums"><span className="text-green-300">{getInsertedCount(item)}</span><span className="px-1 text-gray-400">/</span>{item.totalTracks}</p>
                                        {getDisplayPendingCount(item) > 0 ? <p className="mt-1 text-xs text-amber-200">{getDisplayPendingCount(item) === 1 ? t('1 pendente') : t('{{value0}} pendentes', { value0: getDisplayPendingCount(item) })}</p> : null}
                                        {item.notFoundCount > 0 ? <p className="mt-1 text-xs text-amber-200">{item.notFoundCount === 1 ? t('1 não encontrada') : t('{{value0}} não encontradas', { value0: item.notFoundCount })}</p> : null}
                                    </td>
                                    <td className="p-5 font-medium text-gray-400 text-sm">{formatDate(item.createdAt)}</td>
                                    <td className="p-5 text-right">
                                        <Button
                                            onClick={() => setSelectedLog(item)}
                                            variant="secondary"
                                            size="sm"
                                            rightIcon={<ExternalLink size={14} />}
                                        >{t("Ver detalhes")}</Button>
                                    </td>
                                </tr>
                            ))}
                            {!loading && filteredHistory.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="p-6">
                                        <EmptyState
                                            icon={<ListVideo size={20} />}
                                            title={t(filtered ? 'Nenhuma migração neste filtro.' : 'Nenhuma migração listada.')}
                                            description={filtered ? t('Mude o filtro ou busque por outro nome de playlist.') : t("As próximas transferências aparecerão aqui.")}
                                        />
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>}

            <Modal
                size="lg"
                isOpen={Boolean(selectedLog)}
                onClose={() => setSelectedLog(null)}
                title={selectedLog ? t("Relatório: {{value0}}", { value0: selectedLog.playlistName }) : ''}
                description={selectedLog ? t("{{value0}}/{{value1}} faixas migradas - {{value2}}", { value0: getInsertedCount(selectedLog), value1: selectedLog.totalTracks, value2: formatDate(selectedLog.updatedAt) }) : ''}
                footer={selectedLog && (
                    <>
                        {isActiveTransfer(selectedLog) && <Button variant="secondary" onClick={fetchHistory} loading={loading} loadingLabel={t('Atualizando...')}>{t('Atualizar resultado')}</Button>}
                        {canRetry(selectedLog) && (
                            <Button
                                variant="secondary"
                                leftIcon={<RotateCw size={15} />}
                                onClick={() => retryTransfer(selectedLog)}
                                loading={retrying === selectedLog._id}
                                loadingLabel={t("Reenfileirando...")}
                            >{t("Tentar de novo")}</Button>
                        )}
                        {safeExternalUrl(resolveApiUrl(selectedLog.targetPlaylistUrl)) && (
                            <a
                                href={safeExternalUrl(resolveApiUrl(selectedLog.targetPlaylistUrl))}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-spotify px-4 py-3 text-sm font-extrabold text-black transition-all hover:bg-spotify/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-spotify focus-visible:ring-offset-2 focus-visible:ring-offset-darkBackground"
                            >{t("Abrir playlist")}</a>
                        )}
                        <Button onClick={() => setSelectedLog(null)} variant="inverse">{t("Fechar")}</Button>
                    </>
                )}
            >
                {selectedLog && <TransferDetails item={selectedLog} onQueued={handleReviewQueued} />}
            </Modal>
        </FadeInPage>
    );
};

export default HistoryTab;
