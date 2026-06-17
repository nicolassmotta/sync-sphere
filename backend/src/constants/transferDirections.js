export const TRANSFER_DIRECTIONS = {
    SPOTIFY_TO_YOUTUBE: 'spotify_to_youtube',
    YOUTUBE_TO_SPOTIFY: 'youtube_to_spotify',
};

export const TRANSFER_DIRECTION_VALUES = Object.values(TRANSFER_DIRECTIONS);

export const TRANSFER_PROVIDERS = {
    SPOTIFY: 'spotify',
    YOUTUBE_MUSIC: 'youtubeMusic',
};

export const getTransferDirectionProviders = (direction = TRANSFER_DIRECTIONS.SPOTIFY_TO_YOUTUBE) => {
    if (direction === TRANSFER_DIRECTIONS.YOUTUBE_TO_SPOTIFY) {
        return {
            sourceProvider: TRANSFER_PROVIDERS.YOUTUBE_MUSIC,
            targetProvider: TRANSFER_PROVIDERS.SPOTIFY,
        };
    }

    return {
        sourceProvider: TRANSFER_PROVIDERS.SPOTIFY,
        targetProvider: TRANSFER_PROVIDERS.YOUTUBE_MUSIC,
    };
};
