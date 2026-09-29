import { jest } from '@jest/globals';
import { readStore, writeStore } from '../src/storage/jsonStore.js';

const queue = await import('../src/services/queueService.js');

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('fila local persistida', () => {
    beforeEach(() => {
        queue.resetQueueForTests();
        writeStore('queue.json', []);
    });

    afterEach(() => {
        queue.resetQueueForTests();
        jest.useRealTimers();
    });

    it('persiste o job em disco e remove depois de processar', async () => {
        const process = jest.fn().mockResolvedValue({ status: 'completed' });

        await queue.addTransferJob('transfer-1', 'local', 'playlist-1');
        expect(readStore('queue.json', [])).toHaveLength(1);

        queue.registerTransferProcessor({ process });
        await flush();

        expect(process).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ transferId: 'transfer-1', mode: 'full' }),
        }));
        expect(readStore('queue.json', [])).toHaveLength(0);
    });

    it('reidrata jobs salvos quando o processador é registrado (reinício)', async () => {
        writeStore('queue.json', [{
            id: 'job-7',
            data: { transferId: 'transfer-7', userId: 'local', sourcePlaylistId: 'p', direction: 'spotify_to_youtube' },
            attemptsMade: 0,
            runAfter: null,
        }]);
        const process = jest.fn().mockResolvedValue({ status: 'completed' });

        queue.registerTransferProcessor({ process });
        await flush();

        expect(process).toHaveBeenCalledTimes(1);
        expect(process.mock.calls[0][0].data.transferId).toBe('transfer-7');
    });

    it('reagenda o job quando o processador pede pausa e roda de novo no horário', async () => {
        jest.useFakeTimers({ doNotFake: ['setImmediate'] });
        const rescheduleAt = new Date(Date.now() + 60_000);
        const process = jest.fn()
            .mockResolvedValueOnce({ status: 'paused', rescheduleAt })
            .mockResolvedValueOnce({ status: 'completed' });

        queue.registerTransferProcessor({ process });
        await queue.addTransferJob('transfer-1', 'local', 'playlist-1');
        await flush();

        expect(process).toHaveBeenCalledTimes(1);
        expect(readStore('queue.json', [])[0].runAfter).toBe(rescheduleAt.toISOString());
        expect(queue.getQueuePosition('transfer-1')).toBeNull();

        jest.advanceTimersByTime(60_000);
        await flush();

        expect(process).toHaveBeenCalledTimes(2);
        expect(readStore('queue.json', [])).toHaveLength(0);
    });

    it('não duplica job da mesma transferência e antecipa com runTransferNow', async () => {
        jest.useFakeTimers({ doNotFake: ['setImmediate'] });
        const process = jest.fn().mockResolvedValue({ status: 'completed' });
        queue.registerTransferProcessor({ process });

        await queue.addTransferJob('transfer-1', 'local', 'p', undefined, { runAfter: Date.now() + 600_000 });
        await queue.addTransferJob('transfer-1', 'local', 'p', undefined, { runAfter: Date.now() + 900_000 });
        expect(readStore('queue.json', [])).toHaveLength(1);

        expect(queue.runTransferNow('transfer-1')).toBe(true);
        await flush();

        expect(process).toHaveBeenCalledTimes(1);
    });

    it('chama onFailed e remove o job depois de erro irrecuperável', async () => {
        const unrecoverable = new Error('sem acesso');
        unrecoverable.name = 'UnrecoverableError';
        const onFailed = jest.fn();

        queue.registerTransferProcessor({ process: jest.fn().mockRejectedValue(unrecoverable), onFailed });
        await queue.addTransferJob('transfer-1', 'local', 'p');
        await flush();

        expect(onFailed).toHaveBeenCalledWith(expect.objectContaining({ id: expect.any(String) }), unrecoverable);
        expect(readStore('queue.json', [])).toHaveLength(0);
    });
});
