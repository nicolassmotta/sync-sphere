import User from '../../models/User.js';

const SPOTIFY_SCOPES = [
    'playlist-read-private',
    'playlist-read-collaborative',
];

const requireSpotifyConfig = () => {
    if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
        throw new Error('SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET precisam estar configurados.');
    }
};

export const getSpotifyScopes = () => SPOTIFY_SCOPES;

export const buildSpotifyAuthorizationUrl = (state) => {
    requireSpotifyConfig();

    const redirectUri = process.env.SPOTIFY_REDIRECT_URI;
    if (!redirectUri) {
        throw new Error('SPOTIFY_REDIRECT_URI precisa estar configurado.');
    }

    const params = new URLSearchParams({
        response_type: 'code',
        client_id: process.env.SPOTIFY_CLIENT_ID,
        scope: SPOTIFY_SCOPES.join(' '),
        redirect_uri: redirectUri,
        state,
        show_dialog: 'false',
    });

    return `https://accounts.spotify.com/authorize?${params.toString()}`;
};

const exchangeSpotifyToken = async (params) => {
    requireSpotifyConfig();

    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            Authorization: `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(params),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error_description || data.error || 'Falha ao autenticar com Spotify.');
    }

    return data;
};

export const exchangeSpotifyCode = (code) => {
    if (!process.env.SPOTIFY_REDIRECT_URI) {
        throw new Error('SPOTIFY_REDIRECT_URI precisa estar configurado.');
    }

    return exchangeSpotifyToken({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
    });
};

export const refreshSpotifyAccessToken = async (user) => {
    if (!user.spotifyRefreshToken) {
        throw new Error('Usuário não possui refresh token do Spotify.');
    }

    const tokenData = await exchangeSpotifyToken({
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

export const getSpotifyAccessTokenForUser = async (userId) => {
    requireSpotifyConfig();

    if (userId) {
        const user = await User.findById(userId).select('+spotifyToken +spotifyRefreshToken');
        const hasToken = Boolean(user?.spotifyToken);
        const hasRefreshToken = Boolean(user?.spotifyRefreshToken);

        if (hasToken) {
            const expiresAt = user.spotifyTokenExpiresAt ? new Date(user.spotifyTokenExpiresAt).getTime() : 0;
            if (expiresAt && expiresAt <= Date.now() && !user.spotifyRefreshToken) {
                const tokenData = await exchangeSpotifyToken({ grant_type: 'client_credentials' });
                return tokenData.access_token;
            }

            const shouldRefresh = user.spotifyRefreshToken && (!expiresAt || expiresAt - Date.now() < 60_000);
            return shouldRefresh ? await refreshSpotifyAccessToken(user) : user.spotifyToken;
        }

        if (hasRefreshToken) {
            return refreshSpotifyAccessToken(user);
        }
    }

    const tokenData = await exchangeSpotifyToken({ grant_type: 'client_credentials' });
    return tokenData.access_token;
};

export const getConnectedSpotifyAccessTokenForUser = async (userId) => {
    requireSpotifyConfig();

    const user = await User.findById(userId).select('+spotifyToken +spotifyRefreshToken');
    if (!user) {
        throw new Error('Usuário não encontrado para consultar Spotify.');
    }

    if (!user.spotifyToken && !user.spotifyRefreshToken) {
        throw new Error('Conecte sua conta Spotify para listar suas playlists.');
    }

    const expiresAt = user.spotifyTokenExpiresAt ? new Date(user.spotifyTokenExpiresAt).getTime() : 0;
    const shouldRefresh = user.spotifyRefreshToken && (!user.spotifyToken || !expiresAt || expiresAt - Date.now() < 60_000);

    if (shouldRefresh) {
        return refreshSpotifyAccessToken(user);
    }

    if (expiresAt && expiresAt <= Date.now() && !user.spotifyRefreshToken) {
        throw new Error('A sessão do Spotify expirou. Reconecte sua conta.');
    }

    return user.spotifyToken;
};
