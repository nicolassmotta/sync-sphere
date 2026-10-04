import AppError from '../../utils/AppError.js';

const locks = new Set();
export const withTransferActionLock = async (transferId, action) => {
    const id = String(transferId);
    if (locks.has(id)) throw new AppError('Uma ação desta transferência já está em andamento.', 409);
    locks.add(id);
    try { return await action(); } finally { locks.delete(id); }
};
