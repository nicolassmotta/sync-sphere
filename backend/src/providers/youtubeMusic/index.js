import AppError from '../../utils/AppError.js';
import {
    clearYoutubeMusicCookie,
    createYoutubeMusicCookieDestinationClient,
    createYoutubeMusicSearchClient,
    getYoutubeMusicCookieSource,
    getYoutubeMusicPlaylistSnapshot,
    getYoutubeMusicPlaylistTracksPreview,
    isYoutubeMusicCookieDestinationConfigured,
    normalizeYoutubeMusicPlaylistId,
    saveYoutubeMusicCookie,
    validateYoutubeMusicCookieDestinationConfig,
} from '../../services/youtubeMusicService.js';

const ensureCookie = (action) => {
    if (!isYoutubeMusicCookieDestinationConfigured()) {
        throw new AppError(
            `Configure o cookie do YouTube Music em Integrações (ou YTMUSIC_COOKIE no backend/.env) para ${action} no YouTube Music.`,
            400
        );
    }

    try {
        validateYoutubeMusicCookieDestinationConfig();
    } catch (error) {
        throw new AppError(error.message, 400);
    }
};

/**
 * YouTube Music: API não oficial autenticada por cookie do navegador.
 * O cookie pode ser colado no painel ou vir de `YTMUSIC_COOKIE`.
 */
const youtubeMusicProvider = {
    id: 'youtubeMusic',
    label: 'YouTube Music',
    // Playlists do YouTube Music são playlists do youtube.com: links dos dois servem.
    aliases: ['youtube-music', 'ytmusic', 'youtube'],
    auth: {
        type: 'cookie',
        method: 'ytmusic-cookie',
        fields: [{
            name: 'cookie',
            label: 'Cabeçalho Cookie de music.youtube.com',
            placeholder: 'Cole o cabeçalho Cookie completo',
            secret: true,
        }],
    },
    capabilities: {
        read: true,
        write: true,
        listUserPlaylists: false,
        readByLink: true,
        isrcSearch: false,
        setImage: false,
    },
    playlistUrlExample: 'https://music.youtube.com/playlist?list=PL...',

    getSearchDelayMs() {
        return Number(process.env.YT_MUSIC_SEARCH_DELAY_MS ?? 250);
    },

    async getStatus() {
        const connected = isYoutubeMusicCookieDestinationConfigured();
        return {
            connected,
            authMethod: connected ? 'ytmusic-cookie' : null,
            credentialSource: getYoutubeMusicCookieSource(),
            expiresAt: null,
        };
    },

    async ensureReadable() {
        ensureCookie('ler playlists');
    },

    async ensureWritable() {
        ensureCookie('criar playlists');
    },

    normalizePlaylistId: normalizeYoutubeMusicPlaylistId,
    getPlaylistSnapshot: ({ playlistId }) => getYoutubeMusicPlaylistSnapshot({ playlistId }),
    getPlaylistPreview: ({ playlistId, limit }) => getYoutubeMusicPlaylistTracksPreview({ playlistId, limit }),
    createSearchClient: () => createYoutubeMusicSearchClient(),
    getMatchId: (match) => match?.videoId,

    createDestinationClient({ userId }) {
        const client = createYoutubeMusicCookieDestinationClient({ userId });
        return {
            createPlaylist: (args) => client.createPlaylist(args),
            addTracks: ({ playlistId, ids }) => client.addVideosToPlaylist({ playlistId, videoIds: ids }),
            getPlaylistUrl: (playlistId) => client.getPlaylistUrl(playlistId),
            setPlaylistImage: client.setPlaylistImage,
        };
    },

    async saveCredentials({ values }) {
        try {
            saveYoutubeMusicCookie(values?.cookie || '');
        } catch (error) {
            throw new AppError(error.message, 400);
        }
    },

    async disconnect() {
        clearYoutubeMusicCookie();
    },
};

export default youtubeMusicProvider;
