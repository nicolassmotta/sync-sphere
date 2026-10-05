const TERMINAL_STATUSES = new Set(['completed', 'failed']);

export const TRANSFER_PHASES = {
    QUEUED: 'queued',
    READING: 'reading',
    MATCHING: 'matching',
    INSERTING: 'inserting',
    DONE: 'done',
};

export const getTransferCounts = (transfer) => ({
    total: transfer.totalTracks || 0,
    analyzed: transfer.analyzedCount || 0,
    matched: transfer.matchedCount ?? transfer.processedTracks ?? 0,
    notFound: transfer.notFoundCount || 0,
    retryQueued: transfer.retryQueuedCount || 0,
    failed: transfer.failedCount || 0,
    pendingInserts: transfer.pendingInsertCount || 0,
});

export const getTransferProgress = (transfer) => {
    if (TERMINAL_STATUSES.has(transfer.status)) return 100;
    if (transfer.status === 'pending' && !transfer.analyzedCount) return 0;
    if (transfer.phase === TRANSFER_PHASES.INSERTING) return 90;
    if (!transfer.totalTracks) return 5;

    const analyzed = transfer.analyzedCount ?? transfer.processedTracks ?? 0;
    const trackProgress = Math.round((analyzed / transfer.totalTracks) * 75);
    return Math.max(5, Math.min(85, 10 + trackProgress));
};

const defaultMessage = (transfer) => {
    if (transfer.status === 'pending') return 'Transferência aguardando processamento na fila.';
    if (transfer.status === 'paused') return 'Transferência pausada. Ela volta sozinha no horário indicado.';
    if (transfer.status === 'needs_auth') return 'Reconecte a integração para continuar a transferência.';
    return 'Sincronizando faixas...';
};

export const buildTransferSnapshot = (transfer, live = {}) => ({
    transferId: transfer._id,
    status: transfer.status,
    phase: transfer.phase || (transfer.status === 'pending' ? TRANSFER_PHASES.QUEUED : null),
    direction: transfer.direction,
    sourceProvider: transfer.sourceProvider,
    targetProvider: transfer.targetProvider,
    playlistName: transfer.playlistName,
    message: transfer.lastMessage || defaultMessage(transfer),
    progress: getTransferProgress(transfer),
    counts: getTransferCounts(transfer),
    etaSeconds: transfer.etaSeconds ?? null,
    tracksPerMinute: transfer.tracksPerMinute ?? null,
    resumeAt: transfer.resumeAt || null,
    pauseReason: transfer.pauseReason || null,
    targetPlaylistUrl: transfer.targetPlaylistUrl,
    queuePosition: live.queuePosition ?? null,
    currentTrack: live.currentTrack ?? null,
    recentTracks: live.recentTracks ?? [],
});
