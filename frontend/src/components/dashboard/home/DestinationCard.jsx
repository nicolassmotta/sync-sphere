import { ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import Button from '../../ui/Button';
import { YoutubeIcon } from '../../ui/BrandIcons';

const DestinationCard = ({
    youtubeReady,
    selectedCount,
    readyToTransfer,
    onConfigureDestination,
    onReviewTransfer,
}) => (
    <div className="elevated-card p-6">
        <div className="mb-6 flex items-center justify-between">
            <div>
                <p className="text-xs font-bold uppercase text-white/40">Destino</p>
                <h3 className="mt-1 text-xl font-black text-white">YouTube Music</h3>
            </div>
            <YoutubeIcon className="h-8 w-8 fill-youtube" />
        </div>

        <div className="rounded-lg border border-white/10 bg-black/30 p-4">
            <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-bold text-white/70">Selecionadas</span>
                <span className={`inline-flex items-center gap-2 text-sm font-extrabold ${youtubeReady ? 'text-spotify' : 'text-amber-300'}`}>
                    {youtubeReady ? <CheckCircle2 size={16} /> : <ShieldCheck size={16} />}
                    {selectedCount} {selectedCount === 1 ? 'playlist' : 'playlists'}
                </span>
            </div>
            <p className="mb-4 text-sm leading-6 text-muted">
                {youtubeReady
                    ? 'YTMUSIC_COOKIE foi detectado no back-end. As playlists serão criadas como privadas no destino.'
                    : 'Configure YTMUSIC_COOKIE no backend/.env, reinicie a API e valide o status.'}
            </p>
            <Button
                onClick={!youtubeReady ? onConfigureDestination : onReviewTransfer}
                variant={readyToTransfer ? 'primary' : 'secondary'}
                disabled={youtubeReady && !selectedCount}
                fullWidth
                rightIcon={<ArrowRight size={17} />}
            >
                {readyToTransfer ? 'Revisar e iniciar' : youtubeReady ? 'Selecione playlists' : 'Ver configuração'}
            </Button>
        </div>
    </div>
);

export default DestinationCard;
