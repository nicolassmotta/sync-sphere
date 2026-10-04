import { jest } from '@jest/globals';
import request from 'supertest';
import crypto from 'node:crypto';

jest.unstable_mockModule('../src/utils/logger.js', () => ({ default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
const { default: app } = await import('../src/app.js');
const { default: Transfer } = await import('../src/models/Transfer.js');
const { buildTransferTracks, saveTransferTracks } = await import('../src/services/transfer/TransferTrackStore.js');
const { getProvider, listProviders } = await import('../src/providers/registry.js');
const { globalLimiter, transferLimiter, transferActionLimiter } = await import('../src/middlewares/rateLimiter.js');
const { resetQueueForTests } = await import('../src/services/queueService.js');
const { writeStore } = await import('../src/storage/jsonStore.js');
const { createExport, appendExportTracks } = await import('../src/providers/file/fileLibrary.js');
let record;
let exportId;
let originalFetch;
jest.setTimeout(30000);

beforeAll(() => { originalFetch = global.fetch; global.fetch = jest.fn(() => { throw new Error('Rede externa bloqueada nesta auditoria HTTP.'); }); });
afterAll(() => { global.fetch = originalFetch; });
beforeEach(async () => {
    resetQueueForTests();
    writeStore('queue.json', []);
    writeStore('provider-credentials.json', {});
    for (const limiter of [globalLimiter, transferLimiter, transferActionLimiter]) limiter.resetKey('::ffff:127.0.0.1');
    exportId = createExport({ title: 'Lista fictícia', description: 'Demonstração' }).id;
    appendExportTracks(exportId, [{ name: 'Arquivo', artist: 'Artista fictício' }]);
    [record] = await Transfer.insertMany([{ user: 'local', sourceProvider: 'file', targetProvider: 'file', direction: 'file_to_file', sourcePlaylistId: 'import-ficticio-123', playlistName: 'Arquivo', status: 'completed', totalTracks: 1, processedTracks: 1, targetPlaylistId: exportId }]);
    const tracks = buildTransferTracks([{ name: 'Arquivo', artist: 'Artista fictício' }]);
    Object.assign(tracks[0], { status: 'matched', targetId: 'id-ficticio', inserted: true });
    saveTransferTracks(record._id, tracks);
});
afterEach(() => { resetQueueForTests(); jest.restoreAllMocks(); });

it.each(['/api/health', '/api/ready', '/api/v1/auth/me'])('GET %s funciona sem conta própria', async (url) => {
    const response = await request(app).get(url);
    expect(response.status).toBe(200);
    expect(response.body).not.toHaveProperty('stack');
});
it('POST /auth/logout mantém o contrato local sem credenciais', async () => {
    const response = await request(app).post('/api/v1/auth/logout');
    expect(response.status).toBe(200);
});
it('GET /integrations/status descreve os sete provedores sem revelar credenciais', async () => {
    const response = await request(app).get('/api/v1/integrations/status');
    expect(response.status).toBe(200);
    expect(response.body.data.providers.map((p) => p.id)).toEqual(['spotify', 'youtubeMusic', 'deezer', 'tidal', 'appleMusic', 'soundcloud', 'file']);
    expect(JSON.stringify(response.body)).not.toMatch(/"(?:arl|oauthToken|musicUserToken|cookie|refreshToken)":/);
});
it.each(['spotify', 'tidal'])('GET /integrations/%s/login e callback negado preservam retorno local', async (id) => {
    process.env.SPOTIFY_CLIENT_ID = 'a'.repeat(32);
    process.env.TIDAL_CLIENT_ID = 'cliente-ficticio';
    const login = await request(app).get(`/api/v1/integrations/${id}/login`).set('Origin', 'http://localhost:5173');
    expect(login.status).toBe(200);
    const state = new URL(login.body.data.url).searchParams.get('state');
    expect(state).toBeTruthy();
    const callback = await request(app).get(`/api/v1/integrations/${id}/callback`).query({ state, error: 'access_denied' });
    expect(callback.status).toBe(302);
    expect(callback.headers.location).toContain('http://localhost:5173/dashboard');
    expect(callback.headers.location).toContain('status=denied');
});
it.each(['spotify', 'tidal'])('callback %s recusa state inválido', async (id) => {
    const response = await request(app).get(`/api/v1/integrations/${id}/callback`).query({ state: 'invalido', code: 'ficticio' });
    expect(response.status).toBe(400);
});
it('callback conectado encaminha retorno e recupera somente a plataforma reconectada', async () => {
    const [waiting, other] = await Transfer.insertMany([
        { user: 'local', sourceProvider: 'spotify', targetProvider: 'file', sourcePlaylistId: 'playlist-spotify-ficticia', status: 'needs_auth' },
        { user: 'local', sourceProvider: 'tidal', targetProvider: 'file', sourcePlaylistId: 'playlist-tidal-ficticia', status: 'needs_auth' },
    ]);
    jest.spyOn(getProvider('spotify').oauth, 'handleCallback').mockResolvedValue({ connected: true, userId: 'local', redirectUrl: 'http://localhost:8000/dashboard?provider=spotify&status=connected' });
    const response = await request(app).get('/api/v1/integrations/spotify/callback?code=ficticio');
    expect(response.status).toBe(302);
    expect((await request(app).get(`/api/v1/transfer/${waiting._id}`)).body.data.transfer.status).toBe('pending');
    expect((await request(app).get(`/api/v1/transfer/${other._id}`)).body.data.transfer.status).toBe('needs_auth');
});
it.each(['youtubeMusic', 'deezer', 'appleMusic', 'soundcloud', 'file'])('login e callback OAuth de %s orientam método compatível', async (id) => {
    for (const route of ['login', 'callback']) expect((await request(app).get(`/api/v1/integrations/${id}/${route}`)).status).toBe(400);
});
it('developer-token exige MusicKit configurado e recusa outros provedores', async () => {
    expect((await request(app).get('/api/v1/integrations/spotify/developer-token')).status).toBe(400);
    expect((await request(app).get('/api/v1/integrations/appleMusic/developer-token')).status).toBe(400);
    jest.spyOn(getProvider('appleMusic'), 'getMusicKitDeveloperToken').mockReturnValue('developer-token-ficticio');
    const ready = await request(app).get('/api/v1/integrations/appleMusic/developer-token');
    expect(ready.status).toBe(200);
    expect(ready.body.data.token).toBe('developer-token-ficticio');
});
it.each(['youtubeMusic', 'deezer', 'appleMusic', 'soundcloud'])('credencial de %s valida payload, informa status e permite desconectar', async (id) => {
    expect((await request(app).put(`/api/v1/integrations/${id}/credentials`).send({ values: {} })).status).toBe(400);
    jest.spyOn(getProvider(id), 'saveCredentials').mockResolvedValue(undefined);
    jest.spyOn(getProvider(id), 'getStatus').mockResolvedValue({ connected: true, authMethod: 'simulado' });
    const saved = await request(app).put(`/api/v1/integrations/${id}/credentials`).send({ values: { cookie: 'ficticia' } });
    expect(saved.status).toBe(200);
    expect(saved.body.data[id].connected).toBe(true);
    expect(JSON.stringify(saved.body)).not.toContain('ficticia');
    const disconnected = await request(app).delete(`/api/v1/integrations/${id}`);
    expect(disconnected.status).toBe(200);
});
it.each(listProviders().map((provider) => [provider.id, provider.capabilities.listUserPlaylists]))('listagem e prévias de %s respeitam capacidades e erro de entrada', async (id, canList) => {
    const provider = getProvider(id);
    if (canList) jest.spyOn(provider, 'listPlaylists').mockResolvedValue({ playlists: [{ id: 'lista-ficticia', name: 'Arquivo', trackCount: 1 }], total: 1, limit: 25, hasMore: false });
    const list = await request(app).get(`/api/v1/integrations/${id}/playlists`);
    expect(list.status).toBe(canList ? 200 : 400);
    expect((await request(app).get(`/api/v1/integrations/${id}/playlist-tracks`)).status).toBe(400);
    jest.spyOn(provider, 'getPlaylistPreview').mockResolvedValue({ tracks: [{ name: 'Arquivo', artist: 'Artista fictício' }], totalTracks: 3, returnedTracks: 1, hasMore: true });
    for (const url of [`/api/v1/integrations/${id}/playlists/lista-ficticia/tracks`, `/api/v1/integrations/${id}/playlist-tracks?playlistId=lista-ficticia`]) {
        const preview = await request(app).get(url);
        expect(preview.status).toBe(200);
        expect(preview.body.data.tracks[0].name).toBe('Arquivo');
        expect(preview.body.data.hasMore).toBe(true);
    }
});
it('importação, remoção e quatro downloads funcionam com dados locais', async () => {
    expect((await request(app).post('/api/v1/integrations/file/imports?filename=vazio.txt').set('Content-Type', 'text/plain').send('')).status).toBe(400);
    const imported = await request(app).post('/api/v1/integrations/file/imports?filename=exemplo.csv').set('Content-Type', 'text/plain').send('name,artist\nArquivo,Artista fictício');
    expect(imported.status).toBe(201);
    const id = imported.body.data.playlist.id;
    expect((await request(app).delete(`/api/v1/integrations/file/imports/${id}`)).status).toBe(200);
    expect((await request(app).delete(`/api/v1/integrations/file/imports/${id}`)).status).toBe(404);
    for (const format of ['csv', 'json', 'm3u', 'txt']) {
        const file = await request(app).get(`/api/v1/integrations/file/exports/${exportId}/download?format=${format}`);
        expect(file.status).toBe(200);
        expect(file.headers['content-disposition']).toContain('attachment');
        expect(file.text || (Buffer.isBuffer(file.body) ? file.body.toString('utf8') : JSON.stringify(file.body))).toContain('Arquivo');
    }
    expect((await request(app).get('/api/v1/integrations/file/exports/ausente/download')).status).toBe(404);
});
it('diagnóstico, demo, configuração e backup usam o contrato local', async () => {
    const diagnostic = await request(app).get('/api/v1/system/diagnostic');
    expect(diagnostic.status).toBe(200);
    expect(diagnostic.headers['cache-control']).toBe('no-store');
    expect((await request(app).post('/api/v1/system/demo')).status).toBe(201);
    expect((await request(app).get('/api/v1/system/providers/spotify/setup')).status).toBe(200);
    expect((await request(app).put('/api/v1/system/providers/spotify/setup').send({ clientId: 'b'.repeat(32) })).status).toBe(200);
    expect((await request(app).put('/api/v1/system/providers/tidal/setup').send({ clientId: 'tidal-ficticio' })).status).toBe(200);
    expect((await request(app).get('/api/v1/system/providers/file/setup')).status).toBe(400);
    expect((await request(app).post('/api/v1/system/backups').send({ password: 'curta' })).status).toBe(400);
    const backup = await request(app).post('/api/v1/system/backups').send({ password: 'senha-ficticia-longa-2026' });
    expect(backup.status).toBe(200);
    expect(backup.headers['content-disposition']).toContain('.ssb');
});
it('histórico, transferência, faixas e relatório preservam filtros e metadados', async () => {
    expect((await request(app).get('/api/v1/transfer')).body.data.transfers.some((t) => t._id === record._id)).toBe(true);
    expect((await request(app).get(`/api/v1/transfer/${record._id}`)).body.data.transfer.playlistName).toBe('Arquivo');
    expect((await request(app).get(`/api/v1/transfer/${record._id}/tracks?status=matched`)).body.results).toBe(1);
    expect((await request(app).get(`/api/v1/transfer/${record._id}/tracks?status=not_found`)).body.results).toBe(0);
    expect((await request(app).get(`/api/v1/transfer/${record._id}/tracks?status=invalid`)).status).toBe(400);
    for (const format of ['json', 'csv']) expect((await request(app).get(`/api/v1/transfer/${record._id}/report?format=${format}`)).status).toBe(200);
    expect((await request(app).get('/api/v1/transfer/ausente')).status).toBe(404);
    const [foreign] = await Transfer.insertMany([{ user: 'outra-instalacao-ficticia' }]);
    expect((await request(app).get(`/api/v1/transfer/${foreign._id}`)).status).toBe(403);
});
it('estimativa valida números e retry/resume recusam transferência resolvida', async () => {
    expect((await request(app).get('/api/v1/transfer/estimate?targetProvider=file&count=3')).body.data.estimate.trackCount).toBe(3);
    for (const count of ['-1', 'abc', '1.5', '100001']) expect((await request(app).get(`/api/v1/transfer/estimate?count=${count}`)).status).toBe(400);
    expect((await request(app).post(`/api/v1/transfer/${record._id}/retry`)).status).toBe(400);
    expect((await request(app).post(`/api/v1/transfer/${record._id}/resume`)).status).toBe(400);
    expect((await request(app).post('/api/v1/transfer/retry-all')).status).toBe(202);
    expect((await request(app).post('/api/v1/transfer/start').send({})).status).toBe(400);
});
it('retry de falha anterior à leitura informa reinício, sem mensagem de zero faixas', async () => {
    const [failed] = await Transfer.insertMany([{ user: 'local', status: 'failed', sourceProvider: 'file', targetProvider: 'file', totalTracks: 0 }]);
    const response = await request(app).post(`/api/v1/transfer/${failed._id}/retry`);
    expect(response.status).toBe(202);
    expect(response.body.message).toBe('Transferência reenfileirada do início.');
    expect((await request(app).post(`/api/v1/transfer/${failed._id}/retry`)).status).toBe(409);
});
it('retomada e revisão manual validam o estado, a proposta e jobs existentes', async () => {
    record.status = 'paused'; await record.save();
    expect((await request(app).post(`/api/v1/transfer/${record._id}/resume`)).status).toBe(202);
    resetQueueForTests(); writeStore('queue.json', []);
    record.status = 'completed'; record.targetProvider = 'spotify'; record.direction = 'file_to_spotify'; await record.save();
    jest.spyOn(getProvider('spotify'), 'ensureWritable').mockResolvedValue(undefined);
    jest.spyOn(getProvider('spotify'), 'createSearchClient').mockReturnValue({ searchBestMatch: async () => ({ uri: 'spotify:track:ficticio', name: 'Nova faixa', artist: 'Artista fictício', matchScore: 100 }) });
    const track = buildTransferTracks([{ name: 'Arquivo', artist: 'Artista fictício' }]); track[0].status = 'not_found'; saveTransferTracks(record._id, track);
    expect((await request(app).post(`/api/v1/transfer/${record._id}/tracks/0/search`).send({ name: '', artist: '' })).status).toBe(400);
    expect((await request(app).post(`/api/v1/transfer/${record._id}/tracks/0/confirm`).send({ candidateId: crypto.randomUUID() })).status).toBe(409);
    const searched = await request(app).post(`/api/v1/transfer/${record._id}/tracks/0/search`).send({ name: 'Nova faixa', artist: 'Artista fictício' });
    expect(searched.status).toBe(200);
    const confirmed = await request(app).post(`/api/v1/transfer/${record._id}/tracks/0/confirm`).send({ candidateId: searched.body.data.candidate.id });
    expect(confirmed.status).toBe(202);
    expect((await request(app).post(`/api/v1/transfer/${record._id}/tracks/0/search`).send({ name: 'Nova faixa', artist: 'Artista fictício' })).status).toBe(409);
});
