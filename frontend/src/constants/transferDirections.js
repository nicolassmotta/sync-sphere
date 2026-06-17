export const TRANSFER_DIRECTIONS = {
    SPOTIFY_TO_YOUTUBE: 'spotify_to_youtube',
    YOUTUBE_TO_SPOTIFY: 'youtube_to_spotify',
};

export const TRANSFER_DIRECTION_OPTIONS = [
    {
        value: TRANSFER_DIRECTIONS.SPOTIFY_TO_YOUTUBE,
        source: 'Spotify',
        target: 'YouTube Music',
        label: 'Spotify -> YouTube Music',
        shortLabel: 'Spotify -> YouTube',
    },
    {
        value: TRANSFER_DIRECTIONS.YOUTUBE_TO_SPOTIFY,
        source: 'YouTube Music',
        target: 'Spotify',
        label: 'YouTube Music -> Spotify',
        shortLabel: 'YouTube -> Spotify',
    },
];

export const getTransferDirectionOption = (direction) => (
    TRANSFER_DIRECTION_OPTIONS.find((option) => option.value === direction) || TRANSFER_DIRECTION_OPTIONS[0]
);
