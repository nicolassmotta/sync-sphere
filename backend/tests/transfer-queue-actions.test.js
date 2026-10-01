import { jest } from '@jest/globals';

const mockAddTransferJob = jest.fn();
const mockRunTransferNow = jest.fn(() => false);
const mockHasTransferJob = jest.fn(() => false);

jest.unstable_mockModule('../src/services/queueService.js', () => ({
    addTransferJob: mockAddTransferJob,
    runTransferNow: mockRunTransferNow,
    hasTransferJob: mockHasTransferJob,
}));

const { default: Transfer } = await import('../src/models/Transfer.js');
const {
    buildTransferTracks,
    loadTransferTracks,
    saveTransferTracks,
    TRACK_STATUS,
} = await import('../src/services/transfer/TransferTrackStore.js');
const {
    recoverUnfinishedTransfers,
    resumeTransfer,
    retryTransfer,
} = await import('../src/services/transfer/transferQueueActions.js');

const createTransfer = async (fields) => {
    const [transfer] = await Transfer.insertMany([{
        user: 'local',
        sourcePlaylistId: 'playlist-1',
        playlistName: 'Playlist',
        ...fields,
    }]);
    return transfer;
};

describe('ações de fila sobre transferências', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('retry devolve só faixas com falha para a fila, zerando tentativas', async () => {
        const transfer = await createTransfer({ status: 'completed', failedCount: 1 });
        const tracks = buildTransferTracks([
            { name: 'A', artist: 'X' },
            { name: 'B', artist: 'X' },
            { name: 'C', artist: 'X' },
        ]);
        tracks[0].status = TRACK_STATUS.MATCHED;
        tracks[1].status = TRACK_STATUS.FAILED;
        tracks[1].attempts = 5;
        tracks[2].status = TRACK_STATUS.NOT_FOUND;
        saveTransferTracks(transfer._id, tracks);

        const result = await retryTransfer({ transferId: transfer._id, userId: 'local' });

        expect(result.requeued).toBe(1);
        expect(loadTransferTracks(transfer._id).map((track) => [track.status, track.attempts])).toEqual([
            [TRACK_STATUS.MATCHED, 0],
            [TRACK_STATUS.RETRY_QUEUED, 0],
            [TRACK_STATUS.NOT_FOUND, 0],
        ]);
        expect(transfer.status).toBe('pending');
        expect(mockAddTransferJob).toHaveBeenCalledWith(
            transfer._id, 'local', 'playlist-1', 'spotify_to_youtube', { mode: 'retry', runAfter: null, lane: 'youtubeMusic' }
        );
    });

    it('retry recusa transferência sem faixas pendentes', async () => {
        const transfer = await createTransfer({ status: 'completed' });
        saveTransferTracks(transfer._id, [{ ...buildTransferTracks([{ name: 'A', artist: 'X' }])[0], status: TRACK_STATUS.MATCHED, targetId: 'confirmado', inserted: true }]);

        await expect(retryTransfer({ transferId: transfer._id, userId: 'local' }))
            .rejects.toMatchObject({ statusCode: 400 });
        expect(mockAddTransferJob).not.toHaveBeenCalled();
    });

    it('resume antecipa job pausado ou cria um novo se não existir', async () => {
        const transfer = await createTransfer({ status: 'needs_auth' });

        await resumeTransfer({ transferId: transfer._id, userId: 'local' });

        expect(mockRunTransferNow).toHaveBeenCalledWith(transfer._id);
        expect(mockAddTransferJob).toHaveBeenCalledTimes(1);
        expect(transfer.status).toBe('pending');
    });

    it('no boot reenfileira transferências não concluídas respeitando resumeAt', async () => {
        const resumeAt = new Date(Date.now() + 120_000).toISOString();
        const paused = await createTransfer({ status: 'paused', resumeAt });
        const running = await createTransfer({ status: 'processing' });
        await createTransfer({ status: 'completed' });

        await recoverUnfinishedTransfers();

        expect(mockAddTransferJob).toHaveBeenCalledWith(
            paused._id, 'local', 'playlist-1', 'spotify_to_youtube', { mode: 'full', runAfter: resumeAt, lane: 'youtubeMusic' }
        );
        expect(mockAddTransferJob).toHaveBeenCalledWith(
            running._id, 'local', 'playlist-1', 'spotify_to_youtube', { mode: 'full', runAfter: null, lane: 'youtubeMusic' }
        );
    });
});

it('retry preserva correspondências manuais e reenfileira inserções pendentes', async () => {
    const transfer = await createTransfer({ status: 'failed', targetPlaylistId: 'existente' });
    const tracks = buildTransferTracks([{ name: 'A', artist: 'X' }]);
    Object.assign(tracks[0], { status: TRACK_STATUS.MATCHED, targetId: 'id', matchScore: 95, matchSource: 'manual', manualReview: { title: 'A' } });
    saveTransferTracks(transfer._id, tracks);
    const result = await retryTransfer({ transferId: transfer._id, userId: 'local' });
    expect(result.requeued).toBe(1);
    expect(loadTransferTracks(transfer._id)).toEqual(tracks);
    expect(transfer.targetPlaylistId).toBe('existente');
});

it('retry geral inclui inserções pendentes mesmo sem falhas de busca', async () => {
    const { retryAllTransfers } = await import('../src/services/transfer/transferQueueActions.js');
    const transfer = await createTransfer({ status: 'failed', failedCount: 0, retryQueuedCount: 0 });
    saveTransferTracks(transfer._id, [{ ...buildTransferTracks([{ name: 'A', artist: 'X' }])[0], status: TRACK_STATUS.MATCHED, targetId: 'id' }]);
    const result = await retryAllTransfers({ userId: 'local' });
    expect(result.requeuedTransfers).toBeGreaterThan(0);
    expect(mockAddTransferJob.mock.calls.some(([id]) => id === transfer._id)).toBe(true);
});

it('retry bloqueia job existente antes de mudar os checkpoints', async () => {
    const transfer = await createTransfer({ status: 'paused' });
    const tracks = [{ ...buildTransferTracks([{ name: 'A', artist: 'X' }])[0], status: TRACK_STATUS.FAILED, attempts: 5 }];
    saveTransferTracks(transfer._id, tracks);
    mockHasTransferJob.mockReturnValueOnce(true);
    await expect(retryTransfer({ transferId: transfer._id, userId: 'local' })).rejects.toMatchObject({ statusCode: 409 });
    expect(loadTransferTracks(transfer._id)).toEqual(tracks);
    expect(transfer.status).toBe('paused');
});

it('retry recupera falha anterior à leitura', async () => {
    const transfer = await createTransfer({ status: 'failed' });
    await retryTransfer({ transferId: transfer._id, userId: 'local' });
    expect(transfer.status).toBe('pending');
    expect(mockAddTransferJob).toHaveBeenCalledWith(transfer._id, 'local', 'playlist-1', 'spotify_to_youtube', { mode: 'full', runAfter: null, lane: 'youtubeMusic' });
});

it('duas solicitações simultâneas de retry não alteram o mesmo estado duas vezes', async () => {
    const transfer = await createTransfer({ status: 'failed' });
    saveTransferTracks(transfer._id, [{ ...buildTransferTracks([{ name: 'A', artist: 'X' }])[0], status: TRACK_STATUS.MATCHED, targetId: 'id' }]);
    jest.clearAllMocks();
    const results = await Promise.allSettled([
        retryTransfer({ transferId: transfer._id, userId: 'local' }),
        retryTransfer({ transferId: transfer._id, userId: 'local' }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((result) => result.status === 'rejected').reason.statusCode).toBe(409);
    expect(mockAddTransferJob).toHaveBeenCalledTimes(1);
});

it('histórico antigo descobre inserções pendentes no checkpoint sem precisar regravar', async () => {
    const { listOwnedTransfers } = await import('../src/services/transfer/transferQueryService.js');
    const transfer = await createTransfer({ status: 'failed' });
    saveTransferTracks(transfer._id, [{ ...buildTransferTracks([{ name: 'A', artist: 'X' }])[0], status: TRACK_STATUS.MATCHED, targetId: 'id' }]);
    const history = await listOwnedTransfers({ userId: 'local' });
    expect(history.find((item) => item._id === transfer._id).pendingInsertCount).toBe(1);
    expect(transfer.pendingInsertCount).toBeUndefined();
});


it('retry geral conta transferência anterior à leitura mesmo com zero faixas conhecidas', async () => {
    const { retryAllTransfers } = await import('../src/services/transfer/transferQueueActions.js');
    const transfer = await createTransfer({ status: 'failed', totalTracks: 0 });
    mockHasTransferJob.mockImplementation((id) => id !== transfer._id);
    try {
        expect(await retryAllTransfers({ userId: 'local' })).toEqual({ requeuedTracks: 0, requeuedTransfers: 1 });
        expect(transfer.status).toBe('pending');
    } finally { mockHasTransferJob.mockReturnValue(false); }
});
