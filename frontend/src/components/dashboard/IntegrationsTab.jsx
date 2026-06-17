import { useState } from 'react';
import {
    Database,
    ExternalLink,
    Info,
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
import { SpotifyIcon, YoutubeIcon } from '../ui/BrandIcons';

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

const IntegrationCard = ({
    accent,
    children,
    connected,
    description,
    icon,
    loading,
    onConnect,
    onDisconnect,
    actionLabel,
    badgeLabel,
    setupSteps,
    statusLabel,
    title,
}) => (
    <Card className="relative overflow-hidden p-6 sm:p-7">
        <div className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${accent} to-transparent`} />

        <div className="relative z-10 mb-5 flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/45">
                {icon}
            </div>
            <div className="min-w-0">
                <h3 className="text-2xl font-bold text-white">{title}</h3>
                <div className="mt-2">
                    <StatusBadge
                        status={connected ? 'connected' : 'disconnected'}
                        label={badgeLabel || (connected ? 'Conectado' : 'Pendente')}
                    />
                </div>
            </div>
        </div>

        <p className="relative z-10 mb-5 text-sm leading-relaxed text-muted">
            {description}
        </p>

        {setupSteps?.length > 0 && (
            <div className="mb-5 rounded-lg border border-white/10 bg-black/35 p-4 text-sm text-gray-300">
                <p className="mb-3 flex items-center gap-2 font-bold text-white">
                    <Info size={16} className="text-spotify" /> Validação técnica
                </p>
                <ol className="list-decimal space-y-1 pl-5 text-xs leading-5 text-muted">
                    {setupSteps.map((step) => (
                        <li key={step}>{step}</li>
                    ))}
                </ol>
            </div>
        )}

        {children}

        <div className="relative z-10 space-y-4 rounded-lg border border-white/10 bg-white/[0.045] p-4">
            <div>
                <p className="mb-1 text-xs font-bold uppercase text-white/40">Status atual</p>
                <p className={`text-sm font-medium ${connected ? 'text-green-300' : 'text-yellow-300'}`}>
                    {statusLabel || (connected ? 'Pronto para usar' : 'Pendente de configuração')}
                </p>
            </div>
            <Button
                onClick={connected ? onDisconnect : onConnect}
                loading={loading}
                loadingLabel="Abrindo..."
                variant={connected ? 'secondary' : 'primary'}
                fullWidth
                leftIcon={connected && !actionLabel ? <Trash2 size={16} /> : undefined}
            >
                {actionLabel || (connected ? `Desconectar ${title}` : `Conectar ${title}`)}
            </Button>
        </div>
    </Card>
);

const IntegrationsTab = ({
    integrations,
    integrationsLoading,
    refreshIntegrations,
    refreshSystemStatus,
    systemStatus,
    systemStatusLoading,
}) => {
    const [connectingSpotify, setConnectingSpotify] = useState(false);

    const spotifyConnected = integrations?.spotify?.connected;
    const youtubeReady = integrations?.youtubeMusic?.connected;
    const backendOnline = systemStatus?.backend?.status === 'online';

    const startOAuth = async ({ path, setLoading, fallbackMessage }) => {
        setLoading(true);
        try {
            const response = await api.get(path);
            window.location.href = response.data.data.url;
        } catch (err) {
            toast.error(err.response?.data?.message || fallbackMessage);
            setLoading(false);
        }
    };

    const disconnect = async ({ path, successMessage, fallbackMessage }) => {
        try {
            await api.delete(path);
            await refreshIntegrations({ force: true, minIntervalMs: 0 });
            toast.success(successMessage);
        } catch (err) {
            toast.error(err.response?.data?.message || fallbackMessage);
        }
    };

    const refreshAll = async () => {
        await Promise.all([
            refreshSystemStatus?.(),
            refreshIntegrations?.({ force: true, minIntervalMs: 0 }),
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
                        Status técnico do back-end e dos provedores usados nos fluxos Spotify -&gt; YouTube Music e YouTube Music -&gt; Spotify.
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
                        detail="Credenciais cifradas e histórico em arquivos locais (backend/data); a fila roda no próprio processo."
                        icon={Database}
                        label="Dados e fila locais"
                        state={backendOnline ? 'online' : 'offline'}
                        tone={backendOnline ? 'success' : 'danger'}
                    />
                </div>
            </Card>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <IntegrationCard
                    accent="via-spotify"
                    connected={spotifyConnected}
                    description="Origem ou destino. O back-end usa OAuth para listar playlists, buscar faixas e criar playlists privadas quando o Spotify for destino."
                    icon={<SpotifyIcon className="h-8 w-8 fill-spotify" />}
                    loading={connectingSpotify}
                    onConnect={() => startOAuth({
                        path: '/integrations/spotify/login',
                        setLoading: setConnectingSpotify,
                        fallbackMessage: 'Não foi possível abrir a conexão com o Spotify.',
                    })}
                    onDisconnect={() => disconnect({
                        path: '/integrations/spotify',
                        successMessage: 'Spotify desconectado.',
                        fallbackMessage: 'Falha ao desconectar Spotify.',
                    })}
                    setupSteps={[
                        'Defina SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no backend/.env.',
                        'Use SPOTIFY_REDIRECT_URI=http://localhost:8000/api/v1/integrations/spotify/callback.',
                        'Reconecte se o app antigo não tiver playlist-modify-private/playlist-modify-public.',
                        'Clique em conectar para concluir o OAuth no navegador.',
                    ]}
                    title="Spotify OAuth"
                />

                <IntegrationCard
                    accent="via-youtube"
                    connected={youtubeReady}
                    description="Origem ou destino. O back-end lê playlists e cria playlists privadas no YouTube Music usando o cookie local configurado no .env."
                    icon={<YoutubeIcon className="h-8 w-8 fill-youtube" />}
                    loading={systemStatusLoading || integrationsLoading}
                    onConnect={refreshAll}
                    onDisconnect={refreshAll}
                    actionLabel="Revalidar cookie"
                    badgeLabel={youtubeReady ? 'YTMUSIC_COOKIE configurado' : 'YTMUSIC_COOKIE ausente'}
                    statusLabel={youtubeReady ? 'Cookie detectado no back-end' : 'Aguardando variável local'}
                    setupSteps={[
                        'Abra music.youtube.com logado na conta de destino.',
                        'Copie o cabeçalho Cookie completo de uma requisição da aba Rede.',
                        'Cole em YTMUSIC_COOKIE no backend/.env e reinicie o back-end.',
                    ]}
                    title="YouTube Music"
                >
                    <div className="mb-5 space-y-4">
                        <Alert tone="youtube" title="Destino não usa Google OAuth">
                            O SyncSphere usa a integração não oficial do YouTube Music via cookie local. Não coloque cookies reais em logs, docs, commits ou capturas de tela.
                        </Alert>
                        <CopySnippet
                            code={`YTMUSIC_COOKIE=cole_o_cabecalho_cookie_completo_de_music_youtube_com_aqui
YTMUSIC_AUTH_USER=0`}
                            label="backend/.env"
                            language="env"
                        />
                    </div>
                </IntegrationCard>
            </div>
        </FadeInPage>
    );
};

export default IntegrationsTab;
