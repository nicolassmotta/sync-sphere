import fs from 'node:fs';
import { jest } from '@jest/globals';
import MatchCache, { MATCH_CACHE_TTL_MS } from '../src/services/matching/MatchCache.js';
import TrackMatcher from '../src/services/transfer/TrackMatcher.js';
import { buildTransferTracks } from '../src/services/transfer/TransferTrackStore.js';
import { removeStore } from '../src/storage/jsonStore.js';
import { dataFile } from '../src/config/paths.js';

const track = { name: 'Música', artist: 'Artista', durationMs: 180000 };
const result = { targetId: 'destino-privado', matchScore: 95 };

beforeEach(() => removeStore('match-cache.json'));

it('reutiliza correspondência após recriar o cache e persiste dados cifrados', () => {
    new MatchCache({ scope: 'spotify' }).set(track, result);
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
    const searchClient = { searchBestMatch: jest.fn().mockResolvedValue({ id: 'faixa', matchScore: 90 }) };
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
        .mockResolvedValueOnce({ id: 'original', matchScore: 90 }) };
    for (let attempt = 0; attempt < 3; attempt += 1) {
        await matcher.matchTracks({ searchClient, tracks: buildTransferTracks([track]), matchCache: cache });
    }
    expect(searchClient.searchBestMatch).toHaveBeenCalledTimes(3);
    expect(cache.get(track)).toEqual({ targetId: 'original', matchScore: 90 });
});
