import './loadEnv.js';

const DEFAULT_DEV_ORIGINS = [
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

export const getAllowedFrontendOrigins = () => [
    ...new Set([
        ...DEFAULT_DEV_ORIGINS,
        ...toList(process.env.FRONTEND_URLS || ''),
        ...toList(process.env.FRONTEND_URL || ''),
    ]),
];

export const getRequestFrontendOrigin = (req) => {
    const origin = req.get('origin');
    return getAllowedFrontendOrigins().includes(origin) ? origin : null;
};
