/**
 * Pontuação de candidato comum às plataformas novas. Candidato no formato
 * `{ name, artists: string[], durationMs, isrc }`.
 *
 * - ISRC igual: 100 (mesma gravação).
 * - Nome: 60 igual, 35 contido.
 * - Artista: 30 igual/contido, até 20 por palavras em comum.
 * - Duração: 10 até 5 s de diferença, 5 até 15 s.
 * - Versão diferente (remix, cover, ao vivo...) que a faixa original não tem: -30.
 */
export const normalizeText = (value) => (
    String(value || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/\([^)]*\)|\[[^\]]*\]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
);

const tokens = (value) => new Set(normalizeText(value).split(' ').filter((token) => token.length > 1));

const scoreName = (trackName, candidateName) => {
    const a = normalizeText(trackName);
    const b = normalizeText(candidateName);
    if (!a || !b) return 0;
    if (a === b) return 60;
    if (a.includes(b) || b.includes(a)) return 35;
    return 0;
};

const scoreArtist = (trackArtist, candidateArtists) => {
    const a = normalizeText(trackArtist);
    const b = normalizeText(candidateArtists.join(' '));
    if (!a || !b) return 0;
    if (a === b || a.includes(b) || b.includes(a)) return 30;

    const trackTokens = tokens(trackArtist);
    const candidateTokens = tokens(candidateArtists.join(' '));
    const shared = [...trackTokens].filter((token) => candidateTokens.has(token)).length;
    if (!shared) return 0;
    return Math.min(20, Math.round((shared / Math.max(1, trackTokens.size)) * 20));
};

const scoreDuration = (trackMs, candidateMs) => {
    if (!trackMs || !candidateMs) return 0;
    const diffSeconds = Math.abs(Math.round(trackMs / 1000) - Math.round(candidateMs / 1000));
    if (diffSeconds <= 5) return 10;
    if (diffSeconds <= 15) return 5;
    return 0;
};

const VERSION_PATTERN = /\b(remix|remake|cover|karaoke|instrumental|sped ?up|slowed|reverb|nightcore|8d|live|ao vivo|en vivo|acoustic|acustico|mashup|bootleg|edit|tribute|tributo)\b/g;

const versionTags = (value) => new Set(
    String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().match(VERSION_PATTERN) || []
);

const scoreVersion = (trackName, candidateName) => {
    const trackTags = versionTags(trackName);
    const extra = [...versionTags(candidateName)].filter((tag) => !trackTags.has(tag));
    return extra.length ? -30 : 0;
};

/**
 * `candidate.rawName`, quando existe, é o título completo (com parênteses),
 * usado para detectar versões; `name` é comparado já normalizado.
 */
export const scoreTrackCandidate = (track, candidate) => {
    if (track.isrc && candidate.isrc && track.isrc.toUpperCase() === candidate.isrc.toUpperCase()) {
        return 100;
    }

    return scoreName(track.name, candidate.name)
        + scoreArtist(track.artist, candidate.artists || [])
        + scoreDuration(track.durationMs, candidate.durationMs)
        + scoreVersion(track.name, candidate.rawName || candidate.name);
};

/**
 * `requireArtist`: descarta candidatos sem artista em comum (catálogos com
 * muito upload de terceiros, como o SoundCloud).
 */
export const pickBestCandidate = (track, candidates, { requireArtist = false } = {}) => candidates
    .filter((candidate) => !requireArtist || scoreArtist(track.artist, candidate.artists || []) > 0
        || (track.isrc && candidate.isrc === track.isrc))
    .map((candidate) => ({ ...candidate, matchScore: scoreTrackCandidate(track, candidate) }))
    .sort((a, b) => b.matchScore - a.matchScore)[0] || null;
