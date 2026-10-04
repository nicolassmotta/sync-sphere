import Transfer from '../models/Transfer.js';
import { LOCAL_USER_ID } from '../models/User.js';
import { getQueuePosition } from '../services/queueService.js';
import { buildTransferSnapshot } from '../services/transfer/transferProgressSnapshot.js';
import logger from '../utils/logger.js';

// No modo local não há autenticação de socket: o único usuário é o dono da máquina.
const authenticateSocket = (socket, next) => {
    socket.userId = LOCAL_USER_ID;
    return next();
};

const subscribeToTransfer = async (socket, transferId) => {
    try {
        if (typeof transferId !== 'string' || !transferId.trim() || transferId.length > 100) {
            socket.emit('transfer_error', { message: 'Informe uma transferência válida para acompanhar.' });
            return;
        }
        transferId = transferId.trim();
        const transfer = await Transfer.findOne({
            _id: transferId,
            user: socket.userId,
        });

        if (!transfer) {
            socket.emit('transfer_error', { message: 'Transferência não encontrada para este usuário.' });
            return;
        }

        socket.join(`transfer:${transferId}`);
        socket.emit('transfer_subscribed', { transferId });
        socket.emit('transfer_update', buildTransferSnapshot(transfer, {
            queuePosition: getQueuePosition(transferId),
        }));
    } catch {
        socket.emit('transfer_error', { message: 'Não foi possível assinar esta transferência.' });
    }
};

export const registerTransferSocket = (io) => {
    io.use(authenticateSocket);

    io.on('connection', (socket) => {
        logger.info(`[Socket.io] Nova interface front-end conectada: ${socket.id}`);
        socket.on('subscribe_transfer', (transferId) => subscribeToTransfer(socket, transferId));
        socket.on('disconnect', () => logger.info(`[Socket.io] Cliente desconectado: ${socket.id}`));
    });
};
