import fs from 'fs';
import { ensureDataDir, dataFile } from '../config/paths.js';
import { encryptText, decryptText } from '../utils/crypto.js';

/**
 * Armazenamento local simples baseado em arquivos JSON cifrados. Cada "coleção"
 * vira um arquivo dentro de DATA_DIR. Substitui o MongoDB no modo local: a
 * pessoa clona o projeto, roda, e os dados ficam na própria máquina.
 */
export const readStore = (name, fallback) => {
    ensureDataDir();
    const file = dataFile(name);

    if (!fs.existsSync(file)) {
        return fallback;
    }

    try {
        const raw = fs.readFileSync(file, 'utf8').trim();
        if (!raw) return fallback;
        return JSON.parse(decryptText(raw));
    } catch {
        // Arquivo corrompido ou chave trocada: começa do zero em vez de derrubar a app.
        return fallback;
    }
};

export const writeStore = (name, data) => {
    ensureDataDir();
    fs.writeFileSync(dataFile(name), encryptText(JSON.stringify(data)), { mode: 0o600 });
};

export const removeStore = (name) => {
    fs.rmSync(dataFile(name), { force: true });
};
