import { getAllowedFrontendOrigins } from './frontendOrigins.js';

const isOriginAllowed = (origin) => getAllowedFrontendOrigins().includes(origin);

const corsOriginCallback = (origin, callback) => {
    // Permite requisições sem origin explícita (curl, Postman, SSR interno)
    if (!origin) return callback(null, true);
    if (isOriginAllowed(origin)) return callback(null, true);

    return callback(new Error(`CORS bloqueado para origem não permitida: ${origin}`));
};

export const corsOptions = {
    origin: corsOriginCallback,
    credentials: true,
};

export const socketCorsOptions = {
    origin: corsOriginCallback,
    credentials: true,
};
