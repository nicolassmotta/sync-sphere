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
        this.name = 'SpotifyPlaylistAccessError';
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
const { default: TrackMatcher } = await import('../src/services/transfer/TrackMatcher.js');
const { TRACK_STATUS } = await import('../src/services/transfer/TransferTrackStore.js');

const NOW = new Date('2026-09-29T12:00:00Z').getTime();

const buildTransferRecord = (overrides = {}) => ({
    _id: 'transfer-1',
    sourcePlaylistId: 'source-playlist-1',
    errors: [],
    ...overrides,
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

const buildTrackStore = (initial = null) => {
    const store = { tracks: initial };
    return {
        store,
        load: jest.fn(() => store.tracks),
        save: jest.fn((transferId, tracks) => {
            store.tracks = tracks;
        }),
    };
};

const buildMetrics = () => ({
    chunkSize: 100,
    recordSearch: jest.fn(),
    recordInsertChunk: jest.fn(),
    estimateRemainingSeconds: jest.fn(() => 42),
    tracksPerMinute: jest.fn(() => 30),
    persist: jest.fn(),
});

const buildProcessor = ({
    transferRecord = buildTransferRecord(),
    searchBestMatch = jest.fn().mockResolvedValue({ videoId: 'youtube-video-1', uri: 'spotify:track:1', matchScore: 90 }),
    destinationOverrides = {},
    trackStore = buildTrackStore(),
} = {}) => {
    const repository = buildRepository(transferRecord);
    const publisher = { emit: jest.fn() };
    const searchClient = { searchBestMatch };
    const destinationClient = {
        createPlaylist: jest.fn().mockResolvedValue('target-playlist-1'),
        setPlaylistImage: null,
        addVideosToPlaylist: jest.fn().mockResolvedValue(undefined),
        addTracksToPlaylist: jest.fn().mockResolvedValue(undefined),
        getPlaylistUrl: (playlistId) => `https://target.example/playlist/${playlistId}`,
        ...destinationOverrides,
    };

    mockCreateYoutubeMusicSearchClient.mockReturnValue(searchClient);
    mockCreateYoutubeMusicCookieDestinationClient.mockReturnValue(destinationClient);
    mockCreateSpotifySearchClient.mockReturnValue(searchClient);
    mockCreateSpotifyDestinationClient.mockReturnValue(destinationClient);

    const processor = new TransferProcessor({
        repository,
        publisher,
        trackMatcher: new TrackMatcher({ delayMs: 0, inlineRetryBaseMs: 0, searchConcurrency: 1, now: () => NOW }),
        trackStore,
        createMetrics: buildMetrics,
        now: () => NOW,
    });

    return { processor, repository, publisher, transferRecord, searchClient, destinationClient, trackStore };
};

const spotifyJob = {
    id: 'job-1',
    data: { transferId: 'transfer-1', userId: 'user-1', sourcePlaylistId: 'source-playlist-1' },
};

const youtubeJob = {
    id: 'job-1',
    data: {
        transferId: 'transfer-1',
        userId: 'user-1',
        sourcePlaylistId: 'source-playlist-1',
        direction: 'youtube_to_spotify',
    },
};

describe('TransferProcessor: Spotify para YouTube Music', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetSpotifyPlaylistSnapshot.mockResolvedValue({
            id: 'source-playlist-1',
            name: 'Playlist Original',
            description: 'Descrição original do Spotify',
            imageUrl: 'https://i.scdn.co/image/cover.jpg',
            totalTracks: 2,
            tracks: [
                { spotifyId: 'track-1', name: 'Música 1', artist: 'Artista' },
                { spotifyId: 'track-2', name: 'Música 2', artist: 'Artista' },
            ],
        });
    });

    it('cria playlist no YouTube Music, insere faixas e salva metadados', async () => {
        const searchBestMatch = jest.fn()
            .mockResolvedValueOnce({ videoId: 'video-1', matchScore: 90 })
            .mockResolvedValueOnce({ videoId: 'video-2', matchScore: 90 });
        const { processor, transferRecord, destinationClient, trackStore } = buildProcessor({ searchBestMatch });

        const result = await processor.process(spotifyJob);

        expect(result).toEqual({ status: 'completed' });
        expect(destinationClient.createPlaylist).toHaveBeenCalledWith({
            title: 'Playlist Original',
            description: 'Descrição original do Spotify',
        });
        expect(destinationClient.addVideosToPlaylist).toHaveBeenCalledWith({
            playlistId: 'target-playlist-1',
            videoIds: ['video-1', 'video-2'],
        });
        expect(transferRecord).toMatchObject({
            status: 'completed',
            targetPlaylistUrl: 'https://target.example/playlist/target-playlist-1',
            targetPlaylistDescription: 'Descrição original do Spotify',
            targetPlaylistImageUrl: 'https://i.scdn.co/image/cover.jpg',
            matchedCount: 2,
            analyzedCount: 2,
            totalTracks: 2,
        });
        expect(trackStore.store.tracks.every((track) => track.inserted)).toBe(true);
    });

    it('reutiliza playlist de destino já criada quando a tarefa é retomada', async () => {
        const { processor, transferRecord, destinationClient } = buildProcessor({
            transferRecord: buildTransferRecord({
                targetPlaylistId: 'target-existing',
                targetPlaylistUrl: 'https://target.example/playlist/target-existing',
            }),
        });

        await processor.process(spotifyJob);

        expect(destinationClient.createPlaylist).not.toHaveBeenCalled();
        expect(destinationClient.addVideosToPlaylist).toHaveBeenCalledWith({
            playlistId: 'target-existing',
            videoIds: ['youtube-video-1'],
        });
        expect(transferRecord.status).toBe('completed');
    });

    it('marca falha permanente quando nenhuma faixa é encontrada', async () => {
        const { processor, transferRecord } = buildProcessor({
            searchBestMatch: jest.fn().mockResolvedValue(null),
        });

        await expect(processor.process(spotifyJob)).rejects.toMatchObject({
            name: 'UnrecoverableError',
            message: 'Nenhuma faixa da playlist foi encontrada no YouTube Music.',
        });
        expect(transferRecord.status).toBe('failed');
    });

    it('pausa quando o YouTube bloqueia a busca e devolve horário de retomada', async () => {
        const blocked = new Error('Too Many Requests');
        blocked.response = { status: 429, headers: {} };
        const { processor, transferRecord, destinationClient, trackStore } = buildProcessor({
            searchBestMatch: jest.fn()
                .mockResolvedValueOnce({ videoId: 'video-1', matchScore: 90 })
                .mockRejectedValueOnce(blocked),
        });

        const result = await processor.process(spotifyJob);

        expect(result.status).toBe('paused');
        expect(result.rescheduleAt.getTime()).toBe(NOW + 60_000);
        expect(transferRecord).toMatchObject({
            status: 'paused',
            pauseReason: 'rate_limited',
            pauseCount: 1,
            matchedCount: 1,
            retryQueuedCount: 1,
        });
        expect(destinationClient.createPlaylist).not.toHaveBeenCalled();
        expect(trackStore.store.tracks.map((track) => track.status)).toEqual([
            TRACK_STATUS.MATCHED,
            TRACK_STATUS.RETRY_QUEUED,
        ]);
    });

    it('retoma depois da pausa sem refazer buscas nem reler a playlist', async () => {
        const trackStore = buildTrackStore([
            {
                index: 0, name: 'Música 1', artist: 'Artista', status: TRACK_STATUS.MATCHED,
                targetId: 'video-1', attempts: 0, inserted: false,
            },
            {
                index: 1, name: 'Música 2', artist: 'Artista', status: TRACK_STATUS.RETRY_QUEUED,
                targetId: null, attempts: 0, inserted: false,
            },
        ]);
        const searchBestMatch = jest.fn().mockResolvedValue({ videoId: 'video-2', matchScore: 90 });
        const { processor, transferRecord, destinationClient } = buildProcessor({
            trackStore,
            searchBestMatch,
            transferRecord: buildTransferRecord({
                status: 'paused',
                playlistName: 'Playlist Original',
                sourcePlaylistDescription: 'Descrição original do Spotify',
            }),
        });

        await processor.process(spotifyJob);

        expect(mockGetSpotifyPlaylistSnapshot).not.toHaveBeenCalled();
        expect(searchBestMatch).toHaveBeenCalledTimes(1);
        expect(destinationClient.addVideosToPlaylist).toHaveBeenCalledWith({
            playlistId: 'target-playlist-1',
            videoIds: ['video-1', 'video-2'],
        });
        expect(transferRecord.status).toBe('completed');
    });

    it('agenda nova rodada automática para faixas com falha temporária', async () => {
        const unavailable = new Error('Service Unavailable');
        unavailable.response = { status: 503 };
        const { processor, transferRecord, destinationClient } = buildProcessor({
            searchBestMatch: jest.fn()
                .mockResolvedValueOnce({ videoId: 'video-1', matchScore: 90 })
                .mockRejectedValue(unavailable),
        });

        const result = await processor.process(spotifyJob);

        expect(destinationClient.addVideosToPlaylist).toHaveBeenCalledWith({
            playlistId: 'target-playlist-1',
            videoIds: ['video-1'],
        });
        expect(result.status).toBe('paused');
        expect(result.rescheduleAt.getTime()).toBe(NOW + 30_000);
        expect(transferRecord).toMatchObject({
            status: 'paused',
            pauseReason: 'retry_scheduled',
            retryRound: 1,
            retryQueuedCount: 1,
        });
    });

    it('aguarda reconexão quando o cookie do YouTube Music é recusado na criação da playlist', async () => {
        const cookieError = new Error('O cookie pode estar incompleto ou expirado.');
        cookieError.isPermanentTransferError = true;
        const { processor, transferRecord } = buildProcessor({
            destinationOverrides: { createPlaylist: jest.fn().mockRejectedValue(cookieError) },
        });

        const result = await processor.process(spotifyJob);

        expect(result).toEqual({ status: 'needs_auth' });
        expect(transferRecord.status).toBe('needs_auth');
    });

    it('publica contadores e ETA no progresso', async () => {
        const { processor, publisher } = buildProcessor();

        await processor.process(spotifyJob);

        const matchingUpdate = publisher.emit.mock.calls
            .map(([, payload]) => payload)
            .find((payload) => payload.phase === 'matching' && payload.counts.analyzed === 1);
        expect(matchingUpdate).toMatchObject({
            etaSeconds: 42,
            tracksPerMinute: 30,
            counts: expect.objectContaining({ total: 2, matched: 1 }),
            recentTracks: [expect.objectContaining({ name: 'Música 1', status: TRACK_STATUS.MATCHED })],
        });
    });
});

describe('TransferProcessor: YouTube Music para Spotify', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetYoutubeMusicPlaylistSnapshot.mockResolvedValue({
            id: 'source-playlist-1',
            name: 'Playlist do YouTube Music',
            description: 'Descrição original do YouTube Music',
            imageUrl: 'https://i.ytimg.com/cover.jpg',
            totalTracks: 1,
            tracks: [{ youtubeVideoId: 'video-1', name: 'Música', artist: 'Artista' }],
        });
    });

    it('cria playlist privada no Spotify e salva metadados', async () => {
        const { processor, transferRecord, destinationClient } = buildProcessor({
            transferRecord: buildTransferRecord({ direction: 'youtube_to_spotify' }),
        });

        await processor.process(youtubeJob);

        expect(destinationClient.createPlaylist).toHaveBeenCalledWith({
            title: 'Playlist do YouTube Music',
            description: 'Descrição original do YouTube Music',
        });
        expect(destinationClient.addTracksToPlaylist).toHaveBeenCalledWith({
            playlistId: 'target-playlist-1',
            trackUris: ['spotify:track:1'],
        });
        expect(transferRecord).toMatchObject({
            status: 'completed',
            targetPlaylistImageUrl: 'https://i.ytimg.com/cover.jpg',
        });
    });

    it('marca falha permanente quando nenhuma faixa é encontrada no Spotify', async () => {
        const { processor } = buildProcessor({
            transferRecord: buildTransferRecord({ direction: 'youtube_to_spotify' }),
            searchBestMatch: jest.fn().mockResolvedValue(null),
        });

        await expect(processor.process(youtubeJob))
            .rejects.toThrow('Nenhuma faixa da playlist foi encontrada no Spotify.');
    });

    it('aguarda reconexão quando o Spotify perde a sessão durante a busca', async () => {
        const { processor, transferRecord } = buildProcessor({
            transferRecord: buildTransferRecord({ direction: 'youtube_to_spotify' }),
            searchBestMatch: jest.fn().mockRejectedValue(new Error('Conecte sua conta Spotify para continuar.')),
        });

        const result = await processor.process(youtubeJob);

        expect(result).toEqual({ status: 'needs_auth' });
        expect(transferRecord).toMatchObject({ status: 'needs_auth', retryQueuedCount: 1 });
    });
});
