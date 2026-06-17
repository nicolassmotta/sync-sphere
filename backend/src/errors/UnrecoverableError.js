/**
 * Erro que sinaliza falha definitiva de uma transferência: a fila local não
 * deve tentar novamente quando recebe um erro deste tipo. Substitui o
 * `UnrecoverableError` do BullMQ agora que a fila roda em memória.
 */
export class UnrecoverableError extends Error {
    constructor(message) {
        super(message);
        this.name = 'UnrecoverableError';
    }
}

export default UnrecoverableError;
