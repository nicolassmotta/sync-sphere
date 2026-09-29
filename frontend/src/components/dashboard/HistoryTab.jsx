import { useCallback, useEffect, useState } from 'react';
import {
    AlertTriangle,
    ArrowRightLeft,
    ExternalLink,
    History,
    ListVideo,
    RotateCw,
    Search,
    XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { getProviderLabel, getTransferProviders } from '../../constants/providers';
import { cn } from '../../utils/cn';
import { formatTime } from '../../utils/formatDuration';
import Button from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import FadeInPage from '../ui/FadeInPage';
import LoadingState from '../ui/LoadingState';
import Modal from '../ui/Modal';
import StatusBadge from '../ui/StatusBadge';
import TextField from '../ui/TextField';

const formatDate = (date) => {
    if (!date) return '-';
    return new Intl.DateTimeFormat('pt-BR', {
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

const getPendingCount = (item) => (item.failedCount || 0) + (item.retryQueuedCount || 0);

const getStatusLabel = (item) => {
    if (item.status === 'completed' && getPendingCount(item)) return 'Concluída com pendências';
    if (item.status === 'completed') return 'Concluída';
    if (item.status === 'failed') return 'Precisa de atenção';
    if (item.status === 'paused') return 'Pausada';
    if (item.status === 'needs_auth') return 'Aguardando reconexão';
    if (item.status === 'pending') return 'Na fila';
    return 'Em andamento';
};

const TransferStatusBadge = ({ item }) => (
    item.status === 'completed' && getPendingCount(item)
        ? <StatusBadge status="completed" label="Com pendências" tone="warning" />
        : <StatusBadge status={item.status} />
);

const canRetry = (item) => item.status !== 'processing' && (getPendingCount(item) > 0 || item.status === 'failed');

const DETAIL_TABS = [
    { id: 'pending', label: 'Pendências', statuses: ['failed', 'retry_queued'] },
    { id: 'not_found', label: 'Não encontradas', statuses: ['not_found'] },
];

// Transferências antigas não têm estado por faixa: usa o `errors` legado.
const legacyTracks = (item) => (item.errors || []).map((error, index) => ({
    index: error.index ?? index,
    name: error.trackName,
    artist: error.artistName,
    lastError: error.reason,
    status: error.status || (error.reason?.includes('Nenhum resultado') ? 'not_found' : 'failed'),
}));

const TransferDetails = ({ item }) => {
    const [tracks, setTracks] = useState(null);
    const [activeTab, setActiveTab] = useState('pending');

    useEffect(() => {
        let cancelled = false;
        setTracks(null);

        api.get(`/transfer/${item._id}/tracks`, { params: { status: 'failed,retry_queued,not_found' } })
            .then((response) => {
                if (cancelled) return;
                const loaded = response.data.data.tracks || [];
                setTracks(loaded.length || response.data.data.counts?.total ? loaded : legacyTracks(item));
            })
            .catch(() => {
                if (!cancelled) setTracks(legacyTracks(item));
            });

        return () => {
            cancelled = true;
        };
    }, [item]);

    const tab = DETAIL_TABS.find((candidate) => candidate.id === activeTab);
    const visibleTracks = (tracks || []).filter((track) => tab.statuses.includes(track.status));

    return (
        <div className="space-y-4 text-sm leading-relaxed text-gray-300">
            <div className="rounded-lg border border-white/10 bg-black/60 p-4">
                <div className="mb-2 text-spotify">Situação: {getStatusLabel(item)}</div>
                <div className="mb-2">Resumo: {item.lastMessage || 'Nenhuma observação registrada.'}</div>
                {item.status === 'paused' && item.resumeAt && (
                    <div className="mb-2 text-yellow-300">Retomada automática às {formatTime(item.resumeAt)}.</div>
                )}
                {item.targetPlaylistUrl && (
                    <div className="mb-2 text-spotify">Playlist criada: {item.targetPlaylistUrl}</div>
                )}
                {item.targetPlaylistDescription && (
                    <div>Descrição: {item.targetPlaylistDescription}</div>
                )}
            </div>

            <div className="flex gap-2" role="tablist">
                {DETAIL_TABS.map((candidate) => {
                    const count = (tracks || []).filter((track) => candidate.statuses.includes(track.status)).length;
                    return (
                        <button
                            key={candidate.id}
                            type="button"
                            role="tab"
                            aria-selected={activeTab === candidate.id}
                            onClick={() => setActiveTab(candidate.id)}
                            className={cn(
                                'rounded-lg border px-3 py-2 text-xs font-extrabold transition-colors',
                                activeTab === candidate.id
                                    ? 'border-spotify/40 bg-spotify/10 text-spotify'
                                    : 'border-white/10 bg-white/[0.04] text-white/60 hover:text-white'
                            )}
                        >
                            {candidate.label} ({count})
                        </button>
                    );
                })}
            </div>

            <div className="h-64 overflow-y-auto rounded-lg border border-white/10 bg-black/60 p-3">
                {tracks === null && <LoadingState label="Carregando faixas..." />}
                {tracks !== null && visibleTracks.length === 0 && (
                    <p className="p-2 text-gray-500">
                        {activeTab === 'pending' ? 'Nenhuma faixa pendente.' : 'Todas as faixas foram encontradas.'}
                    </p>
                )}
                {visibleTracks.map((track) => (
                    <div key={`${track.index}-${track.name}`} className="flex items-start gap-2 border-b border-white/5 px-2 py-2 last:border-0">
                        {track.status === 'not_found'
                            ? <XCircle size={15} className="mt-0.5 shrink-0 text-yellow-300" />
                            : <AlertTriangle size={15} className="mt-0.5 shrink-0 text-red-400" />}
                        <div className="min-w-0">
                            <p className="truncate font-bold text-white">{track.name} - {track.artist}</p>
                            <p className="text-xs text-muted">{track.lastError}</p>
                        </div>
                    </div>
                ))}
            </div>
            {activeTab === 'pending' && visibleTracks.length > 0 && (
                <p className="text-xs text-muted">
                    Faixas repetidas com sucesso entram no fim da playlist já criada.
                </p>
            )}
        </div>
    );
};

const HistoryTab = ({ onTransfersQueued }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedLog, setSelectedLog] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [retrying, setRetrying] = useState(null);

    const fetchHistory = useCallback(async () => {
        try {
            const response = await api.get('/transfer');
            setHistory(response.data.data.transfers);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Não foi possível carregar o histórico.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchHistory();
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
            toast.error(err.response?.data?.message || 'Não foi possível tentar de novo.');
        } finally {
            setRetrying(null);
        }
    }, [fetchHistory, onTransfersQueued]);

    const retryAll = useCallback(async () => {
        setRetrying('all');
        const pendingIds = history.filter(canRetry).map((item) => item._id);
        try {
            const response = await api.post('/transfer/retry-all');
            toast.success(response.data.message);
            if (response.data.data.requeuedTransfers) onTransfersQueued?.(pendingIds);
            await fetchHistory();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Não foi possível tentar de novo.');
        } finally {
            setRetrying(null);
        }
    }, [fetchHistory, history, onTransfersQueued]);

    const filteredHistory = history.filter(item =>
        item.playlistName?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const totalPending = history.reduce((sum, item) => sum + getPendingCount(item), 0);
    const playlistsWithPending = history.filter((item) => getPendingCount(item) > 0).length;

    return (
        <FadeInPage className="w-full max-w-6xl mx-auto">
            <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h2 className="mb-2 flex items-center gap-3 text-4xl font-black text-white">
                        <History className="text-spotify" /> Histórico de migrações
                    </h2>
                    <p className="text-muted">Veja o que já foi migrado e quais músicas precisam de atenção.</p>
                </div>

                <div className="w-full md:w-72">
                    <TextField
                        aria-label="Buscar playlist"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        leadingIcon={<Search size={18} className="text-gray-500" />}
                        placeholder="Buscar playlist..."
                    />
                </div>
            </div>

            {totalPending > 0 && (
                <div className="mb-6 flex flex-col gap-4 rounded-lg border border-sky-400/20 bg-sky-400/10 p-5 md:flex-row md:items-center md:justify-between">
                    <div>
                        <p className="flex items-center gap-2 text-base font-extrabold text-white">
                            <RotateCw size={18} className="text-sky-300" />
                            {totalPending} {totalPending === 1 ? 'faixa pendente' : 'faixas pendentes'} em {playlistsWithPending} {playlistsWithPending === 1 ? 'playlist' : 'playlists'}
                        </p>
                        <p className="mt-1 text-sm text-white/65">
                            São faixas que falharam por bloqueio, token expirado ou erro temporário. Nada foi perdido: dá para tentar de novo.
                        </p>
                    </div>
                    <Button
                        variant="secondary"
                        leftIcon={<RotateCw size={15} />}
                        onClick={retryAll}
                        loading={retrying === 'all'}
                        loadingLabel="Reenfileirando..."
                    >
                        Tentar todas
                    </Button>
                </div>
            )}

            <div className="elevated-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/10 bg-white/5">
                                <th className="p-5 text-xs font-bold uppercase text-white/45">Playlist</th>
                                <th className="p-5 text-xs font-bold uppercase text-white/45">Direção</th>
                                <th className="p-5 text-xs font-bold uppercase text-white/45">Status</th>
                                <th className="p-5 text-xs font-bold uppercase text-white/45">Músicas <span className="text-[10px] lowercase text-gray-500">(migradas / total / pendentes)</span></th>
                                <th className="p-5 text-xs font-bold uppercase text-white/45">Data</th>
                                <th className="p-5 text-right text-xs font-bold uppercase text-white/45">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading && (
                                <tr>
                                    <td colSpan="6" className="p-6">
                                        <LoadingState
                                            label="Carregando histórico..."
                                            description="Buscando suas migrações recentes."
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
                                        {item.playlistName}
                                    </td>
                                    <td className="p-5">
                                        <span className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.045] px-3 py-2 text-xs font-extrabold text-white/65">
                                            <ArrowRightLeft size={13} className="text-spotify" />
                                            {getDirectionLabel(item)}
                                        </span>
                                    </td>
                                    <td className="p-5"><TransferStatusBadge item={item} /></td>
                                    <td className="p-5 font-medium text-gray-300">
                                        <span className="text-green-400">{item.matchedCount ?? item.processedTracks ?? 0}</span>
                                        <span className="px-1 text-gray-600">/</span>
                                        {item.totalTracks}
                                        <span className="px-1 text-gray-600">/</span>
                                        <span className={getPendingCount(item) ? 'text-sky-300' : 'text-gray-500'}>{getPendingCount(item)}</span>
                                    </td>
                                    <td className="p-5 font-medium text-gray-400 text-sm">{formatDate(item.createdAt)}</td>
                                    <td className="p-5 text-right">
                                        <Button
                                            onClick={() => setSelectedLog(item)}
                                            variant="secondary"
                                            size="sm"
                                            rightIcon={<ExternalLink size={14} />}
                                        >
                                            Ver detalhes
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                            {!loading && filteredHistory.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="p-6">
                                        <EmptyState
                                            icon={<ListVideo size={20} />}
                                            title="Nenhuma migração listada."
                                            description={searchTerm ? 'Tente outro termo de busca.' : 'As próximas transferências aparecerão aqui.'}
                                        />
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal
                isOpen={Boolean(selectedLog)}
                onClose={() => setSelectedLog(null)}
                title={selectedLog ? `Relatório: ${selectedLog.playlistName}` : ''}
                description={selectedLog ? `${selectedLog.matchedCount ?? selectedLog.processedTracks ?? 0}/${selectedLog.totalTracks} faixas migradas - ${formatDate(selectedLog.updatedAt)}` : ''}
                footer={selectedLog && (
                    <>
                        {canRetry(selectedLog) && (
                            <Button
                                variant="secondary"
                                leftIcon={<RotateCw size={15} />}
                                onClick={() => retryTransfer(selectedLog)}
                                loading={retrying === selectedLog._id}
                                loadingLabel="Reenfileirando..."
                            >
                                Tentar de novo
                            </Button>
                        )}
                        {selectedLog.targetPlaylistUrl && (
                            <a
                                href={selectedLog.targetPlaylistUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-spotify px-4 py-3 text-sm font-extrabold text-black transition-all hover:bg-spotify/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-spotify focus-visible:ring-offset-2 focus-visible:ring-offset-darkBackground"
                            >
                                Abrir playlist
                            </a>
                        )}
                        <Button onClick={() => setSelectedLog(null)} variant="inverse">
                            Fechar
                        </Button>
                    </>
                )}
            >
                {selectedLog && <TransferDetails item={selectedLog} />}
            </Modal>
        </FadeInPage>
    );
};

export default HistoryTab;
