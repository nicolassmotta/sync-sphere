import './config/loadEnv.js';
import http from 'http';
import { Server } from 'socket.io';
import app from './app.js';
import { appEnv, nodeEnv } from './config/env.js';
import { registerTransferSocket } from './socket/transferSocket.js';
import { startWorker } from './workers/transferWorker.js';
import logger from './utils/logger.js';
import { socketCorsOptions } from './config/cors.js';
import { validateEssentialStores } from './storage/jsonStore.js';
import { acquireDataDirectoryLock } from './storage/dataDirectoryLock.js';
import { applyProviderSettings } from './services/system/providerSetupService.js';
import { recoverInterruptedRestore } from './services/system/restoreService.js';

const PORT = process.env.PORT || 8000;

const isWorkerDisabled = () => (
    String(process.env.WORKER_ENABLED || '').trim().toLowerCase() === 'false'
);

// Método inicializador do servidor. No modo local não há banco: os dados ficam
// em arquivos cifrados e a fila roda no próprio processo.
const startServer = async () => {
    try {
        const release = acquireDataDirectoryLock();
        process.once('exit', release);
        process.once('SIGTERM', () => process.exit(0));
        process.once('SIGINT', () => process.exit(0));
        recoverInterruptedRestore();
        validateEssentialStores();
        applyProviderSettings();
        // Acopla servidor HTTP e Socket.io por cima do Express.
        const server = http.createServer(app);
        const io = new Server(server, {
            cors: socketCorsOptions
        });

        registerTransferSocket(io);

        server.on('error', (error) => {
            logger.error(`[Servidor] Não foi possível escutar na porta ${PORT}: ${error.message}`);
            process.exit(1);
        });

        server.listen(PORT, process.env.HOST || '127.0.0.1', () => {
             logger.info(`[Servidor] Rodando com NODE_ENV=${nodeEnv} APP_ENV=${appEnv} na porta ${PORT}`);

             // Liga o processamento da fila local em segundo plano com emissão via Socket.io.
             if (isWorkerDisabled()) {
                 logger.warn('[Trabalhador] Desativado por WORKER_ENABLED=false. Tarefas pendentes não serão processadas neste processo.');
             } else {
                 startWorker(io);
             }
        });

    } catch (error) {
         logger.error(`[Servidor] Não foi possível iniciar o back-end: ${error}`);
         process.exit(1);
    }
}

startServer();
