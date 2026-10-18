import { useText } from '../../../i18n/useText';
import { ArrowRight, CheckCircle2, CircleDashed } from 'lucide-react';
import { cn } from '../../../utils/cn';
import ProviderIcon from '../../ui/ProviderIcon';

/**
 * Situação da plataforma no papel escolhido: na origem importa ler; no
 * destino importa criar a playlist.
 */
const describeReadiness = (provider, role) => {
    if (provider.auth?.type === 'file') return { ready: true, label: 'sem conta' };
    if (role === 'target') return provider.canWrite ? { ready: true, label: 'conectado' } : { ready: false, label: 'precisa conectar' };
    if (provider.connected) return { ready: true, label: 'conectado' };
    return provider.canRead ? { ready: true, public: true, label: 'lê links públicos sem login' } : { ready: false, label: 'precisa conectar' };
};

const ProviderChip = ({ provider, role, active, disabledReason, onClick, showExperimental }) => {
    const { t } = useText();
    const readiness = describeReadiness(provider, role);
    const experimental = showExperimental && provider.validation?.write === 'experimental';
    return <button
        type="button"
        onClick={onClick}
        disabled={Boolean(disabledReason)}
        aria-pressed={active}
        aria-label={`${t(provider.label)}${experimental ? ' (experimental)' : ''}${disabledReason ? ` (${t(disabledReason)})` : ''}`}
        className={cn(
            'flex min-w-0 items-center gap-3 rounded-lg border p-3 text-left transition-all disabled:cursor-not-allowed',
            active
                ? 'border-spotify/60 bg-spotify/10'
                : disabledReason ? 'border-white/10 bg-black/20 opacity-60' : 'border-white/10 bg-black/30 hover:border-white/20 hover:bg-white/[0.055]'
        )}
    >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/10 bg-black/35">
            <ProviderIcon providerId={provider.id} />
        </span>
        <span className="min-w-0">
            <span className="block truncate text-sm font-black text-white">{t(provider.label)}</span>
            {disabledReason ? (
                <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-bold text-muted">
                    <ArrowRight size={12} aria-hidden="true" />{t(disabledReason)}
                </span>
            ) : (
                <span className={cn(
                    'mt-0.5 inline-flex flex-wrap items-center gap-x-1 text-xs font-bold',
                    readiness.ready ? (readiness.public ? 'text-sky-300' : 'text-spotify') : 'text-amber-300'
                )}>
                    {readiness.ready && !readiness.public ? <CheckCircle2 size={12} aria-hidden="true" /> : <CircleDashed size={12} aria-hidden="true" />}
                    {t(readiness.label)}
                    {experimental && <span className="text-amber-200">· {t("experimental")}</span>}
                </span>
            )}
        </span>
    </button>;
};

/**
 * Grade de plataformas de uma etapa. `disabledIds` mostra plataformas que não
 * servem nesta etapa, com o motivo, em vez de trocar o par sem avisar.
 */
export const ProviderRow = ({ title, providers, selectedId, onSelect, role = 'source', disabledIds = [], disabledReason, showExperimental = false }) => {
    const { t } = useText();
    return <fieldset>
        <legend className="mb-3 text-lg font-bold text-white">{t(title)}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
            {providers.map((provider) => (
                <ProviderChip
                    key={provider.id}
                    provider={provider}
                    role={role}
                    showExperimental={showExperimental}
                    active={provider.id === selectedId}
                    disabledReason={disabledIds.includes(provider.id) ? disabledReason : undefined}
                    onClick={() => onSelect(provider.id)}
                />
            ))}
        </div>
    </fieldset>;
};

export default ProviderRow;
