import { useText } from '../../../i18n/useText';
import { ArrowRight, Clock, Link2 } from 'lucide-react';
import Button from '../../ui/Button';
import Modal from '../../ui/Modal';
import TextField from '../../ui/TextField';
import PlaylistArtwork from './PlaylistArtwork';
import { formatTrackCount } from './formatTrackCount';
import { formatEta } from '../../../utils/formatDuration';

const EstimateNotice = ({ estimate, targetLabel }) => {
    const { t } = useText();
    if (!estimate?.trackCount) return null;

    return (
        <div className="mb-5 rounded-lg border border-white/10 bg-black/30 p-3 text-xs font-semibold leading-5 text-white/70">
            <p className="flex items-center gap-2 text-sm font-extrabold text-white">
                <Clock size={15} className="text-spotify" />
                {formatEta(estimate.etaSeconds)}{t(" para ")}{formatTrackCount(estimate.trackCount)}
            </p>
            <p className="mt-1">{Number.isFinite(estimate.tracksPerMinute) && estimate.tracksPerMinute > 0
                ? <>{t("Cerca de ")}{estimate.tracksPerMinute}{t(" faixas por minuto no ")}{targetLabel}{t(", com base nas últimas migrações.")}</>
                : t('Esta é uma estimativa. O tempo pode variar conforme a plataforma e a fila.')}
                {estimate.queueAheadSeconds > 0 && t(" Antes dela, a fila ainda tem {{value0}} de trabalho.", { value0: formatEta(estimate.queueAheadSeconds) })}
            </p>
            <p className="mt-1 text-muted">{t("Se a plataforma limitar as buscas, a migração pausa e conserva o progresso para a retomada.")}</p>
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
}) => {
    const { t } = useText();
    return <Modal
        isOpen={isOpen}
        onClose={onClose}
        size="sm"
        title={t("Confirmar transferência")}
        description={t("Vamos copiar as músicas para {{value0}}. Suas playlists de origem não serão apagadas.", { value0: targetLabel })}
        footer={(
            <Button
                onClick={onStartTransfer}
                variant="primary"
                fullWidth
                disabled={!selectedCount || isTransferring}
                loading={isTransferring}
                loadingLabel={t("Preparando...")}
                rightIcon={<ArrowRight size={18} />}
            >
                {selectedCount ? t("Migrar {{value0}} {{value1}}", { value0: selectedCount, value1: selectedCount === 1 ? 'playlist' : 'playlists' }) : t("Selecione playlists")}
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
        <p className="mb-4 text-sm leading-6 text-muted">{t("O aplicativo copia a lista de músicas, sem baixar arquivos de áudio. Algumas músicas podem não existir no catálogo de destino. Ao terminar, você poderá conferir o resultado e escolher alternativas no Histórico.")}</p>

        {allowLink && (
            <>
                <p className="mb-4 inline-flex items-center gap-2 text-xs font-bold uppercase text-spotify">
                    <Link2 size={14} />{t(" Colar link da playlist")}</p>
                <TextField
                    label={t("Link da playlist no {{value0}}", { value0: sourceLabel })}
                    value={sourcePlaylistId}
                    onChange={onManualPlaylistChange}
                    placeholder={playlistUrlExample || t("Link da playlist")}
                />
            </>
        )}
    </Modal>;
};

export default TransferConfirmModal;
