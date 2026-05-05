import Transfer from '../../models/Transfer.js';
import User from '../../models/User.js';

export default class TransferRepository {
    async getTransferForProcessing(transferId) {
        const transferRecord = await Transfer.findById(transferId);
        if (!transferRecord) {
            throw new Error('Transferência excluída antes de iniciar.');
        }

        return transferRecord;
    }

    async getUserWithTransferSecrets(userId) {
        const user = await User.findById(userId).select('+spotifyToken +spotifyRefreshToken');
        if (!user) {
            throw new Error('Usuário da transferência não foi encontrado.');
        }

        return user;
    }

    async update(transferRecord, fields) {
        Object.assign(transferRecord, fields);
        await transferRecord.save();
        return transferRecord;
    }

    async save(transferRecord) {
        await transferRecord.save();
        return transferRecord;
    }

    async markFailed(transferRecord, message) {
        transferRecord.status = 'failed';
        transferRecord.lastMessage = message || 'Falha crítica na transferência.';
        await transferRecord.save();
        return transferRecord;
    }
}
