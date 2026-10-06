import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import crypto from 'node:crypto';

const directory = fs.realpathSync(path.resolve(process.env.DATA_DIR || '.'));
process.env.DATA_DIR = directory;
if (!directory.startsWith(`${os.tmpdir()}${path.sep}`) || !path.basename(directory).startsWith('syncsphere-audit-')) {
    throw new Error('A simulação exige DATA_DIR temporário com prefixo syncsphere-audit-.');
}
for (const name of Object.keys(process.env)) {
    if (/^(SPOTIFY|YTMUSIC|DEEZER|TIDAL|APPLE|SOUNDCLOUD|JWT_SECRET)/.test(name)) delete process.env[name];
}
process.env.ENCRYPTION_KEY = 'a'.repeat(64);
process.env.DOTENV_CONFIG_PATH = path.join(directory, 'ausente.env');
if (fs.existsSync(process.env.DOTENV_CONFIG_PATH)) throw new Error('A simulação não aceita arquivo de ambiente existente.');
process.env.NODE_ENV = 'test';
global.fetch = async () => { throw new Error('A simulação não permite rede externa.'); };

const { listProviders } = await import('../../src/providers/registry.js');
const { default: AppError } = await import('../../src/utils/AppError.js');
const { readStore, writeStore } = await import('../../src/storage/jsonStore.js');
const { getMissingTrackIds } = await import('../../src/services/transfer/reconcileTrackIds.js');
const { globalLimiter, transferLimiter, transferActionLimiter } = await import('../../src/middlewares/rateLimiter.js');
const { startWorker } = await import('../../src/workers/transferWorker.js');
const { registerTransferSocket } = await import('../../src/socket/transferSocket.js');
const { Server } = await import('socket.io');
const { default: express } = await import('express');
const cases = ['normal', 'partial', 'transient', 'rate-limit', 'needs-auth', 'not-found', 'truncated', 'unknown-total', 'empty', 'invalid-score', 'robust-review'];
const remote = readStore('fixture-destinations.json', {});
const observations = { searches: {}, creations: {}, insertions: [] };
const authorized = {};
const scenario = (id) => cases.find((name) => String(id).includes(`fixture-${name}-`)) || 'normal';
const tracksFor = (name) => name === 'empty' ? [] : [
    { name: 'Faixa fictícia A', artist: 'Banda fictícia', durationMs: 180000 },
    { name: name === 'not-found' ? 'Não localizada' : 'Faixa fictícia B', artist: 'Banda fictícia', durationMs: 200000 },
    { name: 'Faixa fictícia A', artist: 'Banda fictícia', durationMs: 180000 },
].map((track) => name === 'invalid-score' ? { ...track, name: `Sem confiança: ${track.name}` }
    : name === 'robust-review' ? { ...track, name: `Revisão: ${track.name}` } : track);
for (const provider of listProviders().filter((value) => value.id !== 'file')) {
    authorized[provider.id] = true;
    const publicRead = ['deezer', 'appleMusic', 'soundcloud'].includes(provider.id);
    provider.getStatus = async () => ({ connected: authorized[provider.id], configured: true, credentialSource: authorized[provider.id] ? 'panel' : null, canRead: authorized[provider.id] || publicRead, canWrite: authorized[provider.id], authMethod: 'simulated' });
    provider.ensureReadable = async () => { if (!authorized[provider.id] && !publicRead) throw new AppError('Conecte a origem simulada antes de continuar.', 400); };
    provider.ensureWritable = async () => { if (!authorized[provider.id]) throw new AppError('Conecte o destino simulado antes de continuar.', 400); };
    provider.normalizePlaylistId = (value) => String(value).trim();
    provider.getSearchDelayMs = () => 0;
    provider.listPlaylists = async () => ({ playlists: cases.map((name) => ({ id: `fixture-${name}-0001`, name: `Simulação: ${name}`, trackCount: name === 'empty' ? 0 : 3 })), total: cases.length, hasMore: false });
    provider.getPlaylistSnapshot = async ({ playlistId }) => {
        const name = scenario(playlistId);
        return { id: playlistId, name: `Simulação: ${name}`, tracks: tracksFor(name).map((track, index) => ({ ...track, sourceId: `${playlistId}:${index}` })), totalTracks: name === 'unknown-total' ? null : name === 'truncated' ? 5 : tracksFor(name).length, truncated: name === 'truncated', omittedTracks: name === 'truncated' ? 2 : 0, unavailableTracks: 0 };
    };
    provider.getPlaylistPreview = async ({ playlistId, limit = 25 }) => {
        const snapshot = await provider.getPlaylistSnapshot({ playlistId });
        const tracks = snapshot.tracks.slice(0, Number(limit));
        return { ...snapshot, tracks, returnedTracks: tracks.length, hasMore: snapshot.tracks.length > tracks.length };
    };
    provider.createSearchClient = () => ({ searchCandidates: async ({ track }) => {
        observations.searches[provider.id] = (observations.searches[provider.id] || 0) + 1;
        if (track.name === 'Não localizada') return [];
        const id = crypto.createHash('sha256').update(`${provider.id}:${track.name}:${track.artist}`).digest('hex').slice(0, 22);
        if (String(track.sourceId).includes('invalid-score')) return [{ id, videoId: id, uri: `spotify:track:${id}`, matchScore: 100 }];
        const candidate = { id, videoId: id, uri: `spotify:track:${id}`, name: track.name, artists: [track.artist], durationMs: track.durationMs };
        return String(track.sourceId).includes('robust-review') ? [
            { ...candidate, album: 'Edição A' },
            { ...candidate, id: `${id}-alternative`, videoId: `${id}-alternative`, uri: `spotify:track:${id}-alternative`, album: 'Edição B' },
        ] : [candidate];
    } });
    provider.createDestinationClient = () => ({
        createPlaylist: async ({ title }) => {
            const id = `fixture-${provider.id}-${crypto.randomUUID()}`;
            remote[id] = { provider: provider.id, scenario: title.replace('Simulação: ', ''), ids: [], attempts: 0 };
            observations.creations[title] = (observations.creations[title] || 0) + 1;
            writeStore('fixture-destinations.json', remote);
            return id;
        },
        readTrackIds: async ({ playlistId }) => remote[playlistId]?.ids || [],
        getPlaylistUrl: (id) => `https://example.com/playlist/${id}`,
        addTracks: async ({ playlistId, ids, expectedIds }) => {
            const destination = remote[playlistId];
            destination.attempts += 1;
            const name = destination.scenario;
            observations.insertions.push({ playlistId, scenario: name, ids: [...ids], expectedIds: [...expectedIds] });
            if (destination.attempts === 1 && ['partial', 'transient', 'rate-limit', 'needs-auth'].includes(name)) {
                if (name === 'partial') destination.ids.push(expectedIds[0]);
                if (name === 'needs-auth') authorized[provider.id] = false;
                writeStore('fixture-destinations.json', remote);
                throw Object.assign(new Error('Falha fictícia para testar recuperação'), { status: name === 'rate-limit' ? 429 : name === 'needs-auth' ? 401 : 503 });
            }
            destination.ids.push(...getMissingTrackIds({ ids, expectedIds, existingIds: destination.ids }));
            writeStore('fixture-destinations.json', remote);
        },
    });
    provider.saveCredentials = async () => { authorized[provider.id] = true; };
    provider.disconnect = async () => { authorized[provider.id] = false; };
    if (provider.oauth) {
        provider.oauth.getAuthorizationUrl = async () => `http://127.0.0.1:${process.env.PORT}/api/v1/integrations/${provider.id}/callback?code=ficticio`;
        provider.oauth.handleCallback = async () => { authorized[provider.id] = true; return { connected: true, userId: 'local', redirectUrl: `http://127.0.0.1:${process.env.PORT}/dashboard?tab=integrations&provider=${provider.id}&status=connected` }; };
    }
}
const { default: app } = await import('../../src/app.js');
const wrapper = express();
// Cotas reais são verificadas na suíte HTTP; a fixture permite percorrer os cenários.
wrapper.use((req, res, next) => { for (const limiter of [globalLimiter, transferLimiter, transferActionLimiter]) limiter.resetKey(req.socket.remoteAddress); next(); });
wrapper.get('/__qa/observations', (req, res) => res.json({ simulation: true, observations, destinations: remote }));
wrapper.use(app);
const server = http.createServer(wrapper);
const io = new Server(server);
registerTransferSocket(io);
startWorker(io);
server.listen(Number(process.env.PORT || 8198), '127.0.0.1', () => console.log('Simulação local pronta, sem acesso a contas externas.'));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => io.close(() => process.exit(0)));
