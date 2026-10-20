import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';

// Abre um pacote portátil pelo iniciador do sistema atual e confere se o painel responde.
const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const archive = args[0] && !args[0].startsWith('--') ? path.resolve(args[0]) : null;
const port = option('--port', '18765');
const isWindows = process.platform === 'win32';
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'syncsphere-verify-'));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const run = (command, commandArgs) => {
    const result = spawnSync(command, commandArgs, { stdio: 'inherit', shell: false });
    if (result.status !== 0) throw new Error(`Não foi possível extrair o pacote: ${command}.`);
};
let launcher;
let exited = false;
let output = '';

try {
    if (!archive || !fs.existsSync(archive)) throw new Error('Informe o caminho de um pacote gerado por npm run package.');
    if (!/^\d+$/.test(port)) throw new Error('Porta inválida em --port.');
    if (fs.existsSync(`${archive}.sha256`)) {
        const expected = fs.readFileSync(`${archive}.sha256`, 'utf8').split(/\s+/)[0];
        if (crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex') !== expected) throw new Error('A soma SHA-256 do pacote não confere.');
    }
    // No Windows, o tar do sistema extrai ZIP; o tar do Git Bash, primeiro no PATH do CI, não.
    if (isWindows) run(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe'), ['-xf', archive, '-C', workspace]);
    else if (archive.endsWith('.zip')) run('unzip', ['-q', archive, '-d', workspace]);
    else run('tar', ['-xzf', archive, '-C', workspace]);
    const [name] = fs.readdirSync(workspace);
    const bundle = path.join(workspace, name);
    const manifest = JSON.parse(fs.readFileSync(path.join(bundle, 'package-manifest.json'), 'utf8'));
    const target = `${isWindows ? 'win' : process.platform}-${process.arch}`;
    if (manifest.target !== target) throw new Error(`O pacote é para ${manifest.target}, mas este computador é ${target}.`);
    for (const forbidden of ['backend/.env', 'backend/data']) if (fs.existsSync(path.join(bundle, forbidden))) throw new Error(`O pacote não deveria conter ${forbidden}.`);
    const environment = { ...process.env, PORT: port };
    launcher = isWindows
        ? spawn('cmd.exe', ['/d', '/c', 'Iniciar.cmd', '--no-browser'], { cwd: bundle, env: environment, windowsHide: true })
        : spawn(path.join(bundle, process.platform === 'darwin' ? 'Iniciar.command' : 'Iniciar.sh'), ['--no-browser'], { cwd: bundle, env: environment, detached: true });
    for (const stream of [launcher.stdout, launcher.stderr]) stream.on('data', (chunk) => { output += chunk; });
    launcher.on('exit', () => { exited = true; });
    launcher.on('error', (error) => { exited = true; output += `${error.message}\n`; });
    const base = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let attempt = 0; attempt < 90 && !ready && !exited; attempt += 1) {
        try { ready = (await fetch(`${base}/api/ready`, { signal: AbortSignal.timeout(1000) })).ok; } catch { /* Ainda iniciando. */ }
        if (!ready) await wait(1000);
    }
    if (!ready) throw new Error(exited ? 'O iniciador do pacote encerrou antes de o aplicativo ficar pronto.' : 'O aplicativo do pacote não ficou pronto em 90 segundos.');
    const health = await (await fetch(`${base}/api/health`)).json();
    if (health.application !== 'SyncSphere') throw new Error('Outro programa respondeu na porta da conferência.');
    if (!(await (await fetch(`${base}/`)).text()).includes('<div id="root"></div>')) throw new Error('O painel não foi servido pelo pacote.');
    console.log(`Pacote conferido em ${target}: ${name} abriu pelo iniciador e respondeu em ${base}.`);
} catch (error) {
    console.error(error.message);
    if (output) console.error(`\nSaída do iniciador:\n${output}`);
    process.exitCode = 1;
} finally {
    if (launcher?.pid && !exited) {
        if (isWindows) spawnSync('taskkill', ['/pid', String(launcher.pid), '/t', '/f'], { stdio: 'ignore' });
        else try { process.kill(-launcher.pid, 'SIGTERM'); } catch { /* Já encerrado. */ }
        for (let attempt = 0; attempt < 20 && !exited; attempt += 1) await wait(250);
    }
    fs.rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
}
