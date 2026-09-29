import { writeStore } from '../src/storage/jsonStore.js';
import TransferMetrics, {
    estimateTransferSeconds,
    getProviderStats,
} from '../src/services/transfer/TransferMetrics.js';
import { classifyProviderError, ERROR_KINDS, getRetryAfterMs } from '../src/errors/providerErrors.js';

describe('TransferMetrics', () => {
    beforeEach(() => {
        writeStore('provider-stats.json', {});
    });

    it('ajusta a média de busca e estima o tempo restante', () => {
        const metrics = new TransferMetrics({ provider: 'youtubeMusic' });
        for (let index = 0; index < 80; index += 1) metrics.recordSearch(2000);

        expect(Math.round(metrics.searchMs)).toBe(2000);
        expect(metrics.tracksPerMinute()).toBe(30);
        // 30 buscas de 2 s + 1 lote de inserção (2 s padrão).
        expect(metrics.estimateRemainingSeconds({ remainingSearches: 30, pendingInserts: 50 })).toBe(62);
    });

    it('divide o tempo pela concorrência de busca', () => {
        const metrics = new TransferMetrics({ provider: 'spotify', concurrency: 2 });
        for (let index = 0; index < 80; index += 1) metrics.recordSearch(1000);

        expect(metrics.estimateRemainingSeconds({ remainingSearches: 10 })).toBe(5);
    });

    it('persiste a média por plataforma para estimar antes de começar', () => {
        const metrics = new TransferMetrics({ provider: 'youtubeMusic' });
        for (let index = 0; index < 80; index += 1) metrics.recordSearch(3000);
        metrics.persist();

        expect(getProviderStats('youtubeMusic').searchMs).toBe(3000);
        // 100 faixas x 3 s + 1 lote (2 s) + preparo (3 s).
        expect(estimateTransferSeconds({ provider: 'youtubeMusic', trackCount: 100 })).toBe(305);
    });
});

describe('classifyProviderError', () => {
    it.each([
        [{ response: { status: 429 } }, ERROR_KINDS.RATE_LIMITED],
        [new Error('Sign in to confirm you’re not a bot'), ERROR_KINDS.RATE_LIMITED],
        [new Error('cota excedida'), ERROR_KINDS.RATE_LIMITED],
        [{ status: 401, message: 'The access token expired' }, ERROR_KINDS.AUTH],
        [new Error('invalid_grant'), ERROR_KINDS.AUTH],
        [new Error('YTMUSIC_COOKIE incompleto: faltando SID.'), ERROR_KINDS.AUTH],
        [{ status: 503, message: 'Service Unavailable' }, ERROR_KINDS.TRANSIENT],
        [Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }), ERROR_KINDS.TRANSIENT],
        [{ name: 'SpotifyPlaylistAccessError', status: 403, message: 'Forbidden' }, ERROR_KINDS.PERMANENT],
        [{ status: 404, message: 'Not found' }, ERROR_KINDS.PERMANENT],
    ])('classifica %p como %s', (error, kind) => {
        expect(classifyProviderError(error)).toBe(kind);
    });

    it('lê Retry-After em segundos do cabeçalho', () => {
        expect(getRetryAfterMs({ response: { headers: { 'retry-after': '30' } } })).toBe(30_000);
        expect(getRetryAfterMs({ retryAfter: '5' })).toBe(5000);
        expect(getRetryAfterMs(new Error('x'))).toBeNull();
    });
});
