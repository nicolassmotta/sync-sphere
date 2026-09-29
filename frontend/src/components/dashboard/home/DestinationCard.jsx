import { ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import Button from '../../ui/Button';
import ProviderIcon from '../../ui/ProviderIcon';

const DestinationCard = ({
    source,
    target,
    selectedCount,
    readyToTransfer,
    onConfigureDestination,
    onReviewTransfer,
}) => {
    const providersReady = source.canRead && target.canWrite;

    const statusText = !source.canRead
        ? `Conecte o ${source.label} para ler a playlist de origem.`
        : target.canWrite
            ? `Destino ${target.label} pronto para receber playlists privadas.`
            : `Conecte o ${target.label} para criar playlists no destino.`;

    return (
        <div className="elevated-card p-6">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <p className="text-xs font-bold uppercase text-white/40">Destino</p>
                    <h3 className="mt-1 text-xl font-black text-white">{target.label}</h3>
                </div>
                <ProviderIcon providerId={target.id} size="lg" />
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
                    onClick={providersReady ? onReviewTransfer : onConfigureDestination}
                    variant={readyToTransfer ? 'primary' : 'secondary'}
                    disabled={providersReady && !selectedCount}
                    fullWidth
                    rightIcon={<ArrowRight size={17} />}
                >
                    {readyToTransfer ? 'Revisar e iniciar' : providersReady ? 'Selecione playlists' : 'Ver configuração'}
                </Button>
            </div>
        </div>
    );
};

export default DestinationCard;
