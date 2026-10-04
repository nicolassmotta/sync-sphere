import { AsyncLocalStorage } from 'node:async_hooks';

const context = new AsyncLocalStorage();
const slots = new Map();
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const throttleSearch = async (scope, delayMs) => {
    if (!(delayMs > 0)) return;
    const now = Date.now();
    const scheduled = Math.max(now, slots.get(scope) || 0);
    slots.set(scope, scheduled + delayMs);
    if (scheduled > now) await wait(scheduled - now);
};

export const withSearchRequestBudget = (budget, action) => context.run(budget, action);

export const consumeSearchRequest = async () => {
    const budget = context.getStore();
    if (!budget) return null;
    budget.signal?.throwIfAborted();
    const stopped = budget.getStopError?.();
    if (stopped) throw stopped;
    if ((budget.checkpoint.requests || 0) >= budget.maxRequests) {
        const error = new Error('O orçamento de requisições ao catálogo foi esgotado.');
        error.kind = 'permanent';
        error.code = 'ETIMEDOUT';
        throw error;
    }
    budget.checkpoint.requests = (budget.checkpoint.requests || 0) + 1;
    await throttleSearch(budget.scope, budget.delayMs);
    budget.signal?.throwIfAborted();
    const stoppedAfterDelay = budget.getStopError?.();
    if (stoppedAfterDelay) throw stoppedAfterDelay;
    return budget.signal;
};

/** Fora de uma busca, mantém o comportamento normal do cliente HTTP. */
export const fetchWithSearchBudget = async (url, options = {}) => {
    const signal = await consumeSearchRequest();
    return globalThis.fetch(url, { ...options, ...(signal ? { signal } : {}) });
};

export const withCatalogTimeout = async (budget, action, timeoutMs = 15000) => {
    const controller = new AbortController();
    let timer;
    try {
        return await Promise.race([
            withSearchRequestBudget({ ...budget, signal: controller.signal }, action),
            new Promise((_, reject) => {
                timer = setTimeout(() => {
                    const error = new Error('A consulta ao catálogo excedeu o tempo máximo.');
                    error.code = 'ETIMEDOUT';
                    controller.abort(error);
                    reject(error);
                }, timeoutMs);
            }),
        ]);
    } finally { clearTimeout(timer); }
};
