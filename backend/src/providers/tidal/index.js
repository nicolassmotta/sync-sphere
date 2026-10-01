import { getMissingTrackIds } from '../../services/transfer/reconcileTrackIds.js';
import AppError from '../../utils/AppError.js';
import {
    createOAuthState,
    getFrontendOriginFromState,
    getFrontendRedirect,
    verifyOAuthState,
} from '../../modules/integrations/shared/oauthRedirect.js';
import { pickBestCandidate } from '../../services/matching/scoreCandidate.js';
import {
    buildTidalAuthorizationUrl,
    clearTidalCredentials,
    exchangeTidalCode,
    getTidalCatalogToken,
    getTidalCredentials,
    getTidalUserToken,
    hasTidalClientCredentials,
    isTidalConfigured,
    saveTidalTokens,
} from './tidalAuth.js';
import {
    addPlaylistItems,
    createPlaylist,
    getCurrentUser,
    getPlaylist,
    getPlaylistTrackIds,
    getTracksByIds,
    getTracksByIsrc,
    listUserPlaylists,
    searchTrackIds,
} from './tidalApi.js';

const TIDAL_OAUTH_INTENT = 'tidal_oauth';
const PLAYLIST_MAX_ITEMS = 2000;

const getCountryCode = () => (
    getTidalCredentials()?.countryCode || process.env.TIDAL_COUNTRY_CODE || 'BR'
);

const readPlaylist = async (playlistId, { limit = PLAYLIST_MAX_ITEMS } = {}) => {
    const token = await getTidalCatalogToken();
    const countryCode = getCountryCode();
    const [playlist, snapshot] = await Promise.all([
        getPlaylist({ token, countryCode, playlistId }),
        getPlaylistTrackIds({ token, countryCode, playlistId, limit, withReadInfo: true }),
    ]);
    const trackIds = snapshot.ids;
    const tracks = await getTracksByIds({ token, countryCode, ids: trackIds });

    return {
        id: playlistId,
        name: playlist?.attributes?.name || 'Playlist TIDAL',
        description: playlist?.attributes?.description || '',
        imageUrl: null,
        totalTracks: playlist?.attributes?.numberOfItems ?? (snapshot.truncated ? null : tracks.length),
        tracks,
        truncated: snapshot.truncated,
        omittedTracks: snapshot.truncated ? null : 0,
        unavailableTracks: Math.max(0, trackIds.length - tracks.length),
    };
};

const toCandidate = (track) => ({ id: track.tidalId, name: track.name, artists: track.artists, durationMs: track.durationMs, isrc: track.isrc });

/**
 * TIDAL: API oficial v2 com OAuth PKCE. Origem e destino, busca por ISRC.
 */
const tidalProvider = {
    id: 'tidal',
    label: 'TIDAL',
    aliases: [],
    auth: { type: 'oauth', method: 'oauth-pkce' },
    capabilities: {
        read: true,
        write: true,
        listUserPlaylists: true,
        readByLink: true,
        isrcSearch: true,
        setImage: false,
    },
    playlistUrlExample: 'https://tidal.com/playlist/36ea71a8-445e-41a4-82ab-6628c581535d',

    getSearchDelayMs() {
        return Number(process.env.TIDAL_SEARCH_DELAY_MS ?? 250);
    },

    async getStatus() {
        const credentials = getTidalCredentials();
        const connected = Boolean(credentials?.accessToken);
        return {
            connected,
            canRead: connected || hasTidalClientCredentials(),
            canWrite: connected,
            configured: isTidalConfigured(),
            authMethod: connected ? 'oauth-pkce' : null,
            accountName: credentials?.username || null,
            expiresAt: credentials?.expiresAt || null,
        };
    },

    async ensureReadable() {
        if (!getTidalCredentials()?.accessToken && !hasTidalClientCredentials()) {
            throw new AppError('Conecte sua conta TIDAL em Integrações para ler playlists.', 400);
        }
    },

    async ensureWritable() {
        try {
            await getTidalUserToken();
        } catch (error) {
            throw new AppError(error.message, 400);
        }
    },

    normalizePlaylistId(input) {
        const text = String(input || '').trim();
        const match = text.match(/playlist\/([0-9a-f-]{36})/i);
        if (match) return match[1];
        return text.split('?')[0];
    },

    async listPlaylists() {
        const token = await getTidalUserToken();
        const playlists = await listUserPlaylists({ token, countryCode: getCountryCode() });
        return {
            playlists: playlists.map((playlist) => ({
                id: playlist.id,
                name: playlist.attributes?.name || 'Playlist TIDAL',
                description: playlist.attributes?.description || '',
                ownerName: 'TIDAL',
                trackCount: playlist.attributes?.numberOfItems ?? 0,
                imageUrl: null,
                externalUrl: `https://tidal.com/playlist/${playlist.id}`,
            })),
            total: playlists.length,
            limit: playlists.length,
            hasMore: false,
        };
    },

    getPlaylistSnapshot: ({ playlistId }) => readPlaylist(tidalProvider.normalizePlaylistId(playlistId)),

    async getPlaylistPreview({ playlistId, limit = 25 }) {
        const previewLimit = Math.max(1, Math.min(Number(limit) || 25, 100));
        const playlist = await readPlaylist(tidalProvider.normalizePlaylistId(playlistId), { limit: previewLimit });
        return {
            ...playlist,
            returnedTracks: playlist.tracks.length,
            hasMore: playlist.totalTracks > playlist.tracks.length,
        };
    },

    createSearchClient() {
        return {
            async searchBestMatch({ track }) {
                const token = await getTidalCatalogToken();
                const countryCode = getCountryCode();

                if (track.isrc) {
                    const [byIsrc] = await getTracksByIsrc({ token, countryCode, isrc: track.isrc });
                    if (byIsrc) return { ...toCandidate(byIsrc), matchScore: 100 };
                }

                const query = [track.name, track.artist?.split(',')[0]].filter(Boolean).join(' ');
                const ids = await searchTrackIds({ token, countryCode, query });
                if (!ids.length) return null;
                const candidates = await getTracksByIds({ token, countryCode, ids });
                return pickBestCandidate(track, candidates.map(toCandidate));
            },
        };
    },

    getMatchId: (match) => match?.id,

    createDestinationClient() {
        return {
            async createPlaylist({ title, description }) {
                const playlistId = await createPlaylist({ token: await getTidalUserToken(), name: title, description });
                if (!playlistId) throw new Error('TIDAL não retornou o ID da playlist criada.');
                return playlistId;
            },
            async addTracks({ playlistId, ids, expectedIds }) {
                const token = await getTidalUserToken();
                const existingIds = await getPlaylistTrackIds({ token, playlistId, countryCode: getCountryCode() });
                const pending = getMissingTrackIds({ ids, existingIds, expectedIds });
                await addPlaylistItems({ token, playlistId, trackIds: pending });
            },
            getPlaylistUrl: (playlistId) => `https://tidal.com/playlist/${playlistId}`,
            setPlaylistImage: null,
        };
    },

    oauth: {
        getAuthorizationUrl({ req }) {
            return buildTidalAuthorizationUrl(createOAuthState({ req, intent: TIDAL_OAUTH_INTENT }));
        },

        async handleCallback({ query }) {
            const { code, state, error } = query;
            if (error) {
                return {
                    connected: false,
                    redirectUrl: getFrontendRedirect(
                        { tab: 'integrations', provider: 'tidal', status: 'denied' },
                        getFrontendOriginFromState({ state, intent: TIDAL_OAUTH_INTENT })
                    ),
                };
            }
            if (!code || !state) throw new AppError('Retorno do TIDAL sem `code`/`state`.', 400);

            const decoded = verifyOAuthState({ state, intent: TIDAL_OAUTH_INTENT });
            if (!decoded) throw new AppError('Parâmetro `state` do TIDAL inválido.', 400);

            const tokenData = await exchangeTidalCode({ code, state });
            const user = await getCurrentUser({ token: tokenData.access_token }).catch(() => null);
            saveTidalTokens(tokenData, {
                userId: user?.id || tokenData.user_id || null,
                username: user?.attributes?.username || user?.attributes?.firstName || null,
                countryCode: user?.attributes?.country || null,
            });

            return {
                connected: true,
                userId: decoded.id,
                redirectUrl: getFrontendRedirect(
                    { tab: 'integrations', provider: 'tidal', status: 'connected' },
                    decoded.frontendOrigin
                ),
            };
        },
    },

    async disconnect() {
        clearTidalCredentials();
    },
};

export default tidalProvider;
