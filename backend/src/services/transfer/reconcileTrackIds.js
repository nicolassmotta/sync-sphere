/**
 * Compara quantidades, preservando repetições intencionais. `expectedIds`
 * inclui todas as faixas resolvidas da transferência, inclusive já inseridas.
 * Uma retomada após escrita parcial só envia as ocorrências ainda ausentes.
 */
export const getMissingTrackIds = ({ ids, existingIds, expectedIds = ids }) => {
    const needed = new Map();
    expectedIds.filter(Boolean).forEach((id) => needed.set(String(id), (needed.get(String(id)) || 0) + 1));
    existingIds.filter(Boolean).forEach((id) => needed.set(String(id), Math.max(0, (needed.get(String(id)) || 0) - 1)));
    const pendingCounts = new Map();
    ids.filter(Boolean).forEach((id) => pendingCounts.set(String(id), (pendingCounts.get(String(id)) || 0) + 1));
    const skip = new Map([...pendingCounts].map(([id, count]) => [id, Math.max(0, count - (needed.get(id) || 0))]));
    return ids.filter((id) => {
        if (!id) return false;
        const key = String(id);
        const count = skip.get(key) || 0;
        if (!count) return true;
        skip.set(key, count - 1);
        return false;
    });
};
