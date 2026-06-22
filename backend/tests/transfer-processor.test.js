import { jest } from '@jest/globals';

const mockGetSpotifyPlaylistSnapshot = jest.fn();
const mockCreateSpotifySearchClient = jest.fn();
const mockCreateSpotifyDestinationClient = jest.fn();
const mockCreateYoutubeMusicSearchClient = jest.fn();
const mockCreateYoutubeMusicCookieDestinationClient = jest.fn();
const mockGetYoutubeMusicPlaylistSnapshot = jest.fn();

class MockSpotifyPlaylistAccessError extends Error {
    constructor(message) {
        super(message);
        this.isPermanentTransferError = true;
    }
}

jest.unstable_mockModule('../src/services/spotifyService.js', () => ({
    getSpotifyPlaylistSnapshot: mockGetSpotifyPlaylistSnapshot,
    SpotifyPlaylistAccessError: MockSpotifyPlaylistAccessError,
    createSpotifySearchClient: mockCreateSpotifySearchClient,
    createSpotifyDestinationClient: mockCreateSpotifyDestinationClient,
}));

jest.unstable_mockModule('../src/services/youtubeMusicService.js', () => ({
    createYoutubeMusicSearchClient: mockCreateYoutubeMusicSearchClient,
    createYoutubeMusicCookieDestinationClient: mockCreateYoutubeMusicCookieDestinationClient,
    getYoutubeMusicPlaylistSnapshot: mockGetYoutubeMusicPlaylistSnapshot,
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

const buildYoutubeToSpotifyProcessor = ({
    transferRecord = {
        ...buildTransferRecord(),
        direction: 'youtube_to_spotify',
    },
    destinationOverrides = {},
} = {}) => {
    const repository = buildRepository(transferRecord);
    const publisher = { emit: jest.fn() };
    const trackMatcher = {
        matchPlaylistTracks: jest.fn().mockResolvedValue(['spotify:track:1']),
    };
    const searchClient = {
        searchBestMatch: jest.fn().mockResolvedValue({
            uri: 'spotify:track:1',
            matchScore: 90,
        }),
    };
    const destinationClient = {
        createPlaylist: jest.fn().mockResolvedValue('spotify-playlist-1'),
        setPlaylistImage: null,
        addTracksToPlaylist: jest.fn().mockResolvedValue(undefined),
        getPlaylistUrl: (playlistId) => `https://open.spotify.com/playlist/${playlistId}`,
        ...destinationOverrides,
    };

    mockCreateSpotifySearchClient.mockReturnValue(searchClient);
    mockCreateSpotifyDestinationClient.mockReturnValue(destinationClient);

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
            searchClient,
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

describe('migração do YouTube Music para o Spotify', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetYoutubeMusicPlaylistSnapshot.mockResolvedValue({
            id: 'youtube-playlist-1',
            name: 'Playlist do YouTube Music',
            description: 'Descrição original do YouTube Music',
            imageUrl: 'https://i.ytimg.com/cover.jpg',
            totalTracks: 1,
            tracks: [
                {
                    youtubeVideoId: 'video-1',
                    name: 'Música',
                    artist: 'Artista',
                },
            ],
        });
    });

    it('cria playlist privada no Spotify e salva metadados', async () => {
        const {
            processor,
            transferRecord,
            trackMatcher,
            searchClient,
            destinationClient,
        } = buildYoutubeToSpotifyProcessor();

        await processor.process({
            id: 'job-1',
            data: {
                transferId: 'transfer-1',
                userId: 'user-1',
                sourcePlaylistId: 'youtube-playlist-1',
                direction: 'youtube_to_spotify',
            },
        });

        expect(trackMatcher.matchPlaylistTracks).toHaveBeenCalledWith(expect.objectContaining({
            searchClient,
            providerLabel: 'Spotify',
            stage: 'spotify-matching',
        }));
        expect(destinationClient.createPlaylist).toHaveBeenCalledWith({
            title: 'Playlist do YouTube Music',
            description: 'Descrição original do YouTube Music',
        });
        expect(destinationClient.addTracksToPlaylist).toHaveBeenCalledWith({
            playlistId: 'spotify-playlist-1',
            trackUris: ['spotify:track:1'],
        });
        expect(transferRecord.targetPlaylistUrl).toBe('https://open.spotify.com/playlist/spotify-playlist-1');
        expect(transferRecord.targetPlaylistDescription).toBe('Descrição original do YouTube Music');
        expect(transferRecord.targetPlaylistImageUrl).toBe('https://i.ytimg.com/cover.jpg');
        expect(transferRecord.status).toBe('completed');
    });

    it('reutiliza playlist de destino já criada no Spotify', async () => {
        const { processor, transferRecord, destinationClient } = buildYoutubeToSpotifyProcessor({
            transferRecord: {
                ...buildTransferRecord(),
                direction: 'youtube_to_spotify',
                targetPlaylistId: 'spotify-playlist-existing',
                targetPlaylistUrl: 'https://open.spotify.com/playlist/spotify-playlist-existing',
            },
        });

        await processor.process({
            id: 'job-1',
            data: {
                transferId: 'transfer-1',
                userId: 'user-1',
                sourcePlaylistId: 'youtube-playlist-1',
                direction: 'youtube_to_spotify',
            },
        });

        expect(destinationClient.createPlaylist).not.toHaveBeenCalled();
        expect(destinationClient.addTracksToPlaylist).toHaveBeenCalledWith({
            playlistId: 'spotify-playlist-existing',
            trackUris: ['spotify:track:1'],
        });
        expect(transferRecord.status).toBe('completed');
    });

    it('marca falha permanente quando nenhuma faixa é encontrada no Spotify', async () => {
        const { processor, trackMatcher } = buildYoutubeToSpotifyProcessor();
        trackMatcher.matchPlaylistTracks.mockResolvedValue([]);

        await expect(processor.process({
            id: 'job-1',
            data: {
                transferId: 'transfer-1',
                userId: 'user-1',
                sourcePlaylistId: 'youtube-playlist-1',
                direction: 'youtube_to_spotify',
            },
        })).rejects.toThrow('Nenhuma faixa da playlist foi encontrada no Spotify.');
    });
});
