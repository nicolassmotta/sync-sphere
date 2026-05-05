import crypto from 'crypto';
import { Cookie } from 'tough-cookie';

export const YTMUSIC_ORIGIN = 'https://music.youtube.com';

export const normalizeCookieHeader = (cookieHeader = '') => {
    const rawCookieHeader = String(cookieHeader)
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .trim();

    const tableRows = rawCookieHeader
        .split(/\r?\n/)
        .map((row) => row.trim())
        .filter(Boolean)
        .map((row) => {
            const match = row.match(/^([^=\s;]+)\s+["']?([^"'\n]+)["']?$/);
            return match ? `${match[1]}=${match[2]}` : row;
        });

    return tableRows
        .join('; ')
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => part.replace(/^([^=]+)=["'](.*)["']$/, '$1=$2'))
        .join('; ');
};

export const buildYoutubeMusicAuthError = (message) => {
    const error = new Error(message);
    error.isPermanentTransferError = true;
    return error;
};

const getCookieValue = (cookieHeader, cookieName) => {
    const cookies = normalizeCookieHeader(cookieHeader).split('; ');
    const match = cookies.find((cookie) => cookie.startsWith(`${cookieName}=`));
    return match?.slice(cookieName.length + 1);
};

const getCookieNames = (cookieHeader) => (
    normalizeCookieHeader(cookieHeader)
        .split('; ')
        .map((cookie) => cookie.split('=')[0])
        .filter(Boolean)
);

const getSapisidFromCookie = (cookieHeader) => (
    getCookieValue(cookieHeader, '__Secure-3PAPISID')
    || getCookieValue(cookieHeader, '__Secure-1PAPISID')
    || getCookieValue(cookieHeader, 'SAPISID')
);

const getYoutubeMusicCookieValidation = (cookieHeader) => {
    const names = new Set(getCookieNames(cookieHeader));
    const hasSapisid = ['__Secure-3PAPISID', '__Secure-1PAPISID', 'SAPISID'].some((name) => names.has(name));
    const hasSession = ['__Secure-3PSID', '__Secure-1PSID', 'SID'].some((name) => names.has(name));
    const missing = [];

    if (!hasSapisid) missing.push('__Secure-3PAPISID, __Secure-1PAPISID ou SAPISID');
    if (!hasSession) missing.push('__Secure-3PSID, __Secure-1PSID ou SID');

    return {
        valid: hasSapisid && hasSession,
        missing,
        cookieCount: names.size,
    };
};

export const validateYoutubeMusicCookieDestinationConfig = () => {
    const cookieHeader = normalizeCookieHeader(process.env.YTMUSIC_COOKIE);
    if (!cookieHeader) {
        throw buildYoutubeMusicAuthError('Configure YTMUSIC_COOKIE para usar o destino não oficial do YouTube Music.');
    }

    const validation = getYoutubeMusicCookieValidation(cookieHeader);
    if (!validation.valid) {
        throw buildYoutubeMusicAuthError(
            `YTMUSIC_COOKIE incompleto: faltando ${validation.missing.join(' e ')}. O back-end leu ${validation.cookieCount} cookie(s); copie o cabeçalho Cookie completo de uma requisição logada em music.youtube.com.`
        );
    }
};

export const buildSapisidAuthorization = (cookieHeader) => {
    validateYoutubeMusicCookieDestinationConfig();
    const sapisid = getSapisidFromCookie(cookieHeader);
    if (!sapisid) {
        throw buildYoutubeMusicAuthError(
            'YTMUSIC_COOKIE foi lido, mas não contém __Secure-3PAPISID, __Secure-1PAPISID ou SAPISID. Copie o cabeçalho Cookie completo de uma requisição logada em music.youtube.com.'
        );
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const hash = crypto
        .createHash('sha1')
        .update(`${timestamp} ${sapisid} ${YTMUSIC_ORIGIN}`)
        .digest('hex');

    return `SAPISIDHASH ${timestamp}_${hash}`;
};

export const applyAuthHeaders = (ytmusic, cookieHeader) => {
    ytmusic.client.interceptors.request.clear();
    ytmusic.client.interceptors.request.use((request) => {
        request.headers.cookie = cookieHeader;
        request.headers.Cookie = cookieHeader;
        request.headers.Authorization = buildSapisidAuthorization(cookieHeader);
        request.headers.authorization = request.headers.Authorization;
        request.headers.Origin = YTMUSIC_ORIGIN;
        request.headers.origin = YTMUSIC_ORIGIN;
        request.headers['X-Origin'] = YTMUSIC_ORIGIN;
        request.headers['x-origin'] = YTMUSIC_ORIGIN;
        request.headers['X-Goog-AuthUser'] = process.env.YTMUSIC_AUTH_USER || '0';
        request.headers['x-goog-authuser'] = process.env.YTMUSIC_AUTH_USER || '0';
        return request;
    });

    ytmusic.client.defaults.headers.Authorization = buildSapisidAuthorization(cookieHeader);
    ytmusic.client.defaults.headers.authorization = ytmusic.client.defaults.headers.Authorization;
    ytmusic.client.defaults.headers.Origin = YTMUSIC_ORIGIN;
    ytmusic.client.defaults.headers.origin = YTMUSIC_ORIGIN;
    ytmusic.client.defaults.headers['X-Origin'] = YTMUSIC_ORIGIN;
    ytmusic.client.defaults.headers['x-origin'] = YTMUSIC_ORIGIN;
    ytmusic.client.defaults.headers.Cookie = cookieHeader;
    ytmusic.client.defaults.headers.cookie = cookieHeader;
    ytmusic.client.defaults.headers['X-Goog-AuthUser'] = process.env.YTMUSIC_AUTH_USER || '0';
    ytmusic.client.defaults.headers['x-goog-authuser'] = process.env.YTMUSIC_AUTH_USER || '0';
};

export const hydrateCookieJarForMusicDomains = (ytmusic, cookieHeader) => {
    for (const cookieString of cookieHeader.split('; ')) {
        const youtubeCookie = Cookie.parse(cookieString);
        const musicCookie = Cookie.parse(cookieString);
        if (youtubeCookie) {
            ytmusic.cookiejar.setCookieSync(youtubeCookie, 'https://www.youtube.com/');
        }
        if (musicCookie) {
            ytmusic.cookiejar.setCookieSync(musicCookie, 'https://music.youtube.com/');
        }
    }
};
