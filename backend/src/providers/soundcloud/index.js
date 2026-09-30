import { getMissingTrackIds } from '../../services/transfer/reconcileTrackIds.js';
import AppError from '../../utils/AppError.js';
import {
    clearProviderCredentials,
    getProviderCredentials,
    setProviderCredentials,
} from '../../storage/credentialStore.js';
import { pickBestCandidate } from '../../services/matching/scoreCandidate.js';
import { soundcloudRequest, TRACK_IDS_BATCH } from './soundcloudClient.js';

const PROVIDER_ID = 'soundcloud';
const PLAYLIST_MAX_ITEMS = 500; // limite de faixas por playlist no SoundCloud

const getOauthToken = () => (
    getProviderCredentials(PROVIDER_ID)?.oauthToken || process.env.SOUNDCLOUD_OAUTH_TOKEN?.trim() || null
);

const requireOauthToken = (action) => {
    const token = getOauthToken();
    if (!token) {
        throw new AppError(`Cole o cookie oauth_token do SoundCloud em Integrações para ${action}.`, 400);
    }
    return token;
};

/**
 * Título no SoundCloud costuma vir como "Artista - Música" e o dono do
 * upload nem sempre é o artista; usa os metadados da gravadora quando há.
 */
const toTrack = (track) => {
    const title = String(track.title || '');
    const separator = title.indexOf(' - ');
    const parsedArtist = separator > 0 ? title.slice(0, separator).trim() : null;
    const name = separator > 0 ? title.slice(separator + 3).trim() : title;
    const publisherArtist = track.publisher_metadata?.artist || null;
    const artists = [...new Set([publisherArtist, parsedArtist, track.user?.username].filter(Boolean))];

    return {
        soundcloudId: String(track.id),
        sourceId: String(track.id),
        name,
        artists,
        artist: publisherArtist || parsedArtist || track.user?.username || 'Unknown',
        album: track.publisher_metadata?.album_title || '',
        durationMs: Number(track.full_duration || track.duration) || 0,
        isrc: track.publisher_metadata?.isrc || null,
        uri: track.permalink_url || null,
    };
};

// `resolve` e `/playlists/:id` trazem só as primeiras faixas completas; o resto vem como `{ id }`.
const hydrateTracks = async (tracks, oauthToken) => {
    const stubs = tracks.filter((track) => !track.title).map((track) => track.id);
    const full = new Map(tracks.filter((track) => track.title).map((track) => [track.id, track]));

    for (let index = 0; index < stubs.length; index += TRACK_IDS_BATCH) {
        const batch = await soundcloudRequest('/tracks', {
            params: { ids: stubs.slice(index, index + TRACK_IDS_BATCH).join(',') },
            oauthToken,
        });
        (Array.isArray(batch) ? batch : batch?.collection || []).forEach((track) => full.set(track.id, track));
    }

    return tracks.map((track) => full.get(track.id)).filter(Boolean);
};

const fetchPlaylist = async (playlistRef) => {
    const oauthToken = getOauthToken();
    const playlist = /^\d+$/.test(playlistRef)
        ? await soundcloudRequest(`/playlists/${playlistRef}`, { oauthToken })
        : await soundcloudRequest('/resolve', { params: { url: `https://soundcloud.com/${playlistRef}` }, oauthToken });

    if (!playlist || !['playlist', 'system-playlist'].includes(playlist.kind)) {
        throw new AppError('O link não é de uma playlist (set) do SoundCloud.', 400);
    }
    return { playlist, oauthToken };
};

const readPlaylist = async (playlistRef, { limit = PLAYLIST_MAX_ITEMS } = {}) => {
    const { playlist, oauthToken } = await fetchPlaylist(playlistRef);
    const tracks = (await hydrateTracks((playlist.tracks || []).slice(0, limit), oauthToken)).map(toTrack);

    return {
        id: String(playlist.id),
        name: playlist.title || 'Playlist SoundCloud',
        description: playlist.description || '',
        ownerName: playlist.user?.username || '',
        imageUrl: playlist.artwork_url?.replace('-large', '-t500x500') || null,
        totalTracks: playlist.track_count ?? tracks.length,
        tracks,
    };
};

const toCandidate = (track) => {
    const normalized = toTrack(track);
    return {
        id: normalized.soundcloudId,
        name: normalized.name,
        rawName: track.title,
        externalUrl: normalized.uri,
        artists: normalized.artists,
        durationMs: normalized.durationMs,
        isrc: normalized.isrc,
    };
};

/**
 * SoundCloud: leitura de playlists públicas e busca sem login; conta via
 * cookie `oauth_token` para listar, ler privadas e criar playlists.
 */
const soundcloudProvider = {
    id: PROVIDER_ID,
    label: 'SoundCloud',
    aliases: [],
    auth: {
        type: 'cookie',
        method: 'soundcloud-oauth-token',
        optionalForRead: true,
        fields: [{
            name: 'oauthToken',
            label: 'Cookie oauth_token de soundcloud.com',
            placeholder: 'Cole o valor do cookie oauth_token',
            secret: true,
        }],
    },
    capabilities: {
        read: true,
        write: true,
        listUserPlaylists: true,
        readByLink: true,
        isrcSearch: false,
        setImage: false,
    },
    playlistUrlExample: 'https://soundcloud.com/usuario/sets/nome-da-playlist',

    getSearchDelayMs() {
        return Number(process.env.SOUNDCLOUD_SEARCH_DELAY_MS ?? 300);
    },

    async getStatus() {
        const credentials = getProviderCredentials(PROVIDER_ID);
        const connected = Boolean(getOauthToken());
        return {
            connected,
            canRead: true,
            canWrite: connected,
            authMethod: connected ? 'soundcloud-oauth-token' : 'public-api',
            credentialSource: credentials?.oauthToken ? 'panel' : (process.env.SOUNDCLOUD_OAUTH_TOKEN ? 'env' : null),
            accountName: credentials?.username || null,
            expiresAt: null,
        };
    },

    async ensureReadable() {},

    async ensureWritable() {
        requireOauthToken('criar playlists');
    },

    /**
     * Link vira `usuario/sets/nome` (resolvido na leitura); número é ID direto.
     */
    normalizePlaylistId(input) {
        const text = String(input || '').trim();
        if (/^\d+$/.test(text)) return text;
        // Já normalizado (`usuario/sets/nome`): a validação no início e a leitura chamam de novo.
        if (!/soundcloud\.com/i.test(text)) return text.split('?')[0].replace(/^\/+|\/+$/g, '');
        try {
            const url = new URL(text.startsWith('http') ? text : `https://${text}`);
            return url.pathname.replace(/^\/+|\/+$/g, '');
        } catch {
            return text;
        }
    },

    async listPlaylists() {
        const oauthToken = requireOauthToken('listar suas playlists');
        const me = await soundcloudRequest('/me', { oauthToken });
        const page = await soundcloudRequest(`/users/${me.id}/playlists_without_albums`, {
            params: { limit: 200, linked_partitioning: 1 },
            oauthToken,
        });
        const playlists = page?.collection || [];

        return {
            playlists: playlists.map((playlist) => ({
                id: String(playlist.id),
                name: playlist.title,
                description: playlist.description || '',
                ownerName: playlist.sharing === 'private' ? 'Privada' : playlist.user?.username || 'SoundCloud',
                trackCount: playlist.track_count ?? 0,
                imageUrl: playlist.artwork_url || null,
                externalUrl: playlist.permalink_url || null,
            })),
            total: playlists.length,
            limit: playlists.length,
            hasMore: Boolean(page?.next_href),
        };
    },

    getPlaylistSnapshot: ({ playlistId }) => readPlaylist(soundcloudProvider.normalizePlaylistId(playlistId)),

    async getPlaylistPreview({ playlistId, limit = 25 }) {
        const previewLimit = Math.max(1, Math.min(Number(limit) || 25, 100));
        const playlist = await readPlaylist(soundcloudProvider.normalizePlaylistId(playlistId), { limit: previewLimit });
        return { ...playlist, returnedTracks: playlist.tracks.length, hasMore: playlist.totalTracks > playlist.tracks.length };
    },

    createSearchClient() {
        return {
            async searchBestMatch({ track }) {
                const query = [track.artist?.split(',')[0], track.name].filter(Boolean).join(' ');
                const page = await soundcloudRequest('/search/tracks', { params: { q: query, limit: 10 } });
                const candidates = (page?.collection || [])
                    // Trechos de 30 s (prévia de faixa paga) não servem como faixa completa.
                    .filter((candidate) => candidate.policy !== 'SNIP')
                    .map(toCandidate);
                // Sem nome parecido o máximo é 40 (artista + duração), abaixo do mínimo:
                // uploads de fã com o nome do artista não passam.
                return pickBestCandidate(track, candidates, { requireArtist: true });
            },
        };
    },

    getMatchId: (match) => match?.id,

    createDestinationClient() {
        const oauthToken = requireOauthToken('criar playlists');
        const permalinks = new Map();

        return {
            async createPlaylist({ title, description }) {
                const playlist = await soundcloudRequest('/playlists', {
                    method: 'POST',
                    oauthToken,
                    body: { playlist: { title, description: description || '', sharing: 'private', tracks: [], _resource_type: 'playlist' } },
                });
                if (!playlist?.id) throw new Error('SoundCloud não retornou o ID da playlist criada.');
                if (playlist.permalink_url) permalinks.set(String(playlist.id), playlist.permalink_url);
                return String(playlist.id);
            },

            // A API substitui a lista inteira: junta as atuais com as novas.
            async addTracks({ playlistId, ids, expectedIds }) {
                const current = await soundcloudRequest(`/playlists/${playlistId}`, { oauthToken });
                const currentIds = (current?.tracks || []).map((track) => String(track.id));
                const pending = getMissingTrackIds({ ids: ids.map(String), existingIds: currentIds, expectedIds });
                const merged = [...currentIds, ...pending];
                if (merged.length > PLAYLIST_MAX_ITEMS) throw new AppError(`A playlist excede o limite de ${PLAYLIST_MAX_ITEMS} faixas do SoundCloud.`, 400);
                if (merged.length === currentIds.length) return;

                await soundcloudRequest(`/playlists/${playlistId}`, {
                    method: 'PUT',
                    oauthToken,
                    body: { playlist: { tracks: merged.map(Number) } },
                });
            },

            getPlaylistUrl: (playlistId) => permalinks.get(String(playlistId)) || 'https://soundcloud.com/you/sets',
            setPlaylistImage: null,
        };
    },

    async saveCredentials({ values }) {
        const oauthToken = String(values?.oauthToken || '').trim().replace(/^OAuth\s+/i, '');
        if (oauthToken.length < 20) {
            throw new AppError('O oauth_token do SoundCloud tem o formato 2-123456-789-AbCdEf... Copie o valor do cookie "oauth_token".', 400);
        }

        const me = await soundcloudRequest('/me', { oauthToken }).catch((error) => {
            throw new AppError(`SoundCloud recusou o oauth_token: ${error.message}`, 400);
        });
        setProviderCredentials(PROVIDER_ID, { oauthToken, userId: String(me.id), username: me.username });
    },

    async disconnect() {
        clearProviderCredentials(PROVIDER_ID);
    },
};

export default soundcloudProvider;
