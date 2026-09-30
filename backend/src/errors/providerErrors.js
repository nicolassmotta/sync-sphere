/**
 * Classificação dos erros vindos das plataformas de música. A transferência
 * decide o que fazer com cada faixa a partir do tipo: tentar de novo agora,
 * pausar até o bloqueio passar, esperar reconexão ou desistir.
 */
export const ERROR_KINDS = {
    RATE_LIMITED: 'rate_limited',
    AUTH: 'auth',
    TRANSIENT: 'transient',
    NOT_FOUND: 'not_found',
    PERMANENT: 'permanent',
};

const RATE_LIMIT_PATTERN = /rate limit|too many requests|quota|cota|excedid|exceeded|captcha|not a bot|unusual traffic|tr[aá]fego incomum|throttl/i;
const AUTH_PATTERN = /invalid_grant|refresh token|reconecte|conecte sua conta|sess[aã]o do .* expirou|expired|unauthorized|n[aã]o autorizado|cookie|login required|sign in required/i;
const TRANSIENT_PATTERN = /econnreset|econnrefused|etimedout|eai_again|enotfound|socket hang up|timeout|timed out|network|fetch failed|bad gateway|service unavailable/i;
const TRANSIENT_CODES = new Set(['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND', 'ECONNABORTED']);

const getErrorStatus = (error) => Number(error?.status ?? error?.response?.status) || null;

const getHeader = (headers, name) => {
    if (!headers) return undefined;
    if (typeof headers.get === 'function') return headers.get(name);
    return headers[name] ?? headers[name.toLowerCase()];
};

/**
 * Tempo sugerido pela plataforma antes de tentar de novo, em milissegundos.
 * Aceita `retryAfterMs`, `retryAfter` (segundos) ou o cabeçalho `Retry-After`.
 */
export const getRetryAfterMs = (error) => {
    if (Number.isFinite(error?.retryAfterMs)) return error.retryAfterMs;

    const raw = error?.retryAfter ?? getHeader(error?.response?.headers, 'retry-after');
    if (raw === undefined || raw === null || raw === '') return null;

    const seconds = Number(raw);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

    const date = Date.parse(raw);
    return Number.isFinite(date) ? Math.max(0, date - Date.now()) : null;
};

export const classifyProviderError = (error) => {
    if (error?.kind && Object.values(ERROR_KINDS).includes(error.kind)) return error.kind;
    if (error?.name === 'SpotifyPlaylistAccessError') return ERROR_KINDS.PERMANENT;

    const status = getErrorStatus(error);
    const message = String(error?.message || '');

    if (status === 429 || RATE_LIMIT_PATTERN.test(message)) return ERROR_KINDS.RATE_LIMITED;
    if (status === 401 || AUTH_PATTERN.test(message)) return ERROR_KINDS.AUTH;
    if (status && status >= 500) return ERROR_KINDS.TRANSIENT;
    if (TRANSIENT_CODES.has(error?.code) || TRANSIENT_PATTERN.test(message)) return ERROR_KINDS.TRANSIENT;
    if ((status && status >= 400) || error?.isPermanentTransferError) return ERROR_KINDS.PERMANENT;

    // Erro desconhecido durante a busca: vale uma nova tentativa antes de desistir.
    return ERROR_KINDS.TRANSIENT;
};

/**
 * A plataforma bloqueou as buscas (limite de requisições, captcha, cota). A
 * transferência pausa e volta sozinha em `resumeAt`.
 */
export class TransferPausedError extends Error {
    constructor(message, { resumeAt, reason = ERROR_KINDS.RATE_LIMITED, cause } = {}) {
        super(message);
        this.name = 'TransferPausedError';
        this.resumeAt = resumeAt;
        this.reason = reason;
        this.cause = cause;
    }
}

/**
 * Token ou cookie inválido. A transferência espera a integração ser
 * reconectada para continuar de onde parou.
 */
export class TransferNeedsAuthError extends Error {
    constructor(message, { cause } = {}) {
        super(message);
        this.name = 'TransferNeedsAuthError';
        this.cause = cause;
    }
}
