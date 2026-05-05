import '../config/loadEnv.js';
import crypto from 'crypto';

if (!process.env.ENCRYPTION_KEY) {
    throw new Error('ERRO FATAL: ENCRYPTION_KEY não está definida nas variáveis de ambiente. Defina uma string hexadecimal de 32 bytes.');
}
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
if (ENCRYPTION_KEY.length !== 32) {
    throw new Error('ERRO FATAL: ENCRYPTION_KEY deve ter exatamente 32 bytes / 64 caracteres hexadecimais.');
}

const IV_LENGTH = 16; // Vetor de inicialização em AES: sempre 16.
const GCM_IV_LENGTH = 12;

const encryptText = (text) => {
    if (!text) return text;
    const iv = crypto.randomBytes(GCM_IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const authTag = cipher.getAuthTag();

    return ['gcm', iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
}

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
}

export { encryptText, decryptText };
