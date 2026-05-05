import YTMusic from 'ytmusic-api';
import {
    applyAuthHeaders,
    buildSapisidAuthorization,
    buildYoutubeMusicAuthError,
    hydrateCookieJarForMusicDomains,
    normalizeCookieHeader,
    validateYoutubeMusicCookieDestinationConfig,
} from './youtubeMusic/youtubeMusicCookieAuth.js';
import { scoreYoutubeMusicCandidate } from './youtubeMusic/youtubeMusicMatchScoring.js';

export { validateYoutubeMusicCookieDestinationConfig };

let publicSearchClientPromise = null;
let authenticatedClientPromise = null;

const YTMUSIC_COOKIE_DESTINATION = 'ytmusic-cookie';

export const isYoutubeMusicCookieDestinationEnabled = () => (
    true
);

export const isYoutubeMusicCookieDestinationConfigured = () => (
    Boolean(process.env.YTMUSIC_COOKIE?.trim())
);

const getAddChunkSize = () => {
    const parsed = Number(process.env.YTMUSIC_ADD_CHUNK_SIZE);
    if (!Number.isFinite(parsed) || parsed <= 0) return 100;
    return Math.max(1, Math.min(200, Math.floor(parsed)));
};

const createPublicSearchClient = async () => {
    if (!publicSearchClientPromise) {
        publicSearchClientPromise = (async () => {
            const ytmusic = new YTMusic();
            await ytmusic.initialize({
                GL: process.env.YOUTUBE_MUSIC_GL || 'BR',
                HL: process.env.YOUTUBE_MUSIC_HL || 'pt-BR',
            });

            if (!ytmusic.config?.INNERTUBE_API_KEY) {
                throw new Error('Não foi possível inicializar a busca pública do YouTube Music.');
            }

            return ytmusic;
        })().catch((error) => {
            publicSearchClientPromise = null;
            throw error;
        });
    }

    return publicSearchClientPromise;
};

const createAuthenticatedClient = async () => {
    const cookieHeader = normalizeCookieHeader(process.env.YTMUSIC_COOKIE);
    validateYoutubeMusicCookieDestinationConfig();
    const authorization = buildSapisidAuthorization(cookieHeader);

    if (!authenticatedClientPromise) {
        authenticatedClientPromise = (async () => {
            const ytmusic = new YTMusic();
            await ytmusic.initialize({
                cookies: cookieHeader,
                GL: process.env.YOUTUBE_MUSIC_GL || 'BR',
                HL: process.env.YOUTUBE_MUSIC_HL || 'pt-BR',
            });

            if (!ytmusic.config?.INNERTUBE_API_KEY) {
                throw buildYoutubeMusicAuthError(
                    'Não foi possível inicializar o cliente não oficial do YouTube Music. O cookie pode estar incompleto, expirado, ser de youtube.com em vez de music.youtube.com, ou ter sido copiado de uma tela de consentimento.'
                );
            }

            hydrateCookieJarForMusicDomains(ytmusic, cookieHeader);
            applyAuthHeaders(ytmusic, cookieHeader);
            return ytmusic;
        })().catch((error) => {
            authenticatedClientPromise = null;
            throw error;
        });
    }

    const ytmusic = await authenticatedClientPromise;
    ytmusic.client.defaults.headers.Authorization = authorization;
    applyAuthHeaders(ytmusic, cookieHeader);
    return ytmusic;
};

export const searchBestYoutubeMusicMatch = async ({ track }) => {
    const ytmusic = await createPublicSearchClient();
    const query = `${track.name} ${track.artist}`;
    const songs = await ytmusic.searchSongs(query);
    const videos = songs.length ? [] : await ytmusic.searchVideos(query);
    const candidates = [...songs, ...videos];
    if (!candidates.length) return null;

    return candidates
        .filter((candidate) => candidate.videoId)
        .map((candidate) => ({
            ...candidate,
            matchScore: scoreYoutubeMusicCandidate(track, candidate),
        }))
        .sort((a, b) => b.matchScore - a.matchScore)[0] || null;
};

export const createYoutubeMusicSearchClient = () => ({
    kind: 'ytmusic-search',
    searchBestVideoMatch: ({ track }) => searchBestYoutubeMusicMatch({ track }),
});

const validateUnofficialResponseStatus = (response, fallbackMessage) => {
    if (!response?.status || String(response.status).includes('SUCCEEDED')) return;

    throw new Error(response.error?.message || response.message || fallbackMessage);
};

const sanitizePlaylistTitle = (title) => (
    String(title || 'Playlist migrada').replace(/[<>]/g, '').trim() || 'Playlist migrada'
);

const sanitizePlaylistDescription = (description) => (
    String(description || '').replace(/<[^>]*>/g, '').trim()
);

export const createYoutubeMusicCookieDestinationClient = () => ({
    kind: YTMUSIC_COOKIE_DESTINATION,

    async createPlaylist({ title, description }) {
        const ytmusic = await createAuthenticatedClient();
        const response = await ytmusic.constructRequest('playlist/create', {
            title: sanitizePlaylistTitle(title),
            description: sanitizePlaylistDescription(description),
            privacyStatus: 'PRIVATE',
        });

        if (!response?.playlistId) {
            throw new Error('YouTube Music não retornou o ID da playlist criada pelo endpoint não oficial.');
        }

        return response.playlistId;
    },

    setPlaylistImage: null,

    async addVideosToPlaylist({ playlistId, videoIds }) {
        const ytmusic = await createAuthenticatedClient();
        const existingVideos = await ytmusic.getPlaylistVideos(playlistId).catch(() => []);
        const existingVideoIds = new Set(existingVideos.map((video) => video.videoId).filter(Boolean));
        const pendingVideoIds = [...new Set(videoIds)].filter((videoId) => !existingVideoIds.has(videoId));
        const chunkSize = getAddChunkSize();

        for (let index = 0; index < pendingVideoIds.length; index += chunkSize) {
            const chunk = pendingVideoIds.slice(index, index + chunkSize);
            if (!chunk.length) continue;

            const response = await ytmusic.constructRequest('browse/edit_playlist', {
                playlistId,
                actions: chunk.map((videoId) => ({
                    action: 'ACTION_ADD_VIDEO',
                    addedVideoId: videoId,
                })),
            });

            validateUnofficialResponseStatus(
                response,
                'YouTube Music recusou a inserção de faixas pelo endpoint não oficial.'
            );

            chunk.forEach((videoId) => existingVideoIds.add(videoId));
        }
    },

    getPlaylistUrl(playlistId) {
        return playlistId ? `https://music.youtube.com/playlist?list=${playlistId}` : null;
    },
});
