import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Esta auditoria só opera sobre a fixture isolada, nunca sobre uma instalação real.
const base = new URL(process.env.AUDIT_URL || 'http://127.0.0.1:8198');
if (base.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(base.hostname)) throw new Error('A auditoria exige um servidor de simulação local.');
const probe = await fetch(new URL('/__qa/observations', base));
assert.equal(probe.status, 200, 'Inicie a fixture de navegador com armazenamento temporário.');
assert.equal((await probe.json()).simulation, true, 'O servidor precisa declarar que os destinos são simulados.');

const results = [];
const request = async (route, { method = 'GET', body, type = 'application/json', status = 200 } = {}) => {
    const response = await fetch(new URL(`/api/v1${route}`, base), {
        method, redirect: 'manual', signal: AbortSignal.timeout(10000),
        ...(body === undefined ? {} : { headers: { 'Content-Type': type }, body: type === 'application/json' ? JSON.stringify(body) : body }),
    });
    assert.equal(response.status, status, `${method} ${route}: HTTP ${response.status}`);
    return response;
};
const json = async (route, options) => (await request(route, options)).json();
const record = (group, name, detail) => { results.push({ group, name, result: 'aprovado', ...detail }); console.log(`${group}: ${name} aprovado`); };
const waitFor = async (id, statuses = ['completed', 'failed']) => {
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
        const value = (await json(`/transfer/${id}`)).data.transfer;
        if (statuses.includes(value.status)) return value;
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`A transferência ${id} não alcançou ${statuses.join(', ')}.`);
};
const start = async (source, target, playlistId) => (await json('/transfer/start', {
    method: 'POST', status: 202, body: { sourceProvider: source, targetProvider: target, sourcePlaylistId: playlistId },
})).data.transferId;
const report = (id) => json(`/transfer/${id}/report`);
const verify = (value, count) => {
    assert.equal(value.counts.inserted, count);
    assert.equal(value.destinationVerification.state, 'verified');
    assert.equal(value.destinationVerification.orderPreserved, true);
    assert.deepEqual(value.destinationVerification.missing, []);
    assert.deepEqual(value.destinationVerification.extra, []);
};

const { providers } = (await json('/integrations/status')).data;
assert.equal(providers.length, 7);
const remote = providers.filter((provider) => provider.id !== 'file');
const connect = async (provider) => {
    if (provider.auth.type === 'oauth') {
        const authorization = (await json(`/integrations/${provider.id}/login`)).data.url;
        const url = new URL(authorization);
        assert.equal(url.origin, base.origin);
        await request(`/integrations/${provider.id}/callback?code=ficticio`, { status: 302 });
    } else {
        const values = Object.fromEntries(provider.auth.fields.filter((field) => !field.optional).map((field) => [field.name, 'valor-ficticio-de-auditoria']));
        await request(`/integrations/${provider.id}/credentials`, { method: 'PUT', body: { values } });
    }
};
for (const provider of remote) {
    await request(`/integrations/${provider.id}`, { method: 'DELETE' });
    let current = (await json('/integrations/status')).data.providers.find((entry) => entry.id === provider.id);
    assert.equal(current.connected, false);
    assert.equal(current.canWrite, false);
    const before = (await json('/transfer')).data.transfers.length;
    await request('/transfer/start', { method: 'POST', status: 400, body: { sourceProvider: 'file', targetProvider: provider.id, sourcePlaylistId: 'origem-ficticia-inexistente' } });
    assert.equal((await json('/transfer')).data.transfers.length, before);
    await connect(provider);
    current = (await json('/integrations/status')).data.providers.find((entry) => entry.id === provider.id);
    assert.equal(current.connected, true);
    if (provider.capabilities.listUserPlaylists) {
        const playlists = (await json(`/integrations/${provider.id}/playlists`)).data.playlists;
        assert.ok(playlists.length);
    } else await request(`/integrations/${provider.id}/playlists`, { status: 400 });
    const preview = (await json(`/integrations/${provider.id}/playlists/fixture-normal-auditoria/tracks`)).data;
    assert.equal(preview.tracks.length, 3);
    assert.equal(preview.totalTracks, 3);
    record('integração simulada', provider.id, { connection: true, list: Boolean(provider.capabilities.listUserPlaylists), preview: true, disconnectedWriteBlocked: true });
}

const expected = [
    { name: 'Faixa fictícia A', artist: 'Banda fictícia', duration_ms: 180000 },
    { name: 'Faixa fictícia B', artist: 'Banda fictícia', duration_ms: 200000 },
    { name: 'Faixa fictícia A', artist: 'Banda fictícia', duration_ms: 180000 },
];
const input = (await json('/integrations/file/imports?filename=auditoria.json', {
    method: 'POST', status: 201, type: 'text/plain', body: JSON.stringify({ name: 'Auditoria local', tracks: expected }),
})).data.playlist;
let number = 0;
for (const source of providers) for (const target of providers) {
    if (source.id === target.id && !source.capabilities.sameProviderTransfer) continue;
    const id = await start(source.id, target.id, source.id === 'file' ? input.id : `fixture-normal-pair-${++number}`);
    assert.equal((await waitFor(id)).status, 'completed');
    const value = await report(id);
    verify(value, 3);
    assert.deepEqual(value.tracks.map(({ name, artist }) => ({ name, artist })), expected.map(({ name, artist }) => ({ name, artist })));
    if (target.id === 'file') {
        const state = (await json(`/transfer/${id}`)).data.transfer;
        for (const format of ['csv', 'json', 'm3u', 'txt']) {
            const response = await request(`/integrations/file/exports/${state.targetPlaylistId}/download?format=${format}`);
            assert.ok((await response.text()).length > 0);
        }
    }
    record('par', `${source.id} -> ${target.id}`, { occurrences: 3, repetitionPreserved: true, verified: true });
}

for (const target of remote) {
    const source = target.id === 'spotify' ? 'youtubeMusic' : 'spotify';
    for (const scenario of ['partial', 'transient', 'rate-limit', 'needs-auth']) {
        const id = await start(source, target.id, `fixture-${scenario}-audit-${target.id}`);
        await waitFor(id, ['paused', 'needs_auth', 'failed']);
        const state = (await json(`/transfer/${id}`)).data.transfer;
        assert.equal(state.status, scenario === 'needs-auth' ? 'needs_auth' : 'paused');
        if (scenario === 'needs-auth') await connect(target);
        else await request(`/transfer/${id}/resume`, { method: 'POST', status: 202 });
        assert.equal((await waitFor(id)).status, 'completed');
        const value = await report(id);
        verify(value, 3);
        const observation = await (await fetch(new URL('/__qa/observations', base))).json();
        assert.equal(observation.destinations[state.targetPlaylistId].attempts, 2);
        record('recuperação simulada', `${target.id}: ${scenario}`, { occurrences: 3, destinationReused: true, attempts: 2 });
    }
    for (const scenario of ['not-found', 'robust-review', 'invalid-score', 'empty', 'truncated', 'unknown-total']) {
        const id = await start(source, target.id, `fixture-${scenario}-audit-${target.id}`);
        const state = await waitFor(id);
        const value = await report(id);
        if (scenario === 'not-found') { assert.equal(value.counts.notFound, 1); verify(value, 2); }
        if (['robust-review', 'invalid-score'].includes(scenario)) { assert.equal(value.counts.needsReview, 3); assert.equal(value.counts.inserted, 0); }
        if (['empty', 'truncated'].includes(scenario)) { assert.equal(state.status, 'failed'); assert.equal(state.targetPlaylistId, null); }
        if (scenario === 'truncated') { assert.equal(value.sourceTruncated, true); assert.equal(value.sourceTotalTracks, 5); }
        if (scenario === 'unknown-total') { assert.equal(value.sourceTotalTracks, null); verify(value, 3); }
        record('limite simulado', `${target.id}: ${scenario}`, { inserted: value.counts.inserted, needsReview: value.counts.needsReview, notFound: value.counts.notFound, status: state.status });
    }
}

await request('/system/backups', { method: 'POST', body: { password: 'curta' }, status: 400 });
const backup = await request('/system/backups', { method: 'POST', body: { password: 'senha-ficticia-para-auditoria-local' } });
assert.ok((await backup.arrayBuffer()).byteLength > 100);
assert.equal(backup.headers.get('cache-control'), 'no-store');
await request('/system/diagnostic');
record('suporte local', 'diagnóstico e backup', { shortPasswordBlocked: true, encryptedBackup: true });

if (process.env.AUDIT_OUTPUT) fs.writeFileSync(path.resolve(process.env.AUDIT_OUTPUT), JSON.stringify({ generatedAt: new Date().toISOString(), simulation: true, results }, null, 2) + '\n');
console.log(`Auditoria concluída: ${results.length} cenários aprovados. Provedores remotos simulados; Arquivo usa o adaptador real.`);
