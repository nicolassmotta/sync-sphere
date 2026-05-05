import './config/loadEnv.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import mongoose from 'mongoose';
import { corsOptions } from './config/cors.js';
import redisConnection from './config/redis.js';
import { appEnv, nodeEnv } from './config/env.js';
import { globalLimiter } from './middlewares/rateLimiter.js';
import authRoutes from './routes/authRoutes.js';
import transferRoutes from './routes/transferRoutes.js';
import integrationRoutes from './routes/integrationRoutes.js';
import { notFound, errorHandler } from './middlewares/errorHandler.js';

const app = express();

// Middlewares globais de segurança.
app.use(helmet()); // Blindagem padrão de cabeçalhos HTTP.

// Proteção estrita contra injeção NoSQL cortando parâmetros Mongoose de payloads ($ e .).
app.use(mongoSanitize());

// Configuração CORS para aceitar múltiplas origens locais, como Vite 5173/5174.
app.use(cors(corsOptions));

app.use(express.json()); // Permite ler o corpo de requisições JSON.
app.use(cookieParser()); // Intercepta cookies e coloca automaticamente em req.cookies.

// Proteção geral contra excesso básico de requisições.
app.use('/api', globalLimiter);

// Rotas principais.
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/transfer', transferRoutes);
app.use('/api/v1/integrations', integrationRoutes);

// Endpoint simples de saúde.
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        message: 'API da Migração funcionando perfeitamente!',
        env: {
            nodeEnv,
            appEnv,
        },
        uptimeSeconds: Math.floor(process.uptime()),
    });
});

app.get('/api/ready', async (req, res) => {
    const mongoReady = mongoose.connection.readyState === 1;
    const redisReady = redisConnection.status === 'ready';

    const statusCode = mongoReady && redisReady ? 200 : 503;
    res.status(statusCode).json({
        status: statusCode === 200 ? 'ready' : 'not-ready',
        dependencies: {
            mongo: mongoReady ? 'up' : 'down',
            redis: redisReady ? 'up' : 'down',
        },
        env: {
            nodeEnv,
            appEnv,
        },
    });
});

// Interceptadores de erro garantem respostas JSON padronizadas.
app.use(notFound);  // Intercepta rotas não mapeadas acima.
app.use(errorHandler); // Transforma qualquer exceção global em JSON limpo.

export default app;
