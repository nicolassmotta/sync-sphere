import { clampConcurrency, mapWithConcurrency } from '../../utils/concurrency.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const NO_CONFIDENT_MATCH_REASON = 'Nenhum resultado confiável encontrado no YouTube Music.';

const buildSearchFailureError = (errors, noConfidentMatchReason, providerLabel) => {
    const operationalError = errors.find((error) => error.reason && error.reason !== noConfidentMatchReason);
    if (!operationalError) return null;

    const error = new Error(`Falha ao buscar faixas no ${providerLabel}: ${operationalError.reason}`);
    if (/quota|exceeded|cota|excedid/i.test(operationalError.reason)) {
        error.isPermanentTransferError = true;
    }

    return error;
};

export default class TrackMatcher {
    constructor({
        delayMs = Number(process.env.YT_MUSIC_SEARCH_DELAY_MS || 250),
        minMatchScore = 45,
        searchConcurrency = clampConcurrency(process.env.YOUTUBE_SEARCH_CONCURRENCY, { max: 5, fallback: 1 }),
    } = {}) {
        this.delayMs = delayMs;
        this.minMatchScore = minMatchScore;
        this.searchConcurrency = searchConcurrency;
    }

    async matchPlaylistTracks({
        youtubeClient,
        searchClient = youtubeClient,
        tracks,
        transferRecord,
        onTrackProgress,
        onCheckpoint,
        providerLabel = 'YouTube Music',
        noConfidentMatchReason = NO_CONFIDENT_MATCH_REASON,
        getMatchId = (match) => match?.id || match?.videoId || match?.uri,
        stage = 'matching',
    }) {
        const matchedIdsByTrackIndex = new Array(tracks.length);
        let completedTracks = 0;
        const checkpointEvery = Math.max(5, this.searchConcurrency * 2);
        let checkpointQueue = Promise.resolve();

        const enqueueCheckpoint = async () => {
            checkpointQueue = checkpointQueue.then(async () => {
                await onCheckpoint?.();
            });
            await checkpointQueue;
        };

        await mapWithConcurrency(tracks, async (track, index) => {
            const progress = 10 + Math.floor((index / tracks.length) * 70);

            onTrackProgress?.({
                track,
                progress,
                index,
            });

            if (this.delayMs > 0) await wait(this.delayMs);

            try {
                const match = searchClient.searchBestMatch
                    ? await searchClient.searchBestMatch({ track })
                    : await searchClient.searchBestVideoMatch({ track });
                const matchId = getMatchId(match);
                if (!matchId || match.matchScore < this.minMatchScore) {
                    throw new Error(noConfidentMatchReason);
                }

                matchedIdsByTrackIndex[index] = matchId;

                transferRecord.processedTracks += 1;
            } catch (searchError) {
                transferRecord.errors.push({
                    trackName: track.name,
                    artistName: track.artist,
                    reason: searchError.message || `Falha ao buscar faixa no ${providerLabel}.`,
                    stage,
                });
            }

            completedTracks += 1;
            transferRecord.lastMessage = `${completedTracks}/${tracks.length} faixas analisadas.`;
            if (completedTracks % checkpointEvery === 0 || completedTracks === tracks.length) {
                await enqueueCheckpoint();
            }
        }, this.searchConcurrency);

        const seenIds = new Set();
        const matchedIds = matchedIdsByTrackIndex.filter((matchId) => {
            if (!matchId || seenIds.has(matchId)) return false;
            seenIds.add(matchId);
            return true;
        });

        if (!matchedIds.length) {
            const searchFailureError = buildSearchFailureError(
                transferRecord.errors,
                noConfidentMatchReason,
                providerLabel
            );
            if (searchFailureError) {
                throw searchFailureError;
            }
        }

        return matchedIds;
    }
}
