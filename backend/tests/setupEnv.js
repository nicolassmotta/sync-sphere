import os from 'os';
import path from 'path';
import fs from 'fs';

// Variáveis mínimas para os testes rodarem sem depender de .env, banco ou Redis.
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.APP_ENV = process.env.APP_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '0'.repeat(64);

// Dados locais dos testes vão para um diretório temporário descartável.
const testDataDir = path.join(os.tmpdir(), 'syncsphere-test-data');
fs.mkdirSync(testDataDir, { recursive: true });
process.env.DATA_DIR = testDataDir;
