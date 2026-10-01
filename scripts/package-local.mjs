import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const nodeVersion = option('--node-version', '24.15.0');
const supported = ['linux-x64', 'linux-arm64', 'darwin-x64', 'darwin-arm64', 'win-x64', 'win-arm64'];
const targets = args.includes('--all') ? supported : [option('--target', `${process.platform === 'win32' ? 'win' : process.platform}-${process.arch}`)];
const artifacts = path.resolve(option('--output', path.join(root, 'artifacts')));
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'syncsphere-package-'));
const run = (command, commandArgs, cwd) => {
    const result = spawnSync(command, commandArgs, { cwd, stdio: 'inherit', shell: false });
    if (result.status !== 0) throw new Error(`Falha ao preparar o pacote: ${command}.`);
};
const fetchFile = async (url, filename) => {
    const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
    if (!response.ok) throw new Error(`Download oficial do Node.js falhou (${response.status}).`);
    fs.writeFileSync(filename, Buffer.from(await response.arrayBuffer()));
};
const copy = (relative, destination) => fs.cpSync(path.join(root, relative), path.join(destination, relative), { recursive: true, verbatimSymlinks: true });

try {
    if (!/^\d+\.\d+\.\d+$/.test(nodeVersion) || targets.some((target) => !supported.includes(target))) throw new Error('Versão ou plataforma inválida. Use --target linux-x64, linux-arm64, darwin-x64, darwin-arm64, win-x64 ou win-arm64.');
    fs.mkdirSync(artifacts, { recursive: true });
    const build = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build', '--prefix', 'frontend'], { cwd: root, env: { ...process.env, VITE_API_URL: '/api/v1' }, stdio: 'inherit' });
    if (build.status !== 0) throw new Error('Não foi possível preparar o painel para o pacote portátil.');
    const common = path.join(workspace, 'common');
    fs.mkdirSync(common);
    // Lista explícita: não inclui .env, credenciais, dados, logs ou arquivos da máquina.
    for (const relative of ['backend/src', 'backend/package.json', 'backend/package-lock.json', 'backend/.env.example', 'frontend/dist', 'scripts/start-local.mjs', 'scripts/restore-backup.mjs', 'docs', 'LICENSE', 'package.json']) copy(relative, common);
    const cleanEnvironment = { ...process.env, NODE_ENV: 'production' };
    const install = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['ci', '--omit=dev', '--prefix', 'backend'], { cwd: common, env: cleanEnvironment, stdio: 'inherit' });
    if (install.status !== 0) throw new Error('Não foi possível preparar as dependências de produção.');
    const checksumFile = path.join(workspace, 'SHASUMS256.txt');
    await fetchFile(`https://nodejs.org/dist/v${nodeVersion}/SHASUMS256.txt`, checksumFile);
    const checksums = fs.readFileSync(checksumFile, 'utf8');
    for (const target of targets) {
        const archiveName = `node-v${nodeVersion}-${target}.${target.startsWith('win-') ? 'zip' : 'tar.gz'}`;
        const expected = checksums.split('\n').find((line) => line.trim().endsWith(` ${archiveName}`))?.split(/\s+/)[0];
        if (!expected) throw new Error(`Distribuição oficial indisponível: ${target}.`);
        const archive = path.join(workspace, archiveName);
        await fetchFile(`https://nodejs.org/dist/v${nodeVersion}/${archiveName}`, archive);
        if (crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex') !== expected) throw new Error('A verificação SHA-256 do Node.js falhou. Nenhum pacote foi gerado para esta plataforma.');
        const extract = path.join(workspace, `extract-${target}`);
        fs.mkdirSync(extract);
        if (target.startsWith('win-')) run('unzip', ['-q', archive, '-d', extract], root);
        else run('tar', ['-xzf', archive, '-C', extract], root);
        const distribution = path.join(extract, `node-v${nodeVersion}-${target}`);
        const name = `syncsphere-1.1.0-preparacao-${target}`;
        const bundle = path.join(workspace, name);
        fs.cpSync(common, bundle, { recursive: true, verbatimSymlinks: true });
        const packageManifest = JSON.parse(fs.readFileSync(path.join(bundle, 'package.json'), 'utf8'));
        packageManifest.scripts = { start: 'node scripts/start-local.mjs', open: 'node scripts/start-local.mjs', 'backup:restore': 'node scripts/restore-backup.mjs' };
        fs.writeFileSync(path.join(bundle, 'package.json'), JSON.stringify(packageManifest, null, 2));
        fs.mkdirSync(path.join(bundle, 'runtime'));
        fs.copyFileSync(path.join(distribution, target.startsWith('win-') ? 'node.exe' : 'bin/node'), path.join(bundle, 'runtime', target.startsWith('win-') ? 'node.exe' : 'node'));
        fs.copyFileSync(path.join(distribution, 'LICENSE'), path.join(bundle, 'runtime', 'LICENSE'));
        if (!target.startsWith('win-')) fs.chmodSync(path.join(bundle, 'runtime', 'node'), 0o755);
        fs.writeFileSync(path.join(bundle, 'Iniciar.cmd'), '@echo off\r\nchcp 65001 >nul\r\n"%~dp0runtime\\node.exe" "%~dp0scripts\\start-local.mjs"\r\nif errorlevel 1 pause\r\n');
        fs.writeFileSync(path.join(bundle, 'Restaurar-backup.cmd'), '@echo off\r\nchcp 65001 >nul\r\n"%~dp0runtime\\node.exe" "%~dp0scripts\\restore-backup.mjs" --interactive\r\npause\r\n');
        for (const extension of ['sh', 'command']) {
            const prefix = '#!/bin/sh\ncd "$(dirname "$0")" || exit 1\n';
            fs.writeFileSync(path.join(bundle, `Iniciar.${extension}`), prefix + './runtime/node scripts/start-local.mjs "$@"\n', { mode: 0o755 });
            fs.writeFileSync(path.join(bundle, `Restaurar-backup.${extension}`), prefix + './runtime/node scripts/restore-backup.mjs --interactive\n', { mode: 0o755 });
        }
        fs.writeFileSync(path.join(bundle, 'LEIA-ME.txt'), 'SyncSphere 1.1.0 em preparação\n\nExtraia toda a pasta antes de abrir. Windows: Iniciar.cmd. macOS: Iniciar.command. Linux: Iniciar.sh. Mantenha a janela aberta durante as migrações. Não precisa instalar Node.js.\n\nNo painel, use Experimentar sem contas para começar. Para proteger seus dados, abra Ajuda e segurança. Encerre o aplicativo antes de atualizar ou restaurar. Guarde a pasta backend/data da instalação anterior.\n\nPacotes ainda sem assinatura de instalador. Escritas experimentais são identificadas no painel. Consulte docs/primeira-migracao.md e docs/backups.md.\n');
        fs.writeFileSync(path.join(bundle, 'package-manifest.json'), JSON.stringify({ format: 'syncsphere-local-package', version: '1.1.0-preparacao', target, nodeVersion, runtimeArchiveSha256: expected }, null, 2));
        const output = path.join(artifacts, `${name}.${target.startsWith('win-') ? 'zip' : 'tar.gz'}`);
        if (target.startsWith('win-')) run('zip', ['-qr', output, name], workspace);
        else run('tar', ['-czf', output, '-C', workspace, name], root);
        fs.writeFileSync(`${output}.sha256`, `${crypto.createHash('sha256').update(fs.readFileSync(output)).digest('hex')}  ${path.basename(output)}\n`);
        console.log(`Pacote local gerado: ${output}. Execução em ${target} requer verificação no sistema correspondente.`);
    }
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
} finally { fs.rmSync(workspace, { recursive: true, force: true }); }
