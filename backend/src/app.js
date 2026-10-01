import './config/loadEnv.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import { corsOptions } from './config/cors.js';
import { appEnv, nodeEnv } from './config/env.js';
import { FRONTEND_DIST_DIR } from './config/paths.js';
import { globalLimiter } from './middlewares/rateLimiter.js';
import authRoutes from './routes/authRoutes.js';
import transferRoutes from './routes/transferRoutes.js';
import integrationRoutes from './routes/integrationRoutes.js';
import systemRoutes from './routes/systemRoutes.js';
import { notFound, errorHandler } from './middlewares/errorHandler.js';
import { validateEssentialStores } from './storage/jsonStore.js';

const app = express();

// Middlewares globais de segurança.
// Blindagem padrão de cabeçalhos HTTP. A CSP libera capas de playlist
// (imagens https) e o MusicKit JS da Apple, usado para conectar o Apple Music.
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            imgSrc: ["'self'", 'data:', 'https:'],
            scriptSrc: ["'self'", 'https://js-cdn.music.apple.com'],
            connectSrc: ["'self'", 'https://*.apple.com'],
            frameSrc: ["'self'", 'https://*.apple.com'],
        },
    },
}));

// Configuração CORS para aceitar múltiplas origens locais, como Vite 5173/5174.
app.use(cors(corsOptions));

app.use(express.json()); // Permite ler o corpo de requisições JSON.
app.use(cookieParser()); // Intercepta cookies e coloca automaticamente em req.cookies.

// Proteção geral contra excesso básico de requisições.
app.use('/api', globalLimiter);

// Rotas principais.
app.use('/api/v1/system', systemRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/transfer', transferRoutes);
app.use('/api/v1/integrations', integrationRoutes);

// Endpoint simples de saúde.
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        application: 'SyncSphere',
        pid: process.pid,
        version: '1.1.0',
        message: 'API da Migração funcionando perfeitamente!',
        env: {
            nodeEnv,
            appEnv,
        },
        uptimeSeconds: Math.floor(process.uptime()),
    });
});

app.get('/api/ready', (req, res) => {
    try {
        validateEssentialStores();
    } catch (error) {
        return res.status(503).json({
            status: 'not_ready',
            dependencies: { storage: 'unreadable', queue: 'blocked' },
            message: error.message,
        });
    }
    res.status(200).json({
        status: 'ready',
        dependencies: {
            storage: 'local',
            queue: 'local-persistent',
        },
        env: {
            nodeEnv,
            appEnv,
        },
    });
});

const frontendIndexPath = path.join(FRONTEND_DIST_DIR, 'index.html');
const hasFrontendBuild = fs.existsSync(frontendIndexPath);

if (hasFrontendBuild) {
    app.use(express.static(FRONTEND_DIST_DIR, { index: false }));

    app.get(/^\/(?!api(?:\/|$)).*/, (req, res, next) => {
        if (path.extname(req.path) || !req.accepts('html')) return next();
        return res.sendFile(frontendIndexPath);
    });
}

// Interceptadores de erro garantem respostas JSON padronizadas.
app.use(notFound);  // Intercepta rotas não mapeadas acima.
app.use(errorHandler); // Transforma qualquer exceção global em JSON limpo.

export default app;
