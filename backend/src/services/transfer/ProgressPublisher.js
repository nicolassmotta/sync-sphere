const DEFAULT_THROTTLE_MS = 500;

/**
 * Publica o progresso das transferências via Socket.io. Atualizações comuns
 * saem no máximo a cada `throttleMs` por transferência (a última sempre é
 * entregue); mudanças de status saem na hora.
 */
export default class ProgressPublisher {
    constructor(io, { throttleMs = DEFAULT_THROTTLE_MS } = {}) {
        this.io = io;
        this.throttleMs = throttleMs;
        this.lastEmitAt = new Map();
        this.pending = new Map();
        this.timers = new Map();
    }

    getTransferRoom(transferId) {
        return `transfer:${transferId}`;
    }

    send(transferId, payload) {
        this.lastEmitAt.set(transferId, Date.now());
        this.io.to(this.getTransferRoom(transferId)).emit('transfer_update', {
            transferId,
            ...payload,
        });
    }

    emit(transferId, payload, { force = false } = {}) {
        const elapsed = Date.now() - (this.lastEmitAt.get(transferId) || 0);

        if (force || this.throttleMs <= 0 || elapsed >= this.throttleMs) {
            clearTimeout(this.timers.get(transferId));
            this.timers.delete(transferId);
            this.pending.delete(transferId);
            this.send(transferId, payload);
            return;
        }

        this.pending.set(transferId, payload);
        if (this.timers.has(transferId)) return;

        const timer = setTimeout(() => {
            this.timers.delete(transferId);
            const latest = this.pending.get(transferId);
            this.pending.delete(transferId);
            if (latest) this.send(transferId, latest);
        }, this.throttleMs - elapsed);
        timer.unref?.();
        this.timers.set(transferId, timer);
    }
}
