import { jest } from '@jest/globals';
import { searchWithStrategies } from '../src/services/matching/searchOrchestrator.js';

const track = () => ({ name: 'Luz do Sol', artist: 'Ana Silva', durationMs: 180000, album: 'Aurora' });
const candidate = (fields = {}) => ({ id: 'original', name: 'Luz do Sol', artists: ['Ana Silva'], durationMs: 180000, ...fields });
const run = (source, searchCandidates, options = {}) => searchWithStrategies({
    track: source, searchClient: { searchCandidates }, getMatchId: (item) => item.id, ...options,
});

it('resultado fraco aciona fallback sem relaxar artista e versão', async () => {
    const search = jest.fn().mockResolvedValueOnce([candidate({ id: 'wrong', artists: ['Outro'] })])
        .mockResolvedValueOnce([candidate()]);
    const result = await run(track(), search);
    expect(result.matching.decision).toBe('accepted');
    expect(result.id).toBe('original');
    expect(search).toHaveBeenCalledTimes(2);
});

it('resultados empatados continuam em revisão até esgotar estratégias', async () => {
    const search = jest.fn(async () => [candidate(), candidate({ id: 'different' })]);
    const result = await run(track(), search, { maxQueries: 2 });
    expect(result.matching.decision).toBe('needs_review');
    expect(result.matching.reasons).toContain('ambiguous_candidates');
    expect(search).toHaveBeenCalledTimes(2);
});

it('deduplica o mesmo ID e encerra cedo somente com evidência suficiente', async () => {
    const search = jest.fn(async () => [candidate(), candidate()]);
    const result = await run(track(), search);
    expect(result.matching.decision).toBe('accepted');
    expect(result.matching.candidates).toHaveLength(1);
    expect(search).toHaveBeenCalledTimes(1);
});

it('retoma a estratégia que falhou sem refazer consultas concluídas', async () => {
    const source = track();
    const search = jest.fn().mockResolvedValueOnce([candidate({ artists: ['Outro'] })])
        .mockRejectedValueOnce(Object.assign(new Error('Indisponível'), { status: 503 }))
        .mockResolvedValueOnce([candidate()]);
    await expect(run(source, search)).rejects.toThrow('Indisponível');
    expect(source.searchCheckpoint.completed).toEqual(['full']);
    const result = await run(source, search);
    expect(result.matching.decision).toBe('accepted');
    expect(search.mock.calls[1][0].strategy.id).toBe(search.mock.calls[2][0].strategy.id);
    expect(result.matching.queries).toBe(3);
});

it('falha técnica ao esgotar orçamento nunca vira ausência de catálogo', async () => {
    const source = track();
    const search = jest.fn().mockRejectedValue(Object.assign(new Error('Indisponível'), { status: 503 }));
    await expect(run(source, search, { maxQueries: 1 })).rejects.toThrow('Indisponível');
    await expect(run(source, search, { maxQueries: 1 })).rejects.toMatchObject({ code: 'ETIMEDOUT' });
    expect(search).toHaveBeenCalledTimes(1);
});

it('timeout e rate limit são erros operacionais', async () => {
    await expect(run(track(), () => new Promise(() => {}), { timeoutMs: 5 })).rejects.toMatchObject({ code: 'ETIMEDOUT' });
    const error = Object.assign(new Error('Cota'), { status: 429, retryAfter: '60' });
    await expect(run(track(), async () => { throw error; })).rejects.toBe(error);
});

it('mudança de identidade invalida checkpoint', async () => {
    const source = track();
    const first = jest.fn(async () => []);
    await run(source, first);
    source.name = 'Outra música';
    const second = jest.fn(async () => []);
    await run(source, second);
    expect(second).toHaveBeenCalled();
});

it('ponte antiga identifica evidência limitada e não aceita ID com score isolado', async () => {
    const result = await searchWithStrategies({ track: track(),
        searchClient: { searchBestMatch: async () => ({ id: 'opaque', matchScore: 100 }) }, getMatchId: (item) => item.id });
    expect(result.matching).toMatchObject({ decision: 'needs_review', limitedEvidence: true });
});

it('limita requisições HTTP internas de uma estratégia e cancela chamadas após timeout', async () => {
    const { fetchWithSearchBudget } = await import('../src/services/matching/requestBudget.js');
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async () => ({ ok: true }));
    try {
        const search = async () => {
            await fetchWithSearchBudget('https://catalogo-ficticio.invalid/1');
            await fetchWithSearchBudget('https://catalogo-ficticio.invalid/2');
            await fetchWithSearchBudget('https://catalogo-ficticio.invalid/3');
            return [];
        };
        await expect(run(track(), search, { maxRequests: 2 })).rejects.toMatchObject({ code: 'ETIMEDOUT' });
        expect(global.fetch).toHaveBeenCalledTimes(2);
    } finally { global.fetch = originalFetch; jest.useRealTimers(); }
});

it('requisições concorrentes ao mesmo destino respeitam o espaçamento', async () => {
    const { withSearchRequestBudget, fetchWithSearchBudget } = await import('../src/services/matching/requestBudget.js');
    const originalFetch = global.fetch;
    const starts = [];
    jest.useFakeTimers();
    global.fetch = jest.fn(async () => { starts.push(Date.now()); return { ok: true }; });
    try {
        const scope = `concorrencia-${Date.now()}`;
        const requests = Promise.all([0, 1, 2].map(() => withSearchRequestBudget({ checkpoint: { requests: 0 }, maxRequests: 2, scope, delayMs: 15 },
            () => fetchWithSearchBudget('https://catalogo-ficticio.invalid/'))));
        await jest.advanceTimersByTimeAsync(45);
        await requests;
        expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(10);
        expect(starts[2] - starts[1]).toBeGreaterThanOrEqual(10);
    } finally { global.fetch = originalFetch; jest.useRealTimers(); }
});

it('pausa de outra faixa impede novas estratégias sem virar resultado ausente', async () => {
    let stopped = null;
    const error = Object.assign(new Error('Cota do destino'), { status: 429 });
    const search = jest.fn(async () => {
        stopped = error;
        return [candidate({ artists: ['Outro artista'] })];
    });
    await expect(run(track(), search, { getStopError: () => stopped })).rejects.toBe(error);
    expect(search).toHaveBeenCalledTimes(1);
});
