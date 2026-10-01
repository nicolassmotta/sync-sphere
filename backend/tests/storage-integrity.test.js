import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const root = path.resolve('src');
const directories = [];
const temporary = () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'syncsphere-integrity-'));
    directories.push(dir);
    return dir;
};
const run = (dir, key, script) => spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: dir,
    env: { PATH: process.env.PATH, NODE_ENV: 'test', DATA_DIR: dir, ENCRYPTION_KEY: key, DOTENV_CONFIG_PATH: path.join(dir, '.env') },
    encoding: 'utf8',
});
const storeImport = `const { readStore, writeStore } = await import(${JSON.stringify(pathToFileURL(path.join(root, 'storage/jsonStore.js')).href)});`;
afterAll(() => directories.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

it.each(['credentials.json', 'provider-credentials.json', 'transfers.json', 'queue.json', 'transfer-tracks-demo.json', 'file-imports.json', 'file-exports.json'])(
    'chave trocada em outro processo preserva %s byte por byte', (name) => {
        const dir = temporary();
        expect(run(dir, 'a'.repeat(64), `${storeImport} writeStore('${name}', [{ id: 'fictício' }]);`).status).toBe(0);
        const original = fs.readFileSync(path.join(dir, name));
        const failure = run(dir, 'b'.repeat(64), `${storeImport} const data = readStore('${name}', []); writeStore('${name}', data);`);
        expect(failure.status).not.toBe(0);
        expect(failure.stderr).toMatch(/DATA_DIR.*ENCRYPTION_KEY.*backup/);
        expect(fs.readFileSync(path.join(dir, name))).toEqual(original);
    }
);

it('operação normal do model não apaga registros quando a chave é incompatível', () => {
    const dir = temporary();
    expect(run(dir, 'a'.repeat(64), `${storeImport} writeStore('transfers.json', [{ _id: 'anterior' }]);`).status).toBe(0);
    const original = fs.readFileSync(path.join(dir, 'transfers.json'));
    const result = run(dir, 'b'.repeat(64), `const { default: Transfer } = await import(${JSON.stringify(pathToFileURL(path.join(root, 'models/Transfer.js')).href)}); await Transfer.insertMany([{ user: 'local' }]);`);
    expect(result.status).not.toBe(0);
    expect(fs.readFileSync(path.join(dir, 'transfers.json'))).toEqual(original);
});

it.each(['chave inválida', 'a'.repeat(64) + 'zz'])('não substitui uma chave local inválida', (key) => {
    const dir = temporary();
    fs.writeFileSync(path.join(dir, 'encryption.key'), key);
    expect(run(dir, '', storeImport).status).not.toBe(0);
    expect(fs.readFileSync(path.join(dir, 'encryption.key'), 'utf8')).toBe(key);
});

it('cache cifrado é reutilizado em outro processo após checkpoint', () => {
    const dir = temporary();
    const cacheImport = `const { default: MatchCache } = await import(${JSON.stringify(pathToFileURL(path.join(root, 'services/matching/MatchCache.js')).href)}); const cache = new MatchCache({ scope: 'teste' });`;
    const track = `{ name: 'Música fictícia', artist: 'Artista fictício' }`;
    expect(run(dir, 'a'.repeat(64), `${cacheImport} cache.set(${track}, { targetId: 'id-fictício', matchScore: 95 }); cache.flush();`).status).toBe(0);
    const result = run(dir, 'a'.repeat(64), `${cacheImport} console.log(JSON.stringify(cache.get(${track})));`);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('"targetId":"id-fictício"');
    expect(fs.readFileSync(path.join(dir, 'match-cache.json'), 'utf8')).not.toContain('id-fictício');
});
