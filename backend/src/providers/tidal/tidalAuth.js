import AppError from '../../utils/AppError.js';
import {
    clearProviderCredentials,
    getProviderCredentials,
    setProviderCredentials,
} from '../../storage/credentialStore.js';
import { createPkceChallenge, takePkceVerifier } from '../../modules/integrations/shared/pkceStore.js';

/**
 * OAuth do TIDAL (https://developer.tidal.com): Authorization Code + PKCE para
 * a conta do usuário e, se houver Client Secret, Client Credentials para ler
 * o catálogo sem login.
 */
const PROVIDER_ID = 'tidal';
const AUTHORIZE_URL = 'https://login.tidal.com/authorize';
const TOKEN_URL = 'https://auth.tidal.com/v1/oauth2/token';
export const TIDAL_SCOPES = ['user.read', 'playlists.read', 'playlists.write', 'search.read'];

const getClientId = () => (process.env.TIDAL_CLIENT_ID || '').trim();
const getClientSecret = () => (process.env.TIDAL_CLIENT_SECRET || '').trim();

export const getTidalRedirectUri = () => (
    process.env.TIDAL_REDIRECT_URI
    || `http://127.0.0.1:${process.env.PORT || 8000}/api/v1/integrations/tidal/callback`
);

export const isTidalConfigured = () => Boolean(getClientId());
export const hasTidalClientCredentials = () => Boolean(getClientId() && getClientSecret());

const requireConfig = () => {
    if (!isTidalConfigured()) {
        throw new AppError(
            'Defina TIDAL_CLIENT_ID no backend/.env (crie um app em developer.tidal.com) e reinicie o back-end.',
            400
        );
    }
};

export const getTidalCredentials = () => getProviderCredentials(PROVIDER_ID);

const requestToken = async (params) => {
    const body = new URLSearchParams({ client_id: getClientId(), ...params });
    if (getClientSecret()) body.set('client_secret', getClientSecret());

    const response = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        const error = new Error(data.error_description || data.error || `TIDAL recusou o token (HTTP ${response.status}).`);
        error.status = response.status === 400 ? 401 : response.status;
        throw error;
    }
    return data;
};

export const buildTidalAuthorizationUrl = (state) => {
    requireConfig();
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: getClientId(),
        redirect_uri: getTidalRedirectUri(),
        scope: TIDAL_SCOPES.join(' '),
        code_challenge_method: 'S256',
        code_challenge: createPkceChallenge(state),
        state,
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
};

export const exchangeTidalCode = async ({ code, state }) => {
    requireConfig();
    const verifier = takePkceVerifier(state);
    if (!verifier) {
        throw new AppError('Sessão de conexão do TIDAL expirou. Clique em "Conectar TIDAL" de novo.', 400);
    }

    return requestToken({
        grant_type: 'authorization_code',
        code,
        redirect_uri: getTidalRedirectUri(),
        code_verifier: verifier,
    });
};

export const saveTidalTokens = (tokenData, extra = {}) => {
    const previous = getTidalCredentials() || {};
    setProviderCredentials(PROVIDER_ID, {
        ...previous,
        ...extra,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || previous.refreshToken || null,
        expiresAt: new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString(),
    });
};

export const clearTidalCredentials = () => clearProviderCredentials(PROVIDER_ID);

/**
 * Token da conta conectada, renovado pelo refresh token quando falta menos
 * de um minuto para expirar.
 */
export const getTidalUserToken = async () => {
    const credentials = getTidalCredentials();
    if (!credentials?.accessToken) {
        const error = new Error('Conecte sua conta TIDAL em Integrações para continuar.');
        error.status = 401;
        throw error;
    }

    const expiresAt = new Date(credentials.expiresAt || 0).getTime();
    if (expiresAt - Date.now() > 60_000) return credentials.accessToken;

    if (!credentials.refreshToken) {
        const error = new Error('A sessão do TIDAL expirou. Reconecte sua conta.');
        error.status = 401;
        throw error;
    }

    const tokenData = await requestToken({ grant_type: 'refresh_token', refresh_token: credentials.refreshToken });
    saveTidalTokens(tokenData);
    return tokenData.access_token;
};

let catalogToken = null;

/**
 * Token para ler catálogo e playlists públicas: da conta, se conectada; senão
 * Client Credentials (exige TIDAL_CLIENT_SECRET).
 */
export const getTidalCatalogToken = async () => {
    if (getTidalCredentials()?.accessToken) return getTidalUserToken();
    if (!hasTidalClientCredentials()) {
        const error = new Error('Conecte sua conta TIDAL (ou defina TIDAL_CLIENT_SECRET) para ler playlists.');
        error.status = 401;
        throw error;
    }

    if (catalogToken && catalogToken.expiresAt - Date.now() > 60_000) return catalogToken.value;
    const tokenData = await requestToken({ grant_type: 'client_credentials' });
    catalogToken = { value: tokenData.access_token, expiresAt: Date.now() + (tokenData.expires_in || 3600) * 1000 };
    return catalogToken.value;
};
