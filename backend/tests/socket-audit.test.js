import { jest } from '@jest/globals';
import http from 'node:http';
import { Server } from 'socket.io';
import { io as connect } from 'socket.io-client';
jest.unstable_mockModule('../src/utils/logger.js', () => ({ default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
const { default: app } = await import('../src/app.js');
const { default: Transfer } = await import('../src/models/Transfer.js');
const { registerTransferSocket } = await import('../src/socket/transferSocket.js');
let server;
let io;
let client;
let local;
let foreign;
const event = (name) => new Promise((resolve) => client.once(name, resolve));
beforeAll(async () => {
    server = http.createServer(app);
    io = new Server(server);
    registerTransferSocket(io);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    [local, foreign] = await Transfer.insertMany([
        { user: 'local', status: 'paused', pauseReason: 'retry_scheduled', resumeAt: '2030-01-01T12:00:00Z', playlistName: 'Arquivo', totalTracks: 3, matchedCount: 3, pendingInsertCount: 1 },
        { user: 'instalacao-ficticia-diferente', playlistName: 'Privada fictícia' },
    ]);
});
beforeEach(async () => {
    client = connect(`http://127.0.0.1:${server.address().port}`, { autoConnect: false, transports: ['websocket'], reconnection: false });
    const ready = event('connect'); client.connect(); await ready;
});
afterEach(() => client.disconnect());
afterAll(async () => { await new Promise((resolve) => io.close(resolve)); });
it('inscrição real entrega snapshot persistido e permanece aberta durante pausa', async () => {
    const update = event('transfer_update');
    client.emit('subscribe_transfer', local._id);
    const snapshot = await update;
    expect(snapshot).toMatchObject({ transferId: local._id, status: 'paused', pauseReason: 'retry_scheduled', resumeAt: local.resumeAt, playlistName: 'Arquivo', counts: { total: 3, pendingInserts: 1 } });
    expect(client.connected).toBe(true);
});
it('inscrição em registro de outra instalação não entrega metadados', async () => {
    const failure = event('transfer_error');
    client.emit('subscribe_transfer', foreign._id);
    expect(JSON.stringify(await failure)).not.toContain('Privada fictícia');
});
it('inscrição recusa payload que não seja um identificador textual', async () => {
    const failure = event('transfer_error');
    client.emit('subscribe_transfer', [local._id]);
    expect((await failure).message).toContain('válida');
});
