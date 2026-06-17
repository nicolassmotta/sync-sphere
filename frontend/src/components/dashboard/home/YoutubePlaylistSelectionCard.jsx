import { ArrowRight, Link2, Loader2, RefreshCw } from 'lucide-react';
import Button from '../../ui/Button';
import TextField from '../../ui/TextField';
import { YoutubeIcon } from '../../ui/BrandIcons';
import PlaylistTrackPreview from './PlaylistTrackPreview';

const YoutubePlaylistSelectionCard = ({
    preview,
    sourcePlaylistId,
    spotifyConnected,
    youtubeReady,
    onLoadPreview,
    onOpenIntegrations,
    onPlaylistChange,
    onReviewTransfer,
}) => {
    const loading = Boolean(preview?.loading);
    const canPreview = Boolean(sourcePlaylistId?.trim()) && youtubeReady && !loading;
    const readyToReview = Boolean(sourcePlaylistId?.trim()) && youtubeReady && spotifyConnected;

    return (
        <div className="elevated-card p-6 lg:p-7">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <p className="text-sm font-bold uppercase text-white/40">Escolha a origem</p>
                    <h2 className="mt-2 text-2xl font-black text-white">Playlist do YouTube Music</h2>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
                        Cole o link ou ID da playlist. A prévia usa o cookie local configurado no back-end.
                    </p>
                </div>
                <div className="grid h-12 w-12 place-items-center rounded-lg border border-youtube/25 bg-youtube/10">
                    <YoutubeIcon className="h-7 w-7 fill-youtube" />
                </div>
            </div>

            {!youtubeReady && (
                <div className="mb-5 rounded-lg border border-youtube/25 bg-youtube/10 p-5">
                    <h3 className="text-lg font-black text-white">Configure o YouTube Music</h3>
                    <p className="mt-2 text-sm leading-6 text-muted">
                        O cookie local permite ler a playlist de origem antes de criar a playlist no Spotify.
                    </p>
                    <Button
                        onClick={onOpenIntegrations}
                        variant="youtube"
                        className="mt-5"
                        rightIcon={<ArrowRight size={16} />}
                    >
                        Abrir integrações
                    </Button>
                </div>
            )}

            {youtubeReady && !spotifyConnected && (
                <div className="mb-5 rounded-lg border border-spotify/25 bg-spotify/10 p-5">
                    <h3 className="text-lg font-black text-white">Conecte o Spotify</h3>
                    <p className="mt-2 text-sm leading-6 text-muted">
                        O OAuth precisa incluir permissão para criar playlists privadas na conta de destino.
                    </p>
                    <Button
                        onClick={onOpenIntegrations}
                        variant="primary"
                        className="mt-5"
                        rightIcon={<ArrowRight size={16} />}
                    >
                        Abrir integrações
                    </Button>
                </div>
            )}

            <div className="space-y-4">
                <TextField
                    label="Link ou ID da playlist no YouTube Music"
                    value={sourcePlaylistId}
                    onChange={onPlaylistChange}
                    leadingIcon={<Link2 size={18} className="text-youtube" />}
                    placeholder="https://music.youtube.com/playlist?list=PL..."
                />

                <div className="flex flex-wrap gap-2">
                    <Button
                        onClick={onLoadPreview}
                        variant="secondary"
                        disabled={!canPreview}
                        leftIcon={loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                    >
                        Pré-visualizar
                    </Button>
                    <Button
                        onClick={onReviewTransfer}
                        variant={readyToReview ? 'primary' : 'secondary'}
                        disabled={!readyToReview}
                        rightIcon={<ArrowRight size={16} />}
                    >
                        Revisar transferência
                    </Button>
                </div>
            </div>

            {preview && (
                <div className="mt-5">
                    <PlaylistTrackPreview preview={preview} />
                </div>
            )}
        </div>
    );
};

export default YoutubePlaylistSelectionCard;
