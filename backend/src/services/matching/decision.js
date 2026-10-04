import { artistList, normalizeCandidate, normalizeText, titleIdentity } from './identity.js';

export const MATCH_ALGORITHM_VERSION = 'identity-v2';
export const MATCH_MIN_SCORE = 90;
export const MATCH_MIN_MARGIN = 8;

export const evaluateCandidate = (track, rawCandidate) => {
    const candidate = normalizeCandidate(rawCandidate);
    const sourceTitle = titleIdentity(track.name);
    let comparableName = candidate.name;
    for (const artist of artistList(candidate)) {
        const normalizedName = normalizeText(comparableName);
        if (normalizedName.startsWith(`${artist} `) && /\s[-:]\s/.test(comparableName)) {
            comparableName = comparableName.slice(comparableName.search(/\s[-:]\s/) + 3);
            break;
        }
    }
    const targetTitle = titleIdentity(comparableName);
    const sourceArtists = artistList(track);
    const targetArtists = artistList(candidate);
    const titleEqual = Boolean(sourceTitle.comparable && targetTitle.comparable
        && sourceTitle.comparable === targetTitle.comparable);
    const knownAliases = (track.artistAliases || []).map(normalizeText).filter(Boolean);
    const artistEqual = sourceArtists.length > 0 && sourceArtists.every((artist) => targetArtists.includes(artist)
        || (sourceArtists.length === 1 && knownAliases.some((alias) => targetArtists.includes(alias))));
    const versionsEqual = JSON.stringify(sourceTitle.versions) === JSON.stringify(targetTitle.versions)
        && (!sourceTitle.detailedVersion || sourceTitle.detailedVersion === targetTitle.detailedVersion);
    const durationDeltaMs = track.durationMs > 0 && candidate.durationMs > 0
        ? Math.abs(track.durationMs - candidate.durationMs) : null;
    const sourceIsrc = String(track.isrc || '').toUpperCase();
    const targetIsrc = String(candidate.isrc || '').toUpperCase();
    const isrcEqual = Boolean(sourceIsrc && targetIsrc && sourceIsrc === targetIsrc);
    const reasons = [];
    if (!titleEqual) reasons.push(sourceTitle.comparable && targetTitle.comparable ? 'title_conflict' : 'title_missing');
    if (!artistEqual) reasons.push(sourceArtists.length && targetArtists.length ? 'artist_conflict' : 'artist_missing');
    if (!versionsEqual) reasons.push('version_conflict');
    if (durationDeltaMs !== null && durationDeltaMs > 15000) reasons.push('duration_conflict');
    if (sourceIsrc && targetIsrc && !isrcEqual) reasons.push('isrc_conflict');
    if (candidate.available === false) reasons.push('unavailable');
    if (typeof track.explicit === 'boolean' && typeof candidate.explicit === 'boolean'
        && track.explicit !== candidate.explicit) reasons.push('explicit_conflict');
    const matchScore = (titleEqual ? 60 : 0) + (artistEqual ? 30 : 0)
        + (durationDeltaMs !== null && durationDeltaMs <= 5000 ? 10 : 0);
    return {
        candidate, matchScore: isrcEqual && !reasons.length ? 100 : matchScore,
        eligible: !reasons.length && matchScore >= MATCH_MIN_SCORE,
        reasons,
        evidence: { titleEqual, artistEqual, versionsEqual, durationDeltaMs, isrcEqual },
        algorithmVersion: MATCH_ALGORITHM_VERSION,
    };
};

export const decideCandidates = (track, candidates = []) => {
    const distinct = new Map();
    for (const raw of candidates) {
        const evaluated = evaluateCandidate(track, raw);
        const id = evaluated.candidate.targetId;
        if (!id) continue;
        const previous = distinct.get(String(id));
        if (!previous || evaluated.matchScore > previous.matchScore) distinct.set(String(id), evaluated);
    }
    const ranked = [...distinct.values()].sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.matchScore - a.matchScore);
    const best = ranked[0];
    const margin = best && ranked[1] ? best.matchScore - ranked[1].matchScore : null;
    const ambiguous = Boolean(best?.eligible && ranked[1]?.eligible && margin < MATCH_MIN_MARGIN);
    const decision = !best ? 'no_match' : best.eligible && !ambiguous ? 'accepted' : 'needs_review';
    return {
        decision, algorithmVersion: MATCH_ALGORITHM_VERSION, margin,
        reasons: !best ? ['no_candidates'] : ambiguous ? ['ambiguous_candidates'] : best.reasons,
        candidates: ranked.slice(0, 5), best: best || null,
    };
};
