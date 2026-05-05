import { queuePlaylistTransfers } from '../services/transfer/startTransferService.js';
import { getOwnedTransfer, listOwnedTransfers } from '../services/transfer/transferQueryService.js';

/**
 * @function startTransfer
 * @description Inicia o processo de transferência de uma playlist. Valida as entradas (IDs de playlist e cookie do YouTube Music),
 * cria um documento de registro "Pendente" no banco de dados e coloca a tarefa pesada na fila BullMQ/Redis.
 * @param {import('express').Request} req - Requisição Express contendo 'sourcePlaylistId' no body.
 * @param {import('express').Response} res - Resposta Express com HTTP 202, indicando processamento.
 * @param {import('express').NextFunction} next - Middleware global de erros do Express.
 */
export const startTransfer = async (req, res, next) => {
    try {
        const { transfers, playlistIds } = await queuePlaylistTransfers({
            userId: req.user._id,
            sourcePlaylistId: req.body.sourcePlaylistId,
            sourcePlaylistIds: req.body.sourcePlaylistIds,
        });

        res.status(202).json({
            status: 'success',
            message: playlistIds.length === 1
                ? 'A playlist foi engatilhada para conversão.'
                : `${playlistIds.length} playlists foram engatilhadas para conversão.`,
            data: {
                transferId: transfers[0]._id,
                transferIds: transfers.map((transfer) => transfer._id),
            }
        });

    } catch (error) {
        next(error);
    }
};

/**
 * @function getTransferStatus
 * @description Busca o status atualizado de uma transferência no banco de dados.
 * Incorpora defesas ativas contra ataques IDOR, garantindo que o usuário requisitante
 * é exatamente o mesmo que criou a fila.
 * @param {import('express').Request} req - Contém `transferId` em `req.params` e os dados do usuário autenticado.
 * @param {import('express').Response} res - Resposta Express com o objeto de transferência atualizado.
 * @param {import('express').NextFunction} next - Middleware global para repasse de AppError.
 */
export const getTransferStatus = async (req, res, next) => {
    try {
         const { transferId } = req.params;
         const transfer = await getOwnedTransfer({ transferId, userId: req.user.id });

         res.status(200).json({
              status: 'success',
              data: {
                   transfer
              }
         });

    } catch (error) {
         next(error);
    }
}

export const listTransfers = async (req, res, next) => {
    try {
        const transfers = await listOwnedTransfers({ userId: req.user._id });

        res.status(200).json({
            status: 'success',
            results: transfers.length,
            data: {
                transfers,
            },
        });
    } catch (error) {
        next(error);
    }
};
