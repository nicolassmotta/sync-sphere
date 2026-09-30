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

const DEFAULT_FIELDS = [{ name: 'cookie', label: 'Cookie' }];

/**
 * Credenciais coladas no painel (cookie, token). Campos vêm do back-end
 * (`auth.fields`); campos `optional` podem ficar vazios.
 */
const CredentialForm = ({ provider, onSaved }) => {
    const ui = getProviderUi(provider.id);
    const fields = provider.auth?.fields?.length ? provider.auth.fields : DEFAULT_FIELDS;
    const [values, setValues] = useState({});
    const [saving, setSaving] = useState(false);
    const [removing, setRemoving] = useState(false);
    const requiredFilled = fields.every((field) => field.optional || values[field.name]?.trim());

    const save = async () => {
        setSaving(true);
        try {
            const payload = Object.fromEntries(
                Object.entries(values).map(([name, value]) => [name, value.trim()]).filter(([, value]) => value)
            );
            await api.put(`/integrations/${provider.id}/credentials`, { values: payload });
            setValues({});
            toast.success(`${provider.label} configurado.`);
            await onSaved();
        } catch (err) {
            toast.error(err.response?.data?.message || `Não foi possível salvar as credenciais do ${provider.label}.`);
        } finally {
            setSaving(false);
        }
    };

    const remove = async () => {
        setRemoving(true);
        try {
            await api.delete(`/integrations/${provider.id}`);
            toast.success('Credencial do painel removida.');
            await onSaved();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Não foi possível remover a credencial.');
        } finally {
            setRemoving(false);
        }
    };

    return (
        <div className="space-y-3">
            {fields.map((field, index) => (
                <TextField
                    key={field.name}
                    label={field.label}
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    value={values[field.name] || ''}
                    onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                    tone={ui.tone}
                    placeholder={provider.connected && !field.optional ? 'Cole um novo valor para substituir' : field.placeholder || 'Cole o valor'}
                    hint={index === fields.length - 1 ? 'Fica cifrado em backend/data e tem prioridade sobre a variável do .env.' : undefined}
                />
            ))}
            <div className="flex flex-wrap gap-2">
                <Button
                    onClick={save}
                    variant={ui.buttonVariant}
                    disabled={!requiredFilled}
                    loading={saving}
                    loadingLabel="Validando..."
                    leftIcon={<KeyRound size={16} />}
                >
                    Salvar credencial
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

const MUSICKIT_SCRIPT = 'https://js-cdn.music.apple.com/musickit/v3/musickit.js';

const loadMusicKit = () => new Promise((resolve, reject) => {
    if (window.MusicKit) {
        resolve(window.MusicKit);
        return;
    }
    document.addEventListener('musickitloaded', () => resolve(window.MusicKit), { once: true });
    if (!document.querySelector(`script[src="${MUSICKIT_SCRIPT}"]`)) {
        const script = document.createElement('script');
        script.src = MUSICKIT_SCRIPT;
        script.async = true;
        script.onerror = () => reject(new Error('Não foi possível carregar o MusicKit JS da Apple.'));
        document.head.appendChild(script);
    }
});

/**
 * Conexão oficial do Apple Music: o MusicKit JS abre o login da Apple e
 * devolve o Music User Token, que vai para o back-end.
 */
const MusicKitConnect = ({ provider, onConnected }) => {
    const [loading, setLoading] = useState(false);

    const connect = async () => {
        setLoading(true);
        try {
            const tokenResponse = await api.get(`/integrations/${provider.id}/developer-token`);
            const MusicKit = await loadMusicKit();
            const music = await MusicKit.configure({
                developerToken: tokenResponse.data.data.token,
                app: { name: 'SyncSphere', build: '2.0.0' },
            });
            const musicUserToken = await music.authorize();
            await api.put(`/integrations/${provider.id}/credentials`, { values: { musicUserToken } });
            toast.success(`${provider.label} conectado.`);
            await onConnected();
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || `Não foi possível conectar o ${provider.label}.`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button onClick={connect} loading={loading} loadingLabel="Aguardando a Apple..." variant="inverse" fullWidth>
            {provider.connected ? 'Reconectar com Apple Music' : 'Conectar com Apple Music'}
        </Button>
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
            disabled={!provider.connected && provider.configured === false}
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
    if (!provider.connected && provider.canRead) {
        return 'Lê playlists públicas sem login. Cole a credencial para criar playlists.';
    }
    if (!provider.connected) {
        return provider.auth?.type === 'cookie' ? 'Aguardando cookie' : 'Pendente de conexão';
    }
    const source = credentialSourceLabels[provider.credentialSource] || 'Pronto para usar';
    return provider.accountName ? `${source} · conta ${provider.accountName}` : source;
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
                        {!provider.connected && provider.canRead ? (
                            <StatusBadge status="connected" label="Leitura pública" tone="info" />
                        ) : (
                            <StatusBadge status={provider.connected ? 'connected' : 'disconnected'} />
                        )}
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

            {provider.configured === false && (
                <Alert tone="warning" title="Falta configurar o back-end" className="mb-5">
                    {`Defina as variáveis de ${provider.label} no backend/.env (veja abaixo) e reinicie o back-end antes de conectar.`}
                </Alert>
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
                {provider.musicKitAvailable && <MusicKitConnect provider={provider} onConnected={onChanged} />}
                {provider.auth?.type === 'cookie' && (
                    provider.musicKitAvailable ? (
                        <details className="text-sm text-muted">
                            <summary className="cursor-pointer font-bold text-white/70">Colar tokens manualmente</summary>
                            <div className="mt-3"><CredentialForm provider={provider} onSaved={onChanged} /></div>
                        </details>
                    ) : (
                        <CredentialForm provider={provider} onSaved={onChanged} />
                    )
                )}
                {provider.auth?.type === 'file' && (
                    <p className="text-sm text-muted">
                        Não precisa de conexão. {provider.importedPlaylists
                            ? `${provider.importedPlaylists} arquivo(s) importado(s).`
                            : 'Nenhum arquivo importado ainda.'}
                    </p>
                )}
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
