const normalize = (value) => (
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\([^)]*\)|\[[^\]]*\]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
);

export const scoreYoutubeMusicCandidate = (track, candidate) => {
    const trackName = normalize(track.name);
    const trackArtist = normalize(track.artist);
    const candidateName = normalize(candidate.name);
    const candidateArtist = normalize(candidate.artist?.name);

    let score = 0;
    if (candidateName === trackName) score += 60;
    else if (candidateName.includes(trackName) || trackName.includes(candidateName)) score += 35;

    if (candidateArtist && trackArtist.includes(candidateArtist)) score += 30;
    else if (candidateArtist && candidateArtist.includes(trackArtist.split(' ')[0])) score += 15;

    if (track.durationMs && candidate.duration) {
        const diffSeconds = Math.abs(Math.round(track.durationMs / 1000) - candidate.duration);
        if (diffSeconds <= 5) score += 10;
        else if (diffSeconds <= 15) score += 5;
    }

    return score;
};
