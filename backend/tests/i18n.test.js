import request from 'supertest';
import app from '../src/app.js';
import { localizeResponse, localizeText } from '../src/i18n/localization.js';

it('API usa português por padrão e negocia inglês por prioridade', async () => {
    const portuguese = await request(app).get('/api/health');
    expect(portuguese.headers['content-language']).toBe('pt-BR');
    expect(portuguese.body.message).toContain('Migração');
    const english = await request(app).get('/api/health').set('Accept-Language', 'pt-BR;q=0.2, en-US;q=0.9');
    expect(english.headers['content-language']).toBe('en');
    expect(english.body.message).toBe('The playlist transfer API is running!');
    expect(english.headers.vary).toContain('Accept-Language');
});
it('erro operacional é localizado sem mudar código HTTP ou expor credenciais', async () => {
    const response = await request(app).post('/api/v1/system/backups').set('Accept-Language', 'en').send({ password: 'curta' });
    expect(response.status).toBe(400);
    expect(response.body.message).toContain('at least 12 characters');
    expect(JSON.stringify(response.body)).not.toContain('curta');
});
it('metadados e nomes de músicas permanecem intocados enquanto mensagens são localizadas', () => {
    const body = { status: 'success', data: { transfer: { playlistName: 'Arquivo', lastMessage: 'Migração concluída no Arquivo: 3/3 faixas adicionadas.', targetPlaylistDescription: 'Não encontrada' }, tracks: [{ name: 'Carregando dados', artist: 'Não encontrada', description: 'Arquivo' }] } };
    const result = localizeResponse(body, 'en');
    expect(result.data.transfer.playlistName).toBe('Arquivo');
    expect(result.data.transfer.targetPlaylistDescription).toBe('Não encontrada');
    expect(result.data.transfer.lastMessage).toBe('Transfer completed on File: 3/3 tracks added.');
    expect(result.data.tracks).toEqual(body.data.tracks);
    expect(body.data.transfer.lastMessage).toContain('Migração');
});
it('demo em inglês usa dados fictícios e nenhuma conta externa', async () => {
    const response = await request(app).post('/api/v1/system/demo').set('Accept-Language', 'en');
    expect(response.status).toBe(201);
    expect(response.body.data.playlist.name).toBe('My first playlist');
    expect(response.body.data.playlist.trackCount).toBe(3);
    const preview = await request(app).get(`/api/v1/integrations/file/playlists/${response.body.data.playlist.id}/tracks`).set('Accept-Language', 'en');
    expect(preview.status).toBe(200);
    expect(preview.body.data.tracks.map((track) => track.album)).toEqual(['Start', 'Paths', 'Start']);
});
it('detalhe externo desconhecido é preservado na tradução', () => {
    expect(localizeText('External detail ABC-123', 'en')).toBe('External detail ABC-123');
});
