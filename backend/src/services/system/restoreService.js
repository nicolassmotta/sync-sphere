import fs from 'node:fs';
import crypto from 'node:crypto';
import { DATA_DIR, dataFile, ensureDataDir } from '../../config/paths.js';
import { encryptText, decryptText } from '../../utils/crypto.js';
import { openBackup } from './backupService.js';

const JOURNAL = 'restore-journal.json';
const essentialName = /^(credentials|provider-credentials|provider-settings|transfers|queue|file-imports|file-exports)\.json$|^transfer-tracks-[\w-]+\.json$/;
const replaceBytes = (name, content) => {
    const file = dataFile(name);
    if (content === null) { fs.rmSync(file, { force: true }); return; }
    const temporary = `${file}.${crypto.randomUUID()}.tmp`;
    let descriptor;
    try {
        descriptor = fs.openSync(temporary, 'wx', 0o600);
        fs.writeFileSync(descriptor, content);
        fs.fsyncSync(descriptor);
        fs.closeSync(descriptor);
        descriptor = undefined;
        fs.renameSync(temporary, file);
    } finally {
        if (descriptor !== undefined) fs.closeSync(descriptor);
        fs.rmSync(temporary, { force: true });
    }
};

/** Com bloqueio exclusivo, desfaz restauração interrompida antes de abrir dados. */
export const recoverInterruptedRestore = () => {
    if (!fs.existsSync(dataFile(JOURNAL))) return false;
    let previous;
    try { previous = JSON.parse(decryptText(fs.readFileSync(dataFile(JOURNAL), 'utf8'))); }
    catch { throw new Error('Não foi possível recuperar a restauração. Confira DATA_DIR, ENCRYPTION_KEY e o backup; preserve os arquivos antes de continuar.'); }
    if (!previous || Array.isArray(previous) || typeof previous !== 'object' || !Object.entries(previous).every(([name, value]) => essentialName.test(name) && (value === null || typeof value === 'string'))) {
        throw new Error('A recuperação da restauração está inválida. Preserve os dados e o backup antes de continuar.');
    }
    for (const [name, raw] of Object.entries(previous)) replaceBytes(name, raw === null ? null : Buffer.from(raw, 'base64'));
    fs.unlinkSync(dataFile(JOURNAL));
    return true;
};

export const restoreBackup = (content, password) => {
    // Decifra e valida o pacote inteiro antes de tocar nos arquivos da instalação.
    const snapshot = openBackup(content, password);
    ensureDataDir();
    recoverInterruptedRestore();
    const names = new Set([...fs.readdirSync(DATA_DIR).filter((name) => essentialName.test(name)), ...Object.keys(snapshot.stores)]);
    const previous = {};
    const next = {};
    for (const name of names) {
        previous[name] = fs.existsSync(dataFile(name)) ? fs.readFileSync(dataFile(name)).toString('base64') : null;
        next[name] = Object.hasOwn(snapshot.stores, name) ? encryptText(JSON.stringify(snapshot.stores[name])) : null;
    }
    replaceBytes(JOURNAL, encryptText(JSON.stringify(previous)));
    try {
        for (const [name, raw] of Object.entries(next)) replaceBytes(name, raw);
        fs.unlinkSync(dataFile(JOURNAL));
    } catch (error) {
        recoverInterruptedRestore();
        throw error;
    }
    return { restoredCollections: Object.keys(snapshot.stores).length, createdAt: snapshot.createdAt };
};
