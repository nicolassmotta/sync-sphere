import os from 'node:os';
import { readStore, validateEssentialStores } from '../../storage/jsonStore.js';
import { listProviders } from '../../providers/registry.js';

/** Resumo por lista permitida, sem logs, nomes de playlists ou credenciais. */
export const buildDiagnostic = () => {
    let storage = 'pronto';
    try { validateEssentialStores(); } catch { storage = 'indisponível'; }
    let transfers = [];
    let jobs = [];
    try {
        transfers = readStore('transfers.json', []);
        jobs = readStore('queue.json', []);
    } catch { /* O relatório continua útil quando os dados não abrem. */ }
    let credentials = {};
    let account = {};
    try {
        credentials = readStore('provider-credentials.json', {});
        account = readStore('credentials.json', {});
    } catch { /* A ausência do resumo não expõe o conteúdo do erro. */ }
    const envCredentials = {
        spotify: 'SPOTIFY_CLIENT_ID', youtubeMusic: 'YTMUSIC_COOKIE', deezer: 'DEEZER_ARL',
        tidal: 'TIDAL_CLIENT_ID', appleMusic: 'APPLE_TEAM_ID', soundcloud: 'SOUNDCLOUD_OAUTH_TOKEN',
    };
    const counts = {};
    for (const transfer of transfers) {
        const status = ['pending', 'processing', 'paused', 'needs_auth', 'completed', 'failed'].includes(transfer.status)
            ? transfer.status : 'desconhecido';
        counts[status] = (counts[status] || 0) + 1;
    }
    return {
        format: 'syncsphere-diagnostic',
        version: 1,
        generatedAt: new Date().toISOString(),
        application: { version: '1.1.0', node: process.version, platform: os.platform(), architecture: os.arch() },
        storage,
        queue: { jobs: jobs.length },
        transfers: { total: transfers.length, statuses: counts },
        providers: listProviders().map(({ id, auth }) => ({
            id,
            connectionMethod: auth.type,
            credentialStored: Boolean(id === 'spotify' ? account.spotifyToken : credentials[id]),
            environmentConfigured: Boolean(envCredentials[id] && process.env[envCredentials[id]]),
        })),
        excluded: ['credenciais', 'chaves', 'cookies', 'tokens', 'logs', 'caminhos locais', 'nomes de playlists', 'dados de conta'],
    };
};
