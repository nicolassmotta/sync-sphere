import { SpotifyPlaylistAccessError } from '../src/services/spotify/spotifyErrors.js';
import { jest } from '@jest/globals';
import { buildSpotifyServiceMock, buildYoutubeMusicServiceMock } from './helpers/serviceMocks.js';

const mockInsertMany = jest.fn();
const mockAddTransferJob = jest.fn();
const mockGetSpotifyPlaylistTracksPreview = jest.fn();
const mockEnsureSpotifyDestinationReady = jest.fn();
const mockGetYoutubeMusicPlaylistTracksPreview = jest.fn();

jest.unstable_mockModule('../src/models/Transfer.js', () => ({
    default: {
        insertMany: mockInsertMany,
    },
}));

jest.unstable_mockModule('../src/services/queueService.js', () => ({
    addTransferJob: mockAddTransferJob,
}));

jest.unstable_mockModule('../src/services/spotifyService.js', () => buildSpotifyServiceMock({
    getSpotifyPlaylistTracksPreview: mockGetSpotifyPlaylistTracksPreview,
    ensureSpotifyDestinationReady: mockEnsureSpotifyDestinationReady,
}));

jest.unstable_mockModule('../src/services/youtubeMusicService.js', () => buildYoutubeMusicServiceMock({
    getYoutubeMusicPlaylistTracksPreview: mockGetYoutubeMusicPlaylistTracksPreview,
}));

const { queuePlaylistTransfers } = await import('../src/services/transfer/startTransferService.js');

describe('pré-validação Spotify em queuePlaylistTransfers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.YTMUSIC_COOKIE = '__Secure-3PAPISID=fake-sapisid; SID=fake-session';
        mockGetSpotifyPlaylistTracksPreview.mockResolvedValue({
            id: 'playlist-1',
            totalTracks: 10,
            returnedTracks: 1,
            tracks: [{ spotifyId: 'track-1', name: 'Música', artist: 'Artista' }],
        });
        mockEnsureSpotifyDestinationReady.mockResolvedValue(undefined);
        mockGetYoutubeMusicPlaylistTracksPreview.mockResolvedValue({
            id: 'youtube-playlist-1',
            totalTracks: 10,
            returnedTracks: 1,
            tracks: [{ youtubeVideoId: 'video-1', name: 'Música', artist: 'Artista' }],
        });
        mockInsertMany.mockImplementation(async (docs) => docs.map((doc, index) => ({
            _id: `transfer-${index + 1}`,
            ...doc,
        })));
        mockAddTransferJob.mockResolvedValue(undefined);
    });

    afterEach(() => {
        delete process.env.YTMUSIC_COOKIE;
    });

    it('normaliza URL de playlist e valida acesso antes de enfileirar', async () => {
        await queuePlaylistTransfers({
            userId: 'user-1',
            sourcePlaylistId: 'https://open.spotify.com/playlist/playlist123?si=abc',
        });

        expect(mockGetSpotifyPlaylistTracksPreview).toHaveBeenCalledWith({
            playlistId: 'playlist123',
            userId: 'user-1',
            limit: 1,
        });
        expect(mockInsertMany).toHaveBeenCalledWith([
            expect.objectContaining({
                user: 'user-1',
                sourcePlaylistId: 'playlist123',
            }),
        ]);
        expect(mockAddTransferJob).toHaveBeenCalledWith('transfer-1', 'user-1', 'playlist123', 'spotify_to_youtube', {
            lane: 'youtubeMusic',
        });
    });

    it('não cria transferência nem tarefa quando o Spotify bloqueia as faixas', async () => {
        mockGetSpotifyPlaylistTracksPreview.mockRejectedValueOnce(
            new SpotifyPlaylistAccessError('O Spotify não permitiu ler as faixas de "Lofi Girl". A API oficial só libera faixas de playlists criadas por você ou colaborativas.')
        );

        await expect(queuePlaylistTransfers({
            userId: 'user-1',
            sourcePlaylistId: '0vvXsWCC9xrXsKd4FyS8kM',
        })).rejects.toMatchObject({
            statusCode: 400,
            message: 'O Spotify não permitiu ler as faixas de "Lofi Girl". A API oficial só libera faixas de playlists criadas por você ou colaborativas.',
        });

        expect(mockInsertMany).not.toHaveBeenCalled();
        expect(mockAddTransferJob).not.toHaveBeenCalled();
    });

    it('rejeita migração sem cookie do YouTube Music configurado', async () => {
        delete process.env.YTMUSIC_COOKIE;

        await expect(queuePlaylistTransfers({
            userId: 'user-1',
            sourcePlaylistId: 'playlist123',
        })).rejects.toMatchObject({
            statusCode: 400,
            message: 'Configure o cookie do YouTube Music em Integrações (ou YTMUSIC_COOKIE no backend/.env) para criar playlists no YouTube Music.',
        });

        expect(mockGetSpotifyPlaylistTracksPreview).not.toHaveBeenCalled();
        expect(mockInsertMany).not.toHaveBeenCalled();
        expect(mockAddTransferJob).not.toHaveBeenCalled();
    });

    it('normaliza playlist do YouTube Music e valida o Spotify antes de enfileirar o caminho inverso', async () => {
        await queuePlaylistTransfers({
            userId: 'user-1',
            direction: 'youtube_to_spotify',
            sourcePlaylistId: 'https://music.youtube.com/playlist?list=PLyoutube123',
        });

        expect(mockEnsureSpotifyDestinationReady).toHaveBeenCalledWith({ userId: 'user-1' });
        expect(mockGetYoutubeMusicPlaylistTracksPreview).toHaveBeenCalledWith({
            playlistId: 'PLyoutube123',
            limit: 1,
        });
        expect(mockInsertMany).toHaveBeenCalledWith([
            expect.objectContaining({
                user: 'user-1',
                sourcePlaylistId: 'PLyoutube123',
                sourceProvider: 'youtubeMusic',
                targetProvider: 'spotify',
                direction: 'youtube_to_spotify',
            }),
        ]);
        expect(mockAddTransferJob).toHaveBeenCalledWith(
            'transfer-1',
            'user-1',
            'PLyoutube123',
            'youtube_to_spotify',
            { lane: 'spotify' }
        );
    });
});
