import { jest } from '@jest/globals';
import request from 'supertest';

jest.unstable_mockModule('../src/utils/logger.js', () => ({ default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
const { default: app } = await import('../src/app.js');
const { listProviders } = await import('../src/providers/registry.js');
const { startWorker } = await import('../src/workers/transferWorker.js');
const { resetQueueForTests } = await import('../src/services/queueService.js');
const { writeStore } = await import('../src/storage/jsonStore.js');
const { saveImport } = await import('../src/providers/file/fileLibrary.js');
const { globalLimiter, transferLimiter, transferActionLimiter } = await import('../src/middlewares/rateLimiter.js');
const providers = listProviders();
const pairs = providers.flatMap((source) => providers
    .filter((target) => source.id !== target.id || source.id === 'file')
    .map((target) => [source.id, target.id]));
const tracks = [
    { name: 'Arquivo', artist: 'Não encontrada', durationMs: 180000 },
    { name: 'Faixa fictícia B', artist: 'Artista fictício', durationMs: 200000 },
    { name: 'Arquivo', artist: 'Não encontrada', durationMs: 180000 },
];
let input;
let updates;
let destinationIds;
let fetchOriginal;
let searchClients;
jest.setTimeout(30000);

beforeAll(() => {
    fetchOriginal = global.fetch;
    global.fetch = jest.fn(() => { throw new Error('A matriz HTTP não permite rede externa.'); });
});
afterAll(() => { global.fetch = fetchOriginal; });
beforeEach(() => {
    resetQueueForTests();
    writeStore('queue.json', []);
    globalLimiter.resetKey('::ffff:127.0.0.1');
    transferLimiter.resetKey('::ffff:127.0.0.1');
    transferActionLimiter.resetKey('::ffff:127.0.0.1');
    updates = [];
    destinationIds = [];
    searchClients = new Map();
    input = saveImport({ filename: 'auditoria.json', playlist: { name: 'Lista fictícia', format: 'json', tracks } });
    // Somente a fronteira dos provedores remotos é simulada. HTTP, fila, storage,
    // processador, matching, checkpoints e relatórios usam o código de produção.
    for (const provider of providers.filter((value) => value.id !== 'file')) {
        jest.spyOn(provider, 'ensureReadable').mockResolvedValue(undefined);
        jest.spyOn(provider, 'ensureWritable').mockResolvedValue(undefined);
        jest.spyOn(provider, 'getSearchDelayMs').mockReturnValue(0);
        jest.spyOn(provider, 'normalizePlaylistId').mockImplementation((value) => value);
        jest.spyOn(provider, 'getPlaylistPreview').mockResolvedValue({ id: input.id, name: input.name, tracks: tracks.slice(0, 1), totalTracks: 3, returnedTracks: 1, hasMore: true });
        jest.spyOn(provider, 'getPlaylistSnapshot').mockResolvedValue({ id: input.id, name: input.name, tracks, totalTracks: 3, truncated: false });
        const searchClient = { searchBestMatch: jest.fn(async ({ track }) => ({ uri: `spotify:track:id-${track.name}`, id: `id-${track.name}`, videoId: `id-${track.name}`, matchScore: 100 })) };
        searchClients.set(provider.id, searchClient);
        jest.spyOn(provider, 'createSearchClient').mockReturnValue(searchClient);
        jest.spyOn(provider, 'createDestinationClient').mockReturnValue({
            createPlaylist: async () => 'destino-ficticio',
            addTracks: async ({ expectedIds }) => { destinationIds = [...expectedIds]; },
            getPlaylistUrl: () => 'https://destino.example/playlist',
        });
    }
    startWorker({ to: () => ({ emit: (event, snapshot) => updates.push({ event, snapshot }) }) });
});
afterEach(() => { resetQueueForTests(); jest.restoreAllMocks(); });

it.each(pairs)('%s para %s conclui pelo HTTP preservando três ocorrências e metadados', async (sourceProvider, targetProvider) => {
    const queued = await request(app).post('/api/v1/transfer/start').send({ sourceProvider, targetProvider, sourcePlaylistId: input.id });
    expect(queued.status).toBe(202);
    const id = queued.body.data.transferId;
    let response;
    for (let attempt = 0; attempt < 100; attempt += 1) {
        response = await request(app).get(`/api/v1/transfer/${id}`);
        if (['completed', 'failed'].includes(response.body.data?.transfer?.status)) break;
        await new Promise((resolve) => setImmediate(resolve));
    }
    expect(response.status).toBe(200);
    expect(response.body.data.transfer).toMatchObject({ status: 'completed', totalTracks: 3, processedTracks: 3, playlistName: 'Lista fictícia' });
    const report = await request(app).get(`/api/v1/transfer/${id}/report`).set('Accept-Language', 'en');
    expect(report.status).toBe(200);
    expect(report.body.counts.inserted).toBe(3);
    expect(report.body.tracks.map(({ name, artist }) => ({ name, artist }))).toEqual(tracks.map(({ name, artist }) => ({ name, artist })));
    expect(report.body.tracks.map((track) => track.outcome)).toEqual(['added', 'added', 'added']);
    const checkpoints = await request(app).get(`/api/v1/transfer/${id}/tracks`);
    expect(checkpoints.body.data.tracks.every((track) => track.inserted)).toBe(true);
    expect(updates.some(({ snapshot }) => snapshot.transferId === id && snapshot.status === 'completed')).toBe(true);
    if (targetProvider !== 'file') {
        expect(destinationIds).toHaveLength(3);
        expect(destinationIds[0]).toBe(destinationIds[2]);
    } else {
        const exported = await request(app).get(response.body.data.transfer.targetPlaylistUrl.replace('format=csv', 'format=json'));
        expect(exported.status).toBe(200);
        expect(exported.body.tracks).toHaveLength(3);
        expect(exported.body.tracks[0].name).toBe(exported.body.tracks[2].name);
    }
});

describe.each(providers.map((provider) => [provider.id, provider]))('recuperação HTTP no destino %s', (id, provider) => {
    const runFailure = async (status, { always = false } = {}) => {
        jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
        const createPlaylist = jest.fn(async () => 'destino-recuperacao-ficticio');
        const addTracks = jest.fn(async () => {
            if (always || addTracks.mock.calls.length === 1) throw Object.assign(new Error('Falha fictícia do destino'), { status });
        });
        jest.spyOn(provider, 'createDestinationClient').mockReturnValue({ createPlaylist, addTracks, getPlaylistUrl: () => 'https://destino.example/playlist' });
        const response = await request(app).post('/api/v1/transfer/start').set('Connection', 'close').send({ sourceProvider: 'file', targetProvider: id, sourcePlaylistId: input.id });
        expect(response.status).toBe(202);
        await jest.advanceTimersByTimeAsync(0);
        return { transferId: response.body.data.transferId, createPlaylist, addTracks };
    };
    const state = async (id) => (await request(app).get(`/api/v1/transfer/${id}`).set('Connection', 'close')).body.data.transfer;
    afterEach(() => jest.useRealTimers());

    it('503 agenda pausa não terminal, reutiliza destino e conclui sem outra busca', async () => {
        const context = await runFailure(503);
        const waiting = await state(context.transferId);
        expect(waiting).toMatchObject({ status: 'paused', pauseReason: 'retry_scheduled', pendingInsertCount: 3 });
        expect(updates.filter(({ snapshot }) => snapshot.transferId === context.transferId).some(({ snapshot }) => snapshot.status === 'failed')).toBe(false);
        const { readStore } = await import('../src/storage/jsonStore.js');
        expect(waiting.resumeAt).toBe(readStore('queue.json', []).find((job) => job.data.transferId === context.transferId).runAfter);
        const searchClient = searchClients.get(id);
        const searches = searchClient?.searchBestMatch.mock.calls.length;
        await jest.advanceTimersByTimeAsync(5000);
        expect((await state(context.transferId)).status).toBe('completed');
        expect(context.createPlaylist).toHaveBeenCalledTimes(1);
        expect(context.addTracks).toHaveBeenCalledTimes(2);
        if (searches !== undefined) expect(searchClient.searchBestMatch).toHaveBeenCalledTimes(searches);
    });
    it('503 persistente termina apenas após esgotar as três tentativas', async () => {
        const context = await runFailure(503, { always: true });
        await jest.advanceTimersByTimeAsync(5000);
        expect((await state(context.transferId)).status).toBe('paused');
        await jest.advanceTimersByTimeAsync(10000);
        expect(await state(context.transferId)).toMatchObject({ status: 'failed', resumeAt: null });
        expect(context.addTracks).toHaveBeenCalledTimes(3);
        expect(context.createPlaylist).toHaveBeenCalledTimes(1);
    });
    it('400 termina sem retentativa automática e aceita retry explícito de inserção', async () => {
        const context = await runFailure(400);
        expect((await state(context.transferId)).status).toBe('failed');
        const retry = await request(app).post(`/api/v1/transfer/${context.transferId}/retry`);
        expect(retry.status).toBe(202);
        expect(retry.body.data.requeued).toBe(3);
        await jest.advanceTimersByTimeAsync(0);
        expect((await state(context.transferId)).status).toBe('completed');
        expect(context.createPlaylist).toHaveBeenCalledTimes(1);
    });
    it('429 conserva horário da fila e permite retomada do mesmo destino', async () => {
        const context = await runFailure(429);
        expect(await state(context.transferId)).toMatchObject({ status: 'paused', pauseReason: 'rate_limited' });
        expect((await request(app).post(`/api/v1/transfer/${context.transferId}/resume`)).status).toBe(202);
        await jest.advanceTimersByTimeAsync(0);
        expect((await state(context.transferId)).status).toBe('completed');
        expect(context.createPlaylist).toHaveBeenCalledTimes(1);
    });
    if (id !== 'file') it('401 aguarda reconexão e retoma pelo endpoint da integração', async () => {
        const context = await runFailure(401);
        expect((await state(context.transferId)).status).toBe('needs_auth');
        jest.spyOn(provider, 'getStatus').mockResolvedValue({ connected: true });
        let connected;
        if (provider.oauth) {
            jest.spyOn(provider.oauth, 'handleCallback').mockResolvedValue({ connected: true, userId: 'local', redirectUrl: 'http://localhost:8000/dashboard' });
            connected = await request(app).get(`/api/v1/integrations/${id}/callback?code=ficticio`);
            expect(connected.status).toBe(302);
        } else {
            jest.spyOn(provider, 'saveCredentials').mockResolvedValue(undefined);
            connected = await request(app).put(`/api/v1/integrations/${id}/credentials`).send({ values: { cookie: 'ficticia' } });
            expect(connected.status).toBe(200);
        }
        await jest.advanceTimersByTimeAsync(0);
        expect((await state(context.transferId)).status).toBe('completed');
        expect(context.createPlaylist).toHaveBeenCalledTimes(1);
    });
});
