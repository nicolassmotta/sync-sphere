export default class ProgressPublisher {
    constructor(io) {
        this.io = io;
    }

    getTransferRoom(transferId) {
        return `transfer:${transferId}`;
    }

    emit(transferId, payload) {
        this.io.to(this.getTransferRoom(transferId)).emit('transfer_update', {
            transferId,
            ...payload,
        });
    }
}
