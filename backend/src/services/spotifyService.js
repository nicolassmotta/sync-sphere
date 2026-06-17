import { mapWithConcurrency } from '../utils/concurrency.js';
import {
    buildSpotifyAuthorizationUrl,
    exchangeSpotifyCode,
    getConnectedSpotifyAccessTokenForUser,
    getSpotifyAccessTokenForUser,
    getSpotifyScopes,
    refreshSpotifyAccessToken,
} from './spotify/spotifyAuth.js';
import {
    fetchSpotifyJson,
    fetchSpotifyJsonPage,
    fetchSpotifyPlaylistItemsPage,
    fetchSpotifyText,
    getSpotifyPlaylistDetails,
    getSpotifyPlaylistItemsPageUrl,
} from './spotify/spotifyApiClient.js';
import {
    buildSpotifyPlaylistAccessErrorMessage,
    decorateSpotifyPlaylistAccessError,
    SpotifyPlaylistAccessError,
} from './spotify/spotifyErrors.js';
import {
    getSpotifyFirstImageUrl,
    getSpotifyPlaylistItemsReference,
    normalizeSpotifyEmbedTrackItems,
    normalizeSpotifyPathfinderTrackItems,
    normalizeSpotifyPlaylistSummary,
    normalizeSpotifyTrackItems,
} from './spotify/spotifyPlaylistFormatters.js';
import { scoreSpotifyCandidate } from './spotify/spotifyTrackMatchScoring.js';

export {
    buildSpotifyAuthorizationUrl,
    exchangeSpotifyCode,
    getSpotifyScopes,
    refreshSpotifyAccessToken,
    SpotifyPlaylistAccessError,
};

const SPOTIFY_PLAYLIST_PAGE_LIMIT = 50;
const SPOTIFY_PLAYLIST_MAX_ITEMS = 1000;
const SPOTIFY_PLAYLIST_PAGE_CONCURRENCY = 3;
const SPOTIFY_PUBLIC_PLAYLIST_PAGE_LIMIT = 500;
const SPOTIFY_ADD_TRACK_CHUNK_SIZE = 100;
const SPOTIFY_PATHFINDER_QUERY_PLAYLIST_HASH = '908a5597b4d0af0489a9ad6a2d41bc3b416ff47c0884016d92bbd6822d0eb6d8';

export const listSpotifyUserPlaylists = async ({ userId, maxItems = SPOTIFY_PLAYLIST_MAX_ITEMS }) => {
    const accessToken = await getConnectedSpotifyAccessTokenForUser(userId);
    const limit = SPOTIFY_PLAYLIST_PAGE_LIMIT;
    let nextUrl = `https://api.spotify.com/v1/me/playlists?limit=${limit}&offset=0`;
    const playlists = [];
    let total = 0;

    while (nextUrl && playlists.length < maxItems) {
        const page = await fetchSpotifyJson(
            nextUrl,
            accessToken,
            'Falha ao consultar playlists do Spotify.'
        );

        total = page.total ?? total;
        playlists.push(...(page.items || []).map(normalizeSpotifyPlaylistSummary));
        nextUrl = page.next;
    }

    const returnedPlaylists = playlists.slice(0, maxItems);

    return {
        playlists: returnedPlaylists,
        total,
        limit: maxItems,
        hasMore: total > returnedPlaylists.length || Boolean(nextUrl),
    };
};

export const normalizeSpotifyPlaylistId = (input) => {
    if (!input) return input;

    const trimmed = String(input).trim();
    const match = trimmed.match(/playlist\/([a-zA-Z0-9]+)/);
    if (match) return match[1];

    return trimmed.split('?')[0];
};

const parseSpotifyEmbedEntity = (html) => {
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!nextDataMatch?.[1]) {
        throw new SpotifyPlaylistAccessError(buildSpotifyPlaylistAccessErrorMessage());
    }

    const nextData = JSON.parse(nextDataMatch[1]);
    const state = nextData.props?.pageProps?.state;
    const entity = state?.data?.entity;
    if (!entity?.trackList?.length) {
        throw new SpotifyPlaylistAccessError(buildSpotifyPlaylistAccessErrorMessage(entity?.name));
    }

    return { entity, state };
};

const fetchSpotifyPublicPlaylistPathfinderPage = async ({ playlistId, accessToken, offset, limit }) => {
    const url = new URL('https://api-partner.spotify.com/pathfinder/v1/query');
    url.searchParams.set('operationName', 'queryPlaylist');
    url.searchParams.set('variables', JSON.stringify({
        uri: `spotify:playlist:${playlistId}`,
        limit,
        offset,
    }));
    url.searchParams.set('extensions', JSON.stringify({
        persistedQuery: {
            version: 1,
            sha256Hash: SPOTIFY_PATHFINDER_QUERY_PLAYLIST_HASH,
        },
    }));

    const response = await fetch(url.toString(), {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'app-platform': 'WebPlayer',
            Accept: 'application/json',
        },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.errors?.length || data.error) {
        throw new SpotifyPlaylistAccessError(buildSpotifyPlaylistAccessErrorMessage());
    }

    const content = data.data?.playlistV2?.content;
    if (!content?.items) {
        throw new SpotifyPlaylistAccessError(buildSpotifyPlaylistAccessErrorMessage());
    }

    return {
        tracks: normalizeSpotifyPathfinderTrackItems(content.items),
        nextOffset: content.pagingInfo?.nextOffset,
        totalCount: content.totalCount,
    };
};

const getSpotifyPublicPlaylistPathfinderTracks = async ({ playlistId, accessToken, maxItems = SPOTIFY_PLAYLIST_MAX_ITEMS }) => {
    const tracks = [];
    let offset = 0;
    let totalCount = 0;

    while (tracks.length < maxItems) {
        const limit = Math.min(SPOTIFY_PUBLIC_PLAYLIST_PAGE_LIMIT, maxItems - tracks.length);
        const page = await fetchSpotifyPublicPlaylistPathfinderPage({
            playlistId,
            accessToken,
            offset,
            limit,
        });

        tracks.push(...page.tracks);
        totalCount = page.totalCount ?? totalCount;

        if (!page.nextOffset || page.nextOffset <= offset || (totalCount && page.nextOffset >= totalCount)) {
            break;
        }

        offset = page.nextOffset;
    }

    return {
        tracks,
        totalCount: totalCount || tracks.length,
        hasMore: totalCount ? totalCount > tracks.length : false,
    };
};

const getSpotifyPublicPlaylistEmbedSnapshot = async ({ playlistId, playlist, maxItems = SPOTIFY_PLAYLIST_MAX_ITEMS }) => {
    const html = await fetchSpotifyText(
        `https://open.spotify.com/embed/playlist/${playlistId}`,
        buildSpotifyPlaylistAccessErrorMessage(playlist?.name)
    );
    const { entity, state } = parseSpotifyEmbedEntity(html);
    const embedTracks = normalizeSpotifyEmbedTrackItems(entity.trackList);
    const anonymousAccessToken = state?.settings?.session?.accessToken;
    let publicPage = {
        tracks: embedTracks,
        totalCount: embedTracks.length,
        hasMore: false,
    };

    if (anonymousAccessToken) {
        try {
            publicPage = await getSpotifyPublicPlaylistPathfinderTracks({
                playlistId,
                accessToken: anonymousAccessToken,
                maxItems,
            });
        } catch {
            publicPage = {
                tracks: embedTracks,
                totalCount: embedTracks.length,
                hasMore: false,
            };
        }
    }

    const tracks = publicPage.tracks;
    if (!tracks.length) {
        throw new SpotifyPlaylistAccessError(buildSpotifyPlaylistAccessErrorMessage(playlist?.name || entity.name));
    }

    return {
        id: playlistId,
        name: playlist?.name || entity.name || 'Playlist Spotify',
        description: playlist?.description || '',
        ownerName: playlist?.owner?.display_name || entity.subtitle || '',
        imageUrl: getSpotifyFirstImageUrl(playlist?.images)
            || entity.coverArt?.sources?.find((image) => image?.url)?.url
            || null,
        totalTracks: publicPage.totalCount,
        returnedTracks: tracks.length,
        hasMore: publicPage.hasMore,
        source: 'spotify-public-embed',
        tracks,
    };
};

const getSpotifyPlaylistTracksWithPublicFallback = async ({ playlistId, accessToken, playlist }) => {
    try {
        return await getSpotifyPlaylistTracks({
            playlistId,
            accessToken,
            itemsReference: getSpotifyPlaylistItemsReference(playlist),
        });
    } catch (error) {
        if ((error instanceof SpotifyPlaylistAccessError || error?.isPermanentTransferError) && playlist?.public === true) {
            return (await getSpotifyPublicPlaylistEmbedSnapshot({ playlistId, playlist })).tracks;
        }

        decorateSpotifyPlaylistAccessError(error, playlist);
    }

    return [];
};

const getSpotifyPlaylistTracks = async ({ playlistId, accessToken, itemsReference }) => {
    const firstPage = Array.isArray(itemsReference?.items)
        ? itemsReference
        : await fetchSpotifyPlaylistItemsPage({
            playlistId,
            itemsReference,
            limit: SPOTIFY_PLAYLIST_PAGE_LIMIT,
            offset: 0,
        }, accessToken);

    const firstPageItems = firstPage?.items || [];
    const total = firstPage?.total ?? itemsReference?.total ?? firstPageItems.length;
    const tracks = normalizeSpotifyTrackItems(firstPageItems);
    const remainingPages = [];
    const nextOffset = Number.isFinite(firstPage?.offset) && Number.isFinite(firstPage?.limit)
        ? firstPage.offset + firstPage.limit
        : firstPageItems.length;

    for (let offset = nextOffset; offset < total; offset += SPOTIFY_PLAYLIST_PAGE_LIMIT) {
        remainingPages.push({
            offset,
            url: getSpotifyPlaylistItemsPageUrl({
                playlistId,
                itemsReference,
                limit: SPOTIFY_PLAYLIST_PAGE_LIMIT,
                offset,
            }),
        });
    }

    if (remainingPages.length) {
        const pages = await mapWithConcurrency(
            remainingPages,
            (page) => fetchSpotifyJsonPage(
                page,
                accessToken,
                buildSpotifyPlaylistAccessErrorMessage()
            ),
            SPOTIFY_PLAYLIST_PAGE_CONCURRENCY
        );

        pages
            .sort((a, b) => a.offset - b.offset)
            .forEach((page) => {
                tracks.push(...normalizeSpotifyTrackItems(page.data.items));
            });
    }

    return tracks;
};

export const getSpotifyPlaylistSnapshot = async ({ playlistId, userId }) => {
    const normalizedPlaylistId = normalizeSpotifyPlaylistId(playlistId);
    const accessToken = await getSpotifyAccessTokenForUser(userId);
    const playlist = await getSpotifyPlaylistDetails({
        playlistId: normalizedPlaylistId,
        accessToken,
    });
    const tracks = await getSpotifyPlaylistTracksWithPublicFallback({
        playlistId: normalizedPlaylistId,
        accessToken,
        playlist,
    });

    return {
        id: normalizedPlaylistId,
        name: playlist.name || 'Playlist Spotify',
        description: playlist.description || '',
        ownerName: playlist.owner?.display_name || '',
        imageUrl: getSpotifyFirstImageUrl(playlist.images),
        totalTracks: tracks.length,
        tracks,
    };
};

export const getSpotifyPlaylistTracksPreview = async ({ playlistId, userId, limit = 25 }) => {
    const previewLimit = Math.max(1, Math.min(Number(limit) || 25, 100));
    const normalizedPlaylistId = normalizeSpotifyPlaylistId(playlistId);
    const accessToken = await getSpotifyAccessTokenForUser(userId);
    const playlist = await getSpotifyPlaylistDetails({
        playlistId: normalizedPlaylistId,
        accessToken,
    });
    const itemsReference = getSpotifyPlaylistItemsReference(playlist);
    let page;
    try {
        page = await fetchSpotifyPlaylistItemsPage({
            playlistId: normalizedPlaylistId,
            itemsReference,
            limit: previewLimit,
            offset: 0,
        }, accessToken);
    } catch (error) {
        if ((error instanceof SpotifyPlaylistAccessError || error?.isPermanentTransferError) && playlist?.public === true) {
            const publicSnapshot = await getSpotifyPublicPlaylistEmbedSnapshot({
                playlistId: normalizedPlaylistId,
                playlist,
                maxItems: previewLimit,
            });
            const tracks = publicSnapshot.tracks.slice(0, previewLimit);

            return {
                ...publicSnapshot,
                totalTracks: publicSnapshot.totalTracks,
                returnedTracks: tracks.length,
                hasMore: publicSnapshot.totalTracks > tracks.length,
                tracks,
            };
        }

        decorateSpotifyPlaylistAccessError(error, playlist);
    }
    const tracks = normalizeSpotifyTrackItems(page.items);
    const totalTracks = page.total ?? itemsReference?.total ?? tracks.length;

    return {
        id: normalizedPlaylistId,
        name: playlist.name || 'Playlist Spotify',
        totalTracks,
        tracks,
        returnedTracks: tracks.length,
        hasMore: totalTracks > tracks.length,
    };
};

const sanitizeSpotifyPlaylistName = (name) => (
    String(name || 'Playlist migrada').replace(/[<>]/g, '').trim() || 'Playlist migrada'
);

const sanitizeSpotifyPlaylistDescription = (description) => (
    String(description || '').replace(/<[^>]*>/g, '').trim()
);

const getSpotifyCurrentUserProfile = async (accessToken) => (
    fetchSpotifyJson(
        'https://api.spotify.com/v1/me',
        accessToken,
        'Falha ao consultar o perfil do Spotify.'
    )
);

const createSpotifyPlaylist = async ({ accessToken, userId, title, description }) => (
    fetchSpotifyJson(
        `https://api.spotify.com/v1/users/${encodeURIComponent(userId)}/playlists`,
        accessToken,
        'Falha ao criar playlist no Spotify.',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: sanitizeSpotifyPlaylistName(title),
                description: sanitizeSpotifyPlaylistDescription(description),
                public: false,
            }),
        }
    )
);

const getSpotifyPlaylistExistingTrackUris = async ({ accessToken, playlistId }) => {
    const existingTrackUris = new Set();
    let nextUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100&fields=items(track(uri)),next`;

    while (nextUrl) {
        const page = await fetchSpotifyJson(
            nextUrl,
            accessToken,
            'Falha ao consultar faixas existentes da playlist no Spotify.'
        );

        for (const item of page.items || []) {
            if (item.track?.uri) existingTrackUris.add(item.track.uri);
        }

        nextUrl = page.next;
    }

    return existingTrackUris;
};

const addSpotifyTracksToPlaylist = async ({ accessToken, playlistId, trackUris }) => {
    const existingTrackUris = await getSpotifyPlaylistExistingTrackUris({ accessToken, playlistId });
    const pendingTrackUris = [...new Set(trackUris)].filter((trackUri) => (
        trackUri && !existingTrackUris.has(trackUri)
    ));

    for (let index = 0; index < pendingTrackUris.length; index += SPOTIFY_ADD_TRACK_CHUNK_SIZE) {
        const uris = pendingTrackUris.slice(index, index + SPOTIFY_ADD_TRACK_CHUNK_SIZE);
        if (!uris.length) continue;

        await fetchSpotifyJson(
            `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
            accessToken,
            'Falha ao adicionar faixas na playlist do Spotify.',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ uris }),
            }
        );

        uris.forEach((uri) => existingTrackUris.add(uri));
    }
};

const buildSpotifySearchQuery = (track) => (
    [track.name, track.artist].filter(Boolean).join(' ').trim()
);

export const searchBestSpotifyTrackMatch = async ({ track, userId }) => {
    const accessToken = await getSpotifyAccessTokenForUser(userId);
    const query = buildSpotifySearchQuery(track);
    if (!query) return null;

    const url = new URL('https://api.spotify.com/v1/search');
    url.searchParams.set('type', 'track');
    url.searchParams.set('limit', '10');
    url.searchParams.set('market', 'from_token');
    url.searchParams.set('q', query);

    const data = await fetchSpotifyJson(
        url.toString(),
        accessToken,
        'Falha ao buscar faixas no Spotify.'
    );
    const candidates = data.tracks?.items || [];
    if (!candidates.length) return null;

    return candidates
        .filter((candidate) => candidate.uri)
        .map((candidate) => ({
            ...candidate,
            matchScore: scoreSpotifyCandidate(track, candidate),
        }))
        .sort((a, b) => b.matchScore - a.matchScore)[0] || null;
};

export const createSpotifySearchClient = ({ userId }) => ({
    kind: 'spotify-search',
    searchBestMatch: ({ track }) => searchBestSpotifyTrackMatch({ track, userId }),
});

export const ensureSpotifyDestinationReady = async ({ userId }) => {
    await getConnectedSpotifyAccessTokenForUser(userId);
};

export const createSpotifyDestinationClient = ({ userId }) => {
    const getAccessToken = () => getConnectedSpotifyAccessTokenForUser(userId);

    return {
        kind: 'spotify-destination',

        async createPlaylist({ title, description }) {
            const accessToken = await getAccessToken();
            const profile = await getSpotifyCurrentUserProfile(accessToken);
            if (!profile?.id) {
                throw new Error('Spotify não retornou o ID do usuário conectado.');
            }

            const playlist = await createSpotifyPlaylist({
                accessToken,
                userId: profile.id,
                title,
                description,
            });

            if (!playlist?.id) {
                throw new Error('Spotify não retornou o ID da playlist criada.');
            }

            return playlist.id;
        },

        setPlaylistImage: null,

        async addTracksToPlaylist({ playlistId, trackUris }) {
            const accessToken = await getAccessToken();
            await addSpotifyTracksToPlaylist({ accessToken, playlistId, trackUris });
        },

        getPlaylistUrl(playlistId) {
            return playlistId ? `https://open.spotify.com/playlist/${playlistId}` : null;
        },
    };
};
