const normalize = (value) => (
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\([^)]*\)|\[[^\]]*\]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
);

const getFirstArtistToken = (artistName) => normalize(artistName).split(' ').filter(Boolean)[0] || '';

export const scoreSpotifyCandidate = (track, candidate) => {
    const trackName = normalize(track.name);
    const trackArtist = normalize(track.artist);
    const candidateName = normalize(candidate.name);
    const candidateArtists = normalize(
        candidate.artists?.map((artist) => artist.name).filter(Boolean).join(' ')
    );

    let score = 0;

    if (candidateName === trackName) score += 60;
    else if (candidateName.includes(trackName) || trackName.includes(candidateName)) score += 35;

    if (candidateArtists && trackArtist && candidateArtists.includes(trackArtist)) score += 30;
    else if (candidateArtists && candidateArtists.includes(getFirstArtistToken(track.artist))) score += 15;

    if (track.durationMs && candidate.duration_ms) {
        const diffSeconds = Math.abs(Math.round(track.durationMs / 1000) - Math.round(candidate.duration_ms / 1000));
        if (diffSeconds <= 5) score += 10;
        else if (diffSeconds <= 15) score += 5;
    }

    return score;
};
