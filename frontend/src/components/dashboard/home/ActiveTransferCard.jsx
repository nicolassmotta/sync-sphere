import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    AlertTriangle,
    CheckCircle2,
    Clock,
    Disc3,
    Gauge,
    KeyRound,
    PauseCircle,
    Play,
    RotateCw,
    Search,
    XCircle,
} from 'lucide-react';
import Badge from '../../ui/Badge';
import Button from '../../ui/Button';
import StatusBadge from '../../ui/StatusBadge';
import { formatCountdown, formatEta } from '../../../utils/formatDuration';

const TERMINAL_STATUSES = ['completed', 'failed'];

const trackStatusIcons = {
    matched: <CheckCircle2 size={14} className="shrink-0 text-spotify" aria-label="Encontrada" />,
    not_found: <XCircle size={14} className="shrink-0 text-yellow-300" aria-label="Não encontrada" />,
    retry_queued: <RotateCw size={14} className="shrink-0 text-sky-300" aria-label="Na fila de retry" />,
    failed: <AlertTriangle size={14} className="shrink-0 text-red-400" aria-label="Falhou" />,
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

const ProgressBar = ({ value, className = 'h-3' }) => (
    <div className={`${className} overflow-hidden rounded-full bg-white/10`}>
        <motion.div
            className="h-full rounded-full bg-gradient-to-r from-spotify to-youtube"
            initial={{ width: 0 }}
            animate={{ width: `${value}%` }}
            transition={{ type: 'spring', bounce: 0, duration: 0.9 }}
        />
    </div>
);

const describeProgress = (transfer) => {
    const counts = transfer.counts;
    if (transfer.status === 'pending') {
        return transfer.queuePosition > 1 ? `Na fila (posição ${transfer.queuePosition})` : 'Aguardando a fila';
    }
    if (!counts?.total) return transfer.phase === 'reading' ? 'Lendo a playlist de origem...' : null;

    const parts = [`${counts.analyzed} de ${counts.total} faixas`];
    if (transfer.status === 'processing' && transfer.phase === 'inserting') parts.push('inserindo na playlist');
    else if (transfer.status === 'processing' && transfer.etaSeconds) parts.push(`${formatEta(transfer.etaSeconds)} restantes`);
    if (transfer.status === 'processing' && transfer.tracksPerMinute) parts.push(`${transfer.tracksPerMinute} faixas/min`);
    return parts.join(' · ');
};

const CountChips = ({ counts }) => {
    if (!counts?.total) return null;
    const pendingCount = (counts.retryQueued || 0) + (counts.failed || 0);

    return (
        <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone="success" icon={<CheckCircle2 size={12} aria-hidden="true" />}>
                {counts.matched} encontradas
            </Badge>
            {counts.notFound > 0 && (
                <Badge tone="warning" icon={<XCircle size={12} aria-hidden="true" />}>
                    {counts.notFound} não encontradas
                </Badge>
            )}
            {pendingCount > 0 && (
                <Badge tone="info" icon={<RotateCw size={12} aria-hidden="true" />}>
                    {pendingCount} na fila de retry
                </Badge>
            )}
        </div>
    );
};

const PauseNotice = ({ transfer, now, onResume, onOpenIntegrations }) => {
    const [resuming, setResuming] = useState(false);

    if (transfer.status === 'needs_auth') {
        return (
            <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3">
                <p className="flex items-start gap-2 text-xs font-semibold leading-5 text-red-200">
                    <KeyRound size={14} className="mt-0.5 shrink-0" />
                    {transfer.message}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={onOpenIntegrations}>Abrir integrações</Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        loading={resuming}
                        loadingLabel="Retomando..."
                        onClick={async () => {
                            setResuming(true);
                            await onResume(transfer.transferId);
                            setResuming(false);
                        }}
                    >
                        Já reconectei
                    </Button>
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
                    : 'Pausada: a plataforma limitou as buscas. Nenhuma faixa foi perdida.'}
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-yellow-200">
                    <Clock size={13} /> Volta em {countdown}
                </span>
                <Button
                    size="sm"
                    variant="secondary"
                    leftIcon={<Play size={13} />}
                    loading={resuming}
                    loadingLabel="Retomando..."
                    onClick={async () => {
                        setResuming(true);
                        await onResume(transfer.transferId);
                        setResuming(false);
                    }}
                >
                    Retomar agora
                </Button>
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
                    <span className="truncate">{transfer.currentTrack.name} - {transfer.currentTrack.artist}</span>
                </p>
            )}
            {recentTracks.map((track) => (
                <p key={track.index} className="flex items-center gap-2 text-xs font-semibold text-white/60">
                    {trackStatusIcons[track.status]}
                    <span className="truncate">{track.name} - {track.artist}</span>
                </p>
            ))}
        </div>
    );
};

const TransferRow = ({ transfer, now, onResume, onOpenIntegrations }) => (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-2 flex items-start justify-between gap-3">
            <p className="min-w-0 truncate text-sm font-extrabold text-white">
                {transfer.playlistName || 'Playlist'}
            </p>
            <StatusBadge status={transfer.status} />
        </div>
        <ProgressBar value={transfer.progress || 0} className="h-2" />
        {describeProgress(transfer) && (
            <p className="mt-2 text-xs font-semibold text-muted">{describeProgress(transfer)}</p>
        )}
        {TERMINAL_STATUSES.includes(transfer.status) && transfer.message && (
            <p className="mt-2 text-xs font-semibold leading-5 text-white/70">{transfer.message}</p>
        )}
        <CountChips counts={transfer.counts} />
        <PauseNotice transfer={transfer} now={now} onResume={onResume} onOpenIntegrations={onOpenIntegrations} />
        <LiveFeed transfer={transfer} />
    </div>
);

const ActiveTransferCard = ({
    isTransferring,
    progress,
    progressMessage,
    transfers = [],
    onResume,
    onOpenIntegrations,
    onOpenHistory,
}) => {
    const hasCountdown = transfers.some((transfer) => transfer.status === 'paused');
    const now = useNow(hasCountdown);
    const running = transfers.filter((transfer) => !TERMINAL_STATUSES.includes(transfer.status));
    const totalEta = running.reduce((sum, transfer) => sum + (transfer.etaSeconds || 0), 0);
    const hasPendingTracks = transfers.some((transfer) => (
        (transfer.counts?.failed || 0) + (transfer.counts?.retryQueued || 0) > 0
    ));

    return (
        <div className="elevated-card p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                    <p className="text-xs font-bold uppercase text-white/40">Migração ativa</p>
                    <h3 className="mt-1 text-xl font-black text-white">{progress}% concluído</h3>
                    {isTransferring && totalEta > 0 && (
                        <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-bold text-spotify">
                            <Clock size={13} /> {formatEta(totalEta)} restantes
                        </p>
                    )}
                </div>
                <Gauge className="text-spotify" size={24} />
            </div>

            <ProgressBar value={progress} />
            <p className="mt-4 text-sm font-semibold leading-6 text-white/70">
                {isTransferring ? (progressMessage || 'Sincronizando faixas...') : 'Nenhuma transferência em execução.'}
            </p>

            {transfers.length > 0 ? (
                <div className="mt-5 max-h-[34rem] space-y-3 overflow-y-auto pr-1">
                    {transfers.map((transfer) => (
                        <TransferRow
                            key={transfer.transferId}
                            transfer={transfer}
                            now={now}
                            onResume={onResume}
                            onOpenIntegrations={onOpenIntegrations}
                        />
                    ))}
                </div>
            ) : (
                <div className="mt-5 flex items-center gap-4 rounded-lg border border-white/10 bg-black/30 p-4">
                    <div className="grid h-11 w-11 place-items-center rounded-lg border border-white/10 bg-white/[0.04]">
                        <Disc3 className={isTransferring ? 'animate-spinSlow text-youtube' : 'text-muted'} size={22} />
                    </div>
                    <div>
                        <p className="text-sm font-black text-white">{isTransferring ? 'Copiando suas músicas' : 'Pronto para começar'}</p>
                        <p className="mt-1 text-xs font-semibold text-muted">Progresso atualizado automaticamente</p>
                    </div>
                </div>
            )}

            {!isTransferring && hasPendingTracks && onOpenHistory && (
                <Button className="mt-4" size="sm" variant="secondary" fullWidth onClick={onOpenHistory}>
                    Ver pendências no histórico
                </Button>
            )}
        </div>
    );
};

export default ActiveTransferCard;
