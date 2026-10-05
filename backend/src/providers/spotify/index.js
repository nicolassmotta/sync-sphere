import User from '../../models/User.js';
import AppError from '../../utils/AppError.js';
import { hasSpotifyConnection } from '../../services/integrations/connectionState.js';
import {
    createOAuthState,
    getFrontendOriginFromState,
    getFrontendRedirect,
    verifyOAuthState,
} from '../../modules/integrations/shared/oauthRedirect.js';
import {
    buildSpotifyAuthorizationUrl,
    createSpotifyDestinationClient,
    createSpotifySearchClient,
    ensureSpotifyDestinationReady,
    exchangeSpotifyCode,
    getSpotifyPlaylistSnapshot,
    getSpotifyPlaylistTracksPreview,
    listSpotifyUserPlaylists,
    normalizeSpotifyPlaylistId,
} from '../../services/spotifyService.js';

const SPOTIFY_OAUTH_INTENT = 'spotify_oauth';

const getUser = (userId) => User.findById(userId).select('+spotifyToken +spotifyRefreshToken');

/**
 * Spotify: OAuth Authorization Code + PKCE, origem e destino.
 */
const spotifyProvider = {
    id: 'spotify',
    label: 'Spotify',
    aliases: [],
    auth: { type: 'oauth', method: 'oauth-pkce' },
    capabilities: {
        read: true,
        write: true,
        listUserPlaylists: true,
        readByLink: true,
        isrcSearch: false,
        setImage: false,
    },
    playlistUrlExample: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',

    getSearchDelayMs() {
        return Number(process.env.SPOTIFY_SEARCH_DELAY_MS ?? 100);
    },

    async getStatus({ userId }) {
        const user = await getUser(userId);
        const connected = hasSpotifyConnection(user);
        return {
            connected,
            configured: Boolean(String(process.env.SPOTIFY_CLIENT_ID || '').trim()),
            authMethod: connected ? 'oauth-pkce' : null,
            expiresAt: user?.spotifyTokenExpiresAt || null,
        };
    },

    async ensureReadable() {
        // A leitura já falha com mensagem clara na prévia se a conta não estiver conectada.
    },

    async ensureWritable({ userId }) {
        try {
            await ensureSpotifyDestinationReady({ userId });
        } catch (error) {
            throw new AppError(
                error.message || 'Conecte o Spotify com permissão de escrita para criar playlists.',
                400
            );
        }
    },

    normalizePlaylistId: normalizeSpotifyPlaylistId,
    listPlaylists: ({ userId }) => listSpotifyUserPlaylists({ userId }),
    getPlaylistSnapshot: ({ playlistId, userId }) => getSpotifyPlaylistSnapshot({ playlistId, userId }),
    getPlaylistPreview: ({ playlistId, userId, limit }) => getSpotifyPlaylistTracksPreview({ playlistId, userId, limit }),
    createSearchClient: ({ userId }) => createSpotifySearchClient({ userId }),
    getMatchId: (match) => match?.uri,

    createDestinationClient({ userId }) {
        const client = createSpotifyDestinationClient({ userId });
        return {
            createPlaylist: (args) => client.createPlaylist(args),
            addTracks: ({ playlistId, ids, expectedIds }) => client.addTracksToPlaylist({ playlistId, trackUris: ids, expectedIds }),
            getPlaylistUrl: (playlistId) => client.getPlaylistUrl(playlistId),
            setPlaylistImage: client.setPlaylistImage,
        };
    },

    oauth: {
        getAuthorizationUrl({ req }) {
            return buildSpotifyAuthorizationUrl(createOAuthState({ req, intent: SPOTIFY_OAUTH_INTENT }));
        },

        /**
         * Troca o `code` pelo token e devolve para onde redirecionar o navegador.
         */
        async handleCallback({ query }) {
            const { code, state, error } = query;

            if (error) {
                return {
                    connected: false,
                    redirectUrl: getFrontendRedirect(
                        { tab: 'integrations', provider: 'spotify', status: 'denied', spotify: 'denied' },
                        getFrontendOriginFromState({ state, intent: SPOTIFY_OAUTH_INTENT })
                    ),
                };
            }

            if (!code || !state) {
                throw new AppError('Retorno do Spotify sem `code`/`state`.', 400);
            }

            const decoded = verifyOAuthState({ state, intent: SPOTIFY_OAUTH_INTENT });
            if (!decoded) {
                throw new AppError('Parâmetro `state` do Spotify inválido.', 400);
            }

            const tokenData = await exchangeSpotifyCode(code, state);
            const user = await User.findById(decoded.id).select('+spotifyRefreshToken');
            if (!user) {
                throw new AppError('Usuário do OAuth não encontrado.', 404);
            }

            user.spotifyToken = tokenData.access_token;
            user.spotifyRefreshToken = tokenData.refresh_token || user.spotifyRefreshToken;
            user.spotifyTokenExpiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000);
            await user.save({ validateBeforeSave: false });

            return {
                connected: true,
                userId: user._id,
                redirectUrl: getFrontendRedirect(
                    { tab: 'integrations', provider: 'spotify', status: 'connected', spotify: 'connected' },
                    decoded.frontendOrigin
                ),
            };
        },
    },

    async disconnect({ userId }) {
        const user = await User.findById(userId);
        user.spotifyToken = null;
        user.spotifyRefreshToken = null;
        user.spotifyTokenExpiresAt = null;
        await user.save({ validateBeforeSave: false });
    },
};

export default spotifyProvider;
