import { TRANSFER_DIRECTIONS } from '../constants/transferDirections.js';
import logger from '../utils/logger.js';

/**
 * Fila de transferências em memória, no próprio processo. Substitui o
 * BullMQ/Redis para que o projeto rode local sem depender de infraestrutura
 * externa. Processa um job por vez (concorrência 1) e tenta novamente em caso
 * de falha temporária, respeitando erros marcados como `UnrecoverableError`.
 */
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 5000;

const pending = [];
let draining = false;
let sequence = 0;

let processor = null;
let onFailed = null;

const backoffMs = (attempt) => Math.min(BASE_BACKOFF_MS * 2 ** (attempt - 1), 30000);

const drain = async () => {
    if (draining || !processor) return;
    draining = true;

    while (pending.length) {
        const job = pending.shift();

        try {
            await processor(job);
        } catch (error) {
            job.attemptsMade += 1;
            const unrecoverable = error?.name === 'UnrecoverableError';

            if (!unrecoverable && job.attemptsMade < MAX_ATTEMPTS) {
                const delay = backoffMs(job.attemptsMade);
                logger.warn(`[Fila] Job ${job.id} falhou (tentativa ${job.attemptsMade}). Reagendando em ${delay}ms.`);
                setTimeout(() => {
                    pending.push(job);
                    drain();
                }, delay);
            } else {
                try {
                    await onFailed?.(job, error);
                } catch (failureError) {
                    logger.warn(`[Fila] Não foi possível registrar a falha do job ${job.id}: ${failureError.message}`);
                }
            }
        }
    }

    draining = false;
};

/**
 * Registra o processador da fila (chamado pelo worker no boot). Sem processador
 * registrado os jobs ficam aguardando — útil quando WORKER_ENABLED=false.
 */
export const registerTransferProcessor = ({ process, onFailed: failedHandler }) => {
    processor = process;
    onFailed = failedHandler;
    drain();
};

/**
 * Enfileira uma transferência para processamento em segundo plano.
 */
export const addTransferJob = async (
    transferId,
    userId,
    sourcePlaylistId,
    direction = TRANSFER_DIRECTIONS.SPOTIFY_TO_YOUTUBE
) => {
    pending.push({
        id: `job-${++sequence}`,
        data: { transferId, userId, sourcePlaylistId, direction },
        attemptsMade: 0,
    });

    logger.info(`[Fila] Transferência ${transferId} adicionada à fila local em memória.`);
    drain();
};
