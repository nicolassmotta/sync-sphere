export const getSpotifyPlaylistItemsReference = (playlist) => playlist?.tracks || playlist?.items || null;

const getSpotifyPlaylistItemsCount = (playlist) => {
    const itemsReference = getSpotifyPlaylistItemsReference(playlist);
    return itemsReference?.total ?? playlist.trackCount ?? playlist.totalTracks ?? 0;
};

export const getSpotifyFirstImageUrl = (images = []) => (
    images?.find((image) => image?.url)?.url || null
);

export const normalizeSpotifyPlaylistSummary = (playlist) => ({
    id: playlist.id,
    name: playlist.name || 'Playlist Spotify',
    description: playlist.description || '',
    ownerName: playlist.owner?.display_name || '',
    public: Boolean(playlist.public),
    collaborative: Boolean(playlist.collaborative),
    trackCount: getSpotifyPlaylistItemsCount(playlist),
    imageUrl: getSpotifyFirstImageUrl(playlist.images),
    externalUrl: playlist.external_urls?.spotify || null,
    snapshotId: playlist.snapshot_id || null,
});

export const normalizeSpotifyTrackItems = (items) => {
    const tracks = [];

    for (const item of items || []) {
        const track = item.track || item.item || item;
        if (!track || (track.type && track.type !== 'track') || !track.name) continue;

        tracks.push({
            spotifyId: track.id,
            name: track.name,
            artists: track.artists?.map((artist) => artist.name).filter(Boolean) || [],
            explicit: typeof track.explicit === 'boolean' ? track.explicit : null,
            artist: track.artists?.map((artist) => artist.name).filter(Boolean).join(', ') || 'Unknown',
            album: track.album?.name || '',
            durationMs: track.duration_ms || 0,
            isrc: track.external_ids?.isrc || null,
            uri: track.uri,
        });
    }

    return tracks;
};

export const normalizeSpotifyEmbedTrackItems = (items) => {
    const tracks = [];

    for (const item of items || []) {
        if (!item || (item.entityType && item.entityType !== 'track') || !item.title) continue;

        tracks.push({
            spotifyId: item.uri?.startsWith('spotify:track:') ? item.uri.split(':').at(-1) : item.uid,
            name: item.title,
            artist: item.subtitle?.replace(/\u00a0/g, ' ').trim() || 'Unknown',
            album: '',
            durationMs: item.duration || 0,
            uri: item.uri,
        });
    }

    return tracks;
};

export const normalizeSpotifyPathfinderTrackItems = (items) => {
    const tracks = [];

    for (const item of items || []) {
        const track = item?.itemV2?.data;
        if (!track || track.__typename !== 'Track' || !track.name) continue;

        tracks.push({
            spotifyId: track.uri?.startsWith('spotify:track:') ? track.uri.split(':').at(-1) : undefined,
            name: track.name,
            artists: track.artists?.items?.map((artist) => artist.profile?.name).filter(Boolean) || [],
            artist: track.artists?.items
                ?.map((artist) => artist.profile?.name)
                .filter(Boolean)
                .join(', ') || 'Unknown',
            album: track.albumOfTrack?.name || '',
            durationMs: track.duration?.totalMilliseconds || 0,
            uri: track.uri,
        });
    }

    return tracks;
};
