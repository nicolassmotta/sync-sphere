import fs from 'node:fs';
import path from 'node:path';
import { jest } from '@jest/globals';
import { readStore, writeStore, removeStore } from '../src/storage/jsonStore.js';
import { dataFile } from '../src/config/paths.js';

const name = 'atomic-test.json';
afterEach(() => { jest.restoreAllMocks(); removeStore(name); });

it('substitui o estado cifrado com permissões restritas', () => {
    writeStore(name, { value: 'estado anterior' });
    writeStore(name, { value: 'estado novo' });
    expect(readStore(name, null)).toEqual({ value: 'estado novo' });
    expect(fs.readFileSync(dataFile(name), 'utf8')).not.toContain('estado novo');
    if (process.platform !== 'win32') expect(fs.statSync(dataFile(name)).mode & 0o777).toBe(0o600);
});

it('preserva o arquivo anterior se a substituição falhar e limpa seu temporário', () => {
    writeStore(name, { value: 'preservado' });
    jest.spyOn(fs, 'renameSync').mockImplementationOnce(() => { throw new Error('Falha simulada de escrita'); });
    expect(() => writeStore(name, { value: 'incompleto' })).toThrow('Falha simulada de escrita');
    expect(readStore(name, null)).toEqual({ value: 'preservado' });
    expect(fs.readdirSync(path.dirname(dataFile(name))).filter((file) => file.startsWith(`${name}.`))).toEqual([]);
});

it('arquivo ausente usa fallback, mas corrupção preserva bytes e bloqueia leitura', () => {
    expect(readStore(name, [])).toEqual([]);
    fs.writeFileSync(dataFile(name), 'dados corrompidos');
    const original = fs.readFileSync(dataFile(name));
    expect(() => readStore(name, [])).toThrow(/DATA_DIR.*ENCRYPTION_KEY.*backup/);
    expect(fs.readFileSync(dataFile(name))).toEqual(original);
});

it('bloqueia gravação silenciosa depois de falha de leitura', () => {
    fs.writeFileSync(dataFile(name), 'corrompido');
    const original = fs.readFileSync(dataFile(name));
    expect(() => readStore(name, [])).toThrow();
    expect(() => writeStore(name, [])).toThrow(/backup/);
    expect(fs.readFileSync(dataFile(name))).toEqual(original);
});
