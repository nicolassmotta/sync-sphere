import { useText } from '../../../i18n/useText';
import { translate as text } from '../../../i18n/index';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    AlertTriangle,
    CheckCircle2,
    Clock,
    Disc3,
    ExternalLink,
    Gauge,
    KeyRound,
    ListChecks,
    PauseCircle,
    Play,
    RotateCw,
    Search,
    XCircle,
} from 'lucide-react';
import Badge from '../../ui/Badge';
import Button from '../../ui/Button';
import StatusBadge from '../../ui/StatusBadge';
import { getProviderLabel } from '../../../constants/providers';
import { safeExternalUrl } from '../../../utils/safeExternalUrl';
import { formatCountdown, formatEta } from '../../../utils/formatDuration';

const TERMINAL_STATUSES = ['completed', 'failed'];

const trackStatusIcons = {
    matched: <CheckCircle2 size={14} className="shrink-0 text-spotify" aria-label={text("Encontrada")} />,
    not_found: <XCircle size={14} className="shrink-0 text-yellow-300" aria-label={text("Não encontrada")} />,
    retry_queued: <RotateCw size={14} className="shrink-0 text-sky-300" aria-label={text("Na fila de retry")} />,
    failed: <AlertTriangle size={14} className="shrink-0 text-red-400" aria-label={text("Falhou")} />,
};

// Relógio que só roda enquanto houver contagem regressiva na tela.
const useNow = (active) => {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (!active) return undefined;
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, [active]);

    return now;
};

// A cor acompanha a situação: vermelho fica reservado para falha.
const PROGRESS_TONES = {
    active: 'bg-gradient-to-r from-spotify/70 to-spotify',
    attention: 'bg-gradient-to-r from-amber-300/70 to-amber-300',
    failed: 'bg-gradient-to-r from-red-400/70 to-red-400',
};

const ProgressBar = ({ value, className = 'h-3', tone = 'active' }) => {
    const { t } = useText();
    const percent = Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0;
    return <div role="progressbar" aria-label={t("Progresso da transferência")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className={`${className} overflow-hidden rounded-full bg-white/10`}>
        <motion.div aria-hidden="true"
            className={`h-full origin-left rounded-full ${PROGRESS_TONES[tone] || PROGRESS_TONES.active}`}
            initial={{ scaleX: 0 }} animate={{ scaleX: percent / 100 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.9 }} />
    </div>;
};

const needsReview = (transfer) => {
    const counts = transfer.counts || {};
    return (counts.notFound || 0) + (counts.needsReview || 0) + (counts.failed || 0) + (counts.retryQueued || 0) + (counts.pendingInserts || 0) > 0;
};

const transferTone = (transfer) => {
    if (transfer.status === 'failed') return 'failed';
    if (['needs_auth', 'paused'].includes(transfer.status) || (transfer.status === 'completed' && needsReview(transfer))) return 'attention';
    return 'active';
};

const describeProgress = (transfer) => {
    const counts = transfer.counts;
    if (transfer.status === 'pending') {
        return transfer.queuePosition > 1 ? text("Na fila (posição {{value0}})", { value0: transfer.queuePosition }) : text("Aguardando a fila");
    }
    if (!counts?.total) return transfer.phase === 'reading' ? text("Lendo a playlist de origem...") : null;

    const parts = [text("{{value0}} de {{value1}} faixas", { value0: counts.analyzed, value1: counts.total })];
    if (transfer.status === 'processing' && transfer.phase === 'inserting') parts.push(text("inserindo na playlist"));
    else if (transfer.status === 'processing' && transfer.etaSeconds) parts.push(text("{{value0}} restantes", { value0: formatEta(transfer.etaSeconds) }));
    if (transfer.status === 'processing' && transfer.tracksPerMinute) parts.push(text("{{value0}} faixas/min", { value0: transfer.tracksPerMinute }));
    return parts.join(' · ');
};

const CountChips = ({ counts }) => {
    const { t } = useText();
    if (!counts?.total) return null;
    const pendingCount = (counts.retryQueued || 0) + (counts.failed || 0);

    return (
        <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone="success" icon={<CheckCircle2 size={12} aria-hidden="true" />}>
                {counts.matched}{t(" encontradas")}</Badge>
            {counts.notFound > 0 && (
                <Badge tone="warning" icon={<XCircle size={12} aria-hidden="true" />}>
                    {counts.notFound}{t(" não encontradas")}</Badge>
            )}
            {pendingCount > 0 && (
                <Badge tone="info" icon={<RotateCw size={12} aria-hidden="true" />}>
                    {pendingCount}{t(" aguardando nova tentativa")}</Badge>
            )}
        </div>
    );
};

const PauseNotice = ({ transfer, now, onResume, onOpenIntegrations }) => {
    const { t } = useText();
    const [resuming, setResuming] = useState(false);

    if (transfer.status === 'needs_auth') {
        return (
            <div className="mt-3 rounded-lg border border-amber-300/25 bg-amber-300/10 p-3">
                <p className="flex items-start gap-2 text-xs font-semibold leading-5 text-amber-100">
                    <KeyRound size={14} className="mt-0.5 shrink-0" />
                    {t(transfer.message)}
                </p>
                <p className="mt-2 text-xs leading-5 text-white/70">{t("O progresso está salvo. Depois de reconectar, a migração continua de onde parou.")}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="primary" onClick={() => onOpenIntegrations?.(transfer.authProvider)}>
                        {transfer.authProvider ? t("Reconectar {{value0}}", { value0: getProviderLabel(transfer.authProvider) }) : t("Abrir integrações")}</Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        loading={resuming}
                        loadingLabel={t("Retomando...")}
                        onClick={async () => {
                            setResuming(true);
                            await onResume(transfer.transferId);
                            setResuming(false);
                        }}
                    >{t("Já reconectei")}</Button>
                </div>
            </div>
        );
    }

    if (transfer.status !== 'paused') return null;

    const countdown = formatCountdown(transfer.resumeAt, now);
    const isRetryRound = transfer.pauseReason === 'retry_scheduled';

    return (
        <div className="mt-3 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3">
            <p className="flex items-start gap-2 text-xs font-semibold leading-5 text-yellow-100">
                <PauseCircle size={14} className="mt-0.5 shrink-0" />
                {isRetryRound
                    ? transfer.message
                    : t("Pausada: a plataforma limitou as buscas. Nenhuma faixa foi perdida.")}
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-yellow-200">
                    <Clock size={13} />{t(" Volta em ")}{countdown}
                </span>
                <Button
                    size="sm"
                    variant="secondary"
                    leftIcon={<Play size={13} />}
                    loading={resuming}
                    loadingLabel={t("Retomando...")}
                    onClick={async () => {
                        setResuming(true);
                        await onResume(transfer.transferId);
                        setResuming(false);
                    }}
                >{t("Retomar agora")}</Button>
            </div>
        </div>
    );
};

const LiveFeed = ({ transfer }) => {
    if (transfer.status !== 'processing' || transfer.phase !== 'matching') return null;
    const recentTracks = transfer.recentTracks || [];
    if (!transfer.currentTrack && !recentTracks.length) return null;

    return (
        <div className="mt-3 space-y-1.5 rounded-lg border border-white/10 bg-black/30 p-3">
            {transfer.currentTrack && (
                <p className="flex items-center gap-2 truncate text-xs font-bold text-white">
                    <Search size={14} className="shrink-0 animate-pulse text-sky-300" />
                    <span className="min-w-0 truncate">{transfer.currentTrack.name} - {transfer.currentTrack.artist}</span>
                </p>
            )}
            {recentTracks.map((track) => (
                <p key={track.index} className="flex items-center gap-2 text-xs font-semibold text-white/60">
                    {trackStatusIcons[track.status]}
                    <span className="min-w-0 truncate">{track.name} - {track.artist}</span>
                </p>
            ))}
        </div>
    );
};

// Próximo passo de cada playlist encerrada: abrir o destino ou revisar o resultado.
const TransferActions = ({ transfer, onOpenHistory }) => {
    const { t } = useText();
    if (!TERMINAL_STATUSES.includes(transfer.status)) return null;
    const isFile = transfer.targetProvider === 'file';
    const playlistUrl = !isFile && safeExternalUrl(transfer.targetPlaylistUrl);
    const review = transfer.status === 'failed' || needsReview(transfer);
    return <div className="mt-3 flex flex-wrap gap-2">
        {review && onOpenHistory && <Button size="sm" variant="primary" leftIcon={<ListChecks size={14} aria-hidden="true" />} onClick={() => onOpenHistory(transfer.transferId)}>
            {transfer.status === 'failed' ? t("Ver o que aconteceu") : t("Revisar faixas")}</Button>}
        {isFile && transfer.status === 'completed' && onOpenHistory && <Button size="sm" variant={review ? 'secondary' : 'primary'} onClick={() => onOpenHistory(transfer.transferId)}>{t("Baixar o arquivo")}</Button>}
        {playlistUrl && <a href={playlistUrl} target="_blank" rel="noreferrer"
            className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-xs font-extrabold text-white transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-spotify">
            {t("Abrir no {{value0}}", { value0: getProviderLabel(transfer.targetProvider) })}<ExternalLink size={13} aria-hidden="true" /></a>}
    </div>;
};

const TransferRow = ({ transfer, now, onResume, onOpenIntegrations, onOpenHistory }) => {
    const { t } = useText();
    const attention = transfer.status === 'completed' && needsReview(transfer);
    return <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-2 flex items-start justify-between gap-3">
            <p className="min-w-0 truncate text-sm font-extrabold text-white">
                {transfer.playlistName || t("Playlist")}
            </p>
            <StatusBadge status={transfer.status} label={attention ? t("Revisar resultado") : undefined} tone={attention ? 'warning' : undefined} />
        </div>
        <ProgressBar value={transfer.progress || 0} className="h-2" tone={transferTone(transfer)} />
        {describeProgress(transfer) && (
            <p className="mt-2 text-xs font-semibold text-muted">{describeProgress(transfer)}</p>
        )}
        {TERMINAL_STATUSES.includes(transfer.status) && transfer.message && (
            <p className="mt-2 text-xs font-semibold leading-5 text-white/70">{t(transfer.message)}</p>
        )}
        <CountChips counts={transfer.counts} />
        <PauseNotice transfer={transfer} now={now} onResume={onResume} onOpenIntegrations={onOpenIntegrations} />
        <LiveFeed transfer={transfer} />
        <TransferActions transfer={transfer} onOpenHistory={onOpenHistory} />
    </div>;
};

const ActiveTransferCard = ({
    isTransferring,
    progress,
    progressMessage,
    connectionState,
    transfers = [],
    onResume,
    onOpenIntegrations,
    onOpenHistory,
}) => {
    const { t } = useText();
    const hasCountdown = transfers.some((transfer) => transfer.status === 'paused');
    const now = useNow(hasCountdown);
    const running = transfers.filter((transfer) => !TERMINAL_STATUSES.includes(transfer.status));
    // Quem espera reconexão ou pausa não entra na estimativa: o tempo depende de você ou da plataforma.
    const waitingOnUser = running.filter((transfer) => transfer.status === 'needs_auth').length;
    const totalEta = running.filter((transfer) => ['pending', 'processing'].includes(transfer.status))
        .reduce((sum, transfer) => sum + (transfer.etaSeconds || 0), 0);
    const hasPendingTracks = transfers.some((transfer) => (
        (transfer.counts?.failed || 0) + (transfer.counts?.retryQueued || 0) + (transfer.counts?.pendingInserts || 0) > 0
    ));
    const failed = transfers.some((transfer) => transfer.status === 'failed');
    const heading = waitingOnUser ? t("Aguardando você")
        : isTransferring ? t("Migração em andamento")
            : transfers.length ? (failed ? t("Processamento encerrado") : t("Migração concluída")) : t("Migração");
    const overallTone = failed && !isTransferring ? 'failed'
        : waitingOnUser || transfers.some((transfer) => transferTone(transfer) === 'attention') ? 'attention' : 'active';

    return (
        <div className="elevated-card p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                    <p className="text-xs font-bold text-gray-300">{heading}</p>
                    <h2 className="mt-1 text-xl font-black text-white">{progress}{t("% concluído")}</h2>
                    {isTransferring && totalEta > 0 && !waitingOnUser && (
                        <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-bold text-spotify">
                            <Clock size={13} /> {formatEta(totalEta)}{t(" restantes")}</p>
                    )}
                    {waitingOnUser > 0 && (
                        <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-bold text-amber-200">
                            <KeyRound size={13} aria-hidden="true" /> {waitingOnUser === 1 ? t("1 playlist espera você reconectar uma conta.") : t("{{value0}} playlists esperam você reconectar uma conta.", { value0: waitingOnUser })}</p>
                    )}
                </div>
                <Gauge className="text-spotify" size={24} />
            </div>

            {isTransferring && connectionState === 'reconnecting' && <p role="status" className="mb-4 rounded-lg border border-amber-300/30 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">{t("A conexão de progresso caiu. Tentando reconectar. Mantenha o aplicativo aberto; o estado da transferência continua salvo.")}</p>}
            <ProgressBar value={progress} tone={overallTone} />
            <p role="status" className="mt-4 text-sm font-semibold leading-6 text-white/70">
                {isTransferring ? (progressMessage || t("Sincronizando faixas...")) : (transfers.length ? t("Processamento encerrado. Confira o resultado de cada playlist abaixo.") : t("Nenhuma transferência em execução."))}
            </p>

            {transfers.length > 0 ? (
                <div className="mt-5 space-y-3">
                    {transfers.map((transfer) => (
                        <TransferRow
                            key={transfer.transferId}
                            transfer={transfer}
                            now={now}
                            onResume={onResume}
                            onOpenIntegrations={onOpenIntegrations}
                            onOpenHistory={onOpenHistory}
                        />
                    ))}
                </div>
            ) : (
                <div className="mt-5 flex items-center gap-4 rounded-lg border border-white/10 bg-black/30 p-4">
                    <div className="grid h-11 w-11 place-items-center rounded-lg border border-white/10 bg-white/[0.04]">
                        <Disc3 className={isTransferring ? 'animate-spinSlow text-youtube' : 'text-muted'} size={22} />
                    </div>
                    <div>
                        <p className="text-sm font-black text-white">{isTransferring ? t("Copiando suas músicas") : t("Pronto para começar")}</p>
                        <p className="mt-1 text-xs font-semibold text-muted">{t("Progresso atualizado automaticamente")}</p>
                    </div>
                </div>
            )}

            {!isTransferring && hasPendingTracks && onOpenHistory && (
                <Button className="mt-4" size="sm" variant="secondary" fullWidth onClick={() => onOpenHistory()}>{t("Ver pendências no histórico")}</Button>
            )}
        </div>
    );
};

export default ActiveTransferCard;
