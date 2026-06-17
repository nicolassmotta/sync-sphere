import '../config/loadEnv.js';
import { writeStore, readStore } from '../storage/jsonStore.js';

/**
 * No modo local a fila roda em memória (some quando o processo encerra). O que
 * persiste é o histórico de transferências em `data/transfers.json`. Este script
 * limpa esse histórico.
 */
const run = async () => {
    const before = readStore('transfers.json', []);
    console.log(`[Histórico] Transferências antes da limpeza: ${before.length}`);

    writeStore('transfers.json', []);

    console.log('[Histórico] Histórico de transferências limpo.');
};

run();
