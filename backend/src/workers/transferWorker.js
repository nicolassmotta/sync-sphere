import ProgressPublisher from '../services/transfer/ProgressPublisher.js';
import TrackMatcher from '../services/transfer/TrackMatcher.js';
import TransferProcessor from '../services/transfer/TransferProcessor.js';
import TransferRepository from '../services/transfer/TransferRepository.js';
import { recoverUnfinishedTransfers } from '../services/transfer/transferQueueActions.js';
import { getQueuePosition, registerTransferProcessor } from '../services/queueService.js';
import logger from '../utils/logger.js';

/**
 * Inicializa o processamento das transferências usando a fila local
 * persistida. Emite progresso via Socket.io e, no boot, devolve para a fila
 * as transferências que não terminaram.
 */
export const startWorker = (io) => {
    const repository = new TransferRepository();
    const transferProcessor = new TransferProcessor({
        publisher: new ProgressPublisher(io),
        repository,
        trackMatcher: new TrackMatcher(),
        getQueuePosition,
    });

    registerTransferProcessor({
        process: (job) => transferProcessor.process(job),
        onRetry: async (job, error) => {
            const record = await repository.getTransferForProcessing(job.data.transferId);
            await repository.update(record, {
                status: 'paused',
                pauseReason: 'retry_scheduled',
                resumeAt: job.runAfter,
                etaSeconds: null,
                lastMessage: `Falha temporária: ${error.message} Nova tentativa automática programada.`,
            });
            transferProcessor.publish(job.data.transferId, record);
        },
        onFailed: async (job, err) => {
            logger.info(`[Trabalhador com falha] Job ${job?.id} falhou. Erro: ${err.message}`);

            if (!job?.data?.transferId) return;

            try {
                const transferRecord = await repository.getTransferForProcessing(job.data.transferId);
                if (transferRecord.status !== 'completed') {
                    await repository.update(transferRecord, { phase: 'done', resumeAt: null, pauseReason: null, etaSeconds: null });
                    await repository.markFailed(transferRecord, err.message);
                    transferProcessor.publish(job.data.transferId, transferRecord);
                }
            } catch (syncError) {
                logger.warn(`[Trabalhador com falha] Não foi possível sincronizar falha do job ${job?.id}: ${syncError.message}`);
            }
        },
    });

    recoverUnfinishedTransfers().catch((error) => {
        logger.warn(`[Trabalhador] Não foi possível recuperar transferências pendentes: ${error.message}`);
    });

    logger.info('[Trabalhador] Fila local pronta para processar transferências.');
};
