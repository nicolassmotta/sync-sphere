import { jest } from '@jest/globals';
import TrackMatcher from '../src/services/transfer/TrackMatcher.js';
import { buildTransferTracks } from '../src/services/transfer/TransferTrackStore.js';

it.each([undefined, null, NaN, Infinity, '99'])('pontuação inválida %s não autoriza inserção automática nem cache', async (matchScore) => {
    const tracks = buildTransferTracks([{ name: 'Faixa fictícia', artist: 'Artista fictício' }]);
    const cache = { get: () => null, set: jest.fn() };
    await new TrackMatcher({ delayMs: 0 }).matchTracks({ tracks, matchCache: cache, searchClient: { searchBestMatch: async () => ({ id: 'resultado-ficticio', matchScore }) } });
    expect(tracks[0].status).toBe('needs_review');
    expect(tracks[0].targetId).toBeFalsy();
    expect(cache.set).not.toHaveBeenCalled();
});
it('entrada antiga com score não numérico é ignorada e a busca normal continua', async () => {
    const tracks = buildTransferTracks([{ name: 'Faixa fictícia', artist: 'Artista fictício' }]);
    const search = jest.fn(async () => ({ id: 'resultado-validado', name: 'Faixa fictícia', artist: 'Artista fictício', matchScore: 95 }));
    await new TrackMatcher({ delayMs: 0 }).matchTracks({ tracks, matchCache: { get: () => ({ targetId: 'cache-invalido', matchScore: '99' }), set: jest.fn() }, searchClient: { searchBestMatch: search } });
    expect(search).toHaveBeenCalledTimes(1);
    expect(tracks[0].targetId).toBe('resultado-validado');
});
