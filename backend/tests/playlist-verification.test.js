import { comparePlaylistOccurrences } from '../src/services/transfer/verifyPlaylist.js';

it('verifica ordem e repetições somente quando toda a sequência coincide', () => {
    expect(comparePlaylistOccurrences(['a', 'b', 'a'], ['a', 'b', 'a'])).toMatchObject({ state: 'verified', orderPreserved: true, missing: [], extra: [] });
    expect(comparePlaylistOccurrences(['a', 'b', 'a'], ['a', 'a', 'b'])).toMatchObject({ state: 'diverged', orderPreserved: false, missing: [], extra: [] });
});
it('distingue ocorrências faltantes e extras', () => {
    expect(comparePlaylistOccurrences(['a', 'b', 'a'], ['a', 'c'])).toMatchObject({ state: 'diverged', missing: ['a', 'b'], extra: ['c'] });
});
