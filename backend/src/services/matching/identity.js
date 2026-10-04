/** Normalização comparável sem descartar alfabetos ou texto entre parênteses. */
export const normalizeText = (value) => String(value || '').normalize('NFKD')
    .replace(/(\p{Script=Latin})\p{M}+/gu, '$1').normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

const VERSION_TYPES = [
    ['live', /\b(live|ao vivo|en vivo)\b/],
    ['acoustic', /\b(acoustic|acustico|acustica)\b/],
    ['remix', /\b(remix|bootleg|mashup)\b/],
    ['cover', /\b(cover|tribute|tributo|remake)\b/],
    ['instrumental', /\b(instrumental|karaoke)\b/],
    ['speed', /\b(sped up|spedup|slowed|nightcore|reverb|8d)\b/],
    ['edit', /\b(edit|radio version)\b/],
    ['remaster', /\b(remaster|remastered|remasterizado)\b/],
    ['clean', /\b(clean|censored)\b/],
    ['explicit', /\b(explicit|uncensored)\b/],
];

export const titleIdentity = (value) => {
    const original = String(value || '');
    const normalized = normalizeText(original);
    const annotations = original.match(/\([^)]*\)|\[[^\]]*\]/g) || [];
    const suffix = original.includes(' - ') ? original.split(' - ').slice(1).join(' - ') : '';
    const trailingVersion = original.match(/\s+(live|ao vivo|en vivo|acoustic|acustico|remix|instrumental|karaoke|radio edit|remastered|clean|explicit)$/i)?.[1] || '';
    const versionText = normalizeText([...annotations, suffix, trailingVersion].join(' '));
    const versions = VERSION_TYPES.filter(([, pattern]) => pattern.test(versionText)).map(([type]) => type);
    const comparable = normalizeText((trailingVersion ? original.slice(0, -trailingVersion.length) : original).replace(/\([^)]*\)|\[[^\]]*\]/g, (part) => (
        VERSION_TYPES.some(([, pattern]) => pattern.test(normalizeText(part))) ? '' : part
    )).replace(/\s+-\s+.*$/, (part) => (
        VERSION_TYPES.some(([, pattern]) => pattern.test(normalizeText(part))) ? '' : part
    )));
    // Nomes de remix, edições e remasterizações fazem parte da identidade da versão.
    const detailedVersion = versions.some((type) => ['remix', 'speed', 'edit', 'remaster'].includes(type))
        ? normalized : null;
    return { original, comparable, versions, detailedVersion };
};

export const artistList = (track) => {
    const values = track.artists?.length ? track.artists : track.artist;
    return (Array.isArray(values) ? values : [values])
        .map((artist) => typeof artist === 'string' ? artist : artist?.name)
        .map(normalizeText).filter((artist) => artist && !['unknown', 'desconhecido', 'artista desconhecido'].includes(artist));
};

/** Converte apenas campos conhecidos. Não persiste respostas completas de terceiros. */
export const normalizeCandidate = (candidate = {}) => ({
    targetId: candidate.targetId || candidate.uri || candidate.videoId || candidate.id || null,
    name: candidate.rawName || candidate.name || candidate.title || '',
    artists: (Array.isArray(candidate.artists) ? candidate.artists : [candidate.artist])
        .map((artist) => typeof artist === 'string' ? artist : artist?.name).filter(Boolean),
    album: typeof candidate.album === 'string' ? candidate.album : candidate.album?.name || '',
    durationMs: candidate.durationMs || candidate.duration_ms || (Number(candidate.duration) || 0) * 1000,
    isrc: candidate.isrc || candidate.external_ids?.isrc || null,
    externalUrl: safeTrackUrl(candidate.externalUrl || candidate.external_urls?.spotify || candidate.uri),
    available: candidate.restrictions?.reason ? false : candidate.available ?? candidate.is_playable ?? null,
    explicit: typeof candidate.explicit === 'boolean' ? candidate.explicit : null,
});

export const safeTrackUrl = (value) => {
    try {
        const url = new URL(value);
        return url.protocol === 'https:' && !url.username && !url.password && ['open.spotify.com', 'music.youtube.com', 'www.deezer.com',
            'www.youtube.com', 'listen.tidal.com', 'tidal.com', 'music.apple.com', 'soundcloud.com'].includes(url.hostname) ? url.href : null;
    } catch { return null; }
};
