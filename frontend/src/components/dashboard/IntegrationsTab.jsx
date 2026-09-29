import { useState } from 'react';
import {
    Database,
    ExternalLink,
    Info,
    KeyRound,
    Plug,
    RefreshCw,
    Server,
    Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api, { API_ORIGIN } from '../../services/api';
import Alert from '../ui/Alert';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Card from '../ui/Card';
import CopySnippet from '../ui/CopySnippet';
import FadeInPage from '../ui/FadeInPage';
import StatusBadge from '../ui/StatusBadge';
import ProviderIcon from '../ui/ProviderIcon';
import TextField from '../ui/TextField';
import { getProviderUi } from '../../constants/providers';

const TechnicalStatusCard = ({ detail, icon: Icon, label, state, tone }) => (
    <div className="rounded-lg border border-white/10 bg-black/35 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.045]">
                    <Icon size={18} className="text-spotify" />
                </div>
                <p className="font-bold text-white">{label}</p>
            </div>
            <Badge tone={tone}>{state}</Badge>
        </div>
        <p className="text-sm leading-6 text-muted">{detail}</p>
    </div>
);

const credentialSourceLabels = {
    panel: 'Salvo pelo painel',
    env: 'Lido do backend/.env',
};

const CookieCredentialForm = ({ provider, onSaved }) => {
    const ui = getProviderUi(provider.id);
    const [value, setValue] = useState('');
    const [saving, setSaving] = useState(false);
    const [removing, setRemoving] = useState(false);
    const field = provider.auth?.fields?.[0] || { name: 'cookie', label: 'Cookie' };

    const save = async () => {
        setSaving(true);
        try {
            await api.put(`/integrations/${provider.id}/credentials`, { values: { [field.name]: value.trim() } });
            setValue('');
            toast.success(`${provider.label} configurado.`);
            await onSaved();
        } catch (err) {
            toast.error(err.response?.data?.message || `Não foi possível salvar o cookie do ${provider.label}.`);
        } finally {
            setSaving(false);
        }
    };

    const remove = async () => {
        setRemoving(true);
        try {
            await api.delete(`/integrations/${provider.id}`);
            toast.success('Cookie do painel removido.');
            await onSaved();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Não foi possível remover o cookie.');
        } finally {
            setRemoving(false);
        }
    };

    return (
        <div className="space-y-3">
            <TextField
                label={field.label}
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                tone={ui.tone}
                placeholder={provider.connected ? 'Cole um novo cookie para substituir' : 'Cole o cabeçalho Cookie completo'}
                hint="Fica cifrado em backend/data e substitui a variável do .env."
            />
            <div className="flex flex-wrap gap-2">
                <Button
                    onClick={save}
                    variant={ui.buttonVariant}
                    disabled={!value.trim()}
                    loading={saving}
                    loadingLabel="Validando..."
                    leftIcon={<KeyRound size={16} />}
                >
                    Salvar cookie
                </Button>
                {provider.credentialSource === 'panel' && (
                    <Button
                        onClick={remove}
                        variant="secondary"
                        loading={removing}
                        loadingLabel="Removendo..."
                        leftIcon={<Trash2 size={16} />}
                    >
                        Remover do painel
                    </Button>
                )}
            </div>
        </div>
    );
};

const OAuthActions = ({ provider, onChanged }) => {
    const ui = getProviderUi(provider.id);
    const [loading, setLoading] = useState(false);

    const connect = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/integrations/${provider.id}/login`);
            window.location.href = response.data.data.url;
        } catch (err) {
            toast.error(err.response?.data?.message || `Não foi possível abrir a conexão com o ${provider.label}.`);
            setLoading(false);
        }
    };

    const disconnect = async () => {
        setLoading(true);
        try {
            await api.delete(`/integrations/${provider.id}`);
            await onChanged();
            toast.success(`${provider.label} desconectado.`);
        } catch (err) {
            toast.error(err.response?.data?.message || `Falha ao desconectar ${provider.label}.`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button
            onClick={provider.connected ? disconnect : connect}
            loading={loading}
            loadingLabel="Abrindo..."
            variant={provider.connected ? 'secondary' : ui.buttonVariant}
            fullWidth
            leftIcon={provider.connected ? <Trash2 size={16} /> : undefined}
        >
            {provider.connected ? `Desconectar ${provider.label}` : `Conectar ${provider.label}`}
        </Button>
    );
};

const describeStatus = (provider) => {
    if (!provider.connected) {
        return provider.auth?.type === 'cookie' ? 'Aguardando cookie' : 'Pendente de conexão';
    }
    return credentialSourceLabels[provider.credentialSource] || 'Pronto para usar';
};

const ProviderIntegrationCard = ({ provider, onChanged }) => {
    const ui = getProviderUi(provider.id);
    const roles = [
        provider.capabilities?.read && 'origem',
        provider.capabilities?.write && 'destino',
    ].filter(Boolean).join(' e ');

    return (
        <Card className="relative overflow-hidden p-6 sm:p-7">
            <div className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${ui.accentGradient} to-transparent`} />

            <div className="relative z-10 mb-5 flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/45">
                    <ProviderIcon providerId={provider.id} size="lg" />
                </div>
                <div className="min-w-0">
                    <h3 className="text-2xl font-bold text-white">{provider.label}</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                        <StatusBadge status={provider.connected ? 'connected' : 'disconnected'} />
                        {roles && <Badge tone="neutral">{roles}</Badge>}
                    </div>
                </div>
            </div>

            <p className="relative z-10 mb-5 text-sm leading-relaxed text-muted">{ui.description}</p>

            {ui.setupSteps?.length > 0 && (
                <div className="mb-5 rounded-lg border border-white/10 bg-black/35 p-4 text-sm text-gray-300">
                    <p className="mb-3 flex items-center gap-2 font-bold text-white">
                        <Info size={16} className="text-spotify" /> Como configurar
                    </p>
                    <ol className="list-decimal space-y-1 pl-5 text-xs leading-5 text-muted [overflow-wrap:anywhere]">
                        {ui.setupSteps.map((step) => (
                            <li key={step}>{step}</li>
                        ))}
                    </ol>
                </div>
            )}

            {ui.credentialWarning && (
                <Alert tone="warning" title="Credencial sensível" className="mb-5">
                    {ui.credentialWarning}
                </Alert>
            )}

            <div className="relative z-10 space-y-4 rounded-lg border border-white/10 bg-white/[0.045] p-4">
                <div>
                    <p className="mb-1 text-xs font-bold uppercase text-white/40">Status atual</p>
                    <p className={`text-sm font-medium ${provider.connected ? 'text-green-300' : 'text-yellow-300'}`}>
                        {describeStatus(provider)}
                    </p>
                </div>
                {provider.auth?.type === 'oauth' && <OAuthActions provider={provider} onChanged={onChanged} />}
                {provider.auth?.type === 'cookie' && <CookieCredentialForm provider={provider} onSaved={onChanged} />}
            </div>

            {ui.envSnippet && (
                <div className="mt-5">
                    <CopySnippet code={ui.envSnippet} label="Alternativa: backend/.env" language="env" />
                </div>
            )}
        </Card>
    );
};

const IntegrationsTab = ({
    providers = [],
    integrationsLoading,
    refreshIntegrations,
    refreshSystemStatus,
    systemStatus,
    systemStatusLoading,
}) => {
    const backendOnline = systemStatus?.backend?.status === 'online';

    const refreshProviders = () => refreshIntegrations({ force: true, minIntervalMs: 0 });

    const refreshAll = async () => {
        await Promise.all([
            refreshSystemStatus?.(),
            refreshProviders(),
        ]);
    };

    return (
        <FadeInPage className="mx-auto w-full max-w-6xl">
            <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <h2 className="mb-2 flex items-center gap-3 text-4xl font-black text-white">
                        <Plug className="text-spotify" /> Integrações locais
                    </h2>
                    <p className="max-w-3xl text-muted">
                        Conecte as plataformas que vai usar como origem ou destino. Credenciais ficam cifradas no seu computador.
                    </p>
                </div>
                <Button
                    onClick={refreshAll}
                    loading={integrationsLoading || systemStatusLoading}
                    loadingLabel="Validando..."
                    variant="secondary"
                    leftIcon={<RefreshCw size={17} />}
                >
                    Atualizar status
                </Button>
            </div>

            <Card className="mb-6 p-6 sm:p-7">
                <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase text-white/40">Ambiente local</p>
                        <h3 className="mt-1 text-xl font-black text-white">Back-end e dados locais</h3>
                    </div>
                    <a
                        href={`${API_ORIGIN}/api/health`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-bold text-white/70 transition-colors hover:text-white"
                    >
                        Saúde local <ExternalLink size={15} />
                    </a>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                    <TechnicalStatusCard
                        detail={backendOnline ? systemStatus?.backend?.message : `Valide ${API_ORIGIN}/api/health.`}
                        icon={Server}
                        label="Back-end"
                        state={backendOnline ? 'online' : 'offline'}
                        tone={backendOnline ? 'success' : 'danger'}
                    />
                    <TechnicalStatusCard
                        detail="Credenciais cifradas, histórico e fila em arquivos locais (backend/data); a fila sobrevive a reinícios."
                        icon={Database}
                        label="Dados e fila locais"
                        state={backendOnline ? 'online' : 'offline'}
                        tone={backendOnline ? 'success' : 'danger'}
                    />
                </div>
            </Card>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {providers.map((provider) => (
                    <ProviderIntegrationCard key={provider.id} provider={provider} onChanged={refreshProviders} />
                ))}
            </div>
        </FadeInPage>
    );
};

export default IntegrationsTab;
