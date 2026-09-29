import { readStore, writeStore } from '../../storage/jsonStore.js';

/**
 * Métricas de velocidade usadas para estimar quanto falta. Guarda a média
 * móvel exponencial do tempo de cada busca (incluindo o atraso configurado
 * entre buscas) e do tempo de inserção por lote. As médias por plataforma
 * ficam em `data/provider-stats.json` para estimar antes de começar.
 */
const PROVIDER_STATS_STORE = 'provider-stats.json';
const EWMA_ALPHA = 0.2;
const PLAYLIST_SETUP_MS = 3000;

export const DEFAULT_PROVIDER_STATS = {
    youtubeMusic: { searchMs: 1500, insertChunkMs: 2000, chunkSize: 100 },
    spotify: { searchMs: 600, insertChunkMs: 800, chunkSize: 100 },
    file: { searchMs: 5, insertChunkMs: 50, chunkSize: 100 },
};

const FALLBACK_STATS = { searchMs: 1000, insertChunkMs: 1500, chunkSize: 100 };

const ewma = (current, sample, alpha = EWMA_ALPHA) => (
    Number.isFinite(current) && current > 0 ? current + alpha * (sample - current) : sample
);

export const getProviderStats = (provider) => {
    const stored = readStore(PROVIDER_STATS_STORE, {})[provider] || {};
    return { ...FALLBACK_STATS, ...(DEFAULT_PROVIDER_STATS[provider] || {}), ...stored };
};

export const saveProviderStats = (provider, stats) => {
    const all = readStore(PROVIDER_STATS_STORE, {});
    all[provider] = { ...(all[provider] || {}), ...stats, updatedAt: new Date().toISOString() };
    writeStore(PROVIDER_STATS_STORE, all);
};

/**
 * Estimativa em segundos para buscar e inserir `trackCount` faixas.
 */
export const estimateTransferSeconds = ({ provider, trackCount, concurrency = 1 }) => {
    if (!trackCount) return 0;
    const stats = getProviderStats(provider);
    const searchMs = (trackCount * stats.searchMs) / Math.max(1, concurrency);
    const insertMs = Math.ceil(trackCount / stats.chunkSize) * stats.insertChunkMs;
    return Math.ceil((searchMs + insertMs + PLAYLIST_SETUP_MS) / 1000);
};

export default class TransferMetrics {
    constructor({ provider, concurrency = 1, now = () => Date.now() } = {}) {
        const stats = getProviderStats(provider);
        this.provider = provider;
        this.concurrency = Math.max(1, concurrency);
        this.now = now;
        this.searchMs = stats.searchMs;
        this.insertChunkMs = stats.insertChunkMs;
        this.chunkSize = stats.chunkSize;
        this.samples = 0;
        this.startedAt = now();
    }

    recordSearch(durationMs) {
        if (!Number.isFinite(durationMs) || durationMs < 0) return;
        // Primeiras amostras pesam mais para a estimativa se ajustar rápido à rede atual.
        this.searchMs = ewma(this.searchMs, durationMs, this.samples < 5 ? 0.4 : EWMA_ALPHA);
        this.samples += 1;
    }

    recordInsertChunk(durationMs) {
        if (!Number.isFinite(durationMs) || durationMs < 0) return;
        this.insertChunkMs = ewma(this.insertChunkMs, durationMs);
    }

    estimateRemainingSeconds({ remainingSearches = 0, pendingInserts = 0 } = {}) {
        const searchMs = (remainingSearches * this.searchMs) / this.concurrency;
        const insertMs = Math.ceil(pendingInserts / this.chunkSize) * this.insertChunkMs;
        return Math.ceil((searchMs + insertMs) / 1000);
    }

    tracksPerMinute() {
        if (!this.searchMs) return null;
        return Math.round((60000 / this.searchMs) * this.concurrency * 10) / 10;
    }

    persist() {
        if (!this.samples) return;
        saveProviderStats(this.provider, {
            searchMs: Math.round(this.searchMs),
            insertChunkMs: Math.round(this.insertChunkMs),
            chunkSize: this.chunkSize,
        });
    }
}
