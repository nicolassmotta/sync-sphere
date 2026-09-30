import { jest } from '@jest/globals';
import request from 'supertest';
import { parsePlaylistFile, parseCsvRows, serializePlaylist } from '../src/providers/file/formats.js';

const { default: app } = await import('../src/app.js');
const { default: TransferProcessor } = await import('../src/services/transfer/TransferProcessor.js');
const { default: TrackMatcher } = await import('../src/services/transfer/TrackMatcher.js');
const { findExport, saveImport } = await import('../src/providers/file/fileLibrary.js');

const EXPORTIFY_CSV = [
    '"Track URI","Track Name","Artist URI(s)","Artist Name(s)","Album Name","Track Duration (ms)","ISRC"',
    '"spotify:track:1","Garota de Ipanema","spotify:artist:1","Tom Jobim, Vinicius de Moraes","Getz/Gilberto","318000","USPR36400012"',
    '"spotify:track:2","Chega de Saudade","spotify:artist:2","João Gilberto","Chega de Saudade","121000","BRXYZ5800001"',
].join('\r\n');

describe('formatos de arquivo', () => {
    it('lê CSV do Exportify com ISRC, duração e vários artistas', () => {
        const playlist = parsePlaylistFile({ filename: 'bossa_nova.csv', content: EXPORTIFY_CSV });

        expect(playlist).toMatchObject({ name: 'bossa nova', format: 'csv' });
        expect(playlist.tracks).toEqual([
            {
                name: 'Garota de Ipanema',
                artist: 'Tom Jobim, Vinicius de Moraes',
                album: 'Getz/Gilberto',
                isrc: 'USPR36400012',
                durationMs: 318000,
            },
            expect.objectContaining({ name: 'Chega de Saudade', isrc: 'BRXYZ5800001' }),
        ]);
    });

    it('lê CSV com ponto e vírgula, cabeçalho em português, aspas e quebra de linha', () => {
        const content = 'Música;Artista;Duração\n"Aquarela; versão ""ao vivo""";Toquinho;4:31\n"Linha\nquebrada";Artista;';
        const playlist = parsePlaylistFile({ filename: 'x.csv', content });

        expect(playlist.tracks[0]).toMatchObject({
            name: 'Aquarela; versão "ao vivo"',
            artist: 'Toquinho',
            durationMs: 271000,
        });
        expect(playlist.tracks[1].name).toBe('Linha\nquebrada');
    });

    it('recusa CSV sem coluna de nome', () => {
        expect(() => parsePlaylistFile({ filename: 'x.csv', content: 'a,b\n1,2' })).toThrow('coluna de nome');
    });

    it('lê M3U com #EXTINF e nome da playlist, e M3U só com caminhos', () => {
        const extended = parsePlaylistFile({
            filename: 'lista.m3u8',
            content: '#EXTM3U\n#PLAYLIST:Rock\n#EXTINF:215,Queen - Bohemian Rhapsody\nmusic/queen.mp3\n',
        });
        expect(extended.name).toBe('Rock');
        expect(extended.tracks).toEqual([expect.objectContaining({
            name: 'Bohemian Rhapsody',
            artist: 'Queen',
            durationMs: 215000,
        })]);

        const plain = parsePlaylistFile({ filename: 'a.m3u', content: 'C:\\Musicas\\Legião Urbana - Tempo Perdido.flac\n' });
        expect(plain.tracks[0]).toMatchObject({ name: 'Tempo Perdido', artist: 'Legião Urbana' });
    });

    it('lê TXT "Artista - Título" com numeração opcional', () => {
        const playlist = parsePlaylistFile({ filename: 'favoritas.txt', content: '1. Cazuza - Exagerado\n2) Só Título\n\n' });
        expect(playlist.tracks).toEqual([
            expect.objectContaining({ name: 'Exagerado', artist: 'Cazuza' }),
            expect.objectContaining({ name: 'Só Título', artist: 'Unknown' }),
        ]);
    });

    it('lê JSON do SyncSphere e lista simples de faixas', () => {
        const syncSphere = parsePlaylistFile({
            filename: 'x.json',
            content: JSON.stringify({ name: 'Minha', tracks: [{ name: 'A', artists: ['X', 'Y'], duration_ms: 1000 }] }),
        });
        expect(syncSphere).toMatchObject({ name: 'Minha', tracks: [{ name: 'A', artist: 'X, Y', durationMs: 1000 }] });

        const list = parsePlaylistFile({ filename: 'lista.json', content: '[{"title":"B","artist":"Z"}]' });
        expect(list.tracks[0]).toMatchObject({ name: 'B', artist: 'Z' });
    });

    it('detecta o formato pelo conteúdo quando a extensão não ajuda', () => {
        expect(parsePlaylistFile({ filename: 'sem-extensao', content: '#EXTM3U\n#EXTINF:1,A - B\nb.mp3' }).format).toBe('m3u');
        expect(parsePlaylistFile({ filename: 'sem-extensao', content: '[{"name":"A"}]' }).format).toBe('json');
    });

    it('gera CSV que volta a ser lido igual (ida e volta)', () => {
        const original = parsePlaylistFile({ filename: 'bossa.csv', content: EXPORTIFY_CSV });
        const csv = serializePlaylist(original, 'csv');
        const reread = parsePlaylistFile({ filename: 'bossa.csv', content: csv.body });

        expect(reread.tracks).toEqual(original.tracks);
        expect(parseCsvRows(csv.body)[0]).toEqual(['Track Name', 'Artist Name(s)', 'Album Name', 'ISRC', 'Duration (ms)']);
    });

    it('gera M3U, TXT e JSON', () => {
        const playlist = { name: 'P', description: '', tracks: [{ name: 'Song', artist: 'Band', durationMs: 60000 }] };
        expect(serializePlaylist(playlist, 'm3u').body).toContain('#EXTINF:60,Band - Song');
        expect(serializePlaylist(playlist, 'txt').body).toBe('Band - Song\n');
        expect(JSON.parse(serializePlaylist(playlist, 'json').body)).toMatchObject({ name: 'P', exportedBy: 'SyncSphere' });
    });
});

describe('rotas da plataforma arquivo', () => {
    it('importa arquivo como texto e lista como playlist de origem', async () => {
        const imported = await request(app)
            .post('/api/v1/integrations/file/imports?filename=bossa.csv')
            .set('Content-Type', 'text/plain')
            .send(EXPORTIFY_CSV);

        expect(imported.status).toBe(201);
        expect(imported.body.data.playlist).toMatchObject({ name: 'bossa', format: 'csv', trackCount: 2 });

        const listed = await request(app).get('/api/v1/integrations/file/playlists');
        expect(listed.body.data.playlists).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: imported.body.data.playlist.id, trackCount: 2 }),
        ]));

        const preview = await request(app)
            .get(`/api/v1/integrations/file/playlists/${imported.body.data.playlist.id}/tracks?limit=1`);
        expect(preview.body.data).toMatchObject({ totalTracks: 2, hasMore: true });

        const removed = await request(app).delete(`/api/v1/integrations/file/imports/${imported.body.data.playlist.id}`);
        expect(removed.status).toBe(200);
    });

    it('recusa arquivo vazio ou sem faixas', async () => {
        const response = await request(app)
            .post('/api/v1/integrations/file/imports?filename=vazio.txt')
            .set('Content-Type', 'text/plain')
            .send('   ');
        expect(response.status).toBe(400);
    });
});

describe('migração ponta a ponta arquivo -> arquivo', () => {
    it('importa, processa com o fluxo real e baixa o resultado', async () => {
        const source = saveImport({
            filename: 'bossa.csv',
            playlist: parsePlaylistFile({ filename: 'bossa.csv', content: EXPORTIFY_CSV }),
        });
        const transferRecord = {
            _id: `transfer-file-${Date.now()}`,
            sourceProvider: 'file',
            targetProvider: 'file',
            sourcePlaylistId: source.id,
            errors: [],
        };
        const repository = {
            getTransferForProcessing: jest.fn().mockResolvedValue(transferRecord),
            getUserWithTransferSecrets: jest.fn().mockResolvedValue({ _id: 'local' }),
            update: jest.fn(async (record, fields) => Object.assign(record, fields)),
            save: jest.fn(async (record) => record),
            markFailed: jest.fn(),
        };
        const processor = new TransferProcessor({
            repository,
            publisher: { emit: jest.fn() },
            trackMatcher: new TrackMatcher({ delayMs: 0 }),
        });

        const result = await processor.process({
            id: 'job-file',
            data: { transferId: transferRecord._id, userId: 'local', sourcePlaylistId: source.id },
        });

        expect(result).toEqual({ status: 'completed' });
        expect(transferRecord).toMatchObject({ status: 'completed', matchedCount: 2, playlistName: 'bossa' });
        expect(findExport(transferRecord.targetPlaylistId).tracks).toHaveLength(2);

        const download = await request(app)
            .get(transferRecord.targetPlaylistUrl.replace('format=csv', 'format=m3u'))
            .buffer(true)
            .parse((res, callback) => {
                let body = '';
                res.on('data', (chunk) => { body += chunk; });
                res.on('end', () => callback(null, body));
            });
        expect(download.status).toBe(200);
        expect(download.headers['content-disposition']).toContain('bossa.m3u8');
        expect(download.body).toContain('Tom Jobim, Vinicius de Moraes - Garota de Ipanema');
    });

    it('preserva faixas repetidas na exportação', async () => {
        const source = saveImport({
            filename: 'repetidas.txt',
            playlist: parsePlaylistFile({
                filename: 'repetidas.txt',
                content: 'Artista - Música\nArtista - Música\n',
            }),
        });
        const transferRecord = {
            _id: `transfer-repetidas-${Date.now()}`,
            sourceProvider: 'file',
            targetProvider: 'file',
            sourcePlaylistId: source.id,
            errors: [],
        };
        const repository = {
            getTransferForProcessing: jest.fn().mockResolvedValue(transferRecord),
            getUserWithTransferSecrets: jest.fn().mockResolvedValue({ _id: 'local' }),
            update: jest.fn(async (record, fields) => Object.assign(record, fields)),
            save: jest.fn(async (record) => record),
            markFailed: jest.fn(),
        };
        const processor = new TransferProcessor({
            repository,
            publisher: { emit: jest.fn() },
            trackMatcher: new TrackMatcher({ delayMs: 0 }),
        });

        await processor.process({
            id: 'job-repetidas',
            data: { transferId: transferRecord._id, userId: 'local', sourcePlaylistId: source.id },
        });

        expect(findExport(transferRecord.targetPlaylistId).tracks.map((track) => track.name))
            .toEqual(['Música', 'Música']);
    });
});
