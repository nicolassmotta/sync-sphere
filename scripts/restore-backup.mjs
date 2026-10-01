import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { createRequire } from 'node:module';
import { Writable } from 'node:stream';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
let filename = args.find((argument) => !argument.startsWith('--'));
process.env.DOTENV_CONFIG_PATH ||= path.join(root, 'backend', '.env');
try {
    createRequire(path.join(root, 'backend', 'package.json'))('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH });
} catch {
    console.error('Prepare a instalação com npm run setup ou use o pacote portátil antes de restaurar.');
    process.exit(1);
}
if (args.includes('--interactive')) {
    if (!process.stdin.isTTY) { console.error('Abra Restaurar-backup em um terminal interativo.'); process.exit(1); }
    const prompt = createInterface({ input: process.stdin, output: process.stdout });
    try {
        console.log('Encerre o SyncSphere. A restauração substituirá os dados locais pelo conteúdo do backup.');
        console.log(`Diretório que será substituído: ${path.resolve(process.env.DATA_DIR || path.join(root, 'backend', 'data'))}`);
        filename = (await prompt.question('Caminho do arquivo .ssb: ')).trim().replace(/^"|"$/g, '');
        const confirmation = await prompt.question('Digite RESTAURAR para confirmar: ');
        if (confirmation !== 'RESTAURAR') { console.log('Restauração cancelada.'); process.exit(0); }
        args.push('--confirm');
    } finally { prompt.close(); }
}
if (!filename || !args.includes('--confirm')) {
    console.error('Encerre o SyncSphere. Esta ação substitui histórico, credenciais e arquivos importados/exportados pelo backup.');
    console.error('Depois de conferir o backup, execute: npm run backup:restore -- caminho/backup.ssb --confirm');
    process.exit(1);
}
// O mesmo diretório e ambiente usados pelo aplicativo também valem para a restauração.
process.env.DOTENV_CONFIG_PATH ||= path.join(root, 'backend', '.env');
let release;
try {
    const { acquireDataDirectoryLock } = await import('../backend/src/storage/dataDirectoryLock.js');
    const { restoreBackup } = await import('../backend/src/services/system/restoreService.js');
    release = acquireDataDirectoryLock();
    let password = process.env.BACKUP_PASSWORD;
    if (!password) {
        if (!process.stdin.isTTY) throw new Error('Abra um terminal interativo para informar a senha do backup.');
        process.stdout.write('Senha do backup (não será exibida): ');
        const output = new Writable({ write(chunk, encoding, callback) { callback(); } });
        const prompt = createInterface({ input: process.stdin, output, terminal: true });
        try { password = await prompt.question(''); } finally { prompt.close(); process.stdout.write('\n'); }
    }
    if (fs.statSync(filename).size > 90 * 1024 * 1024) throw new Error('O arquivo ultrapassa o limite do backup guiado.');
    const result = restoreBackup(fs.readFileSync(filename, 'utf8'), password);
    console.log(`Backup de ${result.createdAt} restaurado: ${result.restoredCollections} coleções. Abra o SyncSphere novamente.`);
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
} finally { release?.(); }
