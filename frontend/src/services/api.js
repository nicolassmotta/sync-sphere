import axios from 'axios';

const ENV_API_URL = import.meta.env.VITE_API_URL;
const isBrowser = typeof window !== 'undefined';
const localDevPorts = new Set(['5173', '5174', '4173']);
const defaultApiUrl = isBrowser && localDevPorts.has(window.location.port)
    ? 'http://localhost:8000/api/v1'
    : '/api/v1';
const FALLBACK_BASE_URLS = [
    defaultApiUrl,
    'http://localhost:8000/api/v1',
    'http://localhost:4001/api/v1',
];

const uniqueLocalFallbacks = [...new Set(FALLBACK_BASE_URLS)];
const apiCandidates = ENV_API_URL ? [ENV_API_URL] : uniqueLocalFallbacks;

let candidateIndex = 0;
export let API_BASE_URL = apiCandidates[candidateIndex];

const resolveApiOrigin = (baseUrl) => {
    if (/^https?:\/\//i.test(baseUrl)) return new URL(baseUrl).origin;
    return isBrowser ? window.location.origin : '';
};

export let API_ORIGIN = resolveApiOrigin(API_BASE_URL);

const updateActiveBaseUrl = (nextBaseUrl) => {
    API_BASE_URL = nextBaseUrl;
    API_ORIGIN = resolveApiOrigin(nextBaseUrl);
};

const shouldSkipAuthRedirect = (requestUrl = '') => {
    return [
        '/auth/login',
        '/auth/me',
    ].some((path) => requestUrl.includes(path));
};

// Cria uma instância padrão configurada para o back-end
const api = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true, // MANDATÓRIO: garante que os cookies HTTPOnly transitem entre front-end e back-end.
});

// Interceptor de erro global: encerra a sessão quando o token expira ou recebe 401.
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const requestConfig = error.config || {};
        const isNetworkError = !error.response;
        const hasEnvUrl = Boolean(ENV_API_URL);
        const hasMoreCandidates = candidateIndex < apiCandidates.length - 1;
        const wasRetried = Boolean(requestConfig.__fallbackRetried);

        // No desenvolvimento local, tenta outra porta quando houver falha de rede sem resposta
        if (isNetworkError && !hasEnvUrl && hasMoreCandidates && !wasRetried) {
            candidateIndex += 1;
            const nextBaseUrl = apiCandidates[candidateIndex];
            updateActiveBaseUrl(nextBaseUrl);
            api.defaults.baseURL = nextBaseUrl;

            requestConfig.__fallbackRetried = true;
            requestConfig.baseURL = nextBaseUrl;
            return api(requestConfig);
        }

        const requestUrl = error?.config?.url || '';
        const skipAuthRedirect = shouldSkipAuthRedirect(requestUrl);
        const isAlreadyOnLogin = window.location.pathname === '/login';

        if (error.response && error.response.status === 401 && !skipAuthRedirect && !isAlreadyOnLogin) {
             // Redirecionamento forçado quando o cookie de autenticação é rejeitado.
             window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;

/**
 * URLs devolvidas pelo back-end como caminho (`/api/v1/...`) viram absolutas,
 * para funcionar também no Vite em outra porta.
 */
export const resolveApiUrl = (url) => (url && url.startsWith('/') ? `${API_ORIGIN}${url}` : url);
