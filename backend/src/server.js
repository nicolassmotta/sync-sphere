import './config/loadEnv.js';
import http from 'http';
import { Server } from 'socket.io';
import app from './app.js';
import connectDB from './config/db.js';
import { appEnv, nodeEnv } from './config/env.js';
import { registerTransferSocket } from './socket/transferSocket.js';
import { startWorker } from './workers/transferWorker.js';
import logger from './utils/logger.js';
import { socketCorsOptions } from './config/cors.js';

const PORT = process.env.PORT || 4001;

const isWorkerDisabled = () => (
    String(process.env.WORKER_ENABLED || '').trim().toLowerCase() === 'false'
);

// Método inicializador do servidor, garantindo banco primeiro.
const startServer = async () => {
    try {
        await connectDB();
        
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

        server.listen(PORT, () => {
             logger.info(`[Servidor] Rodando com NODE_ENV=${nodeEnv} APP_ENV=${appEnv} na porta ${PORT}`);

             // Liga a escuta do BullMQ para processamento em segundo plano com emissão via Socket.io.
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
