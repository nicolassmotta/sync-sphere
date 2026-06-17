import ProgressPublisher from '../services/transfer/ProgressPublisher.js';
import TrackMatcher from '../services/transfer/TrackMatcher.js';
import TransferProcessor from '../services/transfer/TransferProcessor.js';
import TransferRepository from '../services/transfer/TransferRepository.js';
import { registerTransferProcessor } from '../services/queueService.js';
import logger from '../utils/logger.js';

/**
 * Inicializa o processamento das transferências usando a fila local em memória.
 * Mantém a emissão de progresso via Socket.io e o tratamento de falhas que
 * existia com o BullMQ.
 */
export const startWorker = (io) => {
    const repository = new TransferRepository();
    const transferProcessor = new TransferProcessor({
        publisher: new ProgressPublisher(io),
        repository,
        trackMatcher: new TrackMatcher(),
    });

    registerTransferProcessor({
        process: (job) => transferProcessor.process(job),
        onFailed: async (job, err) => {
            logger.info(`[Trabalhador com falha] Job ${job?.id} falhou. Erro: ${err.message}`);

            if (!job?.data?.transferId) return;

            try {
                const transferRecord = await repository.getTransferForProcessing(job.data.transferId);
                if (transferRecord.status === 'pending' || transferRecord.status === 'processing') {
                    await repository.markFailed(transferRecord, err.message);
                }
            } catch (syncError) {
                logger.warn(`[Trabalhador com falha] Não foi possível sincronizar falha do job ${job?.id}: ${syncError.message}`);
            }
        },
    });

    logger.info('[Trabalhador] Fila local em memória pronta para processar transferências.');
};
