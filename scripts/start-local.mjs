import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backend = path.join(root, 'backend');
const args = process.argv.slice(2);
const noBrowser = args.includes('--no-browser');
const openBrowser = (url) => {
    const command = process.platform === 'win32' ? 'rundll32' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    const commandArgs = process.platform === 'win32' ? ['url.dll,FileProtocolHandler', url] : [url];
    const child = spawn(command, commandArgs, { detached: true, stdio: 'ignore' });
    child.on('error', () => console.log(`Abra este endereço no navegador: ${url}`));
    child.unref();
};

try {
    if (Number(process.versions.node.split('.')[0]) < 20) throw new Error('Esta instalação precisa de Node.js 20 ou superior. Use um pacote portátil ou instale Node.js 24 LTS.');
    if (!fs.existsSync(path.join(root, 'frontend', 'dist', 'index.html'))) throw new Error('O painel ainda não foi preparado. Na instalação pelo código, execute npm run setup uma vez.');
    if (!fs.existsSync(path.join(backend, 'node_modules'))) throw new Error('As dependências ainda não foram preparadas. Execute npm run setup ou use o pacote portátil.');
    if (!process.env.DOTENV_CONFIG_PATH) {
        const environment = path.join(backend, '.env');
        if (!fs.existsSync(environment)) fs.copyFileSync(path.join(backend, '.env.example'), environment, fs.constants.COPYFILE_EXCL);
        process.env.DOTENV_CONFIG_PATH = environment;
    }
    const require = createRequire(path.join(backend, 'package.json'));
    require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH });
    const port = process.env.PORT || 8000;
    if (!/^\d+$/.test(String(port)) || Number(port) < 1 || Number(port) > 65535) throw new Error('A porta configurada é inválida. Confira PORT na configuração avançada.');
    const url = `http://127.0.0.1:${port}/dashboard`;
    const healthUrl = `http://127.0.0.1:${port}/api/health`;
    const isRunning = async () => {
        try {
            const response = await fetch(healthUrl, { signal: AbortSignal.timeout(1000) });
            const health = await response.json();
            return response.ok && health.application === 'SyncSphere' ? health : null;
        } catch { return false; }
    };
    const current = await isRunning();
    if (current) {
        let lock;
        try { lock = JSON.parse(fs.readFileSync(path.join(path.resolve(process.env.DATA_DIR || path.join(backend, 'data')), 'server.lock'), 'utf8')); } catch { /* Pode haver outra instalação na porta. */ }
        if (lock?.pid !== current.pid) throw new Error('Outra instalação do SyncSphere já usa esta porta. Encerre a outra janela antes de abrir esta instalação.');
        console.log(`O SyncSphere já está aberto: ${url}`);
        if (!noBrowser) openBrowser(url);
    } else {
        console.log('Iniciando o SyncSphere. Mantenha esta janela aberta durante as migrações.');
        const child = spawn(process.execPath, ['src/server.js'], { cwd: backend, env: process.env, stdio: 'inherit' });
        let exited = false;
        child.on('exit', (code) => { exited = true; process.exitCode = code ?? 1; });
        child.on('error', () => { exited = true; console.error('Não foi possível iniciar o aplicativo. Confira a instalação e consulte Ajuda.'); process.exitCode = 1; });
        for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { child.kill(signal); });
        for (let attempt = 0; attempt < 60 && !exited; attempt += 1) {
            if ((await isRunning())?.pid === child.pid) {
                console.log(`Pronto para usar: ${url}`);
                if (!noBrowser) openBrowser(url);
                break;
            }
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
        if (!exited && (await isRunning())?.pid !== child.pid) {
            console.error('O aplicativo demorou a iniciar. Confira a mensagem acima. Você também pode abrir Ajuda na documentação.');
            child.kill('SIGTERM');
            process.exitCode = 1;
        }
    }
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
