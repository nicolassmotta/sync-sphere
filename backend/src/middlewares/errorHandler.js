import AppError from '../utils/AppError.js';
import logger from '../utils/logger.js';

export const notFound = (req, res, next) => {
    next(new AppError('Rota não encontrada. Confira o endereço solicitado.', 404));
};

// Respostas e logs não incluem corpos, consultas, credenciais ou pilhas de erro.
export const errorHandler = (err, req, res, next) => {
    if (res.headersSent) return next(err);
    let statusCode = Number(err.statusCode) || 500;
    let message = err.message || 'Erro interno no servidor. Tente novamente em instantes.';
    if (err.type === 'entity.parse.failed') {
        statusCode = 400;
        message = 'JSON inválido. Confira o formato da requisição e tente novamente.';
    } else if (err.type === 'entity.too.large') {
        statusCode = 413;
        message = 'O conteúdo enviado ultrapassa o tamanho permitido. Reduza o arquivo e tente novamente.';
    } else if (!err.isOperational) {
        statusCode = 500;
        message = 'Erro interno no servidor. Tente novamente em instantes.';
    }
    if (!Number.isInteger(statusCode) || statusCode < 400 || statusCode > 599) statusCode = 500;
    if (err.isOperational && Number.isFinite(err.retryAfterMs)) res.setHeader('Retry-After', String(Math.max(0, Math.ceil(err.retryAfterMs / 1000))));
    const logMessage = `[Erro HTTP] ${statusCode} (${req.method} ${req.path})`;
    if (statusCode >= 500) logger.error(logMessage);
    else if (statusCode === 401) logger.info(logMessage);
    else logger.warn(logMessage);
    res.status(statusCode).json({ status: statusCode < 500 ? 'fail' : 'error', message });
};
