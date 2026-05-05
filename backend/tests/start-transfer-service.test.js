import { jest } from '@jest/globals';

const mockInsertMany = jest.fn();
const mockAddTransferJob = jest.fn();
const mockGetSpotifyPlaylistTracksPreview = jest.fn();

jest.unstable_mockModule('../src/models/Transfer.js', () => ({
    default: {
        insertMany: mockInsertMany,
    },
}));

jest.unstable_mockModule('../src/services/queueService.js', () => ({
    addTransferJob: mockAddTransferJob,
}));

jest.unstable_mockModule('../src/services/spotifyService.js', () => ({
    getSpotifyPlaylistTracksPreview: mockGetSpotifyPlaylistTracksPreview,
    normalizeSpotifyPlaylistId: (input) => {
        const trimmed = String(input).trim();
        const match = trimmed.match(/playlist\/([a-zA-Z0-9]+)/);
        return match ? match[1] : trimmed.split('?')[0];
    },
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
        expect(mockAddTransferJob).toHaveBeenCalledWith('transfer-1', 'user-1', 'playlist123');
    });

    it('não cria transferência nem tarefa quando o Spotify bloqueia as faixas', async () => {
        mockGetSpotifyPlaylistTracksPreview.mockRejectedValueOnce(
            new Error('O Spotify não permitiu ler as faixas de "Lofi Girl". A API oficial só libera faixas de playlists criadas por você ou colaborativas.')
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
            message: 'Configure YTMUSIC_COOKIE no backend/.env para criar playlists no YouTube Music.',
        });

        expect(mockGetSpotifyPlaylistTracksPreview).not.toHaveBeenCalled();
        expect(mockInsertMany).not.toHaveBeenCalled();
        expect(mockAddTransferJob).not.toHaveBeenCalled();
    });
});
