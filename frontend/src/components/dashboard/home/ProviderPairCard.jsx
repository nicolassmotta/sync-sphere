import { ArrowDownUp, CheckCircle2, CircleDashed, Terminal } from 'lucide-react';
import { cn } from '../../../utils/cn';
import Button from '../../ui/Button';
import ProviderIcon from '../../ui/ProviderIcon';

const ProviderChip = ({ provider, active, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={cn(
            'flex min-w-0 items-center gap-3 rounded-lg border p-3 text-left transition-all',
            active
                ? 'border-spotify/60 bg-spotify/10'
                : 'border-white/10 bg-black/30 hover:border-white/20 hover:bg-white/[0.055]'
        )}
    >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/10 bg-black/35">
            <ProviderIcon providerId={provider.id} />
        </span>
        <span className="min-w-0">
            <span className="block truncate text-sm font-black text-white">{provider.label}</span>
            <span className={cn(
                'mt-0.5 inline-flex items-center gap-1 text-xs font-bold',
                provider.connected ? 'text-spotify' : 'text-amber-300'
            )}>
                {provider.connected ? <CheckCircle2 size={12} /> : <CircleDashed size={12} />}
                {provider.connected ? 'conectado' : 'pendente'}
            </span>
        </span>
    </button>
);

const ProviderRow = ({ title, providers, selectedId, onSelect }) => (
    <div>
        <p className="mb-2 text-xs font-bold uppercase text-white/40">{title}</p>
        <div className="grid gap-3 sm:grid-cols-2">
            {providers.map((provider) => (
                <ProviderChip
                    key={provider.id}
                    provider={provider}
                    active={provider.id === selectedId}
                    onClick={() => onSelect(provider.id)}
                />
            ))}
        </div>
    </div>
);

/**
 * Escolha da plataforma de origem e de destino. Escolher de um lado a
 * plataforma que está no outro inverte o par.
 */
const ProviderPairCard = ({ providers, sourceProvider, targetProvider, onChange }) => {
    const sources = providers.filter((provider) => provider.capabilities?.read !== false);
    const targets = providers.filter((provider) => provider.capabilities?.write !== false);

    const selectSource = (id) => {
        onChange(id === targetProvider
            ? { sourceProvider: id, targetProvider: sourceProvider }
            : { sourceProvider: id, targetProvider });
    };

    const selectTarget = (id) => {
        onChange(id === sourceProvider
            ? { sourceProvider: targetProvider, targetProvider: id }
            : { sourceProvider, targetProvider: id });
    };

    return (
        <div className="elevated-card p-6 lg:p-7">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-sm font-bold uppercase text-white/40">Direção da transferência</p>
                    <h2 className="mt-2 text-2xl font-black text-white">Escolha origem e destino</h2>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        size="sm"
                        variant="secondary"
                        leftIcon={<ArrowDownUp size={15} />}
                        onClick={() => onChange({ sourceProvider: targetProvider, targetProvider: sourceProvider })}
                    >
                        Inverter
                    </Button>
                    <Terminal className="hidden text-spotify sm:block" size={24} />
                </div>
            </div>

            <div className="space-y-5">
                <ProviderRow title="Origem" providers={sources} selectedId={sourceProvider} onSelect={selectSource} />
                <ProviderRow title="Destino" providers={targets} selectedId={targetProvider} onSelect={selectTarget} />
            </div>
        </div>
    );
};

export default ProviderPairCard;
