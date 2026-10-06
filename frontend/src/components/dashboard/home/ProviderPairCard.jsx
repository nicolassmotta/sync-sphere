import { useText } from '../../../i18n/useText';
import { ArrowDownUp, CheckCircle2, CircleDashed, Terminal } from 'lucide-react';
import { cn } from '../../../utils/cn';
import Button from '../../ui/Button';
import ProviderIcon from '../../ui/ProviderIcon';

const ProviderChip = ({ provider, active, onClick, showExperimental, compact }) => {
    const { t } = useText();
    const ready = Boolean(showExperimental ? provider.canWrite : provider.canRead);
    return <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        aria-label={`${t(provider.label)}${showExperimental && provider.validation?.write === 'experimental' ? ' (experimental)' : ''}`}
        className={cn(
            'flex min-w-0 items-center gap-3 rounded-xl border text-left transition-colors',
            compact ? 'p-2.5' : 'p-3',
            active
                ? showExperimental ? 'border-rose-300/50 bg-rose-300/10' : 'border-spotify/60 bg-spotify/10'
                : 'border-white/10 bg-black/30 hover:border-white/20 hover:bg-white/[0.055]'
        )}
    >
        <span className={cn('grid shrink-0 place-items-center rounded-lg bg-black/25', compact ? 'h-8 w-8' : 'h-10 w-10')}>
            <ProviderIcon providerId={provider.id} size={compact ? 'sm' : 'md'} />
        </span>
        <span className="min-w-0">
            <span className={cn('block break-words font-semibold text-white', compact ? 'text-xs' : 'text-sm')}>{t(provider.label)}</span>
            <span className={cn(
                'mt-0.5 inline-flex items-center gap-1 text-xs font-bold',
                ready ? provider.connected ? 'text-green-300' : 'text-sky-300' : 'text-amber-200'
            )}>
                {ready ? <CheckCircle2 aria-hidden="true" size={11} /> : <CircleDashed aria-hidden="true" size={11} />}
                {ready ? provider.connected ? t("conectado") : showExperimental ? t('pronto para usar') : t("leitura pública") : t("precisa conectar")}
            </span>
        </span>
    </button>;
};

export const ProviderRow = ({ title, providers, selectedId, onSelect, showExperimental = false, compact = false }) => {
    const { t } = useText();
    return <fieldset>
        <legend className="mb-3 text-sm font-semibold text-muted">{t(title)}</legend>
        <div className={cn('grid grid-cols-1 sm:grid-cols-2', compact ? 'gap-2' : 'gap-3')}>
            {providers.map((provider) => (
                <ProviderChip
                    key={provider.id}
                    provider={provider}
                    compact={compact}
                    showExperimental={showExperimental}
                    active={provider.id === selectedId}
                    onClick={() => onSelect(provider.id)}
                />
            ))}
        </div>
    </fieldset>;
};

/**
 * Escolha da plataforma de origem e de destino. Escolher de um lado a
 * plataforma que está no outro inverte o par.
 */
const ProviderPairCard = ({ providers, sourceProvider, targetProvider, onChange }) => {
    const { t } = useText();
    const sources = providers.filter((provider) => provider.capabilities?.read !== false);
    const targets = providers.filter((provider) => provider.capabilities?.write !== false);

    const allowsSame = (id) => providers.find((provider) => provider.id === id)?.capabilities?.sameProviderTransfer;

    const selectSource = (id) => {
        onChange(id === targetProvider && !allowsSame(id)
            ? { sourceProvider: id, targetProvider: sourceProvider }
            : { sourceProvider: id, targetProvider });
    };

    const selectTarget = (id) => {
        onChange(id === sourceProvider && !allowsSame(id)
            ? { sourceProvider: targetProvider, targetProvider: id }
            : { sourceProvider, targetProvider: id });
    };

    return (
        <div className="elevated-card music-route-card p-5 sm:p-6">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-xl font-bold text-white">{t("Escolha origem e destino")}</h2>
                    <p className="mt-2 text-sm leading-6 text-muted">{t('De onde vem sua música e para onde ela vai.')}</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        size="sm"
                        variant="secondary"
                        leftIcon={<ArrowDownUp size={15} />}
                        onClick={() => onChange({ sourceProvider: targetProvider, targetProvider: sourceProvider })}
                    >{t("Inverter")}</Button>
                    <Terminal aria-hidden="true" className="hidden text-spotify sm:block" size={20} />
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <ProviderRow compact title={t("Origem")} providers={sources} selectedId={sourceProvider} onSelect={selectSource} />
                <ProviderRow compact title={t("Destino")} showExperimental providers={targets} selectedId={targetProvider} onSelect={selectTarget} />
            </div>
        </div>
    );
};

export default ProviderPairCard;
