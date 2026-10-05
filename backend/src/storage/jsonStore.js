import AppError from '../utils/AppError.js';
import fs from 'fs';
import crypto from 'node:crypto';
import { ensureDataDir, dataFile, DATA_DIR } from '../config/paths.js';
import { encryptText, decryptText } from '../utils/crypto.js';

/**
 * Armazenamento local simples baseado em arquivos JSON cifrados. Cada "coleção"
 * vira um arquivo dentro de DATA_DIR. Substitui o MongoDB no modo local: a
 * pessoa clona o projeto, roda, e os dados ficam na própria máquina.
 */
const DISCARDABLE_STORES = new Set(['match-cache.json', 'provider-stats.json']);
const unreadableStores = new Set();
const hasEssentialShape = (name, value) => {
    const object = value !== null && typeof value === 'object' && !Array.isArray(value);
    if (/^(credentials|provider-credentials|provider-settings)\.json$/.test(name)) return object;
    if (/^(transfers|queue|file-imports|file-exports)\.json$/.test(name) || /^transfer-tracks-.*\.json$/.test(name)) {
        return Array.isArray(value) && value.every((item) => item !== null && typeof item === 'object' && !Array.isArray(item));
    }
    return true;
};
const storageError = () => new AppError(
    'Não foi possível abrir os dados locais. Confira DATA_DIR, ENCRYPTION_KEY e o backup antes de continuar.', 503
);

export const readStore = (name, fallback) => {
    try {
        ensureDataDir();
        const raw = fs.readFileSync(dataFile(name), 'utf8');
        const value = JSON.parse(decryptText(raw.trim()));
        if (!hasEssentialShape(name, value)) throw storageError();
        unreadableStores.delete(name);
        return value;
    } catch (error) {
        if (error.code === 'ENOENT') return fallback;
        if (DISCARDABLE_STORES.has(name)) return fallback;
        unreadableStores.add(name);
        throw storageError();
    }
};

// Confere também checkpoints e arquivos ainda não carregados pelos consumidores.
export const validateEssentialStores = () => {
    ensureDataDir();
    for (const name of fs.readdirSync(DATA_DIR)) {
        if (/^(credentials|provider-credentials|provider-settings|transfers|queue|file-imports|file-exports)\.json$/.test(name)
            || /^transfer-tracks-.*\.json$/.test(name)) readStore(name, null);
    }
};

export const writeStore = (name, data) => {
    if (unreadableStores.has(name)) throw storageError();
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
    unreadableStores.delete(name);
    fs.rmSync(dataFile(name), { force: true });
};
