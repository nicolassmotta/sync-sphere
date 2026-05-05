// Middleware de tratamento para rotas que não existem.
export const notFound = (req, res, next) => {
    const err = new Error(`Rota indefinida - ${req.originalUrl}`);
    err.statusCode = 404;
    next(err); // Envia para o próximo interceptador.
};

import logger from '../utils/logger.js';

// Middleware global de erros.
export const errorHandler = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Erro interno no servidor.';
    
    // Tratamento de erros do Mongoose/MongoDB que poderiam vazar para o cliente.
    if (err.name === 'CastError') {
        message = `Recurso não encontrado. ID inválido: ${err.value}`;
        statusCode = 400;
    }
    if (err.code === 11000) {
        message = 'Já existe um cadastro com esses dados.';
        statusCode = 409;
    }

    const logMessage = `[Erro operacional] ${statusCode} - ${message} (${req.method} ${req.originalUrl})`;
    if (statusCode >= 500) {
        logger.error(`${logMessage}\nPilha: ${err.stack}`);
    } else if (statusCode === 401) {
        logger.info(logMessage);
    } else {
        logger.warn(logMessage);
    }

    res.status(statusCode).json({
        status: `${statusCode}`.startsWith('4') ? 'fail' : 'error',
        message: message,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack // Esconde o rastro de erro em produção.
    });
};
