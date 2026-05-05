import { jest } from '@jest/globals';

const mockGetSpotifyPlaylistSnapshot = jest.fn();
const mockCreateYoutubeMusicSearchClient = jest.fn();
const mockCreateYoutubeMusicCookieDestinationClient = jest.fn();

class MockSpotifyPlaylistAccessError extends Error {
    constructor(message) {
        super(message);
        this.isPermanentTransferError = true;
    }
}

jest.unstable_mockModule('../src/services/spotifyService.js', () => ({
    getSpotifyPlaylistSnapshot: mockGetSpotifyPlaylistSnapshot,
    SpotifyPlaylistAccessError: MockSpotifyPlaylistAccessError,
}));

jest.unstable_mockModule('../src/services/youtubeMusicService.js', () => ({
    createYoutubeMusicSearchClient: mockCreateYoutubeMusicSearchClient,
    createYoutubeMusicCookieDestinationClient: mockCreateYoutubeMusicCookieDestinationClient,
}));

const { default: TransferProcessor } = await import('../src/services/transfer/TransferProcessor.js');

const buildTransferRecord = () => ({
    _id: 'transfer-1',
    errors: [],
});

const buildRepository = (transferRecord) => ({
    getTransferForProcessing: jest.fn().mockResolvedValue(transferRecord),
    getUserWithTransferSecrets: jest.fn().mockResolvedValue({ _id: 'user-1' }),
    update: jest.fn(async (record, fields) => {
        Object.assign(record, fields);
        return record;
    }),
    save: jest.fn(async (record) => record),
    markFailed: jest.fn(async (record, message) => {
        record.status = 'failed';
        record.lastMessage = message;
        return record;
    }),
});

const buildProcessor = ({
    transferRecord = buildTransferRecord(),
    searchClientOverrides = {},
    destinationOverrides = {},
} = {}) => {
    const repository = buildRepository(transferRecord);
    const publisher = { emit: jest.fn() };
    const trackMatcher = {
        matchPlaylistTracks: jest.fn().mockResolvedValue(['youtube-video-1']),
    };
    const searchClient = {
        searchBestVideoMatch: jest.fn().mockResolvedValue({
            videoId: 'youtube-video-1',
            matchScore: 90,
        }),
        ...searchClientOverrides,
    };
    const destinationClient = {
        createPlaylist: jest.fn().mockResolvedValue('ytmusic-playlist-1'),
        setPlaylistImage: null,
        addVideosToPlaylist: jest.fn().mockResolvedValue(undefined),
        getPlaylistUrl: (playlistId) => `https://music.youtube.com/playlist?list=${playlistId}`,
        ...destinationOverrides,
    };

    mockCreateYoutubeMusicSearchClient.mockReturnValue(searchClient);
    mockCreateYoutubeMusicCookieDestinationClient.mockReturnValue(destinationClient);

    return {
        processor: new TransferProcessor({ repository, publisher, trackMatcher }),
        repository,
        publisher,
        trackMatcher,
        transferRecord,
        searchClient,
        destinationClient,
    };
};

describe('metadados de playlist no TransferProcessor', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetSpotifyPlaylistSnapshot.mockResolvedValue({
            id: 'spotify-playlist-1',
            name: 'Playlist Original',
            description: 'Descrição original do Spotify',
            imageUrl: 'https://i.scdn.co/image/cover.jpg',
            totalTracks: 1,
            tracks: [
                {
                    spotifyId: 'track-1',
                    name: 'Música',
                    artist: 'Artista',
                },
            ],
        });
    });

    it('cria playlist no YouTube Music via cookie e salva metadados', async () => {
        const { processor, transferRecord, trackMatcher, searchClient, destinationClient } = buildProcessor();

        await processor.process({
            id: 'job-1',
            data: {
                transferId: 'transfer-1',
                userId: 'user-1',
                sourcePlaylistId: 'spotify-playlist-1',
            },
        });

        expect(trackMatcher.matchPlaylistTracks).toHaveBeenCalledWith(expect.objectContaining({
            youtubeClient: searchClient,
        }));
        expect(destinationClient.createPlaylist).toHaveBeenCalledWith({
            title: 'Playlist Original',
            description: 'Descrição original do Spotify',
        });
        expect(destinationClient.addVideosToPlaylist).toHaveBeenCalledWith({
            playlistId: 'ytmusic-playlist-1',
            videoIds: ['youtube-video-1'],
        });
        expect(transferRecord.targetPlaylistUrl).toBe('https://music.youtube.com/playlist?list=ytmusic-playlist-1');
        expect(transferRecord.targetPlaylistDescription).toBe('Descrição original do Spotify');
        expect(transferRecord.targetPlaylistImageUrl).toBe('https://i.scdn.co/image/cover.jpg');
        expect(transferRecord.targetPlaylistImageSynced).toBe(false);
        expect(transferRecord.status).toBe('completed');
    });

    it('reutiliza playlist de destino já criada quando a tarefa é retomada', async () => {
        const { processor, transferRecord, destinationClient } = buildProcessor({
            transferRecord: {
                _id: 'transfer-1',
                errors: [],
                targetPlaylistId: 'ytmusic-playlist-existing',
                targetPlaylistUrl: 'https://music.youtube.com/playlist?list=ytmusic-playlist-existing',
            },
        });

        await processor.process({
            id: 'job-1',
            data: {
                transferId: 'transfer-1',
                userId: 'user-1',
                sourcePlaylistId: 'spotify-playlist-1',
            },
        });

        expect(destinationClient.createPlaylist).not.toHaveBeenCalled();
        expect(destinationClient.addVideosToPlaylist).toHaveBeenCalledWith({
            playlistId: 'ytmusic-playlist-existing',
            videoIds: ['youtube-video-1'],
        });
        expect(transferRecord.status).toBe('completed');
    });

    it('marca falha permanente quando nenhuma faixa é encontrada', async () => {
        const { processor, trackMatcher } = buildProcessor();
        trackMatcher.matchPlaylistTracks.mockResolvedValue([]);

        await expect(processor.process({
            id: 'job-1',
            data: {
                transferId: 'transfer-1',
                userId: 'user-1',
                sourcePlaylistId: 'spotify-playlist-1',
            },
        })).rejects.toThrow('Nenhuma faixa da playlist foi encontrada no YouTube Music.');
    });
});
