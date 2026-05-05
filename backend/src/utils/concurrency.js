export const clampConcurrency = (value, { min = 1, max = 10, fallback = 1 } = {}) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, Math.floor(parsed)));
};

export const mapWithConcurrency = async (items, mapper, concurrency = 1) => {
    const limit = clampConcurrency(concurrency, { max: Math.max(1, items.length), fallback: 1 });
    const results = new Array(items.length);
    let nextIndex = 0;

    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (nextIndex < items.length) {
            const currentIndex = nextIndex;
            nextIndex += 1;
            results[currentIndex] = await mapper(items[currentIndex], currentIndex);
        }
    });

    await Promise.all(workers);
    return results;
};
