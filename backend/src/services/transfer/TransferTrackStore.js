import { readStore, removeStore, writeStore } from '../../storage/jsonStore.js';

/**
 * Estado de cada faixa de uma transferência, persistido em
 * `data/transfer-tracks-<id>.json` (cifrado). É o que permite pausar,
 * retomar e tentar de novo só as faixas que falharam, sem refazer buscas.
 */
export const TRACK_STATUS = {
    PENDING: 'pending',
    MATCHED: 'matched',
    NOT_FOUND: 'not_found',
    RETRY_QUEUED: 'retry_queued',
    FAILED: 'failed',
};

const FINAL_STATUSES = new Set([TRACK_STATUS.MATCHED, TRACK_STATUS.NOT_FOUND, TRACK_STATUS.FAILED]);

const storeName = (transferId) => `transfer-tracks-${String(transferId).replace(/[^\w-]/g, '')}.json`;

export const loadTransferTracks = (transferId) => readStore(storeName(transferId), null);

export const saveTransferTracks = (transferId, tracks) => {
    writeStore(storeName(transferId), tracks);
};

export const deleteTransferTracks = (transferId) => {
    removeStore(storeName(transferId));
};

export const buildTransferTracks = (sourceTracks = []) => sourceTracks.map((track, index) => ({
    index,
    sourceId: track.spotifyId || track.youtubeVideoId || track.sourceId || track.uri || null,
    name: track.name,
    artist: track.artist,
    album: track.album || '',
    durationMs: track.durationMs || 0,
    isrc: track.isrc || null,
    uri: track.uri || null,
    status: TRACK_STATUS.PENDING,
    targetId: null,
    matchScore: null,
    attempts: 0,
    errorKind: null,
    lastError: null,
    inserted: false,
}));

export const isTrackAnalyzed = (track) => FINAL_STATUSES.has(track.status);

export const summarizeTransferTracks = (tracks = []) => {
    const counts = {
        total: tracks.length,
        analyzed: 0,
        matched: 0,
        notFound: 0,
        retryQueued: 0,
        failed: 0,
        pending: 0,
    };

    for (const track of tracks) {
        if (isTrackAnalyzed(track)) counts.analyzed += 1;
        if (track.status === TRACK_STATUS.MATCHED) counts.matched += 1;
        else if (track.status === TRACK_STATUS.NOT_FOUND) counts.notFound += 1;
        else if (track.status === TRACK_STATUS.RETRY_QUEUED) counts.retryQueued += 1;
        else if (track.status === TRACK_STATUS.FAILED) counts.failed += 1;
        else counts.pending += 1;
    }

    return counts;
};

/**
 * IDs de destino ainda não inseridos, na ordem da playlist de origem.
 * A mesma faixa pode aparecer mais de uma vez na playlist original.
 */
export const getTracksToInsert = (tracks = []) => {
    return tracks
        .filter((track) => track.status === TRACK_STATUS.MATCHED && !track.inserted && track.targetId)
        .sort((a, b) => a.index - b.index);
};

/**
 * Formato legado de `transfer.errors`, ainda usado no histórico.
 */
export const buildTransferErrors = (tracks = [], stage) => tracks
    .filter((track) => [TRACK_STATUS.NOT_FOUND, TRACK_STATUS.FAILED, TRACK_STATUS.RETRY_QUEUED].includes(track.status))
    .map((track) => ({
        trackName: track.name,
        artistName: track.artist,
        reason: track.lastError || 'Falha ao buscar faixa.',
        stage,
        status: track.status,
        index: track.index,
    }));
