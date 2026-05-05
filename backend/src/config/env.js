const normalizeEnv = (value, fallback) => {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized || fallback;
};

export const appEnv = normalizeEnv(process.env.APP_ENV, 'dev');
export const nodeEnv = normalizeEnv(process.env.NODE_ENV, 'development');

export const isProduction = nodeEnv === 'production' || appEnv === 'prod';
export const isTest = nodeEnv === 'test' || appEnv === 'test';
