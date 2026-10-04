import { jest } from '@jest/globals';
import request from 'supertest';
jest.unstable_mockModule('../src/utils/logger.js', () => ({ default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
const { default: app } = await import('../src/app.js');
const { listProviders } = await import('../src/providers/registry.js');
const { globalLimiter } = await import('../src/middlewares/rateLimiter.js');
afterEach(() => jest.restoreAllMocks());
const cases = listProviders().flatMap((provider) => [401, 429, 503, 404].map((status) => [provider.id, status, provider]));
it.each(cases)('prévia de %s preserva o HTTP %s e orienta sem expor erro bruto', async (id, status, provider) => {
    globalLimiter.resetKey('::ffff:127.0.0.1');
    const error = Object.assign(new Error('token=segredo-ficticio'), { status, retryAfter: '5' });
    jest.spyOn(provider, 'getPlaylistPreview').mockRejectedValue(error);
    const response = await request(app).get(`/api/v1/integrations/${id}/playlist-tracks?playlistId=ficticia`);
    expect(response.status).toBe(status);
    expect(response.body.message).toMatch(/Confira|Aguarde|Abra|Tente/);
    expect(JSON.stringify(response.body)).not.toContain('segredo-ficticio');
    if (status === 429) expect(response.headers['retry-after']).toBe('5');
});

it.each(cases)('início com origem %s e HTTP %s falha antes da fila com orientação segura', async (id, status, provider) => {
    const { transferLimiter } = await import('../src/middlewares/rateLimiter.js');
    globalLimiter.resetKey('::ffff:127.0.0.1'); transferLimiter.resetKey('::ffff:127.0.0.1');
    jest.spyOn(provider, 'ensureReadable').mockResolvedValue(undefined);
    jest.spyOn(provider, 'normalizePlaylistId').mockImplementation((value) => value);
    jest.spyOn(provider, 'getPlaylistPreview').mockRejectedValue(Object.assign(new Error('token=segredo-ficticio'), { status }));
    const response = await request(app).post('/api/v1/transfer/start').send({ sourceProvider: id, targetProvider: 'file', sourcePlaylistId: 'origem-ficticia-001' });
    expect(response.status).toBe(status);
    expect(JSON.stringify(response.body)).not.toContain('segredo-ficticio');
});
