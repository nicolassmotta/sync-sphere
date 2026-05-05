const TERMINAL_STATUSES = new Set(['completed', 'failed']);

export const getTransferProgress = (transfer) => {
    if (TERMINAL_STATUSES.has(transfer.status)) return 100;
    if (transfer.status !== 'processing') return 0;
    if (!transfer.totalTracks) return 5;

    const trackProgress = Math.round((transfer.processedTracks / transfer.totalTracks) * 75);
    return Math.max(5, Math.min(85, 10 + trackProgress));
};

export const buildTransferSnapshot = (transfer) => ({
    transferId: transfer._id,
    status: transfer.status,
    message: transfer.lastMessage || (
        transfer.status === 'pending'
            ? 'Transferência aguardando processamento na fila.'
            : 'Sincronizando faixas...'
    ),
    progress: getTransferProgress(transfer),
    targetPlaylistUrl: transfer.targetPlaylistUrl,
});
