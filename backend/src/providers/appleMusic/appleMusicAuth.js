import fs from 'fs';
import jwt from 'jsonwebtoken';
import {
    clearProviderCredentials,
    getProviderCredentials,
    setProviderCredentials,
} from '../../storage/credentialStore.js';

/**
 * Tokens do Apple Music:
 *
 * - Developer token: JWT ES256 assinado com a chave MusicKit da conta Apple
 *   Developer (APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY ou
 *   APPLE_PRIVATE_KEY_PATH). Alternativa não oficial: o token do web player
 *   colado no painel, que só é aceito com `Origin: https://music.apple.com`.
 * - Music User Token: autoriza a conta do usuário. Vem do MusicKit JS no
 *   navegador ou do cookie `media-user-token` do music.apple.com.
 */
const PROVIDER_ID = 'appleMusic';
const TOKEN_TTL_SECONDS = 60 * 60 * 12;
export const WEB_PLAYER_ORIGIN = 'https://music.apple.com';

let cachedDeveloperToken = null;

const readPrivateKey = () => {
    if (process.env.APPLE_PRIVATE_KEY_PATH) {
        return fs.readFileSync(process.env.APPLE_PRIVATE_KEY_PATH, 'utf8');
    }
    return (process.env.APPLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
};

export const hasSigningKey = () => Boolean(
    process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && (process.env.APPLE_PRIVATE_KEY || process.env.APPLE_PRIVATE_KEY_PATH)
);

export const signDeveloperToken = ({ now = Math.floor(Date.now() / 1000) } = {}) => jwt.sign(
    { iss: process.env.APPLE_TEAM_ID, iat: now, exp: now + TOKEN_TTL_SECONDS },
    readPrivateKey(),
    { algorithm: 'ES256', keyid: process.env.APPLE_KEY_ID }
);

export const getAppleCredentials = () => getProviderCredentials(PROVIDER_ID) || {};

/**
 * Developer token e se ele exige o Origin do web player.
 */
export const getDeveloperToken = () => {
    if (hasSigningKey()) {
        const now = Math.floor(Date.now() / 1000);
        if (!cachedDeveloperToken || cachedDeveloperToken.exp - now < 600) {
            cachedDeveloperToken = { value: signDeveloperToken({ now }), exp: now + TOKEN_TTL_SECONDS };
        }
        return { token: cachedDeveloperToken.value, webPlayer: false };
    }

    const pasted = getAppleCredentials().developerToken || process.env.APPLE_MUSIC_DEVELOPER_TOKEN;
    return pasted ? { token: pasted, webPlayer: true } : null;
};

// --- Token do web player -------------------------------------------------
// Sem chave MusicKit nem token colado, lê o token público embutido no
// JavaScript do music.apple.com (o mesmo que o site usa). Não oficial.
let webPlayerToken = null;
const WEB_TOKEN_PATTERN = /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/;

export const isWebPlayerTokenAutoEnabled = () => process.env.APPLE_MUSIC_AUTO_WEB_TOKEN !== 'false';

const decodeExp = (token) => {
    try {
        return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')).exp || 0;
    } catch {
        return 0;
    }
};

const fetchText = async (url) => {
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (SyncSphere)' } });
    if (!response.ok) throw new Error(`music.apple.com respondeu HTTP ${response.status}.`);
    return response.text();
};

export const fetchWebPlayerToken = async () => {
    const now = Math.floor(Date.now() / 1000);
    if (webPlayerToken && webPlayerToken.exp - now > 3600) return webPlayerToken.value;

    const html = await fetchText(`${WEB_PLAYER_ORIGIN}/us/browse`);
    const bundles = [...new Set(html.match(/\/assets\/index[~-][^"']*\.js/g) || [])]
        .sort((a, b) => Number(a.includes('legacy')) - Number(b.includes('legacy')));

    for (const bundle of bundles) {
        const match = (await fetchText(`${WEB_PLAYER_ORIGIN}${bundle}`)).match(WEB_TOKEN_PATTERN);
        if (match) {
            webPlayerToken = { value: match[0], exp: decodeExp(match[0]) || now + 3600 };
            return webPlayerToken.value;
        }
    }

    const error = new Error('Não foi possível obter o token público do music.apple.com. Configure a chave MusicKit no .env.');
    error.status = 503;
    throw error;
};

/**
 * Developer token para chamadas à API: chave MusicKit, token colado ou,
 * por último, o token público do web player.
 */
export const resolveDeveloperToken = async () => {
    const configured = getDeveloperToken();
    if (configured) return configured;
    if (!isWebPlayerTokenAutoEnabled()) return null;
    return { token: await fetchWebPlayerToken(), webPlayer: true };
};

export const getMusicUserToken = () => (
    getAppleCredentials().musicUserToken || process.env.APPLE_MUSIC_USER_TOKEN || null
);

export const saveAppleCredentials = (values) => {
    setProviderCredentials(PROVIDER_ID, { ...getAppleCredentials(), ...values });
};

export const replaceAppleCredentials = (values) => {
    if (values && Object.keys(values).length) setProviderCredentials(PROVIDER_ID, values);
    else clearProviderCredentials(PROVIDER_ID);
};

export const clearAppleCredentials = () => {
    clearProviderCredentials(PROVIDER_ID);
};

export const resetDeveloperTokenCacheForTests = () => {
    cachedDeveloperToken = null;
    webPlayerToken = null;
};
