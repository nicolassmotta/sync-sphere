import { ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import { TRANSFER_DIRECTIONS } from '../../../constants/transferDirections';
import Button from '../../ui/Button';
import { SpotifyIcon, YoutubeIcon } from '../../ui/BrandIcons';

const DestinationCard = ({
    transferDirection,
    spotifyReady,
    youtubeReady,
    selectedCount,
    readyToTransfer,
    onConfigureDestination,
    onReviewTransfer,
}) => {
    const youtubeToSpotify = transferDirection === TRANSFER_DIRECTIONS.YOUTUBE_TO_SPOTIFY;
    const targetLabel = youtubeToSpotify ? 'Spotify' : 'YouTube Music';
    const targetReady = youtubeToSpotify ? spotifyReady : youtubeReady;
    const sourceReady = youtubeToSpotify ? youtubeReady : true;
    const Icon = youtubeToSpotify ? SpotifyIcon : YoutubeIcon;
    const iconClassName = youtubeToSpotify ? 'h-8 w-8 fill-spotify' : 'h-8 w-8 fill-youtube';

    const statusText = !sourceReady
        ? 'Configure YTMUSIC_COOKIE para ler a playlist de origem.'
        : targetReady
            ? `Destino ${targetLabel} pronto para receber playlists privadas.`
            : youtubeToSpotify
                ? 'Conecte o Spotify com OAuth para criar playlists no destino.'
                : 'Configure YTMUSIC_COOKIE no backend/.env, reinicie a API e valide o status.';

    return (
        <div className="elevated-card p-6">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <p className="text-xs font-bold uppercase text-white/40">Destino</p>
                    <h3 className="mt-1 text-xl font-black text-white">{targetLabel}</h3>
                </div>
                <Icon className={iconClassName} />
            </div>

            <div className="rounded-lg border border-white/10 bg-black/30 p-4">
                <div className="mb-4 flex items-center justify-between">
                    <span className="text-sm font-bold text-white/70">Selecionadas</span>
                    <span className={`inline-flex items-center gap-2 text-sm font-extrabold ${readyToTransfer ? 'text-spotify' : 'text-amber-300'}`}>
                        {readyToTransfer ? <CheckCircle2 size={16} /> : <ShieldCheck size={16} />}
                        {selectedCount} {selectedCount === 1 ? 'playlist' : 'playlists'}
                    </span>
                </div>
                <p className="mb-4 text-sm leading-6 text-muted">{statusText}</p>
                <Button
                    onClick={!targetReady || !sourceReady ? onConfigureDestination : onReviewTransfer}
                    variant={readyToTransfer ? 'primary' : 'secondary'}
                    disabled={targetReady && sourceReady && !selectedCount}
                    fullWidth
                    rightIcon={<ArrowRight size={17} />}
                >
                    {readyToTransfer ? 'Revisar e iniciar' : targetReady && sourceReady ? 'Selecione playlists' : 'Ver configuração'}
                </Button>
            </div>
        </div>
    );
};

export default DestinationCard;
