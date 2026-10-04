/** Compara ocorrências, incluindo repetições. Uma API aceitar escrita não prova presença. */
export const comparePlaylistOccurrences = (expectedIds, actualIds) => {
    const expected = expectedIds.map(String);
    const actual = actualIds.map(String);
    const count = (ids) => {
        const result = new Map();
        ids.forEach((id) => result.set(id, (result.get(id) || 0) + 1));
        return result;
    };
    const expectedCounts = count(expected);
    const actualCounts = count(actual);
    const missing = [...expectedCounts].flatMap(([id, quantity]) => Array(Math.max(0, quantity - (actualCounts.get(id) || 0))).fill(id));
    const extra = [...actualCounts].flatMap(([id, quantity]) => Array(Math.max(0, quantity - (expectedCounts.get(id) || 0))).fill(id));
    const orderPreserved = expected.length === actual.length && expected.every((id, index) => id === actual[index]);
    return { state: !missing.length && !extra.length && orderPreserved ? 'verified' : 'diverged',
        missing, extra, orderPreserved, expectedCount: expected.length, actualCount: actual.length,
        checkedAt: new Date().toISOString() };
};
