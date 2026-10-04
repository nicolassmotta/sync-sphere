import { getMissingTrackIds } from '../../services/transfer/reconcileTrackIds.js';
import AppError from '../../utils/AppError.js';
import { pickBestCandidate } from '../../services/matching/scoreCandidate.js';
import {
    clearAppleCredentials,
    getAppleCredentials,
    getDeveloperToken,
    getMusicUserToken,
    hasSigningKey,
    isWebPlayerTokenAutoEnabled,
    replaceAppleCredentials,
    saveAppleCredentials,
} from './appleMusicAuth.js';
import {
    addLibraryPlaylistTracks,
    createLibraryPlaylist,
    findSongsByIsrc,
    getCatalogPlaylist,
    getLibraryPlaylist,
    getStorefront,
    listLibraryPlaylists,
    searchSongs,
    toAppleTrack,
} from './appleMusicApi.js';

const PLAYLIST_MAX_ITEMS = 2000;

const getDefaultStorefront = () => (
    getAppleCredentials().storefront || process.env.APPLE_MUSIC_STOREFRONT || 'br'
);

/**
 * ID interno `<storefront>:<id>`: playlists do catálogo dependem da loja do
 * link; playlists da biblioteca (`p.`) não.
 */
const parsePlaylistRef = (playlistId) => {
    const [maybeStorefront, maybeId] = String(playlistId).split(':');
    return maybeId
        ? { storefront: maybeStorefront, id: maybeId }
        : { storefront: getDefaultStorefront(), id: maybeStorefront };
};

const readPlaylist = async (playlistId, { limit = PLAYLIST_MAX_ITEMS } = {}) => {
    const ref = parsePlaylistRef(playlistId);
    const isLibrary = ref.id.startsWith('p.');
    const { playlist, songs, truncated = false } = isLibrary
        ? await getLibraryPlaylist({ playlistId: ref.id, limit })
        : await getCatalogPlaylist({ storefront: ref.storefront, playlistId: ref.id, limit });
    const attributes = playlist?.attributes || {};
    const tracks = songs.map(toAppleTrack);

    return {
        id: playlistId,
        name: attributes.name || 'Playlist Apple Music',
        description: attributes.description?.standard || attributes.description?.short || '',
        imageUrl: attributes.artwork?.url?.replace('{w}', '600').replace('{h}', '600') || null,
        totalTracks: attributes.trackCount ?? (truncated ? null : tracks.length),
        tracks,
        truncated,
        omittedTracks: truncated && Number.isFinite(attributes.trackCount) ? Math.max(0, attributes.trackCount - songs.length) : (truncated ? null : 0),
    };
};

const toCandidate = (song) => {
    const track = toAppleTrack(song);
    return { id: track.appleId, name: track.name, artists: track.artists, album: track.album, durationMs: track.durationMs, isrc: track.isrc };
};

const requireUserToken = (action) => {
    if ((!getDeveloperToken() && !isWebPlayerTokenAutoEnabled()) || !getMusicUserToken()) {
        throw new AppError(`Conecte sua conta Apple Music em Integrações para ${action}.`, 400);
    }
};

/**
 * Apple Music: oficial com chave MusicKit + autorização no navegador, ou
 * não oficial colando o token do web player e o cookie `media-user-token`.
 */
const appleMusicProvider = {
    id: 'appleMusic',
    label: 'Apple Music',
    aliases: ['apple-music', 'apple'],
    auth: {
        type: 'cookie',
        method: 'musickit',
        fields: [
            {
                name: 'musicUserToken',
                label: 'Music User Token (cookie media-user-token)',
                placeholder: 'Cole o valor do cookie media-user-token',
                secret: true,
            },
            {
                name: 'developerToken',
                label: 'Token do web player (opcional; obtido sozinho se vazio)',
                placeholder: 'Cole o token "Bearer" das requisições de music.apple.com',
                secret: true,
                optional: true,
            },
        ],
    },
    capabilities: {
        read: true,
        write: true,
        listUserPlaylists: true,
        readByLink: true,
        isrcSearch: true,
        setImage: false,
    },
    playlistUrlExample: 'https://music.apple.com/br/playlist/nome/pl.f4d106fed2bd41149aaacabb233eb5eb',

    getSearchDelayMs() {
        return Number(process.env.APPLE_MUSIC_SEARCH_DELAY_MS ?? 200);
    },

    async getStatus() {
        const credentials = getAppleCredentials();
        const developer = getDeveloperToken();
        const hasDeveloperToken = Boolean(developer) || isWebPlayerTokenAutoEnabled();
        const connected = Boolean(hasDeveloperToken && getMusicUserToken());
        return {
            connected,
            canRead: hasDeveloperToken,
            canWrite: connected,
            configured: hasDeveloperToken,
            musicKitAvailable: hasSigningKey(),
            authMethod: connected ? (developer && !developer.webPlayer ? 'musickit' : 'web-player-token') : null,
            credentialSource: credentials.musicUserToken ? 'panel' : (process.env.APPLE_MUSIC_USER_TOKEN ? 'env' : null),
            accountName: credentials.storefront ? `loja ${credentials.storefront.toUpperCase()}` : null,
            expiresAt: null,
        };
    },

    async ensureReadable() {
        if (!getDeveloperToken() && !isWebPlayerTokenAutoEnabled()) {
            throw new AppError('Configure o Apple Music em Integrações para ler playlists.', 400);
        }
    },

    async ensureWritable() {
        requireUserToken('criar playlists');
    },

    normalizePlaylistId(input) {
        const text = String(input || '').trim();
        const catalog = text.match(/music\.apple\.com\/([a-z]{2})\/playlist\/(?:[^/]+\/)?(pl\.[\w-]+)/i);
        if (catalog) return `${catalog[1].toLowerCase()}:${catalog[2]}`;
        const library = text.match(/(p\.[\w-]+)/);
        if (library && !text.includes('pl.')) return library[1];
        return text.split('?')[0];
    },

    async listPlaylists() {
        requireUserToken('listar suas playlists');
        const playlists = await listLibraryPlaylists();
        return {
            playlists: playlists.map((playlist) => ({
                id: playlist.id,
                name: playlist.attributes?.name || 'Playlist',
                description: playlist.attributes?.description?.standard || '',
                ownerName: 'Biblioteca Apple Music',
                trackCount: playlist.attributes?.trackCount ?? 0,
                imageUrl: playlist.attributes?.artwork?.url?.replace('{w}', '250').replace('{h}', '250') || null,
                externalUrl: `https://music.apple.com/library/playlist/${playlist.id}`,
            })),
            total: playlists.length,
            limit: playlists.length,
            hasMore: false,
        };
    },

    getPlaylistSnapshot: ({ playlistId }) => readPlaylist(appleMusicProvider.normalizePlaylistId(playlistId)),

    async getPlaylistPreview({ playlistId, limit = 25 }) {
        const previewLimit = Math.max(1, Math.min(Number(limit) || 25, 100));
        const playlist = await readPlaylist(appleMusicProvider.normalizePlaylistId(playlistId), { limit: previewLimit });
        return { ...playlist, returnedTracks: playlist.tracks.length, hasMore: playlist.totalTracks > playlist.tracks.length };
    },

    createSearchClient() {
        return {
            kind: 'appleMusic-search', capabilities: { isrcSearch: true },
            async searchCandidates({ track, strategy, limit = 10 }) {
                const storefront = getDefaultStorefront();
                if (strategy?.id === 'isrc') return (await findSongsByIsrc({ storefront, isrc: track.isrc })).map(toCandidate);
                const term = strategy?.query || [track.name, track.artist].filter(Boolean).join(' ');
                return (await searchSongs({ storefront, term, limit })).map(toCandidate);
            },
            async searchBestMatch({ track }) {
                let candidates = [];
                if (this.capabilities.isrcSearch && track.isrc) {
                    candidates = await this.searchCandidates({ track, strategy: { id: 'isrc' } });
                    const best = pickBestCandidate(track, candidates);
                    if (best?.matching.decision === 'accepted') return best;
                }
                return pickBestCandidate(track, [...candidates, ...await this.searchCandidates({ track })]);
            },
        };
    },

    getMatchId: (match) => match?.id,

    createDestinationClient() {
        requireUserToken('criar playlists');

        return {
            async createPlaylist({ title, description }) {
                const playlistId = await createLibraryPlaylist({ name: title, description });
                if (!playlistId) throw new Error('Apple Music não retornou o ID da playlist criada.');
                return playlistId;
            },

            async readTrackIds({ playlistId }) {
                const { songs } = await getLibraryPlaylist({ playlistId, limit: Infinity });
                return songs.map((song) => toAppleTrack(song).appleId);
            },

            async addTracks({ playlistId, ids, expectedIds }) {
                // A API não evita duplicatas: compara com o que já está na playlist.
                const { songs } = await getLibraryPlaylist({ playlistId, limit: Infinity });
                const pending = getMissingTrackIds({ ids, existingIds: songs.map((song) => toAppleTrack(song).appleId), expectedIds });
                if (pending.length) await addLibraryPlaylistTracks({ playlistId, songIds: pending });
            },

            getPlaylistUrl: (playlistId) => `https://music.apple.com/library/playlist/${playlistId}`,
            setPlaylistImage: null,
        };
    },

    /**
     * Developer token para o MusicKit JS autorizar a conta no navegador.
     */
    getMusicKitDeveloperToken() {
        if (!hasSigningKey()) {
            throw new AppError('Configure APPLE_TEAM_ID, APPLE_KEY_ID e APPLE_PRIVATE_KEY no backend/.env para conectar pelo MusicKit.', 400);
        }
        return getDeveloperToken().token;
    },

    async saveCredentials({ values }) {
        const musicUserToken = String(values?.musicUserToken || '').trim();
        const developerToken = String(values?.developerToken || '').trim().replace(/^Bearer\s+/i, '');
        if (!musicUserToken) {
            throw new AppError('Informe o Music User Token (cookie media-user-token).', 400);
        }
        if (!hasSigningKey() && !developerToken && !getAppleCredentials().developerToken && !isWebPlayerTokenAutoEnabled()) {
            throw new AppError('Sem chave MusicKit no .env, cole também o token do web player de music.apple.com.', 400);
        }

        const previous = { ...getAppleCredentials() };
        delete previous.updatedAt;
        saveAppleCredentials({ musicUserToken, ...(developerToken ? { developerToken } : {}) });

        // Valida na hora: sem loja, os tokens não servem; volta ao estado anterior.
        try {
            saveAppleCredentials({ storefront: await getStorefront() });
        } catch (error) {
            replaceAppleCredentials(previous);
            throw new AppError(`Apple Music recusou os tokens: ${error.message}`, 400);
        }
    },

    async disconnect() {
        clearAppleCredentials();
    },
};

export default appleMusicProvider;
