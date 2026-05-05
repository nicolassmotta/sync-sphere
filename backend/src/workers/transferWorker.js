import { Worker } from 'bullmq';

import redisConnection from '../config/redis.js';
import ProgressPublisher from '../services/transfer/ProgressPublisher.js';
import TrackMatcher from '../services/transfer/TrackMatcher.js';
import TransferProcessor from '../services/transfer/TransferProcessor.js';
import TransferRepository from '../services/transfer/TransferRepository.js';
import logger from '../utils/logger.js';

export const startWorker = (io) => {
    const repository = new TransferRepository();
    const transferProcessor = new TransferProcessor({
        publisher: new ProgressPublisher(io),
        repository,
        trackMatcher: new TrackMatcher(),
    });

    const worker = new Worker('playlist-transfer', (job) => transferProcessor.process(job), {
        connection: redisConnection,
        concurrency: 1,
    });

    worker.on('failed', async (job, err) => {
        logger.info(`[Trabalhador com falha] Tarefa ${job?.id} falhou. Erro: ${err.message}`);

        if (!job?.data?.transferId) return;

        try {
            const transferRecord = await repository.getTransferForProcessing(job.data.transferId);
            if (transferRecord.status === 'pending' || transferRecord.status === 'processing') {
                await repository.markFailed(transferRecord, err.message);
            }
        } catch (syncError) {
            logger.warn(`[Trabalhador com falha] Não foi possível sincronizar falha da tarefa ${job?.id}: ${syncError.message}`);
        }
    });

    logger.info('[Trabalhador] Escutando fila BullMQ playlist-transfer.');
};
