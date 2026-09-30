import '../config/loadEnv.js';
import { writeStore, readStore } from '../storage/jsonStore.js';
import { deleteTransferTracks } from '../services/transfer/TransferTrackStore.js';

/**
 * Limpa o histórico de transferências (`data/transfers.json`), a fila
 * persistida (`data/queue.json`) e o estado por faixa de cada transferência.
 * Rode com o servidor parado.
 */
const run = async () => {
    const before = readStore('transfers.json', []);
    console.log(`[Histórico] Transferências antes da limpeza: ${before.length}`);

    before.forEach((transfer) => deleteTransferTracks(transfer._id));
    writeStore('transfers.json', []);
    writeStore('queue.json', []);

    console.log('[Histórico] Histórico, fila e estado das faixas limpos.');
};

run();
