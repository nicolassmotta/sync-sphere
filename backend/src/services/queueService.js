import { TRANSFER_DIRECTIONS } from '../constants/transferDirections.js';
import { readStore, writeStore } from '../storage/jsonStore.js';
import logger from '../utils/logger.js';

/**
 * Fila de transferências no próprio processo, persistida em `data/queue.json`
 * para sobreviver a reinícios. Processa um job por vez (concorrência 1).
 *
 * - Falha temporária: tenta de novo com backoff, respeitando `UnrecoverableError`.
 * - Processador devolve `{ rescheduleAt }`: o job volta para a fila nesse
 *   horário (pausa por bloqueio da plataforma ou rodada de retry de faixas).
 */
const QUEUE_STORE = 'queue.json';
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 5000;

let jobs = null;
const ready = [];
const timers = new Map();
let draining = false;
let runningJobId = null;
let sequence = 0;

let processor = null;
let onFailed = null;

const backoffMs = (attempt) => Math.min(BASE_BACKOFF_MS * 2 ** (attempt - 1), 30000);

const loadJobs = () => {
    if (!jobs) {
        jobs = readStore(QUEUE_STORE, []);
        sequence = jobs.reduce((max, job) => Math.max(max, Number(String(job.id).replace('job-', '')) || 0), sequence);
    }
    return jobs;
};

const persist = () => {
    writeStore(QUEUE_STORE, loadJobs());
};

const removeJob = (job) => {
    jobs = loadJobs().filter((item) => item.id !== job.id);
    persist();
};

const schedule = (job) => {
    clearTimeout(timers.get(job.id));
    timers.delete(job.id);

    const delay = job.runAfter ? new Date(job.runAfter).getTime() - Date.now() : 0;
    if (delay > 0) {
        const timer = setTimeout(() => {
            timers.delete(job.id);
            job.runAfter = null;
            persist();
            ready.push(job);
            drain();
        }, delay);
        timer.unref?.();
        timers.set(job.id, timer);
        return;
    }

    if (!ready.includes(job)) ready.push(job);
    drain();
};

const drain = async () => {
    if (draining || !processor) return;
    draining = true;

    while (ready.length) {
        const job = ready.shift();
        runningJobId = job.id;

        try {
            const result = await processor(job);

            if (result?.rescheduleAt) {
                job.runAfter = new Date(result.rescheduleAt).toISOString();
                job.attemptsMade = 0;
                persist();
                logger.info(`[Fila] Job ${job.id} reagendado para ${job.runAfter}.`);
                schedule(job);
            } else {
                removeJob(job);
            }
        } catch (error) {
            job.attemptsMade += 1;
            const unrecoverable = error?.name === 'UnrecoverableError';

            if (!unrecoverable && job.attemptsMade < MAX_ATTEMPTS) {
                const delay = backoffMs(job.attemptsMade);
                logger.warn(`[Fila] Job ${job.id} falhou (tentativa ${job.attemptsMade}). Reagendando em ${delay}ms.`);
                job.runAfter = new Date(Date.now() + delay).toISOString();
                persist();
                schedule(job);
            } else {
                removeJob(job);
                try {
                    await onFailed?.(job, error);
                } catch (failureError) {
                    logger.warn(`[Fila] Não foi possível registrar a falha do job ${job.id}: ${failureError.message}`);
                }
            }
        } finally {
            runningJobId = null;
        }
    }

    draining = false;
};

/**
 * Registra o processador da fila (chamado pelo worker no boot) e retoma os
 * jobs salvos em disco. Sem processador registrado os jobs ficam aguardando,
 * útil quando WORKER_ENABLED=false.
 */
export const registerTransferProcessor = ({ process, onFailed: failedHandler }) => {
    processor = process;
    onFailed = failedHandler;
    loadJobs().forEach(schedule);
    drain();
};

const findJob = (transferId) => loadJobs().find((job) => String(job.data.transferId) === String(transferId));

/**
 * Enfileira uma transferência. Se já existe job para ela, só antecipa o
 * horário (`runAfter` mais cedo vence) em vez de duplicar.
 */
export const addTransferJob = async (
    transferId,
    userId,
    sourcePlaylistId,
    direction = TRANSFER_DIRECTIONS.SPOTIFY_TO_YOUTUBE,
    { mode = 'full', runAfter = null } = {}
) => {
    const runAfterIso = runAfter ? new Date(runAfter).toISOString() : null;
    const existing = findJob(transferId);

    if (existing) {
        const existingTime = existing.runAfter ? new Date(existing.runAfter).getTime() : 0;
        const nextTime = runAfterIso ? new Date(runAfterIso).getTime() : 0;
        if (nextTime < existingTime) {
            existing.runAfter = runAfterIso;
            persist();
            if (existing.id !== runningJobId) schedule(existing);
        }
        return existing;
    }

    const job = {
        id: `job-${++sequence}`,
        data: { transferId, userId, sourcePlaylistId, direction, mode },
        attemptsMade: 0,
        runAfter: runAfterIso,
    };
    loadJobs().push(job);
    persist();

    logger.info(`[Fila] Transferência ${transferId} adicionada à fila local.`);
    schedule(job);
    return job;
};

/**
 * Tira o job da espera e coloca para rodar assim que a fila estiver livre.
 */
export const runTransferNow = (transferId) => {
    const job = findJob(transferId);
    if (!job) return false;
    if (job.id === runningJobId) return true;

    job.runAfter = null;
    persist();
    schedule(job);
    return true;
};

export const hasTransferJob = (transferId) => Boolean(findJob(transferId));

/**
 * Posição da transferência na fila: 0 = rodando agora, 1 = próxima, etc.
 * `null` quando não está na fila ou está esperando horário (pausada).
 */
export const getQueuePosition = (transferId) => {
    const job = findJob(transferId);
    if (!job) return null;
    if (job.id === runningJobId) return 0;
    const index = ready.indexOf(job);
    return index === -1 ? null : index + 1;
};

// Somente para testes: zera o estado em memória.
export const resetQueueForTests = () => {
    timers.forEach((timer) => clearTimeout(timer));
    timers.clear();
    ready.length = 0;
    jobs = null;
    draining = false;
    runningJobId = null;
    processor = null;
    onFailed = null;
};
