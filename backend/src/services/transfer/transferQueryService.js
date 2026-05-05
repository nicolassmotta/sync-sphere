import Transfer from '../../models/Transfer.js';
import AppError from '../../utils/AppError.js';

export const getOwnedTransfer = async ({ transferId, userId }) => {
    const transfer = await Transfer.findById(transferId);

    if (!transfer) {
        throw new AppError('Nenhum dado de conversão achado com esse ID.', 404);
    }

    if (transfer.user.toString() !== userId) {
        throw new AppError('Acesso Negado. Esta transferência pertence a outro usuário e você não tem autorização para visualizá-la.', 403);
    }

    return transfer;
};

export const listOwnedTransfers = ({ userId, limit = 50 }) => {
    return Transfer.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(limit);
};
