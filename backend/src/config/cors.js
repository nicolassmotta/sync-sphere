import AppError from '../utils/AppError.js';
import { getAllowedFrontendOrigins } from './frontendOrigins.js';

const isOriginAllowed = (origin) => getAllowedFrontendOrigins().includes(origin);

const corsOriginCallback = (origin, callback) => {
    // Permite requisições sem origin explícita (curl, Postman, SSR interno)
    if (!origin) return callback(null, true);
    if (isOriginAllowed(origin)) return callback(null, true);

    return callback(new AppError('A origem do painel não está permitida. Confira FRONTEND_URL e abra a instalação correta.', 403));
};

export const corsOptions = {
    origin: corsOriginCallback,
    credentials: true,
};

export const socketCorsOptions = {
    origin: corsOriginCallback,
    credentials: true,
};
