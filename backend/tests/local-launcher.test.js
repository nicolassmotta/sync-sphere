import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';

const project = path.resolve('..');
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'syncsphere-launcher-test-'));
let launcher;
const freePort = async () => {
    const server = net.createServer();
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    await new Promise((resolve) => server.close(resolve));
    return port;
};
const environment = (data) => ({ PATH: process.env.PATH, HOME: process.env.HOME, DATA_DIR: data, ENCRYPTION_KEY: 'd'.repeat(64), NODE_ENV: 'test', JWT_SECRET: 'segredo-ficticio', APPLE_MUSIC_AUTO_WEB_TOKEN: 'false' });

afterAll(async () => {
    if (launcher?.exitCode === null) {
        const ended = new Promise((resolve) => launcher.once('exit', resolve));
        launcher.kill('SIGTERM');
        await ended;
    }
    fs.rmSync(workspace, { recursive: true, force: true });
});

it('iniciador preserva ambiente, reutiliza sua instância e recusa outra instalação na porta', async () => {
    const backend = path.join(workspace, 'backend');
    fs.mkdirSync(path.join(workspace, 'scripts'), { recursive: true });
    fs.mkdirSync(path.join(workspace, 'frontend', 'dist'), { recursive: true });
    fs.mkdirSync(backend);
    fs.cpSync(path.join(project, 'backend', 'src'), path.join(backend, 'src'), { recursive: true });
    fs.copyFileSync(path.join(project, 'backend', 'package.json'), path.join(backend, 'package.json'));
    fs.symlinkSync(path.join(project, 'backend', 'node_modules'), path.join(backend, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    const script = path.join(workspace, 'scripts', 'start-local.mjs');
    fs.copyFileSync(path.join(project, 'scripts', 'start-local.mjs'), script);
    fs.writeFileSync(path.join(workspace, 'frontend', 'dist', 'index.html'), '<!doctype html><title>Demonstração</title>');
    const port = await freePort();
    const envFile = `PORT=${port}\nAPP_ENV=test\n# Conteúdo fictício preservado\n`;
    fs.writeFileSync(path.join(backend, '.env'), envFile);
    const data = path.join(workspace, 'data-primary');
    launcher = spawn(process.execPath, [script, '--no-browser'], { cwd: workspace, env: environment(data), stdio: 'ignore' });
    let health;
    for (let attempt = 0; attempt < 50; attempt += 1) {
        try {
            health = await (await fetch(`http://127.0.0.1:${port}/api/health`)).json();
            if (health.application === 'SyncSphere') break;
        } catch { /* Espera somente o processo recém-iniciado. */ }
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(health?.application).toBe('SyncSphere');
    expect(fs.readFileSync(path.join(backend, '.env'), 'utf8')).toBe(envFile);
    const repeated = spawnSync(process.execPath, [script, '--no-browser'], { cwd: workspace, env: environment(data), encoding: 'utf8', timeout: 5000 });
    expect(repeated.status).toBe(0);
    expect(repeated.stdout).toContain('já está aberto');
    expect(JSON.parse(fs.readFileSync(path.join(data, 'server.lock'), 'utf8')).pid).toBe(health.pid);
    const other = spawnSync(process.execPath, [script, '--no-browser'], { cwd: workspace, env: environment(path.join(workspace, 'data-other')), encoding: 'utf8', timeout: 5000 });
    expect(other.status).toBe(1);
    expect(other.stderr).toContain('Outra instalação');
}, 15000);
