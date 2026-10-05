import { useText } from '../../i18n/useText';
import { translate as text } from '../../i18n/index';
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

const ChecklistItem = ({ detail, icon: Icon, state, title }) => {
    const { t } = useText();
    return <li className="rounded-lg border border-white/10 bg-black/35 p-4">
        <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.045]">
                    <Icon size={17} className="text-spotify" />
                </div>
                <div className="min-w-0">
                    <p className="font-bold text-white">{t(title)}</p>
                    <p className="mt-1 text-sm leading-6 text-muted">{detail}</p>
                </div>
            </div>
            <Badge tone={getStateTone(state)} icon={getStateIcon(state)}>
                {t(statusText[state])}
            </Badge>
        </div>
    </li>;
};

const isReady = (provider, role) => Boolean(role === 'source'
    ? provider.canRead ?? provider.connected
    : provider.canWrite ?? provider.connected);

const describeConnection = (provider, role) => {
    if (isReady(provider, role)) {
        if (!provider.connected) return text("{{value0}} lê playlists públicas sem login.", { value0: provider.label });
        return role === 'source'
            ? text("{{value0}} conectado para ler playlists.", { value0: provider.label })
            : text("{{value0}} conectado para criar playlists.", { value0: provider.label });
    }
    return provider.auth?.type === 'cookie'
        ? text("Cole o cookie do {{value0}} em Integrações.", { value0: provider.label })
        : text("Conecte o {{value0}} em Integrações.", { value0: provider.label });
};

const SetupChecklist = ({
    integrations,
    source,
    target,
    isTransferring,
    onOpenHistory,
    onOpenIntegrations,
    onRefreshIntegrations,
    onRefreshSystemStatus,
    refreshLoading,
    readyToTransfer,
    selectedCount = 0,
    systemStatus,
}) => {
    const { t } = useText();
    const backendOnline = systemStatus?.backend?.status === 'online';
    const hasSelection = selectedCount > 0;
    const migrationReady = Boolean(readyToTransfer);
    // Sem par escolhido (Guia local): mostra as plataformas padrão.
    const sourceProvider = source || { label: 'Spotify', ...integrations?.spotify };
    const targetProvider = target || { label: t("YouTube Music"), ...integrations?.youtubeMusic };

    const checklist = [
        {
            title: t("Back-end local"),
            detail: backendOnline
                ? t("{{value0}}/api/health respondeu.", { value0: API_ORIGIN })
                : t("Inicie o back-end e valide {{value0}}/api/health.", { value0: API_ORIGIN }),
            icon: Server,
            state: backendOnline ? 'done' : 'blocked',
        },
        {
            title: t("Origem: {{value0}}", { value0: sourceProvider.label }),
            detail: describeConnection(sourceProvider, 'source'),
            icon: Plug,
            state: isReady(sourceProvider, 'source') ? 'done' : 'pending',
        },
        {
            title: t("Destino: {{value0}}", { value0: targetProvider.label }),
            detail: describeConnection(targetProvider, 'target'),
            icon: ShieldCheck,
            state: isReady(targetProvider, 'target') ? 'done' : 'pending',
        },
        {
            title: t("Playlist escolhida"),
            detail: hasSelection
                ? t("{{value0}} {{value1}}.", { value0: selectedCount, value1: selectedCount === 1 ? t("playlist selecionada") : t("playlists selecionadas") })
                : t("Selecione uma playlist do {{value0}} ou cole um link.", { value0: sourceProvider.label }),
            icon: ListMusic,
            state: hasSelection ? 'done' : 'pending',
        },
        {
            title: t("Migração"),
            detail: isTransferring
                ? t("Tarefa em andamento com progresso via Socket.io.")
                : migrationReady ? t("Pronto para criar playlist no {{value0}}.", { value0: targetProvider.label }) : t("Aguarde destino e seleção."),
            icon: ListChecks,
            state: isTransferring || migrationReady ? 'done' : 'pending',
        },
        {
            title: t("Histórico"),
            detail: t("Transferências concluídas, pendências e falhas aparecem na aba Histórico."),
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
                        <ListChecks size={14} className="text-spotify" />{t("Checklist de configuração")}</p>
                    <h2 className="text-2xl font-black text-white">{t("Configuração local antes de migrar")}</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{t("Esta lista usa endpoints reais do back-end quando disponíveis e aponta o próximo passo sem esconder detalhes técnicos.")}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button
                        onClick={refreshAll}
                        loading={refreshLoading}
                        loadingLabel={t("Validando...")}
                        size="sm"
                        variant="secondary"
                        leftIcon={<RefreshCw size={15} />}
                    >{t("Validar status")}</Button>
                    <Button onClick={onOpenIntegrations} size="sm" variant="ghost">{t("Integrações")}</Button>
                    <Button onClick={onOpenHistory} size="sm" variant="ghost">{t("Histórico")}</Button>
                </div>
            </div>

            <ol className="grid gap-3 md:grid-cols-2">
                {checklist.map((item, index) => (
                    <ChecklistItem key={index} {...item} />
                ))}
            </ol>
        </Card>
    );
};

export default SetupChecklist;
