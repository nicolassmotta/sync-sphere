import '../config/loadEnv.js';
import { Queue } from 'bullmq';

import redisConnection from '../config/redis.js';

const queue = new Queue('playlist-transfer', {
    connection: redisConnection,
});

const run = async () => {
    const before = await queue.getJobCounts(
        'active',
        'completed',
        'delayed',
        'failed',
        'paused',
        'prioritized',
        'repeat',
        'unknown',
        'waiting',
        'waiting-children'
    );

    console.log('[Fila] Estado antes da limpeza:', before);

    await queue.pause();
    await queue.drain(true);
    await queue.clean(0, 1000, 'failed');
    await queue.clean(0, 1000, 'completed');
    await queue.clean(0, 1000, 'delayed');
    await queue.obliterate({ force: true });

    const after = await queue.getJobCounts(
        'active',
        'completed',
        'delayed',
        'failed',
        'paused',
        'prioritized',
        'repeat',
        'unknown',
        'waiting',
        'waiting-children'
    );

    console.log('[Fila] Estado depois da limpeza:', after);
};

run()
    .finally(async () => {
        await queue.close();
        await redisConnection.quit();
    });
