import { jest } from '@jest/globals';
import request from 'supertest';
jest.unstable_mockModule('../src/utils/logger.js', () => ({ default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
const { default: app } = await import('../src/app.js');
const { globalLimiter, transferLimiter, transferActionLimiter, GLOBAL_REQUEST_LIMIT, TRANSFER_START_LIMIT, TRANSFER_ACTION_LIMIT } = await import('../src/middlewares/rateLimiter.js');
beforeEach(() => { for (const limiter of [globalLimiter, transferLimiter, transferActionLimiter]) limiter.resetKey('::ffff:127.0.0.1'); });
it('cota geral retorna 429 e horário de espera depois do limite de consultas locais', async () => {
    for (let index = 0; index < GLOBAL_REQUEST_LIMIT; index += 1) expect((await request(app).get('/api/v1/auth/me')).status).toBe(200);
    const response = await request(app).get('/api/v1/auth/me');
    expect(response.status).toBe(429);
    expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
    expect(response.body.message).toContain('Aguarde');
}, 30000);
it('saúde e prontidão continuam respondendo para o painel conferir se o aplicativo está aberto', async () => {
    for (let index = 0; index < GLOBAL_REQUEST_LIMIT; index += 1) await request(app).get('/api/v1/auth/me');
    expect((await request(app).get('/api/v1/auth/me')).status).toBe(429);
    expect((await request(app).get('/api/health')).status).toBe(200);
    expect((await request(app).get('/api/ready')).status).toBe(200);
}, 30000);
it('cota de início bloqueia a tentativa acima do limite sem transformar isso em erro interno', async () => {
    for (let index = 0; index < TRANSFER_START_LIMIT; index += 1) expect((await request(app).post('/api/v1/transfer/start').send({})).status).toBe(400);
    const response = await request(app).post('/api/v1/transfer/start').send({});
    expect(response.status).toBe(429);
    expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
});
it('cota de ações limita a tentativa acima do limite e mantém os registros', async () => {
    for (let index = 0; index < TRANSFER_ACTION_LIMIT; index += 1) expect((await request(app).post('/api/v1/transfer/ausente/retry')).status).toBe(404);
    expect((await request(app).post('/api/v1/transfer/ausente/retry')).status).toBe(429);
}, 30000);
