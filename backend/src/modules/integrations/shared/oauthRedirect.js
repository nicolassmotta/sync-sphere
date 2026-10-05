import crypto from 'crypto';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { getAllowedFrontendOrigins, getRequestFrontendOrigin } from '../../../config/frontendOrigins.js';
import { ensureDataDir, dataFile } from '../../../config/paths.js';

// Segredo usado para assinar o `state` do OAuth (proteção anti-CSRF do fluxo do
// Spotify). Usa JWT_SECRET se existir; senão gera e persiste um segredo local,
// para o projeto funcionar sem configuração.
let cachedStateSecret = null;
const resolveStateSecret = () => {
    if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
    if (cachedStateSecret) return cachedStateSecret;

    ensureDataDir();
    const secretPath = dataFile('oauth-state.secret');
    if (fs.existsSync(secretPath)) {
        const stored = fs.readFileSync(secretPath, 'utf8').trim();
        if (stored) {
            cachedStateSecret = stored;
            return cachedStateSecret;
        }
    }

    cachedStateSecret = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(secretPath, cachedStateSecret, { mode: 0o600 });
    return cachedStateSecret;
};

export const createOAuthState = ({ req, intent }) => {
    return jwt.sign(
        {
            id: req.user._id,
            intent,
            frontendOrigin: getRequestFrontendOrigin(req),
        },
        resolveStateSecret(),
        { expiresIn: '10m' }
    );
};

export const verifyOAuthState = ({ state, intent }) => {
    if (!state) return null;

    const secret = resolveStateSecret();
    try {
        const decoded = jwt.verify(state, secret);
        return decoded.intent === intent ? decoded : null;
    } catch {
        return null;
    }
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
        : process.env.FRONTEND_URL || allowedOrigins[0] || 'http://localhost:8000';

    return `${base}/dashboard?${new URLSearchParams(params).toString()}`;
};
