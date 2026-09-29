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
        delayMs = Number(process.env.YT_MUSIC_SEARCH_DELAY_MS || 250),
        minMatchScore = 45,
        searchConcurrency = getSearchConcurrency(),
        maxTrackAttempts = clampConcurrency(process.env.MAX_TRACK_ATTEMPTS, { max: 20, fallback: 5 }),
        inlineRetries = 2,
        inlineRetryBaseMs = 1000,
        now = () => Date.now(),
    } = {}) {
        this.delayMs = delayMs;
        this.minMatchScore = minMatchScore;
        this.searchConcurrency = searchConcurrency;
        this.maxTrackAttempts = maxTrackAttempts;
        this.inlineRetries = inlineRetries;
        this.inlineRetryBaseMs = inlineRetryBaseMs;
        this.now = now;
    }

    async search(searchClient, track) {
        let lastError;

        for (let attempt = 0; attempt <= this.inlineRetries; attempt += 1) {
            try {
                return searchClient.searchBestMatch
                    ? await searchClient.searchBestMatch({ track })
                    : await searchClient.searchBestVideoMatch({ track });
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
        metrics,
        onTrackStart,
        onTrackDone,
        onCheckpoint,
    }) {
        const eligibleTracks = tracks.filter(isEligible);
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
            if (this.delayMs > 0) await wait(this.delayMs);

            try {
                const match = await this.search(searchClient, track);
                const matchId = getMatchId(match);

                if (!matchId || match.matchScore < this.minMatchScore) {
                    track.status = TRACK_STATUS.NOT_FOUND;
                    track.errorKind = ERROR_KINDS.NOT_FOUND;
                    track.lastError = noConfidentMatchReason;
                    track.matchScore = match?.matchScore ?? null;
                } else {
                    track.status = TRACK_STATUS.MATCHED;
                    track.targetId = matchId;
                    track.matchScore = match.matchScore;
                    track.errorKind = null;
                    track.lastError = null;
                }
                metrics?.recordSearch(this.now() - startedAt);
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
