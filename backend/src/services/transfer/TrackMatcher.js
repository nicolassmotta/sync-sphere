import { withCatalogTimeout } from '../matching/requestBudget.js';
import { searchWithStrategies } from '../matching/searchOrchestrator.js';
import { decideCandidates, MATCH_ALGORITHM_VERSION } from '../matching/decision.js';
import { clampConcurrency, mapWithConcurrency } from '../../utils/concurrency.js';
import {
    classifyProviderError,
    ERROR_KINDS,
    getRetryAfterMs,
    TransferNeedsAuthError,
    TransferPausedError,
} from '../../errors/providerErrors.js';
import { TRACK_STATUS } from './TransferTrackStore.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const NO_CONFIDENT_MATCH_REASON = 'Nenhum resultado confiável encontrado no YouTube Music.';

// Pausas escalonadas quando a plataforma bloqueia as buscas sem dizer por quanto tempo.
export const PAUSE_STEPS_MS = [60_000, 2 * 60_000, 5 * 60_000, 15 * 60_000, 30 * 60_000];

export const getPauseDelayMs = (pauseCount = 0, retryAfterMs = null) => {
    const step = PAUSE_STEPS_MS[Math.min(pauseCount, PAUSE_STEPS_MS.length - 1)];
    return Math.max(step, retryAfterMs || 0);
};

export const getSearchConcurrency = () => (
    clampConcurrency(process.env.YOUTUBE_SEARCH_CONCURRENCY, { max: 5, fallback: 1 })
);

const isEligible = (track) => (
    track.status === TRACK_STATUS.PENDING || track.status === TRACK_STATUS.RETRY_QUEUED
);

export default class TrackMatcher {
    constructor({
        // `null`: usa o atraso da plataforma de destino (`getSearchDelayMs`).
        delayMs = null,
        searchConcurrency = getSearchConcurrency(),
        maxTrackAttempts = clampConcurrency(process.env.MAX_TRACK_ATTEMPTS, { max: 20, fallback: 5 }),
        inlineRetries = 2,
        inlineRetryBaseMs = 1000,
        now = () => Date.now(),
    } = {}) {
        this.delayMs = delayMs;
        this.searchConcurrency = searchConcurrency;
        this.maxTrackAttempts = maxTrackAttempts;
        this.inlineRetries = inlineRetries;
        this.inlineRetryBaseMs = inlineRetryBaseMs;
        this.now = now;
    }

    async search(searchClient, track, options = {}) {
        let lastError;

        for (let attempt = 0; attempt <= this.inlineRetries; attempt += 1) {
            try {
                const stopped = options.getStopError?.();
                if (stopped) throw stopped;
                return await searchWithStrategies({ searchClient, track, ...options });
            } catch (error) {
                lastError = error;
                if (classifyProviderError(error) !== ERROR_KINDS.TRANSIENT || attempt === this.inlineRetries) break;
                if (this.inlineRetryBaseMs > 0) await wait(this.inlineRetryBaseMs * 2 ** attempt);
            }
        }

        throw lastError;
    }

    /**
     * Busca correspondência para as faixas `pending` e `retry_queued`, mudando
     * o estado de cada uma no próprio array. Faixas já resolvidas são puladas,
     * então chamar de novo depois de uma pausa continua de onde parou.
     *
     * Bloqueio da plataforma lança `TransferPausedError`; token/cookie inválido
     * lança `TransferNeedsAuthError`. Nos dois casos as buscas em andamento
     * terminam, nenhuma nova começa e o estado é salvo antes de lançar.
     */
    async matchTracks({
        searchClient,
        tracks,
        getMatchId = (match) => match?.id || match?.videoId || match?.uri,
        providerLabel = 'YouTube Music',
        noConfidentMatchReason = NO_CONFIDENT_MATCH_REASON,
        pauseCount = 0,
        delayMs: providerDelayMs,
        metrics,
        matchCache,
        onTrackStart,
        onTrackDone,
        onCheckpoint,
    }) {
        const eligibleTracks = tracks.filter(isEligible);
        const delayMs = this.delayMs ?? providerDelayMs ?? 0;
        const checkpointEvery = Math.max(5, this.searchConcurrency * 2);
        let halt = null;
        let completedSinceCheckpoint = 0;
        let checkpointQueue = Promise.resolve();

        const checkpoint = () => {
            checkpointQueue = checkpointQueue.then(() => onCheckpoint?.());
            return checkpointQueue;
        };

        await mapWithConcurrency(eligibleTracks, async (track) => {
            if (halt) return;

            onTrackStart?.(track);
            const startedAt = this.now();

            try {
                let cached = matchCache?.get(track);
                if (cached && searchClient.validateCachedMatch) {
                    let available;
                    const validationCheckpoint = { requests: track.cacheRequestCount || 0 };
                    try {
                        available = await withCatalogTimeout({ checkpoint: validationCheckpoint, maxRequests: 12,
                            scope: JSON.stringify(matchCache?.scope || providerLabel), delayMs, getStopError: () => halt?.error },
                        () => searchClient.validateCachedMatch({ targetId: cached.targetId }));
                    }
                    catch (error) {
                        if (Number(error.status || error.response?.status) !== 404) throw error;
                        available = false;
                    } finally { track.cacheRequestCount = validationCheckpoint.requests; }
                    if (available === false) {
                        matchCache.forget(track);
                        delete track.searchCheckpoint;
                        cached = null;
                    }
                }
                const cacheHit = Boolean(cached?.targetId && cached.matching?.algorithmVersion === MATCH_ALGORITHM_VERSION
                    && ['accepted', 'manual'].includes(cached.matching?.decision));
                if (!cacheHit && !searchClient.searchCandidates && delayMs > 0) await wait(delayMs);
                const match = cacheHit ? cached : await this.search(searchClient, track, { getMatchId, delayMs, scope: JSON.stringify(matchCache?.scope || providerLabel), maxRequests: Math.max(0, 12 - (track.cacheRequestCount || 0)), getStopError: () => halt?.error, onCheckpoint: checkpoint });
                const matchId = cacheHit ? cached.targetId : match?.matching?.best?.candidate.targetId || getMatchId(match);

                const matching = cacheHit ? { ...cached.matching, queries: 0, requests: track.cacheRequestCount || 0, strategy: 'cache' }
                    : match?.matching || decideCandidates(track, match ? [{ ...match, targetId: matchId }] : []);
                matching.requests = (matching.requests || 0) + (cacheHit ? 0 : track.cacheRequestCount || 0);
                track.matching = matching;
                track.searchLatencyMs = cacheHit ? 0 : this.now() - startedAt;
                track.matchScore = cacheHit && matching.decision === 'manual' ? null : matching.best?.matchScore ?? null;
                if (!matchId || (matching.decision !== 'accepted' && !(cacheHit && matching.decision === 'manual'))) {
                    track.status = matching.decision === 'needs_review' ? TRACK_STATUS.NEEDS_REVIEW : TRACK_STATUS.NOT_FOUND;
                    track.errorKind = matching.decision === 'no_match' ? ERROR_KINDS.NOT_FOUND : null;
                    track.lastError = matching.decision === 'needs_review' ? 'A correspondência precisa de revisão.' : noConfidentMatchReason;
                    track.targetId = null;
                } else {
                    track.status = TRACK_STATUS.MATCHED;
                    track.targetId = matchId;
                    track.errorKind = null;
                    track.lastError = null;
                    track.matchSource = cacheHit ? (matching.decision === 'manual' ? 'manual_cache' : 'cache') : 'search';
                    track.chosenCandidate = matching.best?.candidate || null;
                    if (!cacheHit) matchCache?.set(track, { targetId: matchId, matchScore: track.matchScore, matching });
                }
                if (!cacheHit) metrics?.recordSearch(this.now() - startedAt);
            } catch (error) {
                const kind = classifyProviderError(error);
                track.errorKind = kind;
                track.lastError = error.message || `Falha ao buscar faixa no ${providerLabel}.`;

                if (kind === ERROR_KINDS.RATE_LIMITED || kind === ERROR_KINDS.AUTH) {
                    // Não é culpa da faixa: volta para a fila sem gastar tentativa.
                    track.status = TRACK_STATUS.RETRY_QUEUED;
                    halt = halt || { kind, error };
                } else if (kind === ERROR_KINDS.TRANSIENT) {
                    track.attempts += 1;
                    track.status = track.attempts >= this.maxTrackAttempts
                        ? TRACK_STATUS.FAILED
                        : TRACK_STATUS.RETRY_QUEUED;
                } else {
                    track.attempts += 1;
                    track.status = TRACK_STATUS.FAILED;
                }
            }

            onTrackDone?.(track);
            completedSinceCheckpoint += 1;
            if (completedSinceCheckpoint >= checkpointEvery) {
                completedSinceCheckpoint = 0;
                await checkpoint();
            }
        }, this.searchConcurrency);

        await checkpoint();

        if (halt?.kind === ERROR_KINDS.RATE_LIMITED) {
            const delayMs = getPauseDelayMs(pauseCount, getRetryAfterMs(halt.error));
            throw new TransferPausedError(
                `O ${providerLabel} bloqueou as buscas temporariamente: ${halt.error.message}`,
                { resumeAt: new Date(this.now() + delayMs), cause: halt.error }
            );
        }

        if (halt?.kind === ERROR_KINDS.AUTH) {
            throw new TransferNeedsAuthError(
                `A conexão com o ${providerLabel} precisa ser renovada: ${halt.error.message}`,
                { cause: halt.error }
            );
        }
    }
}
