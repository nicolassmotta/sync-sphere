import AppError from '../../utils/AppError.js';
import {
    clearProviderCredentials,
    getProviderCredentials,
    setProviderCredentials,
} from '../../storage/credentialStore.js';
import { normalizeText, pickBestCandidate } from '../../services/matching/scoreCandidate.js';
import { createDeezerGateway } from './deezerGateway.js';
import {
    DEEZER_PLAYLIST_MAX_ITEMS,
    findTrackByIsrc,
    getPublicPlaylist,
    getPublicPlaylistPreview,
    searchTracks,
} from './deezerPublicApi.js';

const PROVIDER_ID = 'deezer';
const ADD_CHUNK_SIZE = 100;

const getArl = () => getProviderCredentials(PROVIDER_ID)?.arl || process.env.DEEZER_ARL?.trim() || '';

const getCredentialSource = () => {
    if (getProviderCredentials(PROVIDER_ID)?.arl) return 'panel';
    if (process.env.DEEZER_ARL?.trim()) return 'env';
    return null;
};

const requireGateway = (action) => {
    const arl = getArl();
    if (!arl) {
        throw new AppError(
            `Cole o cookie arl do Deezer em Integrações (ou DEEZER_ARL no backend/.env) para ${action}.`,
            400
        );
    }
    return createDeezerGateway({ arl });
};

const normalizeGatewaySong = (song) => ({
    deezerId: String(song.SNG_ID),
    sourceId: String(song.SNG_ID),
    name: song.SNG_TITLE + (song.VERSION ? ` ${song.VERSION}` : ''),
    artist: song.ART_NAME || song.ARTISTS?.map((artist) => artist.ART_NAME).join(', ') || 'Unknown',
    album: song.ALB_TITLE || '',
    durationMs: (Number(song.DURATION) || 0) * 1000,
    isrc: song.ISRC || null,
    uri: `https://www.deezer.com/track/${song.SNG_ID}`,
});

/**
 * Playlist privada só pelo gateway (com arl); pública pela API aberta.
 */
const readPlaylist = async (playlistId, { limit = DEEZER_PLAYLIST_MAX_ITEMS } = {}) => {
    try {
        return await getPublicPlaylist(playlistId, { limit });
    } catch (error) {
        if (!getArl() || ![404, 401].includes(error.status)) throw error;
    }

    const gateway = requireGateway('ler playlists privadas');
    const [page, songs] = await Promise.all([
        gateway.getPlaylist(playlistId),
        gateway.getPlaylistSongs(playlistId),
    ]);
    const data = page?.DATA || {};
    const tracks = songs.map(normalizeGatewaySong).slice(0, limit);

    return {
        id: String(playlistId),
        name: data.TITLE || 'Playlist Deezer',
        description: data.DESCRIPTION || '',
        ownerName: data.PARENT_USERNAME || '',
        imageUrl: data.PLAYLIST_PICTURE
            ? `https://e-cdns-images.dzcdn.net/images/playlist/${data.PLAYLIST_PICTURE}/1000x1000-000000-80-0-0.jpg`
            : null,
        totalTracks: Number(data.NB_SONG) || tracks.length,
        tracks,
    };
};

const buildQuery = (track) => [track.name, track.artist?.split(',')[0]].filter(Boolean).join(' ');

/**
 * Deezer: API pública para ler playlists públicas e buscar (com ISRC), e o
 * cookie `arl` para listar playlists da conta, ler privadas e criar playlists.
 */
const deezerProvider = {
    id: PROVIDER_ID,
    label: 'Deezer',
    aliases: [],
    auth: {
        type: 'cookie',
        method: 'deezer-arl',
        optionalForRead: true,
        fields: [{ name: 'arl', label: 'Cookie arl de deezer.com', secret: true }],
    },
    capabilities: {
        read: true,
        write: true,
        listUserPlaylists: true,
        readByLink: true,
        isrcSearch: true,
        setImage: false,
    },
    playlistUrlExample: 'https://www.deezer.com/br/playlist/908622995',

    getSearchDelayMs() {
        // 50 requisições a cada 5 s por IP; busca por ISRC + texto pode usar duas.
        return Number(process.env.DEEZER_SEARCH_DELAY_MS ?? 220);
    },

    async getStatus() {
        const credentials = getProviderCredentials(PROVIDER_ID);
        const connected = Boolean(getArl());
        return {
            connected,
            canRead: true,
            canWrite: connected,
            authMethod: connected ? 'deezer-arl' : 'public-api',
            credentialSource: getCredentialSource(),
            accountName: credentials?.userName || null,
            expiresAt: null,
        };
    },

    async ensureReadable() {},

    async ensureWritable() {
        requireGateway('criar playlists no Deezer');
    },

    normalizePlaylistId(input) {
        const text = String(input || '').trim();
        const match = text.match(/playlist\/(\d+)/);
        if (match) return match[1];
        return text.split('?')[0];
    },

    async listPlaylists() {
        const gateway = requireGateway('listar suas playlists');
        const playlists = await gateway.listUserPlaylists();
        return {
            playlists: playlists.map((playlist) => ({
                id: String(playlist.PLAYLIST_ID),
                name: playlist.TITLE,
                description: playlist.DESCRIPTION || '',
                ownerName: playlist.PARENT_USERNAME || 'Deezer',
                trackCount: Number(playlist.NB_SONG) || 0,
                imageUrl: playlist.PLAYLIST_PICTURE
                    ? `https://e-cdns-images.dzcdn.net/images/playlist/${playlist.PLAYLIST_PICTURE}/250x250-000000-80-0-0.jpg`
                    : null,
                externalUrl: `https://www.deezer.com/playlist/${playlist.PLAYLIST_ID}`,
            })),
            total: playlists.length,
            limit: playlists.length,
            hasMore: false,
        };
    },

    getPlaylistSnapshot: ({ playlistId }) => readPlaylist(deezerProvider.normalizePlaylistId(playlistId)),

    async getPlaylistPreview({ playlistId, limit = 25 }) {
        const id = deezerProvider.normalizePlaylistId(playlistId);
        const previewLimit = Math.max(1, Math.min(Number(limit) || 25, 100));

        let preview;
        try {
            preview = await getPublicPlaylistPreview(id, previewLimit);
        } catch (error) {
            if (!getArl() || ![404, 401].includes(error.status)) throw error;
            const playlist = await readPlaylist(id, { limit: previewLimit });
            preview = { ...playlist, tracks: playlist.tracks };
        }

        return {
            ...preview,
            returnedTracks: preview.tracks.length,
            hasMore: preview.totalTracks > preview.tracks.length,
        };
    },

    createSearchClient() {
        return {
            async searchBestMatch({ track }) {
                if (track.isrc) {
                    const byIsrc = await findTrackByIsrc(track.isrc);
                    if (byIsrc) return { ...byIsrc, matchScore: 100 };
                }

                let candidates = await searchTracks(buildQuery(track));
                if (!candidates.length) {
                    candidates = await searchTracks(`track:"${normalizeText(track.name)}"`);
                }
                return pickBestCandidate(track, candidates);
            },
        };
    },

    getMatchId: (match) => match?.id,

    createDestinationClient() {
        const gateway = requireGateway('criar playlists no Deezer');

        return {
            async createPlaylist({ title, description }) {
                const playlistId = await gateway.createPlaylist({ title, description });
                if (!playlistId) throw new Error('Deezer não retornou o ID da playlist criada.');
                return String(playlistId);
            },

            async addTracks({ playlistId, ids }) {
                const existing = new Set((await gateway.getPlaylistSongs(playlistId)).map((song) => String(song.SNG_ID)));
                const pending = [...new Set(ids.map(String))].filter((id) => !existing.has(id));

                for (let index = 0; index < pending.length; index += ADD_CHUNK_SIZE) {
                    await gateway.addSongs({ playlistId, songIds: pending.slice(index, index + ADD_CHUNK_SIZE) });
                }
            },

            getPlaylistUrl: (playlistId) => `https://www.deezer.com/playlist/${playlistId}`,
            setPlaylistImage: null,
        };
    },

    async saveCredentials({ values }) {
        const arl = String(values?.arl || '').trim().replace(/^arl=/, '');
        if (!/^[a-f0-9]{100,}$/i.test(arl)) {
            throw new AppError('O arl do Deezer é um texto hexadecimal longo (cerca de 190 caracteres). Copie o valor do cookie "arl" de deezer.com.', 400);
        }

        const user = await createDeezerGateway({ arl }).getUser().catch((error) => {
            throw new AppError(error.message || 'Não foi possível validar o arl no Deezer.', 400);
        });
        setProviderCredentials(PROVIDER_ID, { arl, userId: user.id, userName: user.name });
    },

    async disconnect() {
        clearProviderCredentials(PROVIDER_ID);
    },
};

export default deezerProvider;
