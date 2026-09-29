import { readStore, writeStore } from './jsonStore.js';

/**
 * Credenciais de provedores salvas pelo painel (cookies, tokens colados),
 * cifradas em `data/provider-credentials.json`. Tokens OAuth do Spotify
 * continuam no model `User` por compatibilidade.
 */
const STORE = 'provider-credentials.json';

export const getProviderCredentials = (providerId) => readStore(STORE, {})[providerId] || null;

export const setProviderCredentials = (providerId, credentials) => {
    const all = readStore(STORE, {});
    all[providerId] = { ...credentials, updatedAt: new Date().toISOString() };
    writeStore(STORE, all);
};

export const clearProviderCredentials = (providerId) => {
    const all = readStore(STORE, {});
    delete all[providerId];
    writeStore(STORE, all);
};
