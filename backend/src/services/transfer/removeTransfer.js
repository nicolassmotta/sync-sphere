import Transfer from '../../models/Transfer.js';
import { deleteExport } from '../../providers/file/fileLibrary.js';
import AppError from '../../utils/AppError.js';
import { hasTransferJob } from '../queueService.js';
import { withTransferActionLock } from './transferActionLock.js';
import { getOwnedTransfer } from './transferQueryService.js';
import { deleteTransferTracks } from './TransferTrackStore.js';

/**
 * Remove do histórico uma transferência terminada, com o estado por faixa e o
 * arquivo gerado no destino Arquivo. Playlists criadas nas plataformas ficam
 * intactas, assim como o cache de correspondências compartilhado.
 */
export const removeTransferFromHistory = (options) => withTransferActionLock(options.transferId, async () => {
    const transfer = await getOwnedTransfer(options);
    if (!['completed', 'failed'].includes(transfer.status) || hasTransferJob(transfer._id)) {
        throw new AppError('Esta migração ainda está em andamento. Aguarde terminar antes de remover do histórico.', 409);
    }
    await Transfer.deleteById(transfer._id);
    deleteTransferTracks(transfer._id);
    if (transfer.targetProvider === 'file' && transfer.targetPlaylistId) deleteExport(transfer.targetPlaylistId);
    return transfer;
});
