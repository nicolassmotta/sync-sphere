import fs from 'node:fs';
import crypto from 'node:crypto';
import { z } from 'zod';
import { DATA_DIR, dataFile } from '../../config/paths.js';
import { readStore, validateEssentialStores } from '../../storage/jsonStore.js';
import AppError from '../../utils/AppError.js';

export const BACKUP_MAX_BYTES = 64 * 1024 * 1024;
const essentialName = /^(credentials|provider-credentials|provider-settings|transfers|queue|file-imports|file-exports)\.json$|^transfer-tracks-[\w-]+\.json$/;
export const backupPasswordSchema = z.string().min(12, 'Use uma senha de pelo menos 12 caracteres.').max(200, 'A senha deve ter até 200 caracteres.');
const snapshotSchema = z.object({
    format: z.literal('syncsphere-backup'), version: z.literal(1), createdAt: z.string().datetime(),
    stores: z.record(z.unknown()).refine((stores) => Object.keys(stores).every((name) => essentialName.test(name)), 'O backup contém um caminho inválido.'),
});
const deriveKey = (password, salt) => crypto.scryptSync(password, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });

export const createBackup = (password) => {
    backupPasswordSchema.parse(password);
    validateEssentialStores();
    const jobs = readStore('queue.json', []);
    if (jobs.length) throw new AppError('Aguarde a fila terminar antes de criar o backup. Transferências pausadas também precisam ser concluídas.', 409);
    const stores = {};
    for (const name of fs.readdirSync(DATA_DIR).sort()) {
        if (essentialName.test(name)) {
            if (fs.statSync(dataFile(name)).size > BACKUP_MAX_BYTES) throw new AppError('Os dados ultrapassam o limite de 64 MB do backup guiado.', 413);
            stores[name] = readStore(name, null);
        }
    }
    const plain = Buffer.from(JSON.stringify({ format: 'syncsphere-backup', version: 1, createdAt: new Date().toISOString(), stores }));
    if (plain.length > BACKUP_MAX_BYTES) throw new AppError('Os dados ultrapassam o limite de 64 MB do backup guiado.', 413);
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(password, salt), iv);
    const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
    return JSON.stringify({ format: 'syncsphere-encrypted-backup', version: 1, salt: salt.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: encrypted.toString('base64') });
};

export const openBackup = (content, password) => {
    backupPasswordSchema.parse(password);
    try {
        if (Buffer.byteLength(content) > BACKUP_MAX_BYTES * 1.4) throw new Error();
        const envelope = JSON.parse(content);
        if (envelope.format !== 'syncsphere-encrypted-backup' || envelope.version !== 1) throw new Error();
        const salt = Buffer.from(envelope.salt, 'base64');
        const iv = Buffer.from(envelope.iv, 'base64');
        const tag = Buffer.from(envelope.tag, 'base64');
        if (salt.length !== 16 || iv.length !== 12 || tag.length !== 16) throw new Error();
        const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(password, salt), iv);
        decipher.setAuthTag(tag);
        const plain = Buffer.concat([decipher.update(Buffer.from(envelope.data, 'base64')), decipher.final()]);
        const snapshot = snapshotSchema.parse(JSON.parse(plain.toString('utf8')));
        for (const [name, value] of Object.entries(snapshot.stores)) {
            const isCredential = name === 'credentials.json' || name === 'provider-credentials.json' || name === 'provider-settings.json';
            if (isCredential ? (!value || typeof value !== 'object' || Array.isArray(value)) : !Array.isArray(value)) throw new Error();
        }
        return snapshot;
    } catch {
        throw new AppError('Não foi possível abrir o backup. Confira a senha e se o arquivo está completo. Nenhum dado foi restaurado.', 400);
    }
};
