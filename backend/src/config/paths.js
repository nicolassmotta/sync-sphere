import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// src/config -> raiz do backend.
export const BACKEND_ROOT = path.resolve(__dirname, '../../');
export const PROJECT_ROOT = path.resolve(BACKEND_ROOT, '..');
export const FRONTEND_DIST_DIR = path.join(PROJECT_ROOT, 'frontend', 'dist');

/**
 * Diretório onde a aplicação guarda os dados locais (credenciais cifradas e
 * histórico de transferências). Pode ser sobrescrito com DATA_DIR para quem
 * quiser apontar para outro lugar.
 */
export const DATA_DIR = process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.join(BACKEND_ROOT, 'data');

export const ensureDataDir = () => {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    return DATA_DIR;
};

export const dataFile = (name) => path.join(DATA_DIR, name);
