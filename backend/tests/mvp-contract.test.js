import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { buildSpotifyServiceMock } from './helpers/serviceMocks.js';

const mockFindById = jest.fn();
const mockGetSpotifyPlaylistTracksPreview = jest.fn();
const mockListSpotifyUserPlaylists = jest.fn();
const mockQueuePlaylistTransfers = jest.fn();

jest.unstable_mockModule('../src/models/User.js', () => ({
    default: {
        findById: mockFindById,
    },
    LOCAL_USER_ID: 'local',
}));

jest.unstable_mockModule('../src/services/spotifyService.js', () => buildSpotifyServiceMock({
    buildSpotifyAuthorizationUrl: jest.fn(() => 'https://accounts.spotify.com/authorize?mock=true'),
    getSpotifyPlaylistTracksPreview: mockGetSpotifyPlaylistTracksPreview,
    listSpotifyUserPlaylists: mockListSpotifyUserPlaylists,
}));

jest.unstable_mockModule('../src/services/transfer/startTransferService.js', () => ({
    queuePlaylistTransfers: mockQueuePlaylistTransfers,
}));

const { default: app } = await import('../src/app.js');

const buildAuthHeader = (userId = 'user-1') => {
    const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
    return `Bearer ${token}`;
};

const buildProtectedUser = (overrides = {}) => ({
    _id: 'user-1',
    id: 'user-1',
    spotifyToken: 'spotify-access-token',
    spotifyRefreshToken: 'spotify-refresh-token',
    spotifyTokenExpiresAt: new Date(Date.now() + 3600_000),
    ...overrides,
});

const mockUserLookup = (user = buildProtectedUser()) => {
    mockFindById.mockReturnValue({
        ...user,
        select: jest.fn().mockResolvedValue(user),
    });
};

describe('contratos de integrações e transferência do MVP', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.YTMUSIC_COOKIE = '__Secure-3PAPISID=fake-sapisid; SID=fake-session';
        mockUserLookup();
    });

    afterEach(() => {
        delete process.env.YTMUSIC_COOKIE;
    });

    it('GET /api/v1/integrations/status expõe conexões Spotify e YouTube Music por cookie', async () => {
        const response = await request(app)
            .get('/api/v1/integrations/status')
            .set('Authorization', buildAuthHeader());

        expect(response.status).toBe(200);
        expect(response.body.data.integrations).toEqual(expect.objectContaining({
            spotify: expect.objectContaining({
                connected: true,
                expiresAt: expect.any(String),
            }),
            youtubeMusic: expect.objectContaining({
                connected: true,
                authMethod: 'ytmusic-cookie',
                expiresAt: null,
            }),
        }));
    });

    it('GET /api/v1/integrations/status retorna YouTube Music desconectado sem cookie', async () => {
        delete process.env.YTMUSIC_COOKIE;

        const response = await request(app)
            .get('/api/v1/integrations/status')
            .set('Authorization', buildAuthHeader());

        expect(response.status).toBe(200);
        expect(response.body.data.integrations.youtubeMusic).toEqual(expect.objectContaining({
            connected: false,
            authMethod: null,
        }));
    });

    it('GET /api/v1/integrations/spotify/playlists retorna playlists selecionáveis', async () => {
        mockListSpotifyUserPlaylists.mockResolvedValue({
            playlists: [
                {
                    id: '37i9dQZF1DXcBWIGoYBM5M',
                    name: 'Hits de Hoje',
                    trackCount: 50,
                    imageUrl: 'https://example.com/cover.jpg',
                    externalUrl: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
                },
            ],
            total: 1,
            limit: 200,
            hasMore: false,
        });

        const response = await request(app)
            .get('/api/v1/integrations/spotify/playlists')
            .set('Authorization', buildAuthHeader());

        expect(response.status).toBe(200);
        expect(response.body.results).toBe(1);
        expect(response.body.data.playlists).toEqual([
            expect.objectContaining({
                id: '37i9dQZF1DXcBWIGoYBM5M',
                name: 'Hits de Hoje',
                trackCount: 50,
            }),
        ]);
        expect(mockListSpotifyUserPlaylists).toHaveBeenCalledWith({ userId: 'local' });
    });

    it('GET /api/v1/integrations/spotify/playlists/:playlistId/tracks retorna preview de faixas', async () => {
        mockGetSpotifyPlaylistTracksPreview.mockResolvedValue({
            id: '37i9dQZF1DXcBWIGoYBM5M',
            name: 'Hits de Hoje',
            totalTracks: 50,
            returnedTracks: 2,
            hasMore: true,
            tracks: [
                { spotifyId: 'track-1', name: 'Faixa Um', artist: 'Artista Um' },
                { spotifyId: 'track-2', name: 'Faixa Dois', artist: 'Artista Dois' },
            ],
        });

        const response = await request(app)
            .get('/api/v1/integrations/spotify/playlists/37i9dQZF1DXcBWIGoYBM5M/tracks?limit=2')
            .set('Authorization', buildAuthHeader());

        expect(response.status).toBe(200);
        expect(response.body.results).toBe(2);
        expect(response.body.data).toEqual(expect.objectContaining({
            id: '37i9dQZF1DXcBWIGoYBM5M',
            totalTracks: 50,
            hasMore: true,
            tracks: [
                expect.objectContaining({ name: 'Faixa Um', artist: 'Artista Um' }),
                expect.objectContaining({ name: 'Faixa Dois', artist: 'Artista Dois' }),
            ],
        }));
        expect(mockGetSpotifyPlaylistTracksPreview).toHaveBeenCalledWith({
            playlistId: '37i9dQZF1DXcBWIGoYBM5M',
            userId: 'local',
            limit: '2',
        });
    });

    it('POST /api/v1/transfer/start aceita múltiplas playlists e retorna transferIds', async () => {
        mockQueuePlaylistTransfers.mockResolvedValue({
            playlistIds: ['spotify-playlist-001', 'spotify-playlist-002'],
            transfers: [
                { _id: 'transfer-1', sourcePlaylistId: 'spotify-playlist-001' },
                { _id: 'transfer-2', sourcePlaylistId: 'spotify-playlist-002' },
            ],
        });

        const response = await request(app)
            .post('/api/v1/transfer/start')
            .set('Authorization', buildAuthHeader())
            .send({
                sourcePlaylistIds: ['spotify-playlist-001', 'spotify-playlist-002'],
            });

        expect(response.status).toBe(202);
        expect(response.body.data).toEqual({
            transferId: 'transfer-1',
            transferIds: ['transfer-1', 'transfer-2'],
        });
        expect(mockQueuePlaylistTransfers).toHaveBeenCalledWith({
            userId: 'local',
            sourcePlaylistId: undefined,
            sourcePlaylistIds: ['spotify-playlist-001', 'spotify-playlist-002'],
        });
    });

    it('POST /api/v1/transfer/start rejeita payload sem playlist', async () => {
        const response = await request(app)
            .post('/api/v1/transfer/start')
            .set('Authorization', buildAuthHeader())
            .send({});

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Selecione ao menos uma playlist');
        expect(mockQueuePlaylistTransfers).not.toHaveBeenCalled();
    });

    it('GET /api/v1/integrations/status lista provedores com capacidades', async () => {
        const response = await request(app)
            .get('/api/v1/integrations/status')
            .set('Authorization', buildAuthHeader());

        expect(response.body.data.providers).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'spotify',
                label: 'Spotify',
                auth: expect.objectContaining({ type: 'oauth' }),
                capabilities: expect.objectContaining({ read: true, write: true, listUserPlaylists: true }),
                connected: true,
            }),
            expect.objectContaining({
                id: 'youtubeMusic',
                auth: expect.objectContaining({ type: 'cookie' }),
                credentialSource: 'env',
            }),
        ]));
    });

    it('PUT /api/v1/integrations/youtube-music/credentials salva o cookie colado no painel', async () => {
        delete process.env.YTMUSIC_COOKIE;

        const invalid = await request(app)
            .put('/api/v1/integrations/youtube-music/credentials')
            .set('Authorization', buildAuthHeader())
            .send({ values: { cookie: 'foo=bar' } });
        expect(invalid.status).toBe(400);
        expect(invalid.body.message).toContain('incompleto');

        const saved = await request(app)
            .put('/api/v1/integrations/youtube-music/credentials')
            .set('Authorization', buildAuthHeader())
            .send({ values: { cookie: '__Secure-3PAPISID=painel; SID=painel' } });
        expect(saved.status).toBe(200);
        expect(saved.body.data.youtubeMusic).toEqual(expect.objectContaining({
            connected: true,
            credentialSource: 'panel',
        }));

        const removed = await request(app)
            .delete('/api/v1/integrations/youtube-music')
            .set('Authorization', buildAuthHeader());
        expect(removed.body.data.youtubeMusic.connected).toBe(false);
    });

    it('recusa plataforma desconhecida nas rotas genéricas', async () => {
        const response = await request(app)
            .get('/api/v1/integrations/napster/playlists')
            .set('Authorization', buildAuthHeader());

        expect(response.status).toBe(404);
        expect(response.body.message).toContain('Plataforma não suportada');
    });

    it('recusa listar playlists em plataforma sem essa capacidade', async () => {
        const response = await request(app)
            .get('/api/v1/integrations/youtube-music/playlists')
            .set('Authorization', buildAuthHeader());

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Cole o link');
    });

    it('POST /api/v1/transfer/start aceita origem e destino explícitos e recusa pares iguais', async () => {
        mockQueuePlaylistTransfers.mockResolvedValue({
            playlistIds: ['PLyoutube123456'],
            transfers: [{ _id: 'transfer-1', sourcePlaylistId: 'PLyoutube123456' }],
        });

        const accepted = await request(app)
            .post('/api/v1/transfer/start')
            .set('Authorization', buildAuthHeader())
            .send({ sourceProvider: 'youtubeMusic', targetProvider: 'spotify', sourcePlaylistId: 'PLyoutube123456' });
        expect(accepted.status).toBe(202);
        expect(mockQueuePlaylistTransfers).toHaveBeenCalledWith(expect.objectContaining({
            sourceProvider: 'youtubeMusic',
            targetProvider: 'spotify',
        }));

        const same = await request(app)
            .post('/api/v1/transfer/start')
            .set('Authorization', buildAuthHeader())
            .send({ sourceProvider: 'spotify', targetProvider: 'spotify', sourcePlaylistId: 'PLyoutube123456' });
        expect(same.status).toBe(400);
        expect(same.body.message).toContain('plataformas diferentes');

        const conversion = await request(app)
            .post('/api/v1/transfer/start')
            .set('Authorization', buildAuthHeader())
            .send({ sourceProvider: 'file', targetProvider: 'file', sourcePlaylistId: 'import-0000000000' });
        expect(conversion.status).toBe(202);

        const unknown = await request(app)
            .post('/api/v1/transfer/start')
            .set('Authorization', buildAuthHeader())
            .send({ sourceProvider: 'napster', targetProvider: 'spotify', sourcePlaylistId: 'PLyoutube123456' });
        expect(unknown.status).toBe(400);
        expect(unknown.body.message).toContain('Plataforma não suportada');
    });
});
