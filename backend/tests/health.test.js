import request from 'supertest';
import app from '../src/app.js';

describe('endpoints de saúde da API', () => {
    it('GET /api/health deve responder 200', async () => {
        const response = await request(app).get('/api/health');

        expect(response.status).toBe(200);
        expect(response.body).toEqual(
            expect.objectContaining({
                status: 'OK',
                env: expect.objectContaining({
                    nodeEnv: expect.any(String),
                    appEnv: expect.any(String),
                }),
            })
        );
    });

    it('GET /api/ready deve responder payload de prontidão local', async () => {
        const response = await request(app).get('/api/ready');

        expect(response.status).toBe(200);
        expect(response.body).toEqual(
            expect.objectContaining({
                status: 'ready',
                dependencies: expect.objectContaining({
                    storage: expect.any(String),
                    queue: expect.any(String),
                }),
            })
        );
    });
});

it('prontidão recusa dados essenciais corrompidos sem retirar a saúde HTTP', async () => {
    const { default: fs } = await import('node:fs');
    const { dataFile } = await import('../src/config/paths.js');
    const { removeStore } = await import('../src/storage/jsonStore.js');
    fs.writeFileSync(dataFile('transfers.json'), 'corrompido');
    try {
        const response = await request(app).get('/api/ready');
        expect(response.status).toBe(503);
        expect(response.body.dependencies.storage).toBe('unreadable');
        expect(response.body.message).toMatch(/ENCRYPTION_KEY.*backup/);
        expect((await request(app).get('/api/health')).status).toBe(200);
        expect(fs.readFileSync(dataFile('transfers.json'), 'utf8')).toBe('corrompido');
    } finally { removeStore('transfers.json'); }
});
