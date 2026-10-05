export const getPendingCount = (item) => (item.failedCount || 0) + (item.retryQueuedCount || 0) + (item.pendingInsertCount || 0);
export const getDisplayPendingCount = (item) => getPendingCount(item) + (item.needsReviewCount || 0);
export const getInsertedCount = (item) => Math.max(0, (item.matchedCount ?? item.processedTracks ?? 0) - (item.pendingInsertCount || 0));

export const isActiveTransfer = (item) => ['pending', 'processing', 'paused', 'needs_auth'].includes(item.status);
export const needsAttention = (item) => item.status === 'failed' || item.status === 'needs_auth'
    || (item.status === 'completed' && (getDisplayPendingCount(item) > 0 || item.notFoundCount > 0 || item.sourceTruncated));
export const isResolvedTransfer = (item) => item.status === 'completed' && !needsAttention(item);

export const HISTORY_FILTERS = [
    { id: 'all', label: 'Todas', matches: () => true },
    { id: 'attention', label: 'Precisam de atenção', matches: needsAttention },
    { id: 'active', label: 'Em andamento', matches: isActiveTransfer },
    { id: 'completed', label: 'Concluídas', matches: isResolvedTransfer },
];

export const filterHistory = (history, filter, search) => {
    const matches = HISTORY_FILTERS.find((entry) => entry.id === filter)?.matches || HISTORY_FILTERS[0].matches;
    const query = search.trim().toLocaleLowerCase();
    return history.filter((item) => matches(item) && (item.playlistName || '').toLocaleLowerCase().includes(query));
};
