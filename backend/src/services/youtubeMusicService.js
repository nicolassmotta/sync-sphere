import { consumeSearchRequest } from './matching/requestBudget.js';
import { pickBestCandidate } from './matching/scoreCandidate.js';
import { getMissingTrackIds } from './transfer/reconcileTrackIds.js';
import YTMusic from 'ytmusic-api';
import {
    applyAuthHeaders,
    buildSapisidAuthorization,
    buildYoutubeMusicAuthError,
    clearYoutubeMusicCookie,
    getYoutubeMusicCookie,
    getYoutubeMusicCookieSource,
    hydrateCookieJarForMusicDomains,
    normalizeCookieHeader,
    saveYoutubeMusicCookie,
    validateYoutubeMusicCookieDestinationConfig,
} from './youtubeMusic/youtubeMusicCookieAuth.js';

export {
    clearYoutubeMusicCookie,
    getYoutubeMusicCookieSource,
    saveYoutubeMusicCookie,
    validateYoutubeMusicCookieDestinationConfig,
};

let publicSearchClientPromise = null;
let authenticatedClientPromise = null;
let authenticatedClientCookie = null;

const YTMUSIC_COOKIE_DESTINATION = 'ytmusic-cookie';
const YOUTUBE_MUSIC_PLAYLIST_MAX_ITEMS = 1000;

export const isYoutubeMusicCookieDestinationEnabled = () => (
    true
);

export const isYoutubeMusicCookieDestinationConfigured = () => (
    Boolean(getYoutubeMusicCookie().trim())
);

export const normalizeYoutubeMusicPlaylistId = (input) => {
    if (!input) return input;

    const trimmed = String(input).trim();
    try {
        const url = new URL(trimmed);
        const listId = url.searchParams.get('list');
        if (listId) return listId.trim();
    } catch {
        // O valor pode ser um ID puro.
    }

    const pathMatch = trimmed.match(/playlist\/([a-zA-Z0-9_-]+)/);
    if (pathMatch) return pathMatch[1];

    return trimmed.split('?')[0];
};

const getAddChunkSize = () => {
    const parsed = Number(process.env.YTMUSIC_ADD_CHUNK_SIZE);
    if (!Number.isFinite(parsed) || parsed <= 0) return 100;
    return Math.max(1, Math.min(200, Math.floor(parsed)));
};

const createPublicSearchClient = async () => {
    if (!publicSearchClientPromise) {
        publicSearchClientPromise = (async () => {
            const ytmusic = new YTMusic();
            ytmusic.client?.interceptors?.request?.use(async (config) => {
                const signal = await consumeSearchRequest();
                return signal ? { ...config, signal } : config;
            });
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
    const cookieHeader = normalizeCookieHeader(getYoutubeMusicCookie());
    validateYoutubeMusicCookieDestinationConfig(cookieHeader);
    const authorization = buildSapisidAuthorization(cookieHeader);

    // Cookie trocado pelo painel: descarta o cliente autenticado anterior.
    if (authenticatedClientCookie !== cookieHeader) {
        authenticatedClientPromise = null;
        authenticatedClientCookie = cookieHeader;
    }

    if (!authenticatedClientPromise) {
        authenticatedClientPromise = (async () => {
            const ytmusic = new YTMusic();
            ytmusic.client?.interceptors?.request?.use(async (config) => {
                const signal = await consumeSearchRequest();
                return signal ? { ...config, signal } : config;
            });
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

export const searchYoutubeMusicCandidates = async ({ track, strategy, limit = 10 }) => {
    const ytmusic = await createPublicSearchClient();
    const query = strategy?.query || `${track.name} ${track.artist}`;
    const results = strategy?.id === 'videos' ? await ytmusic.searchVideos(query) : await ytmusic.searchSongs(query);
    return results.filter((candidate) => candidate.videoId).slice(0, limit);
};

export const searchBestYoutubeMusicMatch = async ({ track }) => {
    let candidates = await searchYoutubeMusicCandidates({ track });
    const best = pickBestCandidate(track, candidates);
    if (best?.matching.decision !== 'accepted') {
        candidates = [...candidates, ...await searchYoutubeMusicCandidates({ track, strategy: { id: 'videos' } })];
    }
    return pickBestCandidate(track, candidates);
};

export const createYoutubeMusicSearchClient = () => ({
    kind: 'ytmusic-search', capabilities: { videos: true, isrcSearch: false },
    searchCandidates: searchYoutubeMusicCandidates,
    searchBestMatch: ({ track }) => searchBestYoutubeMusicMatch({ track }),
    searchBestVideoMatch: ({ track }) => searchBestYoutubeMusicMatch({ track }),
});

const getYoutubeMusicFirstImageUrl = (thumbnails = []) => (
    thumbnails
        ?.filter((thumbnail) => thumbnail?.url)
        ?.sort((a, b) => (b.width || 0) - (a.width || 0))[0]?.url || null
);

const normalizeYoutubeMusicTrackItems = (items = []) => {
    const tracks = [];

    for (const item of items || []) {
        if (!item?.videoId || !item.name) continue;

        tracks.push({
            youtubeVideoId: item.videoId,
            name: item.name,
            artist: item.artist?.name || 'Unknown',
            artists: [item.artist?.name].filter(Boolean),
            album: item.album?.name || '',
            durationMs: item.duration ? item.duration * 1000 : 0,
            uri: `https://music.youtube.com/watch?v=${item.videoId}`,
        });
    }

    return tracks;
};

export const getYoutubeMusicPlaylistSnapshot = async ({
    playlistId,
    limit = YOUTUBE_MUSIC_PLAYLIST_MAX_ITEMS,
} = {}) => {
    const normalizedPlaylistId = normalizeYoutubeMusicPlaylistId(playlistId);
    const maxItems = Math.max(1, Math.min(Number(limit) || YOUTUBE_MUSIC_PLAYLIST_MAX_ITEMS, YOUTUBE_MUSIC_PLAYLIST_MAX_ITEMS));
    const ytmusic = await createAuthenticatedClient();

    const [playlist, videos] = await Promise.all([
        ytmusic.getPlaylist(normalizedPlaylistId).catch(() => null),
        ytmusic.getPlaylistVideos(normalizedPlaylistId),
    ]);

    const allTracks = normalizeYoutubeMusicTrackItems(videos);
    const tracks = allTracks.slice(0, maxItems);
    const totalTracks = playlist?.videoCount || allTracks.length;

    return {
        id: normalizedPlaylistId,
        name: playlist?.name || 'Playlist YouTube Music',
        description: '',
        ownerName: playlist?.artist?.name || '',
        imageUrl: getYoutubeMusicFirstImageUrl(playlist?.thumbnails),
        totalTracks,
        returnedTracks: tracks.length,
        truncated: allTracks.length > maxItems,
        omittedTracks: Math.max(0, allTracks.length - maxItems),
        unavailableTracks: Math.max(0, totalTracks - allTracks.length),
        hasMore: totalTracks > tracks.length,
        source: 'youtube-music-cookie',
        tracks,
    };
};

export const getYoutubeMusicPlaylistTracksPreview = ({ playlistId, limit = 25 }) => (
    getYoutubeMusicPlaylistSnapshot({ playlistId, limit })
);

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

    async readTrackIds({ playlistId }) {
        const ytmusic = await createAuthenticatedClient();
        return (await ytmusic.getPlaylistVideos(playlistId)).map((video) => video.videoId);
    },

    async addVideosToPlaylist({ playlistId, videoIds, expectedIds }) {
        const ytmusic = await createAuthenticatedClient();
        const existingVideos = await ytmusic.getPlaylistVideos(playlistId);
        const pendingVideoIds = getMissingTrackIds({ ids: videoIds, existingIds: existingVideos.map((video) => video.videoId), expectedIds });
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

        }
    },

    getPlaylistUrl(playlistId) {
        return playlistId ? `https://music.youtube.com/playlist?list=${playlistId}` : null;
    },
});
