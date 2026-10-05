import { useText } from '../../../i18n/useText';
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
    const { t } = useText();
    const providersReady = source.canRead && target.canWrite;

    const statusText = !source.canRead
        ? t("Conecte o {{value0}} para ler a playlist de origem.", { value0: source.label })
        : target.canWrite
            ? t("Destino {{value0}} pronto para receber as faixas selecionadas.", { value0: target.label })
            : t("Conecte o {{value0}} para criar playlists no destino.", { value0: target.label });

    return (
        <div className="elevated-card p-6">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <p className="text-xs font-bold uppercase text-white/40">{t("Destino")}</p>
                    <h3 className="mt-1 text-xl font-black text-white">{t(target.label)}</h3>
                </div>
                <ProviderIcon providerId={target.id} size="lg" />
            </div>

            <div className="rounded-lg border border-white/10 bg-black/30 p-4">
                <div className="mb-4 flex items-center justify-between">
                    <span className="text-sm font-bold text-white/70">{t("Selecionadas")}</span>
                    <span className={`inline-flex items-center gap-2 text-sm font-extrabold ${readyToTransfer ? 'text-spotify' : 'text-amber-300'}`}>
                        {readyToTransfer ? <CheckCircle2 size={16} /> : <ShieldCheck size={16} />}
                        {selectedCount} {selectedCount === 1 ? 'playlist' : 'playlists'}
                    </span>
                </div>
                <p className="mb-4 text-sm leading-6 text-muted">{t(statusText)}</p>
                <Button
                    onClick={providersReady ? onReviewTransfer : onConfigureDestination}
                    variant={readyToTransfer ? 'primary' : 'secondary'}
                    disabled={providersReady && !selectedCount}
                    fullWidth
                    rightIcon={<ArrowRight size={17} />}
                >
                    {readyToTransfer ? t("Revisar e iniciar") : providersReady ? t("Selecione playlists") : t("Ver configuração")}
                </Button>
            </div>
        </div>
    );
};

export default DestinationCard;
