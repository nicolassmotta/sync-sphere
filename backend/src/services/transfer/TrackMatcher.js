import { clampConcurrency, mapWithConcurrency } from '../../utils/concurrency.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const NO_CONFIDENT_MATCH_REASON = 'Nenhum resultado confiável encontrado no YouTube Music.';

const buildSearchFailureError = (errors) => {
    const operationalError = errors.find((error) => error.reason && error.reason !== NO_CONFIDENT_MATCH_REASON);
    if (!operationalError) return null;

    const error = new Error(`Falha ao buscar faixas no YouTube Music: ${operationalError.reason}`);
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

    async matchPlaylistTracks({ youtubeClient, tracks, transferRecord, onTrackProgress, onCheckpoint }) {
        const matchedVideoIdsByTrackIndex = new Array(tracks.length);
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
                const match = await youtubeClient.searchBestVideoMatch({ track });
                if (!match?.videoId || match.matchScore < this.minMatchScore) {
                    throw new Error(NO_CONFIDENT_MATCH_REASON);
                }

                matchedVideoIdsByTrackIndex[index] = match.videoId;

                transferRecord.processedTracks += 1;
            } catch (searchError) {
                transferRecord.errors.push({
                    trackName: track.name,
                    artistName: track.artist,
                    reason: searchError.message || 'Falha ao buscar faixa no YouTube.',
                    stage: 'matching',
                });
            }

            completedTracks += 1;
            transferRecord.lastMessage = `${completedTracks}/${tracks.length} faixas analisadas.`;
            if (completedTracks % checkpointEvery === 0 || completedTracks === tracks.length) {
                await enqueueCheckpoint();
            }
        }, this.searchConcurrency);

        const seenVideoIds = new Set();
        const matchedVideoIds = matchedVideoIdsByTrackIndex.filter((videoId) => {
            if (!videoId || seenVideoIds.has(videoId)) return false;
            seenVideoIds.add(videoId);
            return true;
        });

        if (!matchedVideoIds.length) {
            const searchFailureError = buildSearchFailureError(transferRecord.errors);
            if (searchFailureError) {
                throw searchFailureError;
            }
        }

        return matchedVideoIds;
    }
}
