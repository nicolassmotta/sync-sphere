import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import mongoose from 'mongoose';
import redisConnection from '../src/config/redis.js';

const mockFindById = jest.fn();
const mockGetSpotifyPlaylistTracksPreview = jest.fn();
const mockListSpotifyUserPlaylists = jest.fn();
const mockQueuePlaylistTransfers = jest.fn();

jest.unstable_mockModule('../src/models/User.js', () => ({
    default: {
        findById: mockFindById,
    },
}));

jest.unstable_mockModule('../src/services/spotifyService.js', () => ({
    buildSpotifyAuthorizationUrl: jest.fn(() => 'https://accounts.spotify.com/authorize?mock=true'),
    exchangeSpotifyCode: jest.fn(),
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
        expect(response.body.data.integrations).toEqual({
            spotify: expect.objectContaining({
                connected: true,
                expiresAt: expect.any(String),
            }),
            youtubeMusic: expect.objectContaining({
                connected: true,
                authMethod: 'ytmusic-cookie',
                expiresAt: null,
            }),
        });
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
        expect(mockListSpotifyUserPlaylists).toHaveBeenCalledWith({ userId: 'user-1' });
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
            userId: 'user-1',
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
            userId: 'user-1',
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
});

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }

    if (redisConnection.status !== 'end') {
        await redisConnection.quit();
    }
});
