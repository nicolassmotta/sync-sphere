import '../config/loadEnv.js';
import crypto from 'crypto';
import fs from 'fs';
import { ensureDataDir, dataFile } from '../config/paths.js';

/**
 * Resolve a chave de criptografia de 32 bytes usada para proteger as
 * credenciais locais. Prioriza ENCRYPTION_KEY (64 caracteres hex). Se não
 * existir, gera uma chave automaticamente e persiste em data/encryption.key,
 * para que o projeto funcione assim que a pessoa clona e roda, sem setup.
 */
const resolveEncryptionKey = () => {
    const envKey = String(process.env.ENCRYPTION_KEY || '').trim();
    if (envKey) {
        const buffer = Buffer.from(envKey, 'hex');
        if (!/^[a-f0-9]{64}$/i.test(envKey)) {
            throw new Error('ENCRYPTION_KEY deve ter exatamente 32 bytes / 64 caracteres hexadecimais.');
        }
        return buffer;
    }

    ensureDataDir();
    const keyPath = dataFile('encryption.key');

    if (fs.existsSync(keyPath)) {
        const stored = fs.readFileSync(keyPath, 'utf8').trim();
        const buffer = Buffer.from(stored, 'hex');
        if (/^[a-f0-9]{64}$/i.test(stored)) {
            return buffer;
        }
        throw new Error('Chave local inválida. Confira DATA_DIR, ENCRYPTION_KEY e o backup. A chave existente foi preservada.');
    }

    const generated = crypto.randomBytes(32);
    fs.writeFileSync(keyPath, generated.toString('hex'), { mode: 0o600, flag: 'wx' });
    return generated;
};

const ENCRYPTION_KEY = resolveEncryptionKey();

const GCM_IV_LENGTH = 12;

const encryptText = (text) => {
    if (!text) return text;
    const iv = crypto.randomBytes(GCM_IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const authTag = cipher.getAuthTag();

    return ['gcm', iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
};

const decryptText = (text) => {
    if (!text) return text;

    if (text.startsWith('gcm:')) {
        const [, ivHex, authTagHex, encryptedHex] = text.split(':');
        const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, Buffer.from(ivHex, 'hex'));
        decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
        let decrypted = decipher.update(Buffer.from(encryptedHex, 'hex'));
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    }

    // Compatibilidade com valores antigos gravados em AES-256-CBC.
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
};

export { encryptText, decryptText };
