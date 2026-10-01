import AppError from '../utils/AppError.js';
import appleMusicProvider from './appleMusic/index.js';
import deezerProvider from './deezer/index.js';
import fileProvider from './file/index.js';
import soundcloudProvider from './soundcloud/index.js';
import spotifyProvider from './spotify/index.js';
import tidalProvider from './tidal/index.js';
import youtubeMusicProvider from './youtubeMusic/index.js';

/**
 * Registro das plataformas suportadas. Para adicionar uma nova, crie
 * `providers/<id>/index.js` seguindo o contrato abaixo e registre aqui.
 *
 * Contrato:
 * - id, label, aliases, auth { type: 'oauth' | 'cookie' | 'none' | 'file', ... }
 * - capabilities { read, write, listUserPlaylists, readByLink, isrcSearch, setImage }
 * - getStatus({ userId }) -> { connected, canRead?, canWrite?, authMethod, expiresAt }
 *   (`canRead`/`canWrite` valem `connected` quando omitidos; o Deezer lê playlists públicas sem login)
 * - ensureReadable({ userId }) / ensureWritable({ userId }): lançam AppError com o motivo
 * - normalizePlaylistId(input)
 * - listPlaylists({ userId }) quando `listUserPlaylists`
 * - getPlaylistSnapshot({ playlistId, userId }) -> { id, name, description, imageUrl, totalTracks, tracks, truncated, omittedTracks, unavailableTracks }
 * - getPlaylistPreview({ playlistId, userId, limit })
 * - createSearchClient({ userId }) -> { searchBestMatch({ track }) } e getMatchId(match)
 * - createDestinationClient({ userId }) -> { createPlaylist, addTracks({ playlistId, ids, expectedIds }), getPlaylistUrl, setPlaylistImage? }
 *   `expectedIds` contém todas as ocorrências resolvidas; use para reconciliar a quantidade já presente no destino antes de inserir.
 * - getSearchDelayMs()
 * - oauth { getAuthorizationUrl, handleCallback } quando auth.type === 'oauth'
 * - saveCredentials({ values }) quando auth.type === 'cookie'
 * - disconnect({ userId })
 */
const PROVIDERS = [
    spotifyProvider,
    youtubeMusicProvider,
    deezerProvider,
    tidalProvider,
    appleMusicProvider,
    soundcloudProvider,
    fileProvider,
];

const PROVIDERS_BY_KEY = new Map(
    PROVIDERS.flatMap((provider) => [provider.id, ...(provider.aliases || [])].map((key) => [key, provider]))
);

export const listProviders = () => [...PROVIDERS];

export const findProvider = (idOrAlias) => PROVIDERS_BY_KEY.get(String(idOrAlias || '')) || null;

export const getProvider = (idOrAlias) => {
    const provider = findProvider(idOrAlias);
    if (!provider) {
        throw new AppError(`Plataforma não suportada: ${idOrAlias}.`, 404);
    }
    return provider;
};

export const describeProvider = (provider) => ({
    id: provider.id,
    label: provider.label,
    auth: provider.auth,
    capabilities: provider.capabilities,
    playlistUrlExample: provider.playlistUrlExample,
});

/**
 * Status com `canRead`/`canWrite` sempre preenchidos.
 */
export const getProviderStatus = async (provider, { userId }) => {
    const status = await provider.getStatus({ userId });
    return {
        ...status,
        canRead: status.canRead ?? status.connected,
        canWrite: status.canWrite ?? status.connected,
    };
};
