import { jest } from '@jest/globals';
import request from 'supertest';

jest.unstable_mockModule('../src/utils/logger.js', () => ({ default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
const { default: app } = await import('../src/app.js');

it('JSON malformado recebe orientação no idioma solicitado sem devolver o corpo ou a pilha', async () => {
    const response = await request(app).post('/api/v1/system/backups')
        .set('Content-Type', 'application/json').set('Accept-Language', 'en')
        .send('{"password":"segredo-ficticio",');
    expect(response.status).toBe(400);
    expect(response.headers['content-language']).toBe('en');
    expect(response.body.message).toBe('Invalid JSON. Check the request format and try again.');
    expect(JSON.stringify(response.body)).not.toContain('segredo-ficticio');
    expect(response.body).not.toHaveProperty('stack');
});

it('falha inesperada não expõe detalhes internos em nenhuma configuração', async () => {
    const { getProvider } = await import('../src/providers/registry.js');
    const status = jest.spyOn(getProvider('file'), 'getStatus').mockRejectedValue(new Error('credencial-ficticia=segredo-teste'));
    try {
        const response = await request(app).get('/api/v1/integrations/status');
        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Erro interno no servidor. Tente novamente em instantes.');
        expect(JSON.stringify(response.body)).not.toContain('segredo-teste');
        expect(response.body).not.toHaveProperty('stack');
    } finally { status.mockRestore(); }
});
it('arquivo acima do limite recebe 413 acionável sem conteúdo ou pilha', async () => {
    const response = await request(app).post('/api/v1/integrations/file/imports?filename=grande.txt')
        .set('Content-Type', 'text/plain').send('x'.repeat(5 * 1024 * 1024 + 1));
    expect(response.status).toBe(413);
    expect(response.body.message).toContain('Reduza o arquivo');
    expect(response.body).not.toHaveProperty('stack');
});
it('rota desconhecida não ecoa dados colocados na consulta', async () => {
    const response = await request(app).get('/api/ausente?token=segredo-ficticio');
    expect(response.status).toBe(404);
    expect(JSON.stringify(response.body)).not.toContain('segredo-ficticio');
});
it('origem não permitida recebe 403 com mensagem de orientação', async () => {
    const response = await request(app).get('/api/health').set('Origin', 'https://origem-nao-permitida.example');
    expect(response.status).toBe(403);
    expect(response.body.message).toContain('origem');
});
