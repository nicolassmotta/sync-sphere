import { readStore, writeStore } from '../../storage/jsonStore.js';
import AppError from '../../utils/AppError.js';

const STORE = 'provider-settings.json';
const variableNames = { spotify: 'SPOTIFY_CLIENT_ID', tidal: 'TIDAL_CLIENT_ID' };
export const applyProviderSettings = () => {
    const settings = readStore(STORE, {});
    for (const [id, values] of Object.entries(settings)) {
        if (Object.hasOwn(variableNames, id) && typeof values?.clientId === 'string') process.env[variableNames[id]] = values.clientId;
    }
};

export const saveProviderSetup = ({ providerId, clientId }) => {
    if (!variableNames[providerId]) throw new AppError('Esta plataforma não usa configuração de aplicativo pelo painel.', 400);
    if (readStore('queue.json', []).length) throw new AppError('Aguarde a fila terminar antes de alterar o aplicativo da conexão.', 409);
    const credentials = providerId === 'spotify' ? readStore('credentials.json', {}) : readStore('provider-credentials.json', {})[providerId];
    if (credentials?.spotifyToken || credentials?.spotifyRefreshToken || credentials?.accessToken || credentials?.refreshToken) throw new AppError('Desconecte a conta antes de alterar o Client ID do aplicativo.', 409);
    const settings = readStore(STORE, {});
    settings[providerId] = { clientId };
    writeStore(STORE, settings);
    process.env[variableNames[providerId]] = clientId;
    return { configured: true };
};

export const getProviderSetup = (providerId) => ({
    configured: Boolean(process.env[variableNames[providerId]]),
    redirectUri: process.env[`${providerId.toUpperCase()}_REDIRECT_URI`]
        || `http://127.0.0.1:${process.env.PORT || 8000}/api/v1/integrations/${providerId}/callback`,
});
