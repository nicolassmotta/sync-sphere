import { fetchWithSearchBudget as fetch } from '../../services/matching/requestBudget.js';
/**
 * Cliente da API do site do SoundCloud (api-v2), a mesma usada pelo
 * soundcloud.com. Não oficial: a API oficial só libera credenciais para
 * contas Artist Pro.
 *
 * - `client_id`: lido do JavaScript público do soundcloud.com (cache de 24 h)
 *   ou de SOUNDCLOUD_CLIENT_ID. Basta para ler playlists públicas e buscar.
 * - `oauth_token`: cookie da sessão logada, para ler a conta e escrever.
 */
const API_BASE = 'https://api-v2.soundcloud.com';
const SITE = 'https://soundcloud.com';
const CLIENT_ID_TTL_MS = 24 * 60 * 60 * 1000;
const CLIENT_ID_PATTERN = /client_id\s*[:=]\s*"([A-Za-z0-9]{32})"/;
export const TRACK_IDS_BATCH = 50;

let cachedClientId = null;

const fetchText = async (url) => {
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (SyncSphere)' } });
    if (!response.ok) throw new Error(`soundcloud.com respondeu HTTP ${response.status}.`);
    return response.text();
};

export const scrapeClientId = async () => {
    const html = await fetchText(SITE);
    const scripts = [...new Set(html.match(/https:\/\/a-v2\.sndcdn\.com\/assets\/[^"']+\.js/g) || [])].reverse();

    for (const script of scripts) {
        const match = (await fetchText(script)).match(CLIENT_ID_PATTERN);
        if (match) return match[1];
    }

    const error = new Error('Não foi possível obter o client_id público do soundcloud.com. Defina SOUNDCLOUD_CLIENT_ID no .env.');
    error.status = 503;
    throw error;
};

export const getClientId = async ({ refresh = false } = {}) => {
    if (process.env.SOUNDCLOUD_CLIENT_ID) return process.env.SOUNDCLOUD_CLIENT_ID;
    if (!refresh && cachedClientId && Date.now() - cachedClientId.at < CLIENT_ID_TTL_MS) return cachedClientId.value;
    cachedClientId = { value: await scrapeClientId(), at: Date.now() };
    return cachedClientId.value;
};

export const resetSoundcloudCacheForTests = () => {
    cachedClientId = null;
};

/**
 * Requisição à api-v2. `oauthToken` autentica a conta; 401 sem token costuma
 * ser client_id trocado pelo SoundCloud, então renova uma vez e repete.
 */
export const soundcloudRequest = async (path, { params = {}, method = 'GET', body, oauthToken, retried = false } = {}) => {
    const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`);
    url.searchParams.set('client_id', await getClientId());
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    });

    const headers = { Accept: 'application/json' };
    if (oauthToken) headers.Authorization = `OAuth ${oauthToken}`;
    if (body) headers['Content-Type'] = 'application/json';

    const response = await fetch(url.toString(), { method, headers, body: body ? JSON.stringify(body) : undefined });

    if (response.status === 401 && !oauthToken && !retried && !process.env.SOUNDCLOUD_CLIENT_ID) {
        await getClientId({ refresh: true });
        return soundcloudRequest(path, { params, method, body, oauthToken, retried: true });
    }

    const data = await response.json().catch(() => null);
    if (!response.ok) {
        const error = new Error(
            data?.errors?.map((item) => item.error_message).filter(Boolean).join('; ')
            || `SoundCloud respondeu HTTP ${response.status}.`
        );
        error.status = response.status === 403 && oauthToken ? 401 : response.status;
        error.retryAfter = response.headers?.get?.('retry-after') ?? null;
        throw error;
    }
    return data;
};
