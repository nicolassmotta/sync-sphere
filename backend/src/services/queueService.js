import { Queue } from 'bullmq';
import redisConnection from '../config/redis.js';
import logger from '../utils/logger.js';

/**
 * @constant playlistQueue
 * @description Instância principal da fila BullMQ. Gerencia tarefas em segundo plano (Redis) relacionadas
 * à transferência de músicas do Spotify para o YouTube.
 */
let playlistQueue = null;

const getPlaylistQueue = () => {
    if (!playlistQueue) {
        // Inicialização lazy evita efeitos colaterais em import (especialmente em testes)
        playlistQueue = new Queue('playlist-transfer', {
            connection: redisConnection,
        });
    }

    return playlistQueue;
};

/**
 * @function addTransferJob
 * @description Auxiliar assíncrono que injeta parâmetros da requisição Express na fila do Redis.
 * Possui lógica de nova tentativa em caso de falha de conexão da máquina ao processar o trabalhador.
 * @param {string} transferId - O ID do banco de dados Mongoose da transferência em questão.
 * @param {string} userId - O ID do usuário dono dessa migração.
 * @param {string} sourcePlaylistId - O ID público/privado da playlist original no Spotify.
 * @returns {Promise<void>}
 */
// Auxiliar que injeta os parâmetros na fila.
export const addTransferJob = async (transferId, userId, sourcePlaylistId) => {
    const queue = getPlaylistQueue();

    // Adiciona com lógica de nova tentativa, tentando 3 vezes se a conexão cair no processo.
    await queue.add('transfer', {
        transferId,
        userId,
        sourcePlaylistId
    }, {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 5000 // Atrasa 5s se falhar
        }
    });

    logger.info(`[Fila] Tarefa da transferência ${transferId} inserida com sucesso na fila principal.`);
};
