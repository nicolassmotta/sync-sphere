import { decideCandidates } from '../src/services/matching/decision.js';
import { jest } from '@jest/globals';
import MatchCache from '../src/services/matching/MatchCache.js';
import { buildSpotifyServiceMock, buildYoutubeMusicServiceMock } from './helpers/serviceMocks.js';

const mockGetSpotifyPlaylistSnapshot = jest.fn();
const mockCreateSpotifySearchClient = jest.fn();
const mockCreateSpotifyDestinationClient = jest.fn();
const mockCreateYoutubeMusicSearchClient = jest.fn();
const mockCreateYoutubeMusicCookieDestinationClient = jest.fn();
const mockGetYoutubeMusicPlaylistSnapshot = jest.fn();

jest.unstable_mockModule('../src/services/spotifyService.js', () => buildSpotifyServiceMock({
    getSpotifyPlaylistSnapshot: mockGetSpotifyPlaylistSnapshot,
    createSpotifySearchClient: mockCreateSpotifySearchClient,
    createSpotifyDestinationClient: mockCreateSpotifyDestinationClient,
}));

jest.unstable_mockModule('../src/services/youtubeMusicService.js', () => buildYoutubeMusicServiceMock({
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
    createMatchCache = () => null,
} = {}) => {
    const repository = buildRepository(transferRecord);
    const publisher = { emit: jest.fn() };
    // A API simulada devolve metadados completos, como um catálogo real.
    const queuedSearch = searchBestMatch;
    const searchClient = { searchBestMatch: jest.fn(async (options) => {
        const result = await queuedSearch(options);
        return result ? { name: options.track.name, artist: options.track.artist, durationMs: options.track.durationMs, ...result } : null;
    }) };
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
        createMatchCache,
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
            expectedIds: ['video-1', 'video-2'],
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

    it('usa correspondências persistidas em uma nova transferência', async () => {
        const scope = `processor-${Date.now()}`;
        const createMatchCache = () => new MatchCache({ scope });
        const first = buildProcessor({ createMatchCache });
        await first.processor.process(spotifyJob);

        const second = buildProcessor({ createMatchCache });
        await second.processor.process(spotifyJob);

        expect(first.searchClient.searchBestMatch).toHaveBeenCalledTimes(2);
        expect(second.searchClient.searchBestMatch).not.toHaveBeenCalled();
        expect(second.destinationClient.addVideosToPlaylist).toHaveBeenCalled();
        expect(second.transferRecord.status).toBe('completed');
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
            videoIds: ['youtube-video-1', 'youtube-video-1'],
            expectedIds: ['youtube-video-1', 'youtube-video-1'],
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
                matching: decideCandidates({ name: 'Música 1', artist: 'Artista' }, [{ id: 'video-1', name: 'Música 1', artist: 'Artista' }]),
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
            expectedIds: ['video-1', 'video-2'],
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
            expectedIds: ['video-1'],
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
            expectedIds: ['spotify:track:1'],
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

describe('regressões de recuperação e leitura', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetSpotifyPlaylistSnapshot.mockResolvedValue({ id: 'origem', name: 'Playlist', totalTracks: 1, tracks: [{ name: 'A', artist: 'X' }] });
    });

    it('não publica falha terminal na tentativa transitória de inserção', async () => {
        const error = Object.assign(new Error('Serviço temporariamente indisponível'), { status: 503 });
        const { processor, publisher, destinationClient } = buildProcessor({ destinationOverrides: {
            addVideosToPlaylist: jest.fn().mockRejectedValueOnce(error).mockResolvedValue(undefined),
        } });
        await expect(processor.process(spotifyJob)).rejects.toBe(error);
        expect(publisher.emit.mock.calls.some(([, snapshot]) => snapshot.status === 'failed')).toBe(false);
        await processor.process(spotifyJob);
        expect(destinationClient.createPlaylist).toHaveBeenCalledTimes(1);
    });

    it('recusa snapshot cortado antes de buscar ou criar destino', async () => {
        mockGetSpotifyPlaylistSnapshot.mockResolvedValue({ id: 'origem', name: 'Playlist', totalTracks: 3, truncated: true, omittedTracks: 2, tracks: [{ name: 'A', artist: 'X' }] });
        const { processor, transferRecord, searchClient, destinationClient } = buildProcessor();
        await expect(processor.process(spotifyJob)).rejects.toMatchObject({ name: 'UnrecoverableError' });
        expect(transferRecord).toMatchObject({ sourceTotalTracks: 3, sourceOmittedTracks: 2, sourceTruncated: true, status: 'failed' });
        expect(searchClient.searchBestMatch).not.toHaveBeenCalled();
        expect(destinationClient.createPlaylist).not.toHaveBeenCalled();
    });
});

it('retoma escrita parcial preservando repetições, playlist, busca e ocorrências confirmadas', async () => {
    const { getMissingTrackIds } = await import('../src/services/transfer/reconcileTrackIds.js');
    const existing = ['A'];
    let attempt = 0;
    const insert = jest.fn(async ({ videoIds, expectedIds }) => {
        const pending = getMissingTrackIds({ ids: videoIds, existingIds: existing, expectedIds });
        if (attempt++ === 0) {
            existing.push(pending[0]);
            throw Object.assign(new Error('Falha parcial'), { status: 503 });
        }
        existing.push(...pending);
    });
    const trackStore = buildTrackStore([
        { index: 0, name: 'A', status: TRACK_STATUS.MATCHED, targetId: 'A', inserted: true, matchSource: 'manual', matchScore: 95 },
        { index: 1, name: 'B', status: TRACK_STATUS.MATCHED, targetId: 'B', inserted: false, matchSource: 'search', matchScore: 90, matching: { algorithmVersion: 'identity-v2', decision: 'accepted' } },
        { index: 2, name: 'A', status: TRACK_STATUS.MATCHED, targetId: 'A', inserted: false, matchSource: 'manual', matchScore: 95 },
    ]);
    const { processor, searchClient, destinationClient, transferRecord } = buildProcessor({ trackStore,
        transferRecord: buildTransferRecord({ status: 'failed', targetPlaylistId: 'existente', playlistName: 'Playlist' }),
        destinationOverrides: { addVideosToPlaylist: insert },
    });
    await expect(processor.process(spotifyJob)).rejects.toMatchObject({ status: 503 });
    expect(existing).toEqual(['A', 'B']);
    await processor.process(spotifyJob);
    expect(existing).toEqual(['A', 'B', 'A']);
    expect(searchClient.searchBestMatch).not.toHaveBeenCalled();
    expect(destinationClient.createPlaylist).not.toHaveBeenCalled();
    expect(insert).toHaveBeenLastCalledWith({ playlistId: 'existente', videoIds: ['B', 'A'], expectedIds: ['A', 'B', 'A'] });
    expect(transferRecord.status).toBe('completed');
    expect(trackStore.store.tracks.every((track) => track.inserted)).toBe(true);
});

it.each([
    { totalTracks: undefined },
    { totalTracks: 3, truncated: false, unavailableTracks: 2 },
])('snapshot sem corte por limite conclui mesmo com total desconhecido ou itens indisponíveis: %j', async (metadata) => {
    mockGetSpotifyPlaylistSnapshot.mockResolvedValue({ id: 'origem', name: 'Playlist', tracks: [{ name: 'A', artist: 'X' }], ...metadata });
    const { processor, transferRecord } = buildProcessor();
    await processor.process(spotifyJob);
    expect(transferRecord.status).toBe('completed');
    expect(transferRecord.sourceTruncated).toBe(false);
    expect(transferRecord.sourceTotalTracks).toBe(metadata.totalTracks ?? null);
});

describe('integração do trabalhador com fila persistida', () => {
    const flush = () => new Promise((resolve) => setImmediate(resolve));
    let queue;
    beforeEach(async () => {
        queue = await import('../src/services/queueService.js');
        queue.resetQueueForTests();
        process.env.YT_MUSIC_SEARCH_DELAY_MS = '0';
        const { resetMatchCacheForTests } = await import('../src/services/matching/MatchCache.js');
        resetMatchCacheForTests();
        const { default: Transfer } = await import('../src/models/Transfer.js');
        for (const record of await Transfer.find({})) { record.status = 'completed'; await record.save(); }
        const { removeStore } = await import('../src/storage/jsonStore.js');
        removeStore('match-cache.json');
        const { writeStore } = await import('../src/storage/jsonStore.js');
        writeStore('queue.json', []);
        jest.useFakeTimers({ doNotFake: ['setImmediate'] });
        mockGetSpotifyPlaylistSnapshot.mockResolvedValue({ id: 'origem', name: 'Playlist', totalTracks: 1, tracks: [{ name: 'A', artist: 'X' }] });
    });
    afterEach(() => { queue.resetQueueForTests(); jest.useRealTimers(); delete process.env.YT_MUSIC_SEARCH_DELAY_MS; });

    const runWorker = async (insert) => {
        const { default: Transfer } = await import('../src/models/Transfer.js');
        const { addTransferJob } = queue;
        const { startWorker } = await import('../src/workers/transferWorker.js');
        const { readStore } = await import('../src/storage/jsonStore.js');
        const [record] = await Transfer.insertMany([{ user: 'local', sourcePlaylistId: 'origem', status: 'completed' }]);
        const search = jest.fn(async ({ track }) => ({ name: track.name, artist: track.artist, durationMs: track.durationMs, videoId: 'video', matchScore: 95 }));
        const create = jest.fn().mockResolvedValue('existente');
        mockCreateYoutubeMusicSearchClient.mockReturnValue({ searchBestMatch: search });
        mockCreateYoutubeMusicCookieDestinationClient.mockReturnValue({ createPlaylist: create, addVideosToPlaylist: insert, getPlaylistUrl: () => 'https://example.test/playlist' });
        const snapshots = [];
        startWorker({ to: () => ({ emit: (event, snapshot) => snapshots.push(snapshot) }) });
        await flush();
        record.status = 'pending';
        await record.save();
        await addTransferJob(record._id, 'local', 'origem');
        await flush();
        return { record, snapshots, search, create, readStore };
    };

    it('503 publica pausa com o horário do job e depois sucesso sem repetir busca ou criação', async () => {
        const error = Object.assign(new Error('Falha temporária de inserção'), { status: 503 });
        const context = await runWorker(jest.fn().mockRejectedValueOnce(error).mockResolvedValue(undefined));
        expect(context.record.status).toBe('paused');
        expect(context.record.resumeAt).toBe(context.readStore('queue.json', [])[0].runAfter);
        expect(context.snapshots.some((snapshot) => snapshot.status === 'failed')).toBe(false);
        expect(context.snapshots.at(-1)).toMatchObject({ status: 'paused', pauseReason: 'retry_scheduled', resumeAt: context.record.resumeAt });
        await jest.advanceTimersByTimeAsync(5000);
        await flush();
        expect(context.record.status).toBe('completed');
        expect(context.snapshots.at(-1).status).toBe('completed');
        expect(context.search).toHaveBeenCalledTimes(1);
        expect(context.create).toHaveBeenCalledTimes(1);
        expect(context.readStore('queue.json', [])).toEqual([]);
    });

    it('esgotamento das três tentativas persiste e publica falha definitiva', async () => {
        const context = await runWorker(jest.fn().mockRejectedValue(Object.assign(new Error('Falha temporária'), { status: 503 })));
        await jest.advanceTimersByTimeAsync(5000);
        await flush();
        expect(context.record.status).toBe('paused');
        await jest.advanceTimersByTimeAsync(10000);
        await flush();
        expect(context.record).toMatchObject({ status: 'failed', resumeAt: null, phase: 'done' });
        expect(context.snapshots.at(-1).status).toBe('failed');
        expect(context.readStore('queue.json', [])).toEqual([]);
    });

    it('erro irrecuperável termina sem agendar nova tentativa', async () => {
        const context = await runWorker(jest.fn().mockRejectedValue(Object.assign(new Error('Operação recusada'), { status: 403 })));
        expect(context.record.status).toBe('failed');
        expect(context.readStore('queue.json', [])).toEqual([]);
        expect(context.snapshots.some((snapshot) => snapshot.status === 'paused')).toBe(false);
    });
});

it.each([{ code: 'ECONNRESET' }, { status: 503 }])('criação sem garantia %j conserva intenção e impede outra playlist automática', async (failure) => {
    mockGetSpotifyPlaylistSnapshot.mockResolvedValue({
        id: 'source-playlist-1', name: 'Lista fictícia',
        tracks: [{ name: 'Música fictícia', artist: 'Artista fictício' }],
    });
    const createPlaylist = jest.fn().mockRejectedValueOnce(Object.assign(new Error('Falha de rede após criação'), failure));
    const context = buildProcessor({ destinationOverrides: { createPlaylist } });
    await expect(context.processor.process(spotifyJob)).rejects.toThrow('Falha de rede após criação');
    expect(context.transferRecord.creationIntent.state).toBe('unknown');
    await expect(context.processor.process(spotifyJob)).rejects.toThrow('A criação da playlist ficou sem confirmação.');
    expect(createPlaylist).toHaveBeenCalledTimes(1);
});

it('checkpoint automático antigo sem evidências não autoriza uma inserção nova', async () => {
    const tracks = [{ index: 0, name: 'Música', artist: 'Artista', status: 'matched', targetId: 'antigo', inserted: false, matchScore: 90, matchSource: 'search' }];
    const context = buildProcessor({ trackStore: buildTrackStore(tracks) });
    await context.processor.process(spotifyJob);
    expect(context.trackStore.store.tracks[0]).toMatchObject({ status: 'needs_review', targetId: null, matching: { legacy: true, reasons: ['legacy_decision'] } });
    expect(context.destinationClient.createPlaylist).not.toHaveBeenCalled();
});
