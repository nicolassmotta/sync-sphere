import { queuePlaylistTransfers } from '../services/transfer/startTransferService.js';
import {
    estimateTransfer,
    getOwnedTransfer,
    listOwnedTransfers,
    listTransferTracks,
} from '../services/transfer/transferQueryService.js';
import {
    resumeTransfer,
    retryAllTransfers,
    retryTransfer,
} from '../services/transfer/transferQueueActions.js';

/**
 * @function startTransfer
 * @description Inicia o processo de transferência de uma playlist. Valida as entradas (IDs de playlist e cookie do YouTube Music),
 * cria um registro "Pendente" no histórico local e coloca a tarefa pesada na fila local em memória.
 * @param {import('express').Request} req - Requisição Express contendo 'sourcePlaylistId' no body.
 * @param {import('express').Response} res - Resposta Express com HTTP 202, indicando processamento.
 * @param {import('express').NextFunction} next - Middleware global de erros do Express.
 */
export const startTransfer = async (req, res, next) => {
    try {
        const { transfers, playlistIds } = await queuePlaylistTransfers({
            userId: req.user._id,
            direction: req.body.direction,
            sourceProvider: req.body.sourceProvider,
            targetProvider: req.body.targetProvider,
            sourcePlaylistId: req.body.sourcePlaylistId,
            sourcePlaylistIds: req.body.sourcePlaylistIds,
        });

        res.status(202).json({
            status: 'success',
            message: playlistIds.length === 1
                ? 'A playlist foi engatilhada para migração.'
                : `${playlistIds.length} playlists foram engatilhadas para migração.`,
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

export const getTransferTracks = async (req, res, next) => {
    try {
        const { counts, tracks } = await listTransferTracks({
            transferId: req.params.transferId,
            userId: req.user.id,
            status: req.query.status,
        });

        res.status(200).json({
            status: 'success',
            results: tracks.length,
            data: { counts, tracks },
        });
    } catch (error) {
        next(error);
    }
};

export const retryTransferTracks = async (req, res, next) => {
    try {
        const { transfer, requeued } = await retryTransfer({
            transferId: req.params.transferId,
            userId: req.user.id,
        });

        res.status(202).json({
            status: 'success',
            message: `${requeued} ${requeued === 1 ? 'faixa voltou' : 'faixas voltaram'} para a fila.`,
            data: { transfer, requeued },
        });
    } catch (error) {
        next(error);
    }
};

export const retryAllTransferTracks = async (req, res, next) => {
    try {
        const result = await retryAllTransfers({ userId: req.user.id });

        res.status(202).json({
            status: 'success',
            message: result.requeuedTracks
                ? `${result.requeuedTracks} faixas de ${result.requeuedTransfers} playlists voltaram para a fila.`
                : 'Nenhuma faixa pendente para tentar de novo.',
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

export const resumeTransferNow = async (req, res, next) => {
    try {
        const transfer = await resumeTransfer({
            transferId: req.params.transferId,
            userId: req.user.id,
        });

        res.status(202).json({
            status: 'success',
            message: 'Transferência retomada.',
            data: { transfer },
        });
    } catch (error) {
        next(error);
    }
};

export const getTransferEstimate = async (req, res, next) => {
    try {
        const estimate = await estimateTransfer({
            userId: req.user.id,
            direction: req.query.direction,
            targetProvider: req.query.targetProvider,
            trackCount: Number(req.query.count) || 0,
        });

        res.status(200).json({
            status: 'success',
            data: { estimate },
        });
    } catch (error) {
        next(error);
    }
};


export const downloadTransferReport = async (req, res, next) => {
    try {
        const { buildTransferReport } = await import('../services/transfer/transferReportService.js');
        const report = await buildTransferReport({ transferId: req.params.transferId, userId: req.user.id, format: req.query.format });
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Type', report.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="syncsphere-relatorio.${report.extension}"`);
        res.send(report.body);
    } catch (error) { next(error); }
};
