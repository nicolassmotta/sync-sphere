import './loadEnv.js';

const DEFAULT_DEV_ORIGINS = [
    'http://localhost:8000',
    'http://127.0.0.1:8000',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
];

export const toList = (value = '') =>
    String(value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

// O próprio servidor entrega o painel: a porta configurada sempre vale, mesmo
// quando PORT muda e FRONTEND_URL continua com a porta antiga.
const getServerOrigins = () => {
    const port = String(process.env.PORT || 8000).trim();
    return /^\d+$/.test(port) ? [`http://localhost:${port}`, `http://127.0.0.1:${port}`] : [];
};

export const getAllowedFrontendOrigins = () => [
    ...new Set([
        ...DEFAULT_DEV_ORIGINS,
        ...getServerOrigins(),
        ...toList(process.env.FRONTEND_URLS || ''),
        ...toList(process.env.FRONTEND_URL || ''),
    ]),
];

export const getRequestFrontendOrigin = (req) => {
    const origin = req.get('origin');
    return getAllowedFrontendOrigins().includes(origin) ? origin : null;
};
