import fs from 'node:fs';
import crypto from 'node:crypto';
import { dataFile, ensureDataDir } from '../config/paths.js';

/** Impede servidor e restauração de escreverem no mesmo diretório ao mesmo tempo. */
export const acquireDataDirectoryLock = () => {
    ensureDataDir();
    const file = dataFile('server.lock');
    const token = crypto.randomUUID();
    if (fs.existsSync(file)) {
        let previous;
        try { previous = JSON.parse(fs.readFileSync(file, 'utf8')); }
        catch { throw new Error('O bloqueio dos dados está inválido. Confira se o aplicativo está encerrado antes de recuperar server.lock.'); }
        if (!Number.isInteger(previous.pid) || previous.pid <= 0) throw new Error('Bloqueio dos dados inválido. Encerre o aplicativo e confira server.lock.');
        try {
            process.kill(previous.pid, 0);
            throw new Error('O aplicativo já está aberto neste diretório de dados. Encerre-o antes de continuar.');
        } catch (error) {
            if (error.code !== 'ESRCH') throw error;
            fs.unlinkSync(file);
        }
    }
    fs.writeFileSync(file, JSON.stringify({ pid: process.pid, token }), { flag: 'wx', mode: 0o600 });
    return () => {
        try {
            if (JSON.parse(fs.readFileSync(file, 'utf8')).token === token) fs.unlinkSync(file);
        } catch (error) { if (error.code !== 'ENOENT') throw error; }
    };
};
