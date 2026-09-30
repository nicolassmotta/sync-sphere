import { ArrowRight, Clock, Link2 } from 'lucide-react';
import Button from '../../ui/Button';
import Modal from '../../ui/Modal';
import TextField from '../../ui/TextField';
import PlaylistArtwork from './PlaylistArtwork';
import { formatTrackCount } from './formatTrackCount';
import { formatEta } from '../../../utils/formatDuration';

const EstimateNotice = ({ estimate, targetLabel }) => {
    if (!estimate?.trackCount) return null;

    return (
        <div className="mb-5 rounded-lg border border-white/10 bg-black/30 p-3 text-xs font-semibold leading-5 text-white/70">
            <p className="flex items-center gap-2 text-sm font-extrabold text-white">
                <Clock size={15} className="text-spotify" />
                {formatEta(estimate.etaSeconds)} para {formatTrackCount(estimate.trackCount)}
            </p>
            <p className="mt-1">
                Cerca de {estimate.tracksPerMinute} faixas por minuto no {targetLabel}, com base nas últimas migrações.
                {estimate.queueAheadSeconds > 0 && ` Antes dela, a fila ainda tem ${formatEta(estimate.queueAheadSeconds)} de trabalho.`}
            </p>
            <p className="mt-1 text-muted">
                Se a plataforma limitar as buscas, a migração pausa e conserva o progresso para a retomada.
            </p>
        </div>
    );
};

const TransferConfirmModal = ({
    isOpen,
    onClose,
    sourceLabel,
    targetLabel,
    playlistUrlExample,
    allowLink = true,
    selectedPlaylists,
    sourcePlaylistId,
    onManualPlaylistChange,
    onStartTransfer,
    selectedCount,
    isTransferring,
    estimate,
}) => (
    <Modal
        isOpen={isOpen}
        onClose={onClose}
        size="sm"
        title="Confirmar transferência"
        description={`Revise a seleção antes de criar as playlists no ${targetLabel}.`}
        footer={(
            <Button
                onClick={onStartTransfer}
                variant="primary"
                fullWidth
                disabled={!selectedCount || isTransferring}
                loading={isTransferring}
                loadingLabel="Preparando..."
                rightIcon={<ArrowRight size={18} />}
            >
                {selectedCount ? `Migrar ${selectedCount} ${selectedCount === 1 ? 'playlist' : 'playlists'}` : 'Selecione playlists'}
            </Button>
        )}
    >
        {selectedPlaylists.length > 0 && (
            <div className="mb-5 max-h-52 space-y-2 overflow-y-auto rounded-lg border border-spotify/30 bg-spotify/10 p-3">
                {selectedPlaylists.map((playlist) => (
                    <div key={playlist.id} className="flex items-center gap-3 rounded-lg bg-black/25 p-2">
                        <PlaylistArtwork imageUrl={playlist.imageUrl} name={playlist.name} />
                        <div className="min-w-0">
                            <p className="truncate text-sm font-extrabold text-white">{playlist.name}</p>
                            <p className="text-xs font-semibold text-muted">{formatTrackCount(playlist.trackCount)}</p>
                        </div>
                    </div>
                ))}
            </div>
        )}

        <EstimateNotice estimate={estimate} targetLabel={targetLabel} />

        {allowLink && (
            <>
                <p className="mb-4 inline-flex items-center gap-2 text-xs font-bold uppercase text-spotify">
                    <Link2 size={14} /> Colar link da playlist
                </p>
                <TextField
                    label={`Link da playlist no ${sourceLabel}`}
                    value={sourcePlaylistId}
                    onChange={onManualPlaylistChange}
                    placeholder={playlistUrlExample || 'Link da playlist'}
                />
            </>
        )}
    </Modal>
);

export default TransferConfirmModal;
