import Transfer from '../../models/Transfer.js';
import AppError from '../../utils/AppError.js';
import { resolveTransferProviders } from '../../constants/transferDirections.js';
import { getSearchConcurrency } from './TrackMatcher.js';
import { estimateTransferSeconds, getProviderStats } from './TransferMetrics.js';
import { loadTransferTracks, summarizeTransferTracks } from './TransferTrackStore.js';

export const getOwnedTransfer = async ({ transferId, userId }) => {
    const transfer = await Transfer.findById(transferId);

    if (!transfer) {
        throw new AppError('Nenhum dado de conversão achado com esse ID.', 404);
    }

    if (transfer.user.toString() !== userId) {
        throw new AppError('Acesso Negado. Esta transferência pertence a outro usuário e você não tem autorização para visualizá-la.', 403);
    }

    return transfer;
};

export const listOwnedTransfers = ({ userId, limit = 50 }) => {
    return Transfer.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(limit);
};

export const listTransferTracks = async ({ transferId, userId, status }) => {
    const transfer = await getOwnedTransfer({ transferId, userId });
    const tracks = loadTransferTracks(transfer._id) || [];
    const statuses = status ? new Set(String(status).split(',')) : null;

    return {
        transfer,
        counts: summarizeTransferTracks(tracks),
        tracks: statuses ? tracks.filter((track) => statuses.has(track.status)) : tracks,
    };
};

const ACTIVE_STATUSES = new Set(['pending', 'processing', 'paused']);

/**
 * Estimativa antes de iniciar: tempo das faixas novas mais o que ainda falta
 * nas transferências que já estão na fila.
 */
export const estimateTransfer = async ({ userId, direction, targetProvider: requestedTarget, trackCount }) => {
    const { targetProvider } = resolveTransferProviders({ direction, targetProvider: requestedTarget });
    const concurrency = getSearchConcurrency();
    const activeTransfers = (await Transfer.find({ user: userId }))
        .filter((transfer) => ACTIVE_STATUSES.has(transfer.status));

    const queueAheadSeconds = activeTransfers.reduce((sum, transfer) => {
        const remaining = Math.max(0, (transfer.totalTracks || 0) - (transfer.analyzedCount || 0));
        return sum + estimateTransferSeconds({ provider: transfer.targetProvider, trackCount: remaining, concurrency });
    }, 0);

    return {
        trackCount,
        targetProvider,
        etaSeconds: estimateTransferSeconds({ provider: targetProvider, trackCount, concurrency }),
        tracksPerMinute: Math.round((60000 / getProviderStats(targetProvider).searchMs) * concurrency * 10) / 10,
        queueAheadSeconds,
        activeTransfers: activeTransfers.length,
    };
};
