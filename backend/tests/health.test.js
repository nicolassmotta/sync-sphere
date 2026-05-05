import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import redisConnection from '../src/config/redis.js';

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

    it('GET /api/ready deve responder payload de prontidão', async () => {
        const response = await request(app).get('/api/ready');

        expect([200, 503]).toContain(response.status);
        expect(response.body).toEqual(
            expect.objectContaining({
                status: expect.any(String),
                dependencies: expect.objectContaining({
                    mongo: expect.any(String),
                    redis: expect.any(String),
                }),
            })
        );
    });
});

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }

    if (redisConnection.status !== 'end') {
        await redisConnection.quit();
    }
});
