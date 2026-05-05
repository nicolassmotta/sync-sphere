import jwt from 'jsonwebtoken';
import Transfer from '../models/Transfer.js';
import User from '../models/User.js';
import { buildTransferSnapshot } from '../services/transfer/transferProgressSnapshot.js';
import logger from '../utils/logger.js';

const parseCookieHeader = (cookieHeader = '') => (
    String(cookieHeader || '').split(';').reduce((acc, item) => {
        const index = item.indexOf('=');
        if (index === -1) return acc;

        const rawValue = item.slice(index + 1).trim();
        const name = item.slice(0, index).trim();

        try {
            acc[name] = decodeURIComponent(rawValue);
        } catch {
            acc[name] = rawValue;
        }

        return acc;
    }, {})
);

const authenticateSocket = async (socket, next) => {
    try {
        const cookies = parseCookieHeader(socket.handshake.headers.cookie);
        const token = cookies.jwt;

        if (!token || !process.env.JWT_SECRET) {
            return next(new Error('Socket não autenticado.'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('_id');

        if (!user) {
            return next(new Error('Usuário do socket não existe.'));
        }

        socket.userId = user._id.toString();
        return next();
    } catch {
        return next(new Error('Sessão de socket inválida.'));
    }
};

const subscribeToTransfer = async (socket, transferId) => {
    try {
        const transfer = await Transfer.findOne({
            _id: transferId,
            user: socket.userId,
        }).select('_id status lastMessage totalTracks processedTracks targetPlaylistUrl');

        if (!transfer) {
            socket.emit('transfer_error', { message: 'Transferência não encontrada para este usuário.' });
            return;
        }

        socket.join(`transfer:${transferId}`);
        socket.emit('transfer_subscribed', { transferId });
        socket.emit('transfer_update', buildTransferSnapshot(transfer));
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
