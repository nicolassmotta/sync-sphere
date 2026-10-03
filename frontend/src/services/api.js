import axios from 'axios';
import { currentLocale } from '../i18n';

const ENV_API_URL = import.meta.env.VITE_API_URL;
const isBrowser = typeof window !== 'undefined';
const localDevPorts = new Set(['5173', '5174', '4173']);
const defaultApiUrl = isBrowser && localDevPorts.has(window.location.port)
    ? 'http://localhost:8000/api/v1'
    : '/api/v1';

// Uma origem explícita evita conectar outra instalação após falha de rede.
export const API_BASE_URL = ENV_API_URL || defaultApiUrl;
export const API_ORIGIN = /^https?:\/\//i.test(API_BASE_URL)
    ? new URL(API_BASE_URL).origin
    : isBrowser ? window.location.origin : '';

const api = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
});

api.interceptors.request.use((config) => {
    config.headers['Accept-Language'] = currentLocale();
    return config;
});

// O aplicativo não tem login próprio. Um 401 orienta reconexão na tela atual.
api.interceptors.response.use((response) => response, (error) => Promise.reject(error));
export default api;

/** Caminhos de download também funcionam quando o Vite usa outra porta. */
export const resolveApiUrl = (url) => (url && url.startsWith('/') ? `${API_ORIGIN}${url}` : url);
