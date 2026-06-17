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
