import fs from 'fs';
import crypto from 'node:crypto';
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
    const file = dataFile(name);
    const temporary = `${file}.${crypto.randomUUID()}.tmp`;
    let descriptor;
    try {
        descriptor = fs.openSync(temporary, 'wx', 0o600);
        fs.writeFileSync(descriptor, encryptText(JSON.stringify(data)));
        fs.fsyncSync(descriptor);
        fs.closeSync(descriptor);
        descriptor = undefined;
        fs.renameSync(temporary, file);
    } finally {
        if (descriptor !== undefined) fs.closeSync(descriptor);
        fs.rmSync(temporary, { force: true });
    }
};

export const removeStore = (name) => {
    fs.rmSync(dataFile(name), { force: true });
};
