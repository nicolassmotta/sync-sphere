import { throttleSearch, withSearchRequestBudget } from './requestBudget.js';
import crypto from 'node:crypto';
import { classifyProviderError } from '../../errors/providerErrors.js';
import { decideCandidates, MATCH_ALGORITHM_VERSION } from './decision.js';
import { normalizeCandidate } from './identity.js';
import { buildSearchStrategies } from './searchStrategies.js';

export const searchWithStrategies = async ({ searchClient, track, getMatchId, delayMs = 0,
    scope = searchClient.kind || 'catalog', maxQueries = 6, maxRequests = 12, timeoutMs = 15000, maxTimeMs = 30000, getStopError, onCheckpoint }) => {
    if (!searchClient.searchCandidates) {
        const match = searchClient.searchBestMatch
            ? await searchClient.searchBestMatch({ track }) : await searchClient.searchBestVideoMatch({ track });
        if (!match) return null;
        if (match.matching?.algorithmVersion === 'file-preservation-v1') return match;
        const matching = match.matching || decideCandidates(track, [{ ...match, targetId: getMatchId(match) }]);
        return { ...match, matching: { ...matching, limitedEvidence: !match.matching, queries: 1, strategy: 'legacy' } };
    }
    const context = crypto.createHash('sha256').update(JSON.stringify([
        MATCH_ALGORITHM_VERSION, scope, track.name, track.artist, track.artists, track.durationMs, track.isrc, track.album, track.explicit, track.artistAliases,
    ])).digest('hex');
    const previous = track.searchCheckpoint?.context === context ? track.searchCheckpoint : null;
    const checkpoint = previous || { context, completed: [], candidates: [], queries: 0 };
    track.searchCheckpoint = checkpoint;
    let matching = decideCandidates(track, checkpoint.candidates);
    const startedAt = Date.now();
    if (maxRequests <= 0) {
        const error = new Error('O orçamento de requisições ao catálogo foi esgotado.');
        error.kind = 'permanent';
        error.code = 'ETIMEDOUT';
        throw error;
    }
    if (checkpoint.failure && (checkpoint.queries >= maxQueries || (checkpoint.requests || 0) >= maxRequests)) {
        const error = new Error('O orçamento de busca foi esgotado após uma falha técnica.');
        error.kind = 'permanent';
        error.code = 'ETIMEDOUT';
        throw error;
    }
    for (const strategy of buildSearchStrategies(track, searchClient.capabilities)) {
        if (matching.decision === 'accepted') break;
        const stopped = getStopError?.();
        if (stopped) throw stopped;
        if (checkpoint.queries >= maxQueries || (checkpoint.requests || 0) >= maxRequests) break;
        if (checkpoint.completed.includes(strategy.id)) continue;
        await throttleSearch(scope, delayMs);
        // Tentativas, inclusive falhas técnicas, consomem orçamento. Não viram ausência de catálogo.
        checkpoint.queries += 1;
        const remainingMs = maxTimeMs - (Date.now() - startedAt);
        if (remainingMs <= 0) {
            const error = new Error('O tempo máximo de busca foi atingido.');
            error.code = 'ETIMEDOUT';
            checkpoint.failure = 'transient';
            throw error;
        }
        const controller = new AbortController();
        let timer;
        let raw;
        try {
            raw = await Promise.race([
                withSearchRequestBudget({ checkpoint, maxRequests, scope, delayMs, signal: controller.signal, getStopError },
                    () => searchClient.searchCandidates({ track, strategy, limit: 10 })),
                new Promise((_, reject) => {
                    timer = setTimeout(() => {
                        const error = new Error('A consulta ao catálogo excedeu o tempo máximo.');
                        error.code = 'ETIMEDOUT';
                        controller.abort(error);
                        reject(error);
                    }, Math.min(timeoutMs, remainingMs));
                }),
            ]);
            delete checkpoint.failure;
        } catch (error) {
            checkpoint.failure = classifyProviderError(error);
            await onCheckpoint?.();
            throw error;
        } finally { clearTimeout(timer); }
        const candidates = raw.slice(0, 10).map((candidate) => normalizeCandidate({ ...candidate, targetId: getMatchId(candidate) }));
        matching = decideCandidates(track, [...checkpoint.candidates, ...candidates]);
        checkpoint.candidates = matching.candidates.map((item) => item.candidate);
        checkpoint.completed.push(strategy.id);
        track.matching = { ...matching, queries: checkpoint.queries + (checkpoint.previousQueries || 0), requests: (checkpoint.requests || 0) + (checkpoint.previousRequests || 0), strategy: strategy.id };
        await onCheckpoint?.();
    }
    matching = { ...matching, queries: checkpoint.queries + (checkpoint.previousQueries || 0), requests: (checkpoint.requests || 0) + (checkpoint.previousRequests || 0), strategy: checkpoint.completed.at(-1) || null };
    return matching.best ? { ...matching.best.candidate, id: matching.best.candidate.targetId,
        matchScore: matching.best.matchScore, matching } : { matching };
};
