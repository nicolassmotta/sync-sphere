import Transfer from '../../models/Transfer.js';
import AppError from '../../utils/AppError.js';
import logger from '../../utils/logger.js';
import { addTransferJob, hasTransferJob, runTransferNow } from '../queueService.js';
import {
    loadTransferTracks,
    saveTransferTracks,
    summarizeTransferTracks,
    TRACK_STATUS,
} from './TransferTrackStore.js';
import { getOwnedTransfer } from './transferQueryService.js';

/**
 * Ações sobre transferências já criadas: retomar, tentar de novo as faixas
 * pendentes e recuperar a fila depois de um reinício.
 */
const RESUMABLE_STATUSES = new Set(['pending', 'processing', 'paused', 'needs_auth']);

const enqueue = (transfer, { mode = 'full', runAfter = null } = {}) => addTransferJob(
    transfer._id,
    transfer.user,
    transfer.sourcePlaylistId,
    transfer.direction,
    { mode, runAfter, lane: transfer.targetProvider }
);

const requeueFailedTracks = (transferId) => {
    const tracks = loadTransferTracks(transferId);
    if (!tracks) return null;

    let requeued = 0;
    let pendingInserts = 0;
    for (const track of tracks) {
        if (track.status === TRACK_STATUS.MATCHED && !track.inserted && track.targetId) pendingInserts += 1;
        if (track.status === TRACK_STATUS.FAILED || track.status === TRACK_STATUS.RETRY_QUEUED) {
            track.status = TRACK_STATUS.RETRY_QUEUED;
            track.attempts = 0;
            requeued += 1;
        }
    }

    if (requeued) saveTransferTracks(transferId, tracks);
    return { requeued: requeued + pendingInserts, pendingInserts, counts: summarizeTransferTracks(tracks) };
};

const markQueued = async (transfer, message, counts) => {
    Object.assign(transfer, {
        status: 'pending',
        resumeAt: null,
        pauseReason: null,
        pauseCount: 0,
        retryRound: 0,
        lastMessage: message,
    });
    if (counts) {
        transfer.retryQueuedCount = counts.retryQueued;
        transfer.failedCount = counts.failed;
        transfer.pendingInsertCount = counts.pendingInserts;
    }
    await transfer.save();
};

/**
 * Reenfileira falhas de busca e inserções pendentes sem apagar correspondências.
 * Reinicia a transferência inteira se ela falhou
 * antes de ler a playlist. Faixas não encontradas continuam como estão:
 * buscar de novo não muda o resultado.
 */
const retryTransferUnlocked = async ({ transferId, userId }) => {
    const transfer = await getOwnedTransfer({ transferId, userId });
    if (transfer.status === 'processing' || hasTransferJob(transfer._id)) {
        throw new AppError('Esta transferência já está em andamento.', 409);
    }

    const result = requeueFailedTracks(transfer._id);

    if (!result) {
        if (transfer.status !== 'failed') {
            throw new AppError('Esta transferência ainda não tem faixas para tentar de novo.', 400);
        }
        await markQueued(transfer, 'Transferência reenfileirada do início.');
        await enqueue(transfer);
        return { transfer, requeued: transfer.totalTracks || 0 };
    }

    if (!result.requeued) {
        throw new AppError('Nenhuma faixa pendente para tentar de novo nesta transferência.', 400);
    }

    await markQueued(transfer, `${result.requeued} faixas voltaram para a fila. ${result.pendingInserts} aguardam inserção com correspondência preservada.`, result.counts);
    await enqueue(transfer, { mode: 'retry' });
    return { transfer, requeued: result.requeued };
};

const retryingTransfers = new Set();
export const retryTransfer = async (options) => {
    const id = String(options.transferId);
    if (retryingTransfers.has(id)) throw new AppError('Esta transferência já está sendo reenfileirada.', 409);
    retryingTransfers.add(id);
    try {
        return await retryTransferUnlocked(options);
    } finally {
        retryingTransfers.delete(id);
    }
};

export const retryAllTransfers = async ({ userId }) => {
    const transfers = await Transfer.find({ user: userId });
    let requeuedTracks = 0;
    let requeuedTransfers = 0;

    for (const transfer of transfers) {
        if (transfer.status === 'processing' || hasTransferJob(transfer._id)) continue;
        const tracks = loadTransferTracks(transfer._id);
        const hasPending = transfer.status === 'failed' || tracks?.some((track) =>
            [TRACK_STATUS.FAILED, TRACK_STATUS.RETRY_QUEUED].includes(track.status)
            || (track.status === TRACK_STATUS.MATCHED && !track.inserted && track.targetId));
        if (!hasPending) continue;

        const result = await retryTransfer({ transferId: transfer._id, userId }).catch(() => null);
        if (result) {
            requeuedTracks += result.requeued;
            requeuedTransfers += 1;
        }
    }

    return { requeuedTracks, requeuedTransfers };
};

/**
 * Retoma agora uma transferência pausada ou aguardando reconexão, sem
 * esperar o horário programado.
 */
export const resumeTransfer = async ({ transferId, userId }) => {
    const transfer = await getOwnedTransfer({ transferId, userId });
    if (!['paused', 'needs_auth', 'pending'].includes(transfer.status)) {
        throw new AppError('Só é possível retomar transferências pausadas ou aguardando.', 400);
    }

    await markQueued(transfer, 'Retomada solicitada. Aguardando a fila.');
    if (!runTransferNow(transfer._id)) {
        await enqueue(transfer);
    }
    return transfer;
};

/**
 * Chamado quando uma integração volta a ficar conectada.
 */
export const resumeTransfersNeedingAuth = async ({ userId }) => {
    const transfers = await Transfer.find({ user: userId, status: 'needs_auth' });
    for (const transfer of transfers) {
        await markQueued(transfer, 'Integração reconectada. Retomando a transferência.');
        if (!runTransferNow(transfer._id)) await enqueue(transfer);
    }
    return transfers.length;
};

/**
 * No boot: toda transferência não terminada volta para a fila. As pausadas
 * respeitam o `resumeAt`; as que estavam rodando quando o processo caiu
 * voltam na hora e continuam de onde pararam.
 */
export const recoverUnfinishedTransfers = async () => {
    const transfers = await Transfer.find({});
    let recovered = 0;

    for (const transfer of transfers) {
        if (!RESUMABLE_STATUSES.has(transfer.status) || hasTransferJob(transfer._id)) continue;

        const runAfter = transfer.status === 'paused' ? transfer.resumeAt : null;
        await enqueue(transfer, { runAfter });
        recovered += 1;
    }

    if (recovered) {
        logger.info(`[Fila] ${recovered} transferência(s) não concluída(s) voltaram para a fila.`);
    }
    return recovered;
};
