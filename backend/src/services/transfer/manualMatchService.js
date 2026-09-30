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

const REVIEWABLE = new Set([TRACK_STATUS.NOT_FOUND, TRACK_STATUS.FAILED]);
const locks = new Set();
const CANDIDATE_TTL_MS = 10 * 60 * 1000;

const withReviewLock = async (transferId, action) => {
    if (locks.has(transferId)) throw new AppError('Uma revisão desta transferência já está em andamento.', 409);
    locks.add(transferId);
    try {
        return await action();
    } finally {
        locks.delete(transferId);
    }
};

const loadEditable = async ({ transferId, userId, trackIndex }) => {
    const transfer = await getOwnedTransfer({ transferId, userId });
    if (!['completed', 'failed'].includes(transfer.status) || hasTransferJob(transferId)) {
        throw new AppError('Aguarde a transferência terminar antes de revisar faixas.', 409);
    }
    const tracks = loadTransferTracks(transferId) || [];
    const track = tracks.find((item) => item.index === Number(trackIndex));
    if (!track) throw new AppError('Faixa não encontrada nesta transferência.', 404);
    if (!REVIEWABLE.has(track.status) || track.inserted) {
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

const candidateUrl = (providerId, targetId, candidate) => {
    const id = encodeURIComponent(String(targetId).split(':').pop());
    const urls = {
        spotify: `https://open.spotify.com/track/${id}`,
        youtubeMusic: `https://music.youtube.com/watch?v=${id}`,
        deezer: `https://www.deezer.com/track/${id}`,
        tidal: `https://listen.tidal.com/track/${id}`,
        appleMusic: `https://music.apple.com/br/song/${id}`,
    };
    if (providerId === 'soundcloud' && candidate.externalUrl) {
        try {
            const url = new URL(candidate.externalUrl);
            if (url.protocol === 'https:' && url.hostname === 'soundcloud.com') return url.href;
        } catch { /* Resultado sem link válido: a escolha ainda pode ser revisada pelo título. */ }
    }
    return urls[providerId] || null;
};

// A escolha só aceita propostas produzidas pelo servidor, com validade curta.
export const searchManualMatch = (options) => withReviewLock(options.transferId, async () => {
    const { provider, track } = await loadEditable(options);
    await provider.ensureWritable({ userId: options.userId });
    const searchClient = provider.createSearchClient({ userId: options.userId });
    const queryTrack = {
        ...track, name: options.name.trim(), artist: options.artist.trim(), isrc: null,
    };
    let candidate;
    try {
        candidate = await searchClient.searchBestMatch({ track: queryTrack });
    } catch (error) {
        if (error instanceof AppError) throw error;
        const kind = classifyProviderError(error);
        if (kind === ERROR_KINDS.RATE_LIMITED) throw new AppError('A plataforma limitou as buscas. Aguarde antes de tentar novamente.', 429);
        if (kind === ERROR_KINDS.AUTH) throw new AppError(`Reconecte o ${provider.label} antes de buscar uma alternativa.`, 401);
        throw new AppError(`Não foi possível buscar no ${provider.label}. Tente novamente em instantes.`, 503);
    }
    // Outra ação pode ter retomado a fila durante a requisição externa.
    const current = await loadEditable(options);
    delete current.track.manualCandidate;
    const targetId = provider.getMatchId(candidate);
    if (!targetId) {
        saveTransferTracks(options.transferId, current.tracks);
        return null;
    }
    const proposal = {
        id: crypto.randomUUID(), targetId,
        name: candidate.rawName || candidate.name || candidate.title || queryTrack.name,
        artist: artistName(candidate) || queryTrack.artist,
        durationMs: candidate.durationMs || candidate.duration_ms || (Number(candidate.duration) || 0) * 1000,
        matchScore: Number.isFinite(candidate.matchScore) ? candidate.matchScore : null,
        externalUrl: candidateUrl(provider.id, targetId, candidate),
        expiresAt: Date.now() + CANDIDATE_TTL_MS,
    };
    current.track.manualCandidate = proposal;
    saveTransferTracks(options.transferId, current.tracks);
    return proposal;
});

export const confirmManualMatch = (options) => withReviewLock(options.transferId, async () => {
    let current = await loadEditable(options);
    await current.provider.ensureWritable({ userId: options.userId });
    current = await loadEditable(options);
    const { transfer, tracks, track, provider } = current;
    const candidate = track.manualCandidate;
    if (!candidate || candidate.id !== options.candidateId || candidate.expiresAt <= Date.now()) {
        throw new AppError('A alternativa expirou ou mudou. Faça uma nova busca antes de confirmar.', 409);
    }
    Object.assign(track, {
        status: TRACK_STATUS.MATCHED, targetId: candidate.targetId,
        matchScore: candidate.matchScore, matchSource: 'manual',
        manualMatch: { name: candidate.name, artist: candidate.artist },
        inserted: false, attempts: 0, errorKind: null, lastError: null,
    });
    delete track.manualCandidate;
    saveTransferTracks(transfer._id, tracks);
    const counts = summarizeTransferTracks(tracks);
    Object.assign(transfer, {
        status: 'pending', phase: 'inserting', resumeAt: null, pauseReason: null,
        pauseCount: 0, retryRound: 0, matchedCount: counts.matched,
        analyzedCount: counts.analyzed, notFoundCount: counts.notFound,
        failedCount: counts.failed, retryQueuedCount: counts.retryQueued,
        errors: buildTransferErrors(tracks, `${provider.id}-matching`),
        lastMessage: 'Alternativa confirmada. Aguardando inserção na playlist.',
    });
    await transfer.save();
    await addTransferJob(transfer._id, options.userId, transfer.sourcePlaylistId, transfer.direction, {
        mode: 'manual', lane: provider.id,
    });
    return transfer;
});
