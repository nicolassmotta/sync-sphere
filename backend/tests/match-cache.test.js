import { decideCandidates } from '../src/services/matching/decision.js';
import fs from 'node:fs';
import { jest } from '@jest/globals';
import MatchCache, { MATCH_CACHE_TTL_MS, MATCH_CACHE_LIMIT, resetMatchCacheForTests } from '../src/services/matching/MatchCache.js';
import TrackMatcher from '../src/services/transfer/TrackMatcher.js';
import { buildTransferTracks } from '../src/services/transfer/TransferTrackStore.js';
import { removeStore } from '../src/storage/jsonStore.js';
import { dataFile } from '../src/config/paths.js';

const track = { name: 'Música', artist: 'Artista', durationMs: 180000 };
const resultFor = (source) => ({ targetId: 'destino-privado', matchScore: 100, matching: decideCandidates(source, [{ ...source, id: 'destino-privado' }]) });
const result = resultFor(track);

beforeEach(() => { resetMatchCacheForTests(); removeStore('match-cache.json'); });
afterEach(() => { resetMatchCacheForTests(); jest.restoreAllMocks(); });

it('reutiliza correspondência após recriar o cache e persiste dados cifrados', () => {
    const cache = new MatchCache({ scope: 'spotify' });
    cache.set(track, result);
    cache.flush();
    resetMatchCacheForTests();
    expect(new MatchCache({ scope: 'spotify' }).get(track)).toEqual(result);
    expect(fs.readFileSync(dataFile('match-cache.json'), 'utf8')).not.toContain(result.targetId);
});

it('separa plataformas, contas, versões e durações', () => {
    const cache = new MatchCache({ scope: ['spotify', 'local'] });
    cache.set(track, result);
    expect(new MatchCache({ scope: ['youtubeMusic', 'local'] }).get(track)).toBeNull();
    expect(new MatchCache({ scope: ['spotify', 'outra'] }).get(track)).toBeNull();
    expect(cache.get({ ...track, name: 'Música (Ao Vivo)' })).toBeNull();
    expect(cache.get({ ...track, durationMs: 210000 })).toBeNull();
});

it('refaz a busca depois de sete dias', () => {
    let now = 1000;
    const cache = new MatchCache({ scope: 'spotify', now: () => now });
    cache.set(track, result);
    now += MATCH_CACHE_TTL_MS;
    expect(cache.get(track)).toBeNull();
});

it('evita nova chamada ao provedor e mantém as métricas de busca externa', async () => {
    const matcher = new TrackMatcher({ delayMs: 0 });
    const searchClient = { searchBestMatch: jest.fn().mockResolvedValue({ ...track, id: 'faixa', matchScore: 90 }) };
    const metrics = { recordSearch: jest.fn() };
    const run = async () => {
        const tracks = buildTransferTracks([track]);
        await matcher.matchTracks({ searchClient, tracks, metrics, matchCache: new MatchCache({ scope: 'deezer' }) });
        return tracks[0];
    };
    expect((await run()).matchSource).toBe('search');
    expect((await run()).matchSource).toBe('cache');
    expect(searchClient.searchBestMatch).toHaveBeenCalledTimes(1);
    expect(metrics.recordSearch).toHaveBeenCalledTimes(1);
});

it('não guarda resultados ausentes ou abaixo da confiança mínima', async () => {
    const matcher = new TrackMatcher({ delayMs: 0 });
    const cache = new MatchCache({ scope: 'soundcloud' });
    const searchClient = { searchBestMatch: jest.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'cover', matchScore: 20 })
        .mockResolvedValueOnce({ ...track, id: 'original', matchScore: 90 }) };
    for (let attempt = 0; attempt < 3; attempt += 1) {
        await matcher.matchTracks({ searchClient, tracks: buildTransferTracks([track]), matchCache: cache });
    }
    expect(searchClient.searchBestMatch).toHaveBeenCalledTimes(3);
    expect(cache.get(track)).toMatchObject({ targetId: 'original', matchScore: 100 });
});

it('carrega o índice uma vez para uma sequência de acertos', () => {
    const cache = new MatchCache({ scope: 'leituras' });
    cache.set(track, result);
    const read = jest.spyOn(fs, 'readFileSync');
    try {
        for (let index = 0; index < 100; index += 1) expect(cache.get(track)).toEqual(result);
        expect(read).not.toHaveBeenCalled();
    } finally { read.mockRestore(); }
});

it('consumidores de destinos diferentes compartilham atualizações e sobrevivem ao reinício', () => {
    const first = new MatchCache({ scope: 'spotify' });
    const second = new MatchCache({ scope: 'deezer' });
    first.set(track, result);
    second.set(track, { ...result, targetId: 'deezer-id' });
    second.flush();
    resetMatchCacheForTests();
    expect(new MatchCache({ scope: 'spotify' }).get(track)).toEqual(result);
    expect(new MatchCache({ scope: 'deezer' }).get(track).targetId).toBe('deezer-id');
});

it('limita o índice e a persistência a 5.000 entradas', async () => {
    const { readStore } = await import('../src/storage/jsonStore.js');
    const cache = new MatchCache({ scope: 'limite' });
    for (let index = 0; index <= MATCH_CACHE_LIMIT; index += 1) cache.set({ ...track, name: `Faixa ${index}` }, resultFor({ ...track, name: `Faixa ${index}` }));
    cache.flush();
    expect(cache.get({ ...track, name: 'Faixa 0' })).toBeNull();
    expect(cache.get({ ...track, name: `Faixa ${MATCH_CACHE_LIMIT}` })).toEqual(resultFor({ ...track, name: `Faixa ${MATCH_CACHE_LIMIT}` }));
    expect(Object.keys(readStore('match-cache.json', {}))).toHaveLength(MATCH_CACHE_LIMIT);
});

it('cache corrompido ou falha de escrita permite seguir com busca normal', async () => {
    fs.writeFileSync(dataFile('match-cache.json'), 'corrompido');
    const cache = new MatchCache({ scope: 'falha' });
    const searchClient = { searchBestMatch: jest.fn().mockResolvedValue({ ...track, id: 'id', matchScore: 95 }) };
    const matcher = new TrackMatcher({ delayMs: 0 });
    const first = buildTransferTracks([track]);
    await matcher.matchTracks({ tracks: first, searchClient, matchCache: cache });
    expect(first[0].status).toBe('matched');
    jest.spyOn(fs, 'renameSync').mockImplementation(() => { throw new Error('Falha simulada'); });
    expect(() => cache.flush()).not.toThrow();
    const second = buildTransferTracks([track]);
    await matcher.matchTracks({ tracks: second, searchClient, matchCache: cache });
    expect(second[0].status).toBe('matched');
    expect(searchClient.searchBestMatch).toHaveBeenCalledTimes(2);
});

it('persiste no prazo de um segundo ou no checkpoint de cem mudanças', async () => {
    const { readStore } = await import('../src/storage/jsonStore.js');
    jest.useFakeTimers();
    try {
        const cache = new MatchCache({ scope: 'checkpoint' });
        cache.set(track, result);
        expect(fs.existsSync(dataFile('match-cache.json'))).toBe(false);
        jest.advanceTimersByTime(1000);
        expect(Object.keys(readStore('match-cache.json', {}))).toHaveLength(1);
        for (let index = 0; index < 100; index += 1) cache.set({ ...track, name: `Nova ${index}` }, result);
        expect(Object.keys(readStore('match-cache.json', {}))).toHaveLength(101);
    } finally { jest.useRealTimers(); }
});

it('cache sem permissão de leitura permite buscar a faixa normalmente', async () => {
    fs.writeFileSync(dataFile('match-cache.json'), 'conteúdo fictício');
    const read = fs.readFileSync.bind(fs);
    jest.spyOn(fs, 'readFileSync').mockImplementation((file, ...options) => {
        if (file === dataFile('match-cache.json')) throw Object.assign(new Error('Falha simulada de permissão'), { code: 'EACCES' });
        return read(file, ...options);
    });
    const searchClient = { searchBestMatch: jest.fn().mockResolvedValue({ ...track, id: 'destino', matchScore: 95 }) };
    const tracks = buildTransferTracks([track]);
    await new TrackMatcher({ delayMs: 0 }).matchTracks({ tracks, searchClient, matchCache: new MatchCache({ scope: 'sem-permissão' }) });
    expect(tracks[0]).toMatchObject({ status: 'matched', targetId: 'destino', matchSource: 'search' });
    expect(searchClient.searchBestMatch).toHaveBeenCalledTimes(1);
});

it('cache antigo sem versão e evidências não contorna a política nova', () => {
    const cache = new MatchCache({ scope: 'legado' });
    cache.set(track, { targetId: 'antigo', matchScore: 100 });
    expect(cache.get(track)).toBeNull();
});

it('escolhas manuais não recebem pontuação de confiança e podem ser esquecidas', () => {
    const cache = new MatchCache({ scope: 'manual' });
    cache.set(track, { targetId: 'outra-versao', matchScore: null,
        matching: { decision: 'manual', algorithmVersion: 'identity-v2', best: { candidate: { targetId: 'outra-versao', name: 'Música (Live)' } } } });
    expect(cache.get(track)).toMatchObject({ matchScore: null, targetId: 'outra-versao' });
    expect(cache.get({ ...track, name: 'Música (Live)' })).toBeNull();
    cache.forget(track);
    expect(cache.get(track)).toBeNull();
});

it('resultado indisponível é invalidado e provoca nova busca', async () => {
    const cache = new MatchCache({ scope: 'disponibilidade' });
    cache.set(track, result);
    const search = jest.fn(async () => ({ ...track, id: 'nova-faixa' }));
    const tracks = buildTransferTracks([track]);
    // O estado persistido usa valores nulos para metadados opcionais, como a chave do cache.
    cache.set(tracks[0], resultFor(tracks[0]));
    await new TrackMatcher({ delayMs: 0 }).matchTracks({ tracks, matchCache: cache,
        searchClient: { validateCachedMatch: async () => false, searchBestMatch: search } });
    expect(search).toHaveBeenCalledTimes(1);
    expect(tracks[0].targetId).toBe('nova-faixa');
});
