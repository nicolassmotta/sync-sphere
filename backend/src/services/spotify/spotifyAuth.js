import { fetchWithSearchBudget as fetch } from '../matching/requestBudget.js';
import crypto from 'crypto';
import User from '../../models/User.js';

const SPOTIFY_SCOPES = [
    'playlist-read-private',
    'playlist-read-collaborative',
    'playlist-modify-private',
    'playlist-modify-public',
    'user-read-private',
];

const getSpotifyClientId = () => (
    (process.env.SPOTIFY_CLIENT_ID || '').trim()
);

// Sem SPOTIFY_REDIRECT_URI definido, usa o loopback local. O Spotify exige IP
// de loopback (127.0.0.1), não "localhost"; este valor exato precisa estar
// cadastrado em "Redirect URIs" no painel do app Spotify.
const getSpotifyRedirectUri = () => (
    process.env.SPOTIFY_REDIRECT_URI
    || `http://127.0.0.1:${process.env.PORT || 8000}/api/v1/integrations/spotify/callback`
);

const requireSpotifyConfig = () => {
    if (!getSpotifyClientId()) {
        throw new Error(
            'SPOTIFY_CLIENT_ID precisa estar configurado no backend/.env. '
            + 'Client Secret não é necessário porque o Spotify usa OAuth com PKCE.'
        );
    }
};

export const getSpotifyScopes = () => SPOTIFY_SCOPES;

// --- PKCE -----------------------------------------------------------------
// O code_verifier precisa ser guardado entre o "login" e o "callback" e NÃO
// pode trafegar pela URL (senão o PKCE perde o sentido). No modo local o
// back-end é um processo único, então um Map em memória, indexado pelo `state`
// assinado, é suficiente. TTL curto + limpeza preguiçosa evitam vazamento.
const PKCE_TTL_MS = 10 * 60 * 1000;
const pkceVerifiers = new Map();

const prunePkceVerifiers = () => {
    const now = Date.now();
    for (const [key, entry] of pkceVerifiers) {
        if (now - entry.createdAt > PKCE_TTL_MS) {
            pkceVerifiers.delete(key);
        }
    }
};

const createPkcePair = () => {
    const verifier = crypto.randomBytes(64).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    return { verifier, challenge };
};

const takePkceVerifier = (state) => {
    const entry = pkceVerifiers.get(state);
    if (entry) {
        pkceVerifiers.delete(state);
    }
    return entry?.verifier || null;
};

export const buildSpotifyAuthorizationUrl = (state) => {
    requireSpotifyConfig();

    prunePkceVerifiers();
    const { verifier, challenge } = createPkcePair();
    pkceVerifiers.set(state, { verifier, createdAt: Date.now() });

    const params = new URLSearchParams({
        response_type: 'code',
        client_id: getSpotifyClientId(),
        scope: SPOTIFY_SCOPES.join(' '),
        redirect_uri: getSpotifyRedirectUri(),
        state,
        code_challenge_method: 'S256',
        code_challenge: challenge,
        show_dialog: 'false',
    });

    return `https://accounts.spotify.com/authorize?${params.toString()}`;
};

// No fluxo PKCE o token endpoint identifica o app pelo client_id no corpo (sem
// header Basic/Authorization e sem client secret).
const requestSpotifyToken = async (params) => {
    requireSpotifyConfig();

    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            client_id: getSpotifyClientId(),
            ...params,
        }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error_description || data.error || 'Falha ao autenticar com Spotify.');
    }

    return data;
};

export const exchangeSpotifyCode = (code, state) => {
    const codeVerifier = takePkceVerifier(state);
    if (!codeVerifier) {
        throw new Error('Sessão de conexão do Spotify expirada. Clique em "Conectar Spotify" novamente.');
    }

    return requestSpotifyToken({
        grant_type: 'authorization_code',
        code,
        redirect_uri: getSpotifyRedirectUri(),
        code_verifier: codeVerifier,
    });
};

export const refreshSpotifyAccessToken = async (user) => {
    if (!user.spotifyRefreshToken) {
        throw new Error('Usuário não possui refresh token do Spotify.');
    }

    const tokenData = await requestSpotifyToken({
        grant_type: 'refresh_token',
        refresh_token: user.spotifyRefreshToken,
    });

    user.spotifyToken = tokenData.access_token;
    if (tokenData.refresh_token) {
        user.spotifyRefreshToken = tokenData.refresh_token;
    }
    user.spotifyTokenExpiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000);
    await user.save({ validateBeforeSave: false });

    return user.spotifyToken;
};

// Resolve o token de acesso do usuário conectado, renovando via refresh token
// quando necessário. Sem secret não existe mais o atalho `client_credentials`
// (token de app): para ler/escrever no Spotify é preciso ter a conta conectada.
const resolveConnectedAccessToken = async (userId) => {
    if (!userId) {
        throw new Error('Conecte sua conta Spotify para continuar.');
    }

    const user = await User.findById(userId).select('+spotifyToken +spotifyRefreshToken');
    if (!user || (!user.spotifyToken && !user.spotifyRefreshToken)) {
        throw new Error('Conecte sua conta Spotify para continuar.');
    }

    const expiresAt = user.spotifyTokenExpiresAt ? new Date(user.spotifyTokenExpiresAt).getTime() : 0;
    const shouldRefresh = user.spotifyRefreshToken
        && (!user.spotifyToken || !expiresAt || expiresAt - Date.now() < 60_000);

    if (shouldRefresh) {
        return refreshSpotifyAccessToken(user);
    }

    if (expiresAt && expiresAt <= Date.now()) {
        throw new Error('A sessão do Spotify expirou. Reconecte sua conta.');
    }

    return user.spotifyToken;
};

export const getSpotifyAccessTokenForUser = async (userId) => {
    requireSpotifyConfig();
    return resolveConnectedAccessToken(userId);
};

export const getConnectedSpotifyAccessTokenForUser = async (userId) => {
    requireSpotifyConfig();
    return resolveConnectedAccessToken(userId);
};
