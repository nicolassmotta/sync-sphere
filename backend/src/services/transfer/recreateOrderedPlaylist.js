import { evaluateCandidate } from '../matching/decision.js';
import crypto from 'node:crypto';
import Transfer from '../../models/Transfer.js';
import AppError from '../../utils/AppError.js';
import { addTransferJob, hasTransferJob } from '../queueService.js';
import { getOwnedTransfer } from './transferQueryService.js';
import { withTransferActionLock } from './transferActionLock.js';
import { loadTransferTracks, saveTransferTracks } from './TransferTrackStore.js';

/** Ação explícita cria uma cópia. A playlist anterior permanece intacta. */
export const recreateOrderedPlaylist = (options) => withTransferActionLock(options.transferId, async () => {
    const original = await getOwnedTransfer(options);
    if (!['completed', 'failed'].includes(original.status) || hasTransferJob(original._id)) {
        throw new AppError('Aguarde a transferência terminar antes de criar uma cópia.', 409);
    }
    const tracks = loadTransferTracks(original._id) || [];
    if (!tracks.length || tracks.some((track) => !['matched', 'skipped'].includes(track.status))) {
        throw new AppError('Resolva ou ignore todas as pendências antes de criar uma cópia na ordem da origem.', 409);
    }
    if (!tracks.some((track) => track.targetId)) throw new AppError('Nenhuma faixa resolvida para criar uma cópia.', 400);
    const choices = options.choices || [];
    const corrections = new Map();
    for (const choice of choices) {
        const track = tracks.find((item) => item.index === choice.trackIndex);
        const candidate = track?.manualCandidates?.find((item) => item.id === choice.candidateId && item.revision === choice.revision);
        if (!track?.inserted || !candidate || candidate.expiresAt <= Date.now()) {
            throw new AppError('A alternativa expirou ou mudou. Faça uma nova busca antes de confirmar.', 409);
        }
        corrections.set(track.index, candidate);
    }
    const correctionKey = JSON.stringify(choices);
    const existing = (await Transfer.find({ user: options.userId, sourceTransferId: original._id }))
        .find((transfer) => ['pending', 'processing', 'paused'].includes(transfer.status));
    if (existing) {
        if (existing.sourceCorrectionKey !== correctionKey) throw new AppError('Uma cópia com outras escolhas já está em andamento.', 409);
        if (!hasTransferJob(existing._id)) await addTransferJob(existing._id, options.userId, existing.sourcePlaylistId, existing.direction, { mode: 'manual', lane: existing.targetProvider });
        return existing;
    }
    const copyId = crypto.randomUUID();
    saveTransferTracks(copyId, tracks.map((track) => {
        const candidate = corrections.get(track.index);
        const { manualCandidates, manualCandidate, ...stableTrack } = track;
        return { ...stableTrack, inserted: false, insertedAt: null, destinationPresence: null,
            searchLatencyMs: 0, cacheRequestCount: 0, searchCheckpoint: null,
            matching: track.matching ? { ...track.matching, queries: 0, requests: 0, strategy: 'preserved_choice' } : null,
            ...(candidate ? { targetId: candidate.targetId, chosenCandidate: candidate, matchScore: null, matchSource: 'manual',
                review: { action: 'choose', candidateId: candidate.id, revision: candidate.revision, evidence: evaluateCandidate(track, candidate), at: new Date().toISOString() } } : {}),
        };
    }));
    const { _id, createdAt, updatedAt, ...fields } = original;
    const [copy] = await Transfer.insertMany([{
        ...fields, _id: copyId, status: 'pending', phase: 'inserting',
        playlistName: `${original.playlistName} (ordem da origem)`,
        targetPlaylistId: null, targetPlaylistUrl: null, creationIntent: null,
        targetPlaylistImageSynced: false, destinationVerification: null,
        pendingInsertCount: tracks.filter((track) => track.status === 'matched' && track.targetId).length,
        resumeAt: null, pauseReason: null, pauseCount: 0, retryRound: 0,
        sourceTransferId: original._id, sourceCorrectionKey: correctionKey,
    }]);
    await addTransferJob(copy._id, options.userId, copy.sourcePlaylistId, copy.direction, { mode: 'manual', lane: copy.targetProvider });
    return copy;
});
