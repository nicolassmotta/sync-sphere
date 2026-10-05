import { candidateUrl } from '../matching/trackUrls.js';
import MatchCache from '../matching/MatchCache.js';
import { matchCacheScope } from '../matching/cacheScope.js';
import { MATCH_ALGORITHM_VERSION } from '../matching/decision.js';
import { searchWithStrategies } from '../matching/searchOrchestrator.js';
import { evaluateCandidate } from '../matching/decision.js';
import { withTransferActionLock as withReviewLock } from './transferActionLock.js';
import crypto from 'node:crypto';
import AppError from '../../utils/AppError.js';
import { classifyProviderError, ERROR_KINDS } from '../../errors/providerErrors.js';
import { getProvider } from '../../providers/registry.js';
import { resolveTransferProviders } from '../../constants/transferDirections.js';
import { addTransferJob, hasTransferJob } from '../queueService.js';
import { getOwnedTransfer } from './transferQueryService.js';
import {
    buildTransferErrors, loadTransferTracks, saveTransferTracks,
    summarizeTransferTracks, TRACK_STATUS,
} from './TransferTrackStore.js';

const REVIEWABLE = new Set([TRACK_STATUS.NOT_FOUND, TRACK_STATUS.NEEDS_REVIEW, TRACK_STATUS.FAILED]);
const CANDIDATE_TTL_MS = 10 * 60 * 1000;

const loadEditable = async ({ transferId, userId, trackIndex, allowInserted = false }) => {
    const transfer = await getOwnedTransfer({ transferId, userId });
    if (!['completed', 'failed'].includes(transfer.status) || hasTransferJob(transferId)) {
        throw new AppError('Aguarde a transferência terminar antes de revisar faixas.', 409);
    }
    const tracks = loadTransferTracks(transferId) || [];
    const track = tracks.find((item) => item.index === Number(trackIndex));
    if (!track) throw new AppError('Faixa não encontrada nesta transferência.', 404);
    if (!(allowInserted && track.inserted && track.status === TRACK_STATUS.MATCHED)
        && (!REVIEWABLE.has(track.status) || track.inserted)) {
        throw new AppError('Esta faixa já foi resolvida ou está aguardando uma nova tentativa.', 409);
    }
    const { targetProvider } = resolveTransferProviders(transfer);
    const provider = getProvider(targetProvider);
    if (provider.id === 'file') throw new AppError('O destino Arquivo não precisa de correspondência manual.', 400);
    return { transfer, tracks, track, provider };
};

const artistName = (candidate) => {
    const artists = candidate.artists || candidate.artist || [];
    return Array.isArray(artists)
        ? artists.map((artist) => typeof artist === 'string' ? artist : artist?.name).filter(Boolean).join(', ')
        : typeof artists === 'string' ? artists : artists?.name || '';
};

const persistProposals = (track, provider, candidates) => {
    track.candidateRevision = (track.candidateRevision || 0) + 1;
    track.manualCandidates = candidates.slice(0, 5).map((candidate) => {
        const targetId = provider.getMatchId(candidate) || candidate.targetId;
        return {
            id: crypto.randomUUID(), revision: track.candidateRevision, targetId,
            name: candidate.rawName || candidate.name || candidate.title || '',
            artist: artistName(candidate), album: candidate.album || '',
            durationMs: candidate.durationMs || candidate.duration_ms || (Number(candidate.duration) || 0) * 1000,
            isrc: candidate.isrc || null, explicit: candidate.explicit ?? null, available: candidate.available ?? null,
            matchScore: evaluateCandidate(track, candidate).matchScore,
            reasons: [...evaluateCandidate(track, candidate).reasons, ...(track.matching?.reasons?.includes('ambiguous_candidates') ? ['ambiguous_candidates'] : [])],
            externalUrl: candidateUrl(provider.id, targetId, candidate),
            expiresAt: Date.now() + CANDIDATE_TTL_MS,
        };
    }).filter((candidate) => candidate.targetId);
    if (track.manualCandidates.length) track.manualCandidate = track.manualCandidates[0];
    else delete track.manualCandidate;
    return track.manualCandidates;
};

export const listManualCandidates = (options) => withReviewLock(options.transferId, async () => {
    const { provider, track, tracks } = await loadEditable(options);
    if (!track.manualCandidates?.length || track.manualCandidates.some((item) => item.expiresAt <= Date.now())) {
        persistProposals(track, provider, (track.matching?.candidates || []).map((item) => item.candidate));
        saveTransferTracks(options.transferId, tracks);
    }
    return track.manualCandidates;
});

export const searchManualMatches = (options) => withReviewLock(options.transferId, async () => {
    const { provider, track } = await loadEditable(options);
    await provider.ensureWritable({ userId: options.userId });
    const searchClient = provider.createSearchClient({ userId: options.userId });
    const queryTrack = {
        ...track, name: options.name.trim(), artist: options.artist.trim(), artists: null, artistAliases: null,
        isrc: null, searchCheckpoint: null,
    };
    let result;
    try {
        result = await searchWithStrategies({ searchClient, track: queryTrack,
            getMatchId: provider.getMatchId, delayMs: provider.getSearchDelayMs?.() || 0, scope: provider.id });
    } catch (error) {
        if (error instanceof AppError) throw error;
        const kind = classifyProviderError(error);
        if (kind === ERROR_KINDS.RATE_LIMITED) throw new AppError('A plataforma limitou as buscas. Aguarde antes de tentar novamente.', 429);
        if (kind === ERROR_KINDS.AUTH) throw new AppError(`Reconecte o ${provider.label} antes de buscar uma alternativa.`, 401);
        throw new AppError(`Não foi possível buscar no ${provider.label}. Tente novamente em instantes.`, 503);
    }
    const current = await loadEditable(options);
    const candidates = result?.matching?.candidates?.map((item) => item.candidate) || (result ? [result] : []);
    const proposals = persistProposals(current.track, provider, candidates);
    saveTransferTracks(options.transferId, current.tracks);
    return proposals;
});

// Mantém o contrato de revisão de uma única faixa para clientes anteriores.
export const searchManualMatch = async (options) => (await searchManualMatches(options))[0] || null;

export const confirmManualMatchBatch = (options) => withReviewLock(options.transferId, async () => {
    const { choices } = options;
    if (!Array.isArray(choices) || !choices.length || choices.length > 100
        || new Set(choices.map((choice) => choice.trackIndex)).size !== choices.length) {
        throw new AppError('Lote de revisão inválido.', 400);
    }
    const transfer = await getOwnedTransfer(options);
    const persisted = loadTransferTracks(options.transferId) || [];
    const same = choices.every((choice) => {
        const track = persisted.find((item) => item.index === choice.trackIndex);
        return track?.review?.candidateId === choice.candidateId && track?.review?.action === choice.action
            && (choice.revision == null || track.review.revision === choice.revision);
    });
    if (same) {
        if (persisted.some((track) => track.review && !track.inserted && track.status === TRACK_STATUS.MATCHED)
            && !hasTransferJob(transfer._id)) {
            transfer.status = 'pending';
            await transfer.save();
            await addTransferJob(transfer._id, options.userId, transfer.sourcePlaylistId, transfer.direction, { mode: 'manual', lane: transfer.targetProvider || resolveTransferProviders(transfer).targetProvider });
        }
        return transfer;
    }
    // Valida todas as escolhas antes da primeira escrita.
    const editable = await loadEditable({ ...options, trackIndex: choices[0].trackIndex });
    await editable.provider.ensureWritable({ userId: options.userId });
    const selections = [];
    for (const choice of choices) {
        const current = await loadEditable({ ...options, trackIndex: choice.trackIndex });
        const candidate = choice.action === 'skip' ? null
            : (current.track.manualCandidates || [current.track.manualCandidate]).find((item) => item?.id === choice.candidateId);
        if (choice.action !== 'skip' && (!candidate || candidate.expiresAt <= Date.now()
            || (choice.revision != null && candidate.revision !== choice.revision))) {
            throw new AppError('A alternativa expirou ou mudou. Faça uma nova busca antes de confirmar.', 409);
        }
        selections.push({ choice, candidate });
    }
    const { tracks, provider } = await loadEditable({ ...options, trackIndex: choices[0].trackIndex });
    for (const { choice, candidate } of selections) {
        const track = tracks.find((item) => item.index === choice.trackIndex);
        Object.assign(track, {
            status: choice.action === 'skip' ? TRACK_STATUS.SKIPPED : TRACK_STATUS.MATCHED,
            targetId: candidate?.targetId || null, matchScore: null, matchSource: 'manual',
            manualMatch: candidate ? { name: candidate.name, artist: candidate.artist } : null,
            review: { action: choice.action, candidateId: choice.candidateId, revision: candidate?.revision, rejectedTargetIds: choice.action === 'skip' ? (track.manualCandidates || []).map((item) => item.targetId).slice(0, 5) : [], evidence: candidate ? evaluateCandidate(track, candidate) : null, at: new Date().toISOString() },
            chosenCandidate: candidate || null,
            inserted: false, attempts: 0, errorKind: null, lastError: null,
        });
        delete track.manualCandidate;
        delete track.manualCandidates;
    }
    // Faixas são a fonte de recuperação se o processo cair antes de salvar/enfileirar.
    saveTransferTracks(transfer._id, tracks);
    const counts = summarizeTransferTracks(tracks);
    Object.assign(transfer, {
        status: counts.pendingInserts ? 'pending' : 'completed', phase: counts.pendingInserts ? 'inserting' : 'done',
        resumeAt: null, pauseReason: null, pauseCount: 0, retryRound: 0,
        matchedCount: counts.matched, pendingInsertCount: counts.pendingInserts,
        analyzedCount: counts.analyzed, notFoundCount: counts.notFound,
        needsReviewCount: counts.needsReview, skippedCount: counts.skipped,
        failedCount: counts.failed, retryQueuedCount: counts.retryQueued,
        errors: buildTransferErrors(tracks, `${provider.id}-matching`),
        lastMessage: 'Revisão salva. Escolhas confirmadas aguardam inserção na playlist.',
    });
    await transfer.save();
    const cache = new MatchCache({ scope: matchCacheScope(provider.id, options.userId) });
    for (const { choice, candidate } of selections) {
        const track = tracks.find((item) => item.index === choice.trackIndex);
        if (candidate) cache.set(track, { targetId: candidate.targetId, matchScore: null,
            matching: { decision: 'manual', algorithmVersion: MATCH_ALGORITHM_VERSION,
                reasons: ['user_choice'], best: { candidate: { targetId: candidate.targetId, name: candidate.name, artist: candidate.artist, durationMs: candidate.durationMs, album: candidate.album, externalUrl: candidate.externalUrl } }, candidates: [], strategy: 'manual' } });
        else cache.forget(track);
    }
    cache.flush();
    if (counts.pendingInserts) await addTransferJob(transfer._id, options.userId, transfer.sourcePlaylistId, transfer.direction, {
        mode: 'manual', lane: provider.id,
    });
    return transfer;
});

export const confirmManualMatch = (options) => confirmManualMatchBatch({ ...options,
    choices: [{ trackIndex: Number(options.trackIndex), candidateId: options.candidateId, action: 'choose' }],
});

export const forgetManualChoice = (options) => withReviewLock(options.transferId, async () => {
    const transfer = await getOwnedTransfer(options);
    const tracks = loadTransferTracks(options.transferId) || [];
    const track = tracks.find((item) => item.index === Number(options.trackIndex));
    if (!track) throw new AppError('Faixa não encontrada nesta transferência.', 404);
    const { targetProvider } = resolveTransferProviders(transfer);
    new MatchCache({ scope: matchCacheScope(targetProvider, options.userId) }).forget(track);
});
