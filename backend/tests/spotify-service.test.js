import { jest } from '@jest/globals';

process.env.SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || 'spotify-client-id';
process.env.SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || 'spotify-client-secret';

const mockFindById = jest.fn();

jest.unstable_mockModule('../src/models/User.js', () => ({
    default: {
        findById: mockFindById,
    },
}));

const {
    getSpotifyPlaylistSnapshot,
    getSpotifyPlaylistTracksPreview,
    listSpotifyUserPlaylists,
} = await import('../src/services/spotifyService.js');

const buildSpotifyUser = () => ({
    spotifyToken: 'spotify-access-token',
    spotifyRefreshToken: 'spotify-refresh-token',
    spotifyTokenExpiresAt: new Date(Date.now() + 3600_000),
});

const mockUserLookup = (user = buildSpotifyUser()) => {
    mockFindById.mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
    });
};

const spotifyResponse = (data, { ok = true, status = 200 } = {}) => ({
    ok,
    status,
    json: jest.fn().mockResolvedValue(data),
});

const buildTrackItem = ({ id, name, artist = 'Artista' }) => ({
    track: {
        id,
        name,
        type: 'track',
        artists: [{ name: artist }],
        album: { name: 'Álbum' },
        duration_ms: 180000,
        uri: `spotify:track:${id}`,
    },
});

const buildEmbedHtml = ({ playlistId = 'playlist-1', name = 'Playlist Pública', owner = 'Dono Público' } = {}) => {
    const nextData = {
        props: {
            pageProps: {
                state: {
                    data: {
                        entity: {
                            type: 'playlist',
                            id: playlistId,
                            name,
                            subtitle: owner,
                            coverArt: {
                                sources: [{ url: 'https://example.com/embed-cover.jpg' }],
                            },
                            trackList: [
                                {
                                    uri: 'spotify:track:embed-track-1',
                                    uid: 'embed-track-1',
                                    title: 'Música Incorporada Um',
                                    subtitle: 'Artista Incorporado Um,\u00a0Artista Incorporado Dois',
                                    duration: 120000,
                                    entityType: 'track',
                                },
                                {
                                    uri: 'spotify:track:embed-track-2',
                                    uid: 'embed-track-2',
                                    title: 'Música Incorporada Dois',
                                    subtitle: 'Artista Incorporado Três',
                                    duration: 90000,
                                    entityType: 'track',
                                },
                            ],
                        },
                    },
                    settings: {
                        session: {
                            accessToken: 'anonymous-embed-token',
                        },
                    },
                },
            },
        },
    };

    return `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nextData)}</script></body></html>`;
};

const buildPathfinderPlaylistResponse = ({ totalCount = 2, nextOffset = null } = {}) => spotifyResponse({
    data: {
        playlistV2: {
            content: {
                items: [
                    {
                        itemV2: {
                            data: {
                                __typename: 'Track',
                                uri: 'spotify:track:pathfinder-track-1',
                                name: 'Música Pathfinder Um',
                                artists: {
                                    items: [
                                        { profile: { name: 'Artista Pathfinder Um' } },
                                        { profile: { name: 'Artista Pathfinder Dois' } },
                                    ],
                                },
                                albumOfTrack: { name: 'Álbum Pathfinder' },
                                duration: { totalMilliseconds: 111000 },
                            },
                        },
                    },
                    {
                        itemV2: {
                            data: {
                                __typename: 'Track',
                                uri: 'spotify:track:pathfinder-track-2',
                                name: 'Música Pathfinder Dois',
                                artists: {
                                    items: [
                                        { profile: { name: 'Artista Pathfinder Três' } },
                                    ],
                                },
                                albumOfTrack: { name: 'Álbum Pathfinder' },
                                duration: { totalMilliseconds: 222000 },
                            },
                        },
                    },
                ],
                pagingInfo: { nextOffset },
                totalCount,
            },
        },
    },
});

describe('compatibilidade de itens de playlist no spotifyService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUserLookup();
        global.fetch = jest.fn();
    });

    it('usa items.total ao listar playlists quando a API não retorna tracks.total', async () => {
        global.fetch.mockResolvedValueOnce(spotifyResponse({
            total: 1,
            next: null,
            items: [
                {
                    id: 'playlist-1',
                    name: 'Playlist com referência de itens',
                    items: {
                        href: 'https://api.spotify.com/v1/playlists/playlist-1/items',
                        total: 42,
                    },
                    images: [],
                    owner: { display_name: 'Dono' },
                    external_urls: { spotify: 'https://open.spotify.com/playlist/playlist-1' },
                },
            ],
        }));

        const result = await listSpotifyUserPlaylists({ userId: 'user-1' });

        expect(result.playlists[0]).toEqual(expect.objectContaining({
            id: 'playlist-1',
            trackCount: 42,
        }));
    });

    it('busca snapshot completo pelo items.href da playlist', async () => {
        global.fetch
            .mockResolvedValueOnce(spotifyResponse({
                id: 'playlist-1',
                name: 'Playlist com páginas de itens',
                description: 'Descrição',
                items: {
                    href: 'https://api.spotify.com/v1/playlists/playlist-1/items',
                    total: 2,
                },
                images: [],
                owner: { display_name: 'Dono' },
            }))
            .mockResolvedValueOnce(spotifyResponse({
                total: 2,
                items: [
                    buildTrackItem({ id: 'track-1', name: 'Música Um', artist: 'Artista Um' }),
                    buildTrackItem({ id: 'track-2', name: 'Música Dois', artist: 'Artista Dois' }),
                ],
            }));

        const snapshot = await getSpotifyPlaylistSnapshot({
            playlistId: 'playlist-1',
            userId: 'user-1',
        });

        const pageUrl = new URL(global.fetch.mock.calls[1][0]);
        expect(pageUrl.pathname).toBe('/v1/playlists/playlist-1/items');
        expect(pageUrl.searchParams.get('limit')).toBe('50');
        expect(pageUrl.searchParams.get('offset')).toBe('0');
        expect(snapshot).toEqual(expect.objectContaining({
            id: 'playlist-1',
            totalTracks: 2,
            tracks: [
                expect.objectContaining({ spotifyId: 'track-1', name: 'Música Um', artist: 'Artista Um' }),
                expect.objectContaining({ spotifyId: 'track-2', name: 'Música Dois', artist: 'Artista Dois' }),
            ],
        }));
    });

    it('usa items.href também na prévia de faixas', async () => {
        global.fetch
            .mockResolvedValueOnce(spotifyResponse({
                id: 'playlist-1',
                name: 'Prévia da playlist',
                items: {
                    href: 'https://api.spotify.com/v1/playlists/playlist-1/items',
                    total: 10,
                },
                images: [],
                owner: { display_name: 'Dono' },
            }))
            .mockResolvedValueOnce(spotifyResponse({
                total: 10,
                items: [
                    buildTrackItem({ id: 'track-1', name: 'Música Um' }),
                    buildTrackItem({ id: 'track-2', name: 'Música Dois' }),
                ],
            }));

        const preview = await getSpotifyPlaylistTracksPreview({
            playlistId: 'playlist-1',
            userId: 'user-1',
            limit: 2,
        });

        const pageUrl = new URL(global.fetch.mock.calls[1][0]);
        expect(pageUrl.pathname).toBe('/v1/playlists/playlist-1/items');
        expect(pageUrl.searchParams.get('limit')).toBe('2');
        expect(preview.returnedTracks).toBe(2);
        expect(preview.hasMore).toBe(true);
    });

    it('mostra erro claro quando o Spotify bloqueia os itens da playlist', async () => {
        global.fetch
            .mockResolvedValueOnce(spotifyResponse({
                id: 'playlist-1',
                name: 'Playlist bloqueada',
                items: {
                    href: 'https://api.spotify.com/v1/playlists/playlist-1/items',
                    total: 500,
                },
                images: [],
                owner: { display_name: 'Dono' },
            }))
            .mockResolvedValueOnce(spotifyResponse({
                error: {
                    status: 403,
                    message: 'Proibido',
                },
            }, { ok: false, status: 403 }));

        await expect(getSpotifyPlaylistSnapshot({
            playlistId: 'playlist-1',
            userId: 'user-1',
        })).rejects.toThrow('O Spotify não permitiu ler as faixas de "Playlist bloqueada".');
    });

    it('usa incorporação pública como alternativa para playlist pública bloqueada pela Web API', async () => {
        global.fetch
            .mockResolvedValueOnce(spotifyResponse({
                id: 'playlist-1',
                name: 'Playlist pública bloqueada',
                public: true,
                images: [],
                owner: { display_name: 'Dono Público' },
            }))
            .mockResolvedValueOnce(spotifyResponse({
                error: {
                    status: 403,
                    message: 'Proibido',
                },
            }, { ok: false, status: 403 }))
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                text: jest.fn().mockResolvedValue(buildEmbedHtml({
                    playlistId: 'playlist-1',
                    name: 'Playlist pública bloqueada',
                    owner: 'Dono Público',
                })),
            })
            .mockResolvedValueOnce(buildPathfinderPlaylistResponse());

        const snapshot = await getSpotifyPlaylistSnapshot({
            playlistId: 'playlist-1',
            userId: 'user-1',
        });

        expect(global.fetch.mock.calls[2][0]).toBe('https://open.spotify.com/embed/playlist/playlist-1');
        expect(global.fetch.mock.calls[3][0]).toContain('https://api-partner.spotify.com/pathfinder/v1/query');
        expect(snapshot).toEqual(expect.objectContaining({
            id: 'playlist-1',
            totalTracks: 2,
            tracks: [
                expect.objectContaining({
                    spotifyId: 'pathfinder-track-1',
                    name: 'Música Pathfinder Um',
                    artist: 'Artista Pathfinder Um, Artista Pathfinder Dois',
                }),
                expect.objectContaining({
                    spotifyId: 'pathfinder-track-2',
                    name: 'Música Pathfinder Dois',
                    artist: 'Artista Pathfinder Três',
                }),
            ],
        }));
    });

    it('usa incorporação pública como alternativa na prévia', async () => {
        global.fetch
            .mockResolvedValueOnce(spotifyResponse({
                id: 'playlist-1',
                name: 'Playlist pública de prévia',
                public: true,
                images: [],
                owner: { display_name: 'Dono Público' },
            }))
            .mockResolvedValueOnce(spotifyResponse({
                error: {
                    status: 403,
                    message: 'Proibido',
                },
            }, { ok: false, status: 403 }))
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                text: jest.fn().mockResolvedValue(buildEmbedHtml({
                    playlistId: 'playlist-1',
                    name: 'Playlist pública de prévia',
                    owner: 'Dono Público',
                })),
            });

        const preview = await getSpotifyPlaylistTracksPreview({
            playlistId: 'playlist-1',
            userId: 'user-1',
            limit: 1,
        });

        expect(preview.source).toBe('spotify-public-embed');
        expect(preview.returnedTracks).toBe(1);
        expect(preview.hasMore).toBe(true);
        expect(preview.tracks).toEqual([
            expect.objectContaining({ name: 'Música Incorporada Um' }),
        ]);
    });

    it('usa alternativa pública quando o Spotify retorna token ausente nas faixas', async () => {
        global.fetch
            .mockResolvedValueOnce(spotifyResponse({
                id: 'playlist-1',
                name: 'Playlist pública sem token',
                public: true,
                images: [],
                owner: { display_name: 'Dono Público' },
            }))
            .mockResolvedValueOnce(spotifyResponse({
                error: {
                    status: 400,
                    message: 'token ausente',
                },
            }, { ok: false, status: 400 }))
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                text: jest.fn().mockResolvedValue(buildEmbedHtml({
                    playlistId: 'playlist-1',
                    name: 'Playlist pública sem token',
                    owner: 'Dono Público',
                })),
            });

        const preview = await getSpotifyPlaylistTracksPreview({
            playlistId: 'playlist-1',
            userId: 'user-1',
            limit: 1,
        });

        expect(preview.source).toBe('spotify-public-embed');
        expect(preview.tracks).toEqual([
            expect.objectContaining({ name: 'Música Incorporada Um' }),
        ]);
    });
    it('preserva corte e total do snapshot público alternativo', async () => {
        global.fetch
            .mockResolvedValueOnce(spotifyResponse({ id: 'playlist-1', name: 'Grande', public: true, images: [] }))
            .mockResolvedValueOnce(spotifyResponse({ error: { status: 403, message: 'Proibido' } }, { ok: false, status: 403 }))
            .mockResolvedValueOnce({ ok: true, text: async () => buildEmbedHtml() });
        const page = await buildPathfinderPlaylistResponse({ totalCount: 1200, nextOffset: 500 }).json();
        const item = page.data.playlistV2.content.items[0];
        page.data.playlistV2.content.items = Array.from({ length: 500 }, () => item);
        global.fetch.mockResolvedValueOnce(spotifyResponse(page));
        const second = structuredClone(page);
        second.data.playlistV2.content.pagingInfo.nextOffset = 1000;
        global.fetch.mockResolvedValueOnce(spotifyResponse(second));
        const snapshot = await getSpotifyPlaylistSnapshot({ playlistId: 'playlist-1', userId: 'local' });
        expect(snapshot).toMatchObject({ totalTracks: 1200, truncated: true, omittedTracks: 200 });
        expect(snapshot.tracks).toHaveLength(1000);
    });

});
