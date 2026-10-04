import { normalizeText, titleIdentity } from './identity.js';

export const buildSearchStrategies = (track, { isrcSearch = false, videos = false } = {}) => {
    const name = String(track.name || '').trim();
    const artist = String(track.artist || '').trim();
    const comparable = titleIdentity(name).comparable;
    const primaryArtist = track.artists?.[0]?.name || track.artists?.[0] || artist.split(/,|\bfeat\.?\b/i)[0];
    const strategies = [
        ...(isrcSearch && track.isrc ? [{ id: 'isrc', query: track.isrc }] : []),
        { id: 'full', query: [name, artist].filter(Boolean).join(' ') },
        { id: 'normalized', query: [comparable, normalizeText(artist)].filter(Boolean).join(' ') },
        { id: 'primary_artist', query: [comparable, primaryArtist].filter(Boolean).join(' ') },
        ...(track.album ? [{ id: 'album', query: [name, artist, track.album].filter(Boolean).join(' ') }] : []),
        { id: 'broad', query: name },
        ...(videos ? [{ id: 'videos', query: [name, artist].filter(Boolean).join(' ') }] : []),
    ];
    const seen = new Set();
    return strategies.filter((strategy) => {
        const key = `${strategy.id === 'videos' ? 'videos' : strategy.id === 'isrc' ? 'isrc' : 'text'}:${strategy.query}`;
        if (!strategy.query || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};
