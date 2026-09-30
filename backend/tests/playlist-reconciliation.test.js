import { getMissingTrackIds } from '../src/services/transfer/reconcileTrackIds.js';

it('preserva repetições intencionais e a ordem das faixas novas', () => {
    expect(getMissingTrackIds({ ids: ['A', 'B', 'A'], existingIds: [] })).toEqual(['A', 'B', 'A']);
});

it('após escrita parcial só adiciona ocorrências ainda ausentes', () => {
    expect(getMissingTrackIds({ ids: ['A', 'B', 'A'], existingIds: ['A'] })).toEqual(['B', 'A']);
    expect(getMissingTrackIds({ ids: ['A', 'B', 'A'], existingIds: ['A', 'B'] })).toEqual(['A']);
    expect(getMissingTrackIds({ ids: ['A', 'B', 'A'], existingIds: ['A', 'B', 'A'] })).toEqual([]);
});

it('insere outra ocorrência após revisão manual sem descartar a faixa já inserida', () => {
    expect(getMissingTrackIds({ ids: ['A'], existingIds: ['A'], expectedIds: ['A', 'A'] })).toEqual(['A']);
    expect(getMissingTrackIds({ ids: ['A'], existingIds: ['A', 'A'], expectedIds: ['A', 'A'] })).toEqual([]);
});

it('preserva itens preexistentes e não acrescenta ocorrências extras', () => {
    expect(getMissingTrackIds({ ids: ['A', 'A', 'B'], existingIds: ['Z', 'A', 'A', 'A'], expectedIds: ['A', 'A', 'B'] })).toEqual(['B']);
});
