import jwt from 'jsonwebtoken';
import { getAllowedFrontendOrigins, getRequestFrontendOrigin } from '../../../config/frontendOrigins.js';

export const createOAuthState = ({ req, intent }) => {
    if (!process.env.JWT_SECRET) {
        throw new Error('ERRO FATAL: JWT_SECRET não está definida nas variáveis de ambiente.');
    }

    return jwt.sign(
        {
            id: req.user._id,
            intent,
            frontendOrigin: getRequestFrontendOrigin(req),
        },
        process.env.JWT_SECRET,
        { expiresIn: '10m' }
    );
};

export const verifyOAuthState = ({ state, intent }) => {
    if (!state) return null;
    if (!process.env.JWT_SECRET) {
        throw new Error('ERRO FATAL: JWT_SECRET não está definida nas variáveis de ambiente.');
    }

    const decoded = jwt.verify(state, process.env.JWT_SECRET);
    return decoded.intent === intent ? decoded : null;
};

export const getFrontendOriginFromState = ({ state, intent }) => {
    try {
        return verifyOAuthState({ state, intent })?.frontendOrigin || null;
    } catch {
        return null;
    }
};

export const getFrontendRedirect = (params, frontendOrigin = null) => {
    const allowedOrigins = getAllowedFrontendOrigins();
    const base = frontendOrigin && allowedOrigins.includes(frontendOrigin)
        ? frontendOrigin
        : process.env.FRONTEND_URL || allowedOrigins[0] || 'http://localhost:5173';

    return `${base}/dashboard?${new URLSearchParams(params).toString()}`;
};
