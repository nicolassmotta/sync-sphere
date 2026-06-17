import { useEffect, useState } from 'react';
import { ArrowRightLeft, History, Search, ExternalLink, ListVideo } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
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

const getDirectionLabel = (item) => (
    item.direction === 'youtube_to_spotify' ? 'YouTube -> Spotify' : 'Spotify -> YouTube'
);

const HistoryTab = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedLog, setSelectedLog] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const response = await api.get('/transfer');
                setHistory(response.data.data.transfers);
            } catch (err) {
                toast.error(err.response?.data?.message || 'Não foi possível carregar o histórico.');
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, []);

    const filteredHistory = history.filter(item => 
        item.playlistName?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusLabel = (status) => {
        if (status === 'completed') return 'Concluída';
        if (status === 'failed') return 'Precisa de atenção';
        return 'Em andamento';
    };

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

            <div className="elevated-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/10 bg-white/5">
                                <th className="p-5 text-xs font-bold uppercase text-white/45">Playlist</th>
                                <th className="p-5 text-xs font-bold uppercase text-white/45">Direção</th>
                                <th className="p-5 text-xs font-bold uppercase text-white/45">Status</th>
                                <th className="p-5 text-xs font-bold uppercase text-white/45">Músicas <span className="text-[10px] lowercase text-gray-500">(total / pendentes)</span></th>
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
                                    <td className="p-5"><StatusBadge status={item.status} /></td>
                                    <td className="p-5 font-medium text-gray-300">
                                        {item.totalTracks} <span className="text-gray-600 px-1">/</span> <span className={item.errors?.length > 0 ? "text-red-400" : "text-green-400"}>{item.errors?.length || 0}</span>
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
                description={selectedLog ? `${selectedLog.processedTracks}/${selectedLog.totalTracks} faixas processadas - ${formatDate(selectedLog.updatedAt)}` : ''}
                footer={selectedLog && (
                    <>
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
                {selectedLog && (
                    <div className="h-64 overflow-y-auto rounded-lg border border-white/10 bg-black/60 p-4 text-sm leading-relaxed text-gray-300">
                        <div className="text-spotify mb-2">Situação: {getStatusLabel(selectedLog.status)}</div>
                        <div className="mb-2">Resumo: {selectedLog.lastMessage || 'Nenhuma observação registrada.'}</div>
                        {selectedLog.targetPlaylistUrl && (
                            <div className="text-spotify mb-2">Playlist criada: {selectedLog.targetPlaylistUrl}</div>
                        )}
                        {selectedLog.targetPlaylistDescription && (
                            <div className="mb-2">Descrição: {selectedLog.targetPlaylistDescription}</div>
                        )}
                        {selectedLog.targetPlaylistImageUrl && (
                            <div className={selectedLog.targetPlaylistImageSynced ? 'text-spotify mb-2' : 'text-yellow-300 mb-2'}>
                                Capa: {selectedLog.targetPlaylistImageSynced ? 'Capa copiada para o YouTube.' : 'Capa original salva, mas ainda não confirmada no YouTube.'}
                            </div>
                        )}
                        {selectedLog.errors?.map((item, index) => (
                            <div key={`${item.trackName}-${index}`} className="text-red-400 mb-2">
                                Atenção: {item.trackName} - {item.artistName}: {item.reason}
                            </div>
                        ))}
                        {!selectedLog.errors?.length && (
                            <div className="text-gray-500">Todas as músicas foram encontradas.</div>
                        )}
                    </div>
                )}
            </Modal>
        </FadeInPage>
    );
};

export default HistoryTab;
