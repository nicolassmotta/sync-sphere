import { decideCandidates, evaluateCandidate } from './decision.js';
export { normalizeText } from './identity.js';

export const scoreTrackCandidate = (track, candidate) => evaluateCandidate(track, candidate).matchScore;

/** Ponte de compatibilidade. A decisão estruturada acompanha o melhor candidato. */
export const pickBestCandidate = (track, candidates, { requireArtist = false } = {}) => {
    if (requireArtist) candidates = candidates.filter((candidate) => evaluateCandidate(track, candidate).evidence.artistEqual);
    const result = decideCandidates(track, candidates);
    if (!result.best) return null;
    const bestId = result.best.candidate.targetId;
    const raw = candidates.find((candidate) => String(candidate.targetId || candidate.uri || candidate.videoId || candidate.id) === String(bestId));
    return { ...raw, matchScore: result.best.matchScore, matching: result };
};
