import './loadEnv.js';
import IORedis from 'ioredis';

// Mantém apenas uma conexão de cache para não criar múltiplas conexões na porta local.
const connection = new IORedis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
});

connection.on('error', (err) => {
     console.error('[Erro Redis] Falha ao conectar com o banco em memória local:', err);
});

export default connection;
