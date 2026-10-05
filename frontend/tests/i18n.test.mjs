import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createLocalizer, preferredLocale } from '../../shared/localization.js';

const pt = JSON.parse(fs.readFileSync(new URL('../../shared/locales/pt-BR.json', import.meta.url)));
const en = JSON.parse(fs.readFileSync(new URL('../../shared/locales/en.json', import.meta.url)));
const text = createLocalizer(pt, en);

test('catálogos mantêm as mesmas mensagens e parâmetros', () => {
    assert.deepEqual(Object.keys(pt).sort(), Object.keys(en).sort());
    for (const key of Object.keys(pt)) {
        const parameters = (value) => [...value.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]).sort();
        assert.deepEqual(parameters(pt[key]), parameters(en[key]), key);
    }
});
test('preferência salva tem prioridade e idioma desconhecido usa o português', () => {
    assert.equal(preferredLocale('pt-BR', ['en-US']), 'pt-BR');
    assert.equal(preferredLocale('en', ['pt-BR']), 'en');
    assert.equal(preferredLocale('inválido', ['en-GB']), 'en');
    assert.equal(preferredLocale(null, ['fr-FR']), 'pt-BR');
});
test('troca de idioma funciona nos dois sentidos para mensagens já recebidas', () => {
    assert.equal(text('Carregando dados', 'en'), 'Loading data');
    assert.equal(text('Loading data', 'pt-BR'), 'Carregando dados');
    assert.equal(text('Playlist "Nome privado" carregada com 3 faixas.', 'en'), 'Playlist "Nome privado" loaded with 3 tracks.');
});
test('títulos e artistas interpolados não são traduzidos como texto do aplicativo', () => {
    assert.equal(text('Playlist "Arquivo" carregada com 1 faixas.', 'en'), 'Playlist "Arquivo" loaded with 1 tracks.');
    assert.equal(text('Procurando no Spotify: Não encontrada - Arquivo', 'en'), 'Searching Spotify: Não encontrada - Arquivo');
    assert.equal(text('Campo criado por uma pessoa', 'en'), 'Campo criado por uma pessoa');
});
test('resultado preserva contagens e traduz somente provedor e notas do sistema', () => {
    const original = 'Migração concluída no Arquivo: 3/3 faixas adicionadas. 2 faixas ficaram nas pendências.';
    assert.equal(text(original, 'en'), 'Transfer completed on File: 3/3 tracks added. 2 tracks remain pending.');
    assert.equal(text('1 faixa teve falha temporária. Nova tentativa automática em instantes.', 'en'), '1 track had a temporary failure. Another automatic attempt is scheduled shortly.');
});
test('mensagens longas não fazem buscas de padrões nem são truncadas', () => {
    const original = 'Detalhe externo: ' + 'x'.repeat(5000);
    assert.equal(text(original, 'en'), original);
});
