export const candidateUrl = (providerId, targetId, candidate) => {
    const id = encodeURIComponent(String(targetId).split(':').pop());
    const urls = {
        spotify: `https://open.spotify.com/track/${id}`,
        youtubeMusic: `https://music.youtube.com/watch?v=${id}`,
        deezer: `https://www.deezer.com/track/${id}`,
        tidal: `https://listen.tidal.com/track/${id}`,
        appleMusic: `https://music.apple.com/br/song/${id}`,
    };
    if (providerId === 'soundcloud' && candidate.externalUrl) {
        try {
            const url = new URL(candidate.externalUrl);
            if (url.protocol === 'https:' && url.hostname === 'soundcloud.com') return url.href;
        } catch { /* Resultado sem link válido: a escolha ainda pode ser revisada pelo título. */ }
    }
    return urls[providerId] || null;
};
