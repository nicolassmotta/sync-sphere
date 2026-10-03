import request from 'supertest';
import fs from 'node:fs';
import http from 'node:http';
import { jest } from '@jest/globals';
import app from '../src/app.js';
import { dataFile } from '../src/config/paths.js';
import { readStore, writeStore, removeStore } from '../src/storage/jsonStore.js';
import { createBackup, openBackup } from '../src/services/system/backupService.js';
import { restoreBackup, recoverInterruptedRestore } from '../src/services/system/restoreService.js';
import { acquireDataDirectoryLock } from '../src/storage/dataDirectoryLock.js';
import { buildDiagnostic } from '../src/services/system/diagnosticService.js';
import { buildTransferReport } from '../src/services/transfer/transferReportService.js';
import Transfer from '../src/models/Transfer.js';
import { saveTransferTracks, buildTransferTracks } from '../src/services/transfer/TransferTrackStore.js';
import { encryptText } from '../src/utils/crypto.js';

const password = 'senha-ficticia-de-backup';
beforeEach(() => { writeStore('queue.json', []); });
afterEach(() => { jest.restoreAllMocks(); removeStore('server.lock'); removeStore('restore-journal.json'); });

it('demonstração importa três ocorrências fictícias sem credenciais', async () => {
    const response = await request(app).post('/api/v1/system/demo');
    expect(response.status).toBe(201);
    expect(response.body.data.playlist.trackCount).toBe(3);
    const record = readStore('file-imports.json', []).find((item) => item.id === response.body.data.playlist.id);
    expect(record.tracks[0]).toEqual(record.tracks[2]);
});

it('diagnóstico não inclui credenciais, nomes, caminhos ou erro bruto', () => {
    writeStore('provider-credentials.json', { youtubeMusic: { cookie: 'SEGREDO_FICTICIO' } });
    writeStore('transfers.json', [{ status: 'failed', playlistName: 'NOME_PRIVADO', errors: [{ reason: 'SEGREDO_FICTICIO' }] }]);
    const serialized = JSON.stringify(buildDiagnostic());
    expect(serialized).not.toContain('SEGREDO_FICTICIO');
    expect(serialized).not.toContain('NOME_PRIVADO');
    expect(serialized).not.toContain(process.env.DATA_DIR);
});

it('backup requer senha forte e protege credenciais e metadados', async () => {
    expect((await request(app).post('/api/v1/system/backups').send({ password: 'curta' })).status).toBe(400);
    writeStore('credentials.json', { spotifyToken: 'TOKEN_FICTICIO' });
    const content = createBackup(password);
    expect(content).not.toContain('TOKEN_FICTICIO');
    expect(openBackup(content, password).stores['credentials.json'].spotifyToken).toBe('TOKEN_FICTICIO');
    expect(() => openBackup(content, 'senha-incorreta-ficticia')).toThrow('Nenhum dado foi restaurado');
    const damaged = JSON.parse(content);
    damaged.data = Buffer.from('alterado').toString('base64');
    expect(() => openBackup(JSON.stringify(damaged), password)).toThrow();
});

it('não cria backup com job pendente', () => {
    writeStore('queue.json', [{ id: 'pendente' }]);
    expect(() => createBackup(password)).toThrow('Aguarde a fila terminar');
});

it('restauração com senha errada conserva os bytes anteriores', () => {
    writeStore('credentials.json', { spotifyToken: 'anterior' });
    const content = createBackup(password);
    const previous = fs.readFileSync(dataFile('credentials.json'));
    expect(() => restoreBackup(content, 'outra-senha-ficticia')).toThrow();
    expect(fs.readFileSync(dataFile('credentials.json'))).toEqual(previous);
});

it('restauração recupera dados e reverte todos os arquivos após falha parcial', () => {
    writeStore('credentials.json', { spotifyToken: 'backup' });
    const content = createBackup(password);
    writeStore('credentials.json', { spotifyToken: 'atual' });
    const previous = fs.readFileSync(dataFile('credentials.json'));
    const rename = fs.renameSync.bind(fs);
    let mutations = 0;
    jest.spyOn(fs, 'renameSync').mockImplementation((source, target) => {
        if (++mutations === 3) throw new Error('Falha simulada durante restauração');
        return rename(source, target);
    });
    expect(() => restoreBackup(content, password)).toThrow('Falha simulada');
    expect(fs.readFileSync(dataFile('credentials.json'))).toEqual(previous);
    jest.restoreAllMocks();
    expect(restoreBackup(content, password).restoredCollections).toBeGreaterThan(0);
    expect(readStore('credentials.json', {}).spotifyToken).toBe('backup');
});

it('restauração interrompida é desfeita pelo diário cifrado antes do boot', () => {
    writeStore('credentials.json', { spotifyToken: 'preservado' });
    const previous = fs.readFileSync(dataFile('credentials.json'));
    fs.writeFileSync(dataFile('restore-journal.json'), encryptText(JSON.stringify({ 'credentials.json': previous.toString('base64'), 'file-exports.json': null })));
    writeStore('credentials.json', { spotifyToken: 'parcial' });
    expect(recoverInterruptedRestore()).toBe(true);
    expect(fs.readFileSync(dataFile('credentials.json'))).toEqual(previous);
});

it('bloqueio exclusivo recusa outra instância e é liberado pelo proprietário', () => {
    const release = acquireDataDirectoryLock();
    expect(() => acquireDataDirectoryLock()).toThrow('já está aberto');
    release();
    expect(fs.existsSync(dataFile('server.lock'))).toBe(false);
});

it('relatório diferencia correspondência de inserção e protege fórmulas CSV', async () => {
    const [transfer] = await Transfer.insertMany([{ user: 'local', playlistName: 'Teste', status: 'failed', sourceTotalTracks: 3, sourceTruncated: true, sourceOmittedTracks: 1 }]);
    const tracks = buildTransferTracks([{ name: '=HYPERLINK("x")', artist: 'Teste' }, { name: 'B', artist: 'Teste' }]);
    Object.assign(tracks[0], { status: 'matched', targetId: 'id', inserted: false });
    Object.assign(tracks[1], { status: 'matched', targetId: 'id2', inserted: true });
    saveTransferTracks(transfer._id, tracks);
    const json = JSON.parse((await buildTransferReport({ transferId: transfer._id, userId: 'local' })).body);
    expect(json.counts).toMatchObject({ inserted: 1, pendingInserts: 1 });
    expect(json.tracks[0].outcome).toBe('aguardando inserção');
    expect(json.omittedTracks).toBe(1);
    const csv = await buildTransferReport({ transferId: transfer._id, userId: 'local', format: 'csv' });
    expect(csv.body).toContain("'=HYPERLINK");
    const english = JSON.parse((await buildTransferReport({ transferId: transfer._id, userId: 'local', locale: 'en' })).body);
    expect(english.tracks[0].outcome).toBe('awaiting insertion');
    expect(english.tracks[1].outcome).toBe('added');
    expect(english.tracks[0].name).toBe(tracks[0].name);
    expect(english.note).toBe('The report describes the state confirmed by the application.');
    const englishCsv = await buildTransferReport({ transferId: transfer._id, userId: 'local', locale: 'en', format: 'csv' });
    expect(englishCsv.body).toContain('"Position","Track","Artist","Outcome","Match","Score"');
    expect(englishCsv.body).toContain("'=HYPERLINK");
});

it('configura Client ID local sem editar .env e sem devolver o valor salvo', async () => {
    const previous = process.env.SPOTIFY_CLIENT_ID;
    writeStore('credentials.json', {});
    try {
        const response = await request(app).put('/api/v1/system/providers/spotify/setup').send({ clientId: 'a'.repeat(32) });
        expect(response.status).toBe(200);
        expect(response.body.data).toEqual({ configured: true });
        const status = await request(app).get('/api/v1/system/providers/spotify/setup');
        expect(JSON.stringify(status.body)).not.toContain('a'.repeat(32));
        expect(status.body.data.redirectUri).toContain('127.0.0.1');
        expect(fs.readFileSync(dataFile('provider-settings.json'), 'utf8')).not.toContain('a'.repeat(32));
        writeStore('queue.json', [{ id: 'ativo' }]);
        expect((await request(app).put('/api/v1/system/providers/spotify/setup').send({ clientId: 'b'.repeat(32) })).status).toBe(409);
    } finally {
        if (previous === undefined) delete process.env.SPOTIFY_CLIENT_ID;
        else process.env.SPOTIFY_CLIENT_ID = previous;
    }
});


it('origem remota não acessa backup mesmo simulando endereço local em cabeçalho', async () => {
    const server = http.createServer((req, res) => {
        Object.defineProperty(req.socket, 'remoteAddress', { value: '203.0.113.8' });
        app(req, res);
    });
    const response = await request(server).post('/api/v1/system/backups').set('X-Forwarded-For', '127.0.0.1').send({ password });
    expect(response.status).toBe(403);
    expect(response.body.message).toContain('neste computador');
});

it('diário corrompido permanece intacto e bloqueia a recuperação com orientação', () => {
    fs.writeFileSync(dataFile('restore-journal.json'), 'diário corrompido');
    const previous = fs.readFileSync(dataFile('restore-journal.json'));
    expect(() => recoverInterruptedRestore()).toThrow(/DATA_DIR.*ENCRYPTION_KEY.*backup/);
    expect(fs.readFileSync(dataFile('restore-journal.json'))).toEqual(previous);
});


it('status do Spotify informa a falta do aplicativo para mostrar o assistente inicial', async () => {
    const { getProvider } = await import('../src/providers/registry.js');
    const previous = process.env.SPOTIFY_CLIENT_ID;
    try {
        delete process.env.SPOTIFY_CLIENT_ID;
        expect((await getProvider('spotify').getStatus({ userId: 'local' })).configured).toBe(false);
        process.env.SPOTIFY_CLIENT_ID = 'a'.repeat(32);
        expect((await getProvider('spotify').getStatus({ userId: 'local' })).configured).toBe(true);
    } finally {
        if (previous === undefined) delete process.env.SPOTIFY_CLIENT_ID;
        else process.env.SPOTIFY_CLIENT_ID = previous;
    }
});
