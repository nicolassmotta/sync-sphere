import { jest } from '@jest/globals';
import request from 'supertest';
jest.unstable_mockModule('../src/utils/logger.js', () => ({ default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
const { default: app } = await import('../src/app.js');
const { globalLimiter, transferLimiter, transferActionLimiter } = await import('../src/middlewares/rateLimiter.js');
beforeEach(() => { for (const limiter of [globalLimiter, transferLimiter, transferActionLimiter]) limiter.resetKey('::ffff:127.0.0.1'); });
it('cota geral retorna 429 e horário de espera após 150 consultas locais', async () => {
    for (let index = 0; index < 150; index += 1) expect((await request(app).get('/api/health')).status).toBe(200);
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(429);
    expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
    expect(response.body.message).toContain('Aguarde');
});
it('cota de início bloqueia a décima primeira tentativa sem transformar isso em erro interno', async () => {
    for (let index = 0; index < 10; index += 1) expect((await request(app).post('/api/v1/transfer/start').send({})).status).toBe(400);
    const response = await request(app).post('/api/v1/transfer/start').send({});
    expect(response.status).toBe(429);
    expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
});
it('cota de retomada limita a sexagésima primeira ação e mantém os registros', async () => {
    for (let index = 0; index < 60; index += 1) expect((await request(app).post('/api/v1/transfer/ausente/retry')).status).toBe(404);
    expect((await request(app).post('/api/v1/transfer/ausente/retry')).status).toBe(429);
});
