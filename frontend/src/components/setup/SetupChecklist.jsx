import {
    CheckCircle2,
    CircleDashed,
    History,
    ListChecks,
    ListMusic,
    Plug,
    RefreshCw,
    Server,
    ShieldCheck,
} from 'lucide-react';
import { API_ORIGIN } from '../../services/api';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Card from '../ui/Card';

const getStateTone = (state) => {
    if (state === 'done') return 'success';
    if (state === 'blocked') return 'danger';
    return 'warning';
};

const getStateIcon = (state) => {
    if (state === 'done') return <CheckCircle2 size={13} />;
    return <CircleDashed size={13} />;
};

const statusText = {
    done: 'ok',
    pending: 'pendente',
    blocked: 'atenção',
};

const ChecklistItem = ({ detail, icon: Icon, state, title }) => (
    <li className="rounded-lg border border-white/10 bg-black/35 p-4">
        <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.045]">
                    <Icon size={17} className="text-spotify" />
                </div>
                <div className="min-w-0">
                    <p className="font-bold text-white">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-muted">{detail}</p>
                </div>
            </div>
            <Badge tone={getStateTone(state)} icon={getStateIcon(state)}>
                {statusText[state]}
            </Badge>
        </div>
    </li>
);

const SetupChecklist = ({
    integrations,
    isTransferring,
    onOpenHistory,
    onOpenIntegrations,
    onRefreshIntegrations,
    onRefreshSystemStatus,
    refreshLoading,
    readyToTransfer,
    selectedCount = 0,
    sourceLabel = 'Spotify',
    targetLabel = 'YouTube Music',
    systemStatus,
}) => {
    const backendOnline = systemStatus?.backend?.status === 'online';
    const spotifyConnected = Boolean(integrations?.spotify?.connected);
    const youtubeReady = Boolean(integrations?.youtubeMusic?.connected);
    const hasSelection = selectedCount > 0;
    const migrationReady = Boolean(readyToTransfer);

    const checklist = [
        {
            title: 'Back-end local',
            detail: backendOnline
                ? `${API_ORIGIN}/api/health respondeu.`
                : `Inicie o back-end e valide ${API_ORIGIN}/api/health.`,
            icon: Server,
            state: backendOnline ? 'done' : 'blocked',
        },
        {
            title: 'Spotify OAuth',
            detail: spotifyConnected
                ? 'OAuth conectado para listar playlists.'
                : 'Configure credenciais e conecte o Spotify.',
            icon: Plug,
            state: spotifyConnected ? 'done' : 'pending',
        },
        {
            title: 'YTMUSIC_COOKIE',
            detail: youtubeReady
                ? 'Cookie configurado no back-end.'
                : 'Cole o cookie no backend/.env e reinicie a API.',
            icon: ShieldCheck,
            state: youtubeReady ? 'done' : 'pending',
        },
        {
            title: 'Playlist escolhida',
            detail: hasSelection
                ? `${selectedCount} playlist${selectedCount === 1 ? '' : 's'} selecionada${selectedCount === 1 ? '' : 's'}.`
                : `Selecione uma playlist do ${sourceLabel} ou cole um link.`,
            icon: ListMusic,
            state: hasSelection ? 'done' : 'pending',
        },
        {
            title: 'Migração',
            detail: isTransferring
                ? 'Tarefa em andamento com progresso via Socket.io.'
                : migrationReady ? `Pronto para criar playlist no ${targetLabel}.` : 'Aguarde destino e seleção.',
            icon: ListChecks,
            state: isTransferring || migrationReady ? 'done' : 'pending',
        },
        {
            title: 'Histórico',
            detail: 'Transferências concluídas e falhas aparecem na aba Histórico.',
            icon: History,
            state: 'pending',
        },
    ];

    const refreshAll = async () => {
        await Promise.all([
            onRefreshSystemStatus?.(),
            onRefreshIntegrations?.({ force: true, minIntervalMs: 0 }),
        ]);
    };

    return (
        <Card className="p-6 sm:p-7">
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <p className="mb-2 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.045] px-3 py-2 text-xs font-bold uppercase text-white/45">
                        <ListChecks size={14} className="text-spotify" />
                        Checklist de configuração
                    </p>
                    <h2 className="text-2xl font-black text-white">Configuração local antes de migrar</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
                        Esta lista usa endpoints reais do back-end quando disponíveis e aponta o próximo passo sem esconder detalhes técnicos.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button
                        onClick={refreshAll}
                        loading={refreshLoading}
                        loadingLabel="Validando..."
                        size="sm"
                        variant="secondary"
                        leftIcon={<RefreshCw size={15} />}
                    >
                        Validar status
                    </Button>
                    <Button onClick={onOpenIntegrations} size="sm" variant="ghost">
                        Integrações
                    </Button>
                    <Button onClick={onOpenHistory} size="sm" variant="ghost">
                        Histórico
                    </Button>
                </div>
            </div>

            <ol className="grid gap-3 md:grid-cols-2">
                {checklist.map((item) => (
                    <ChecklistItem key={item.title} {...item} />
                ))}
            </ol>
        </Card>
    );
};

export default SetupChecklist;
