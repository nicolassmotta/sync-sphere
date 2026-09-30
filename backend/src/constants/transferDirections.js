export const TRANSFER_PROVIDERS = {
    SPOTIFY: 'spotify',
    YOUTUBE_MUSIC: 'youtubeMusic',
};

// Valores antigos de `direction`, mantidos para histórico e clientes antigos.
export const TRANSFER_DIRECTIONS = {
    SPOTIFY_TO_YOUTUBE: 'spotify_to_youtube',
    YOUTUBE_TO_SPOTIFY: 'youtube_to_spotify',
};

export const TRANSFER_DIRECTION_VALUES = Object.values(TRANSFER_DIRECTIONS);

const LEGACY_DIRECTIONS = {
    [TRANSFER_DIRECTIONS.SPOTIFY_TO_YOUTUBE]: {
        sourceProvider: TRANSFER_PROVIDERS.SPOTIFY,
        targetProvider: TRANSFER_PROVIDERS.YOUTUBE_MUSIC,
    },
    [TRANSFER_DIRECTIONS.YOUTUBE_TO_SPOTIFY]: {
        sourceProvider: TRANSFER_PROVIDERS.YOUTUBE_MUSIC,
        targetProvider: TRANSFER_PROVIDERS.SPOTIFY,
    },
};

const DIRECTION_SEPARATOR = '_to_';

/**
 * Nome da direção a partir dos provedores. Os dois sentidos antigos mantêm o
 * valor legado; os novos pares viram `<origem>_to_<destino>`.
 */
export const buildTransferDirection = (sourceProvider, targetProvider) => {
    const legacy = Object.entries(LEGACY_DIRECTIONS).find(([, providers]) => (
        providers.sourceProvider === sourceProvider && providers.targetProvider === targetProvider
    ));
    return legacy ? legacy[0] : `${sourceProvider}${DIRECTION_SEPARATOR}${targetProvider}`;
};

export const getTransferDirectionProviders = (direction = TRANSFER_DIRECTIONS.SPOTIFY_TO_YOUTUBE) => {
    if (LEGACY_DIRECTIONS[direction]) return { ...LEGACY_DIRECTIONS[direction] };

    const [sourceProvider, targetProvider] = String(direction).split(DIRECTION_SEPARATOR);
    if (/^[a-zA-Z]+$/.test(sourceProvider || '') && /^[a-zA-Z]+$/.test(targetProvider || '')) {
        return { sourceProvider, targetProvider };
    }

    return { ...LEGACY_DIRECTIONS[TRANSFER_DIRECTIONS.SPOTIFY_TO_YOUTUBE] };
};

/**
 * Provedores de uma transferência: campos explícitos vencem; sem eles, usa a
 * direção (formato antigo).
 */
export const resolveTransferProviders = ({ sourceProvider, targetProvider, direction } = {}) => {
    const fromDirection = getTransferDirectionProviders(direction);
    const resolved = {
        sourceProvider: sourceProvider || fromDirection.sourceProvider,
        targetProvider: targetProvider || fromDirection.targetProvider,
    };

    return {
        ...resolved,
        direction: buildTransferDirection(resolved.sourceProvider, resolved.targetProvider),
    };
};
