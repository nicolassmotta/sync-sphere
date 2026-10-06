import { useText } from '../../i18n/useText';
import { translate as text } from '../../i18n/index';
import { useState } from 'react';
import {
    Database,
    ExternalLink,
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
import Modal from '../ui/Modal';
import AppSetupForm from '../setup/AppSetupForm';
import { getProviderUi } from '../../constants/providers';

const TechnicalStatusCard = ({ detail, icon: Icon, label, state, tone }) => {
    const { t } = useText();
    return <div className="rounded-lg border border-white/10 bg-black/35 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.045]">
                    <Icon size={18} className="text-spotify" />
                </div>
                <p className="font-bold text-white">{t(label)}</p>
            </div>
            <Badge tone={tone}>{state}</Badge>
        </div>
        <p className="text-sm leading-6 text-muted">{t(detail)}</p>
    </div>;
};

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
    const { t } = useText();
    const ui = getProviderUi(provider.id);
    const fields = provider.auth?.fields?.length ? provider.auth.fields : DEFAULT_FIELDS;
    const [values, setValues] = useState({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [confirmRemoval, setConfirmRemoval] = useState(false);
    const [removing, setRemoving] = useState(false);
    const requiredFilled = fields.every((field) => field.optional || values[field.name]?.trim());

    const save = async () => {
        setSaving(true);
        setError('');
        try {
            const payload = Object.fromEntries(
                Object.entries(values).map(([name, value]) => [name, value.trim()]).filter(([, value]) => value)
            );
            await api.put(`/integrations/${provider.id}/credentials`, { values: payload });
            setValues({});
            toast.success(t("{{value0}} configurado.", { value0: provider.label }));
            await onSaved();
        } catch (err) {
            setError(err.response?.data?.message || t("Não foi possível validar a conexão com {{value0}}. Confira o valor e tente novamente.", { value0: provider.label }));
        } finally {
            setSaving(false);
        }
    };

    const remove = async () => {
        setRemoving(true);
        try {
            await api.delete(`/integrations/${provider.id}`);
            setConfirmRemoval(false);
            toast.success(t("Credencial do painel removida."));
            await onSaved();
        } catch (err) {
            toast.error(err.response?.data?.message || t("Não foi possível remover a credencial."));
        } finally {
            setRemoving(false);
        }
    };

    return (
        <form onSubmit={(event) => { event.preventDefault(); if (requiredFilled && !saving && !removing) save(); }} className="space-y-3">
            {error && <Alert tone="danger" title={t("Conexão não confirmada")}>{t(error)}</Alert>}
            <fieldset disabled={saving || removing} className="space-y-3">
            {fields.map((field, index) => (
                <TextField
                    key={field.name}
                    name={field.name}
                    label={t(field.label)}
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    value={values[field.name] || ''}
                    onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                    tone={ui.tone}
                    placeholder={provider.connected && !field.optional ? t("Cole um novo valor para substituir") : t(field.placeholder) || t("Cole o valor")}
                    required={!field.optional}
                    hint={index === fields.length - 1 ? t("O valor fica protegido neste computador. Não compartilhe em mensagens ou capturas de tela.") : undefined}
                />
            ))}
            <div className="flex flex-wrap gap-2">
                <Button
                    type="submit"
                    variant={ui.buttonVariant}
                    disabled={!requiredFilled}
                    loading={saving}
                    loadingLabel={t("Validando...")}
                    leftIcon={<KeyRound size={16} />}
                >{t("Validar e conectar")}</Button>
                {provider.credentialSource === 'panel' && (
                    <Button
                        onClick={() => setConfirmRemoval(true)}
                        variant="secondary"
                        loading={removing}
                        loadingLabel={t("Removendo...")}
                        leftIcon={<Trash2 size={16} />}
                    >{t("Desconectar e remover")}</Button>
                )}
            </div>
            </fieldset>
            <Modal isOpen={confirmRemoval} onClose={() => setConfirmRemoval(false)} size="sm" title={t("Desconectar {{value0}}?", { value0: provider.label })}
                description={t("A credencial salva pelo painel será removida deste computador. As playlists na plataforma serão preservadas.")}
                footer={<Button onClick={remove} loading={removing} variant="danger">{t("Desconectar e remover")}</Button>} />
        </form>
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
        script.onerror = () => reject(new Error(text("Não foi possível carregar o MusicKit JS da Apple.")));
        document.head.appendChild(script);
    }
});

/**
 * Conexão oficial do Apple Music: o MusicKit JS abre o login da Apple e
 * devolve o Music User Token, que vai para o back-end.
 */
const MusicKitConnect = ({ provider, onConnected }) => {
    const { t } = useText();
    const [loading, setLoading] = useState(false);

    const connect = async () => {
        setLoading(true);
        try {
            const tokenResponse = await api.get(`/integrations/${provider.id}/developer-token`);
            const MusicKit = await loadMusicKit();
            const music = await MusicKit.configure({
                developerToken: tokenResponse.data.data.token,
                app: { name: t("SyncSphere"), build: '1.1.0' },
            });
            const musicUserToken = await music.authorize();
            await api.put(`/integrations/${provider.id}/credentials`, { values: { musicUserToken } });
            toast.success(t("{{value0}} conectado.", { value0: provider.label }));
            await onConnected();
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || t("Não foi possível conectar o {{value0}}.", { value0: provider.label }));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button onClick={connect} loading={loading} loadingLabel={t("Aguardando a Apple...")} variant="inverse" fullWidth>
            {provider.connected ? t("Reconectar com Apple Music") : t("Conectar com Apple Music")}
        </Button>
    );
};

const OAuthActions = ({ provider, onChanged }) => {
    const { t } = useText();
    const ui = getProviderUi(provider.id);
    const [loading, setLoading] = useState(false);
    const [confirmDisconnect, setConfirmDisconnect] = useState(false);

    const connect = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/integrations/${provider.id}/login`);
            window.location.href = response.data.data.url;
        } catch (err) {
            toast.error(err.response?.data?.message || t("Não foi possível abrir a conexão com o {{value0}}.", { value0: provider.label }));
            setLoading(false);
        }
    };

    const disconnect = async () => {
        setLoading(true);
        try {
            await api.delete(`/integrations/${provider.id}`);
            await onChanged();
            setConfirmDisconnect(false);
            toast.success(t("{{value0}} desconectado.", { value0: provider.label }));
        } catch (err) {
            toast.error(err.response?.data?.message || t("Falha ao desconectar {{value0}}.", { value0: provider.label }));
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
        <Button
            onClick={provider.connected ? () => setConfirmDisconnect(true) : connect}
            disabled={!provider.connected && provider.configured === false}
            loading={loading}
            loadingLabel={t("Abrindo...")}
            variant={provider.connected ? 'secondary' : ui.buttonVariant}
            fullWidth
            leftIcon={provider.connected ? <Trash2 size={16} /> : undefined}
        >
            {provider.connected ? t("Desconectar {{value0}}", { value0: provider.label }) : t("Conectar {{value0}}", { value0: provider.label })}
        </Button>
        {provider.connected && <Button className="mt-3" fullWidth onClick={connect} loading={loading} loadingLabel={t("Abrindo...")} variant="secondary">{t("Autorizar {{value0}} novamente", { value0: provider.label })}</Button>}
        <Modal isOpen={confirmDisconnect} onClose={() => setConfirmDisconnect(false)} size="sm" title={t("Desconectar {{value0}}?", { value0: provider.label })}
            description={t("A autorização local será removida. Suas playlists na plataforma serão preservadas.")}
            footer={<Button variant="danger" onClick={disconnect} loading={loading}>{t("Desconectar")}</Button>} />
        </>
    );
};

const describeStatus = (provider) => {
    if (!provider.connected && provider.canRead) {
        return text("Lê playlists públicas sem login. Cole a credencial para criar playlists.");
    }
    if (!provider.connected) {
        return provider.auth?.type === 'cookie' ? text("Aguardando cookie") : text("Pendente de conexão");
    }
    const source = credentialSourceLabels[provider.credentialSource] || text("Pronto para usar");
    return provider.accountName ? text("{{value0}} · conta {{value1}}", { value0: text(source), value1: provider.accountName }) : source;
};

const ProviderIntegrationCard = ({ provider, onChanged }) => {
    const { t } = useText();
    const [guideStep, setGuideStep] = useState(0);
    const ui = getProviderUi(provider.id);
    const roles = [
        provider.capabilities?.read && t("origem"),
        provider.capabilities?.write && t("destino"),
    ].filter(Boolean).join(t(" e "));

    return (
        <Card className="relative overflow-hidden p-6 sm:p-7">
            <div className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${ui.accentGradient} to-transparent`} />

            <div className="relative z-10 mb-5 flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/45">
                    <ProviderIcon providerId={provider.id} size="lg" />
                </div>
                <div className="min-w-0">
                    <h2 className="text-2xl font-bold text-white">{t(provider.label)}</h2>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {!provider.connected && provider.canRead ? (
                            <StatusBadge status="connected" label={t("Leitura pública")} tone="info" />
                        ) : (
                            <StatusBadge status={provider.connected ? 'connected' : 'disconnected'} />
                        )}
                        {roles && <Badge tone="neutral">{roles}</Badge>}
                    </div>
                </div>
            </div>

            <p className="relative z-10 mb-5 text-sm leading-relaxed text-muted">{t(ui.description)}</p>

            {provider.validation?.write === 'experimental' && <Alert tone="warning" title={t("Escrita experimental")} className="mb-5">{t("A validação com uma conta real ainda está pendente. Os testes automatizados de escrita usam respostas simuladas.")}</Alert>}
            {provider.validation?.method === 'oficial e alternativa não oficial' && <p className="mb-5 text-sm text-amber-100">{t("Esta plataforma oferece MusicKit e um caminho alternativo não oficial pelo site. Confira no guia qual método você está usando.")}</p>}
            {provider.validation?.method === 'não oficial ou misto' && <p className="mb-5 text-sm text-amber-100">{t("Esta conexão usa recursos do site da plataforma e pode mudar sem aviso.")}</p>}
            {ui.setupSteps?.length > 0 && <section className="mb-5 rounded-lg border border-white/15 p-4">
                <p className="font-semibold text-white">{t("Etapa ")}{guideStep + 1}{t(" de ")}{ui.setupSteps.length}</p>
                <p className="mt-3 text-sm leading-7 text-gray-200">{ui.setupSteps[guideStep]}</p>
                <div className="mt-4 flex justify-between gap-2">
                    <Button size="sm" disabled={guideStep === 0} onClick={() => setGuideStep(guideStep - 1)}>{t("Anterior")}</Button>
                    <Button size="sm" disabled={guideStep === ui.setupSteps.length - 1} onClick={() => setGuideStep(guideStep + 1)}>{t("Próxima etapa")}</Button>
                </div>
            </section>}
            {provider.configured === false && ['spotify', 'tidal'].includes(provider.id) && <div className="mb-5"><AppSetupForm providerId={provider.id} onSaved={onChanged} /></div>}
            {provider.configured !== false && !provider.connected && ['spotify', 'tidal'].includes(provider.id) && <details className="mb-5"><summary className="cursor-pointer text-sm text-gray-200">{t("Alterar aplicativo da conexão")}</summary><div className="mt-4"><AppSetupForm providerId={provider.id} onSaved={onChanged} /></div></details>}
            {provider.configured === false && !['spotify', 'tidal'].includes(provider.id) && <Alert tone="warning" title={t("Preparação necessária")} className="mb-5">{t("Confira o guia desta plataforma em Ajuda antes de conectar.")}</Alert>}

            {ui.credentialWarning && (
                <Alert tone="warning" title={t("Credencial sensível")} className="mb-5">
                    {ui.credentialWarning}
                </Alert>
            )}

            <div className="relative z-10 space-y-4 rounded-lg border border-white/10 bg-white/[0.045] p-4">
                <div>
                    <p className="mb-1 text-xs font-bold text-gray-300">{t("Sua conexão")}</p>
                    <p className={`text-sm font-medium ${provider.connected ? 'text-green-300' : 'text-yellow-300'}`}>
                        {describeStatus(provider)}
                    </p>
                </div>
                {provider.auth?.type === 'oauth' && <OAuthActions provider={provider} onChanged={onChanged} />}
                {provider.musicKitAvailable && <MusicKitConnect provider={provider} onConnected={onChanged} />}
                {provider.auth?.type === 'cookie' && (
                    provider.musicKitAvailable ? (
                        <details className="text-sm text-muted">
                            <summary className="cursor-pointer font-bold text-white/70">{t("Colar tokens manualmente")}</summary>
                            <div className="mt-3"><CredentialForm provider={provider} onSaved={onChanged} /></div>
                        </details>
                    ) : (
                        <CredentialForm provider={provider} onSaved={onChanged} />
                    )
                )}
                {provider.auth?.type === 'file' && (
                    <p className="text-sm text-muted">{t("Não precisa de conexão. ")}{provider.importedPlaylists
                            ? t("{{value0}} arquivo(s) importado(s).", { value0: provider.importedPlaylists })
                            : t("Nenhum arquivo importado ainda.")}
                    </p>
                )}
            </div>

            {ui.envSnippet && (
                <details className="mt-5">
                    <summary className="cursor-pointer text-sm text-muted">{t("Configuração avançada por arquivo")}</summary>
                    <CopySnippet code={ui.envSnippet} label={t("Alternativa: backend/.env")} language="env" />
                </details>
            )}
        </Card>
    );
};

const IntegrationsTab = ({
    providers = [],
    preferredProviderIds = [],
    onContinue,
    integrationsLoading,
    refreshIntegrations,
    refreshSystemStatus,
    systemStatus,
    systemStatusLoading,
}) => {
    const { t } = useText();
    const [selectedProviderId, setSelectedProviderId] = useState(preferredProviderIds[0] || 'spotify');
    const selectedProvider = providers.find((provider) => provider.id === selectedProviderId) || providers[0];
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
                    <h1 className="mb-2 flex items-center gap-3 text-4xl font-black text-white">
                        <Plug className="text-spotify" aria-hidden="true" />{t(" Conectar plataformas")}</h1>
                    <p className="max-w-3xl text-muted">{t("Conecte as plataformas que vai usar como origem ou destino. Credenciais ficam cifradas no seu computador.")}</p>
                </div>
                <Button
                    onClick={refreshAll}
                    loading={integrationsLoading || systemStatusLoading}
                    loadingLabel={t("Validando...")}
                    variant="secondary"
                    leftIcon={<RefreshCw size={17} />}
                >{t("Atualizar status")}</Button>
            </div>

            <details className="mb-6">
            <summary className="cursor-pointer text-sm text-muted">{t("Conferir o funcionamento do aplicativo")}</summary>
            <Card className="mt-3 p-6 sm:p-7">
                <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase text-white/40">{t("Ambiente local")}</p>
                        <h2 className="mt-1 text-xl font-black text-white">{t("Back-end e dados locais")}</h2>
                    </div>
                    <a
                        href={`${API_ORIGIN}/api/health`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-bold text-white/70 transition-colors hover:text-white"
                    >{t("Saúde local ")}<ExternalLink size={15} />
                    </a>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                    <TechnicalStatusCard
                        detail={backendOnline ? systemStatus?.backend?.message : t("Valide {{value0}}/api/health.", { value0: API_ORIGIN })}
                        icon={Server}
                        label={t("Back-end")}
                        state={backendOnline ? 'online' : 'offline'}
                        tone={backendOnline ? 'success' : 'danger'}
                    />
                    <TechnicalStatusCard
                        detail="Credenciais cifradas, histórico e fila em arquivos locais (backend/data); a fila sobrevive a reinícios."
                        icon={Database}
                        label={t("Dados e fila locais")}
                        state={backendOnline ? 'online' : 'offline'}
                        tone={backendOnline ? 'success' : 'danger'}
                    />
                </div>
            </Card>

            </details>
            {!backendOnline && !systemStatusLoading && <Alert tone="danger" className="mb-6" title={t('Aplicativo local indisponível')}>{t('O aplicativo local não respondeu. Abra Ajuda para conferir como iniciar.')}</Alert>}
            <div className="grid items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
                <div role="group" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:sticky lg:top-24 lg:grid-cols-1" aria-label={t("Escolher plataforma para conectar")}>
                    {providers.map((provider) => <button key={provider.id} type="button"
                        aria-label={`${t(provider.label)}${preferredProviderIds.includes(provider.id) ? t(' (escolhida)') : ''}`}
                        aria-describedby={`integration-status-${provider.id}`}
                        aria-pressed={selectedProvider?.id === provider.id} onClick={() => setSelectedProviderId(provider.id)}
                        className={`flex min-w-0 items-center gap-3 rounded-xl border p-3 text-left transition-colors ${selectedProvider?.id === provider.id ? 'border-spotify/40 bg-spotify/10' : 'border-white/10 bg-black/20 hover:bg-white/5'}`}>
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-black/30"><ProviderIcon providerId={provider.id} size="sm" /></span>
                        <span className="min-w-0"><span className="block break-words text-sm font-semibold text-white">{t(provider.label)}</span>
                            <span id={`integration-status-${provider.id}`} className={`mt-1 block text-xs ${provider.connected ? 'text-green-300' : provider.canRead ? 'text-sky-300' : 'text-muted'}`}>{t(provider.connected ? 'Conectado' : provider.canRead ? 'Leitura pública' : 'Preparar conexão')}</span>
                        </span>
                    </button>)}
                </div>
                {selectedProvider && <ProviderIntegrationCard key={selectedProvider.id} provider={selectedProvider} onChanged={refreshProviders} />}
            </div>
            {onContinue && <Button className="mt-6" variant="primary" onClick={onContinue}>{t("Voltar à minha migração")}</Button>}

        </FadeInPage>
    );
};

export default IntegrationsTab;
