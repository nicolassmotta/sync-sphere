import { ArrowRight, Link2 } from 'lucide-react';
import Button from '../../ui/Button';
import Modal from '../../ui/Modal';
import TextField from '../../ui/TextField';
import PlaylistArtwork from './PlaylistArtwork';
import { formatTrackCount } from './formatTrackCount';

const TransferConfirmModal = ({
    isOpen,
    onClose,
    selectedPlaylists,
    sourcePlaylistId,
    onManualPlaylistChange,
    onStartTransfer,
    selectedCount,
    isTransferring,
}) => (
    <Modal
        isOpen={isOpen}
        onClose={onClose}
        size="sm"
        title="Confirmar transferência"
        description="Revise a seleção antes de criar as playlists no YouTube."
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

        <p className="mb-4 inline-flex items-center gap-2 text-xs font-bold uppercase text-spotify">
            <Link2 size={14} /> Colar link da playlist
        </p>
        <TextField
            label="Link da playlist no Spotify"
            value={sourcePlaylistId}
            onChange={onManualPlaylistChange}
            placeholder="https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M"
        />
    </Modal>
);

export default TransferConfirmModal;
