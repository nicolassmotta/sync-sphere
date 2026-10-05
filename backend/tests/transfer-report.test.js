import Transfer from '../src/models/Transfer.js';
import { buildTransferReport } from '../src/services/transfer/transferReportService.js';
import { buildTransferTracks, saveTransferTracks } from '../src/services/transfer/TransferTrackStore.js';

it('relatório v2 distingue todos os estados e conserva leitura legada sem inventar evidências', async () => {
    const [transfer] = await Transfer.insertMany([{ user: 'local', playlistName: 'Fictícia', status: 'completed' }]);
    const statuses = ['matched', 'matched', 'needs_review', 'not_found', 'skipped', 'failed', 'retry_queued', 'pending'];
    const tracks = buildTransferTracks(statuses.map(() => ({ name: '=Fórmula', artist: 'Fictício' })));
    tracks.forEach((track, index) => Object.assign(track, { status: statuses[index], inserted: index === 0,
        targetId: index < 2 ? 'id' : null, lastError: 'Authorization: segredo-ficticio', errorKind: index === 5 ? 'transient' : null }));
    tracks.forEach((track) => { delete track.formatVersion; });
    saveTransferTracks(transfer._id, tracks);
    const options = { transferId: transfer._id, userId: 'local' };
    const report = JSON.parse((await buildTransferReport(options)).body);
    expect(report.version).toBe(2);
    expect(new Set(report.tracks.map((track) => track.outcome)).size).toBe(8);
    expect(report.counts).toMatchObject({ total: 8, inserted: 1, needsReview: 1, skipped: 1, pendingInserts: 1 });
    expect(report.tracks[0]).toMatchObject({ legacy: true, evidence: null, reasons: null, algorithmVersion: null });
    expect(report.metrics.precision).toBeNull();
    expect(JSON.stringify(report)).not.toContain('segredo-ficticio');
    expect((await buildTransferReport({ ...options, format: 'csv' })).body).toContain("\"'=Fórmula\"");
});

it('falha técnica conserva consultas concluídas e falhas sem rotular registro novo como legado', async () => {
    const [transfer] = await Transfer.insertMany([{ user: 'local', status: 'failed' }]);
    const [track] = buildTransferTracks([{ name: 'Fictícia', artist: 'Fictício' }]);
    Object.assign(track, { status: 'failed', errorKind: 'transient', searchCheckpoint: { queries: 2, requests: 3, previousQueries: 1, previousRequests: 2 } });
    saveTransferTracks(transfer._id, [track]);
    const report = JSON.parse((await buildTransferReport({ transferId: transfer._id, userId: 'local' })).body);
    expect(report.tracks[0]).toMatchObject({ legacy: false, queries: 3, requests: 5 });
    expect(report.metrics).toMatchObject({ queries: 3, requests: 5 });
});

it('revisão legada não conta como cobertura automática e cópia não inventa acerto de cache', async () => {
    const [transfer] = await Transfer.insertMany([{ user: 'local', status: 'completed' }]);
    const tracks = buildTransferTracks([{ name: 'A', artist: 'Artista' }, { name: 'B', artist: 'Artista' }]);
    Object.assign(tracks[0], { status: 'needs_review', matchSource: 'search' });
    Object.assign(tracks[1], { status: 'matched', targetId: 'b', inserted: true, matchSource: 'cache', matching: { strategy: 'preserved_choice' } });
    saveTransferTracks(transfer._id, tracks);
    const report = JSON.parse((await buildTransferReport({ transferId: transfer._id, userId: 'local' })).body);
    expect(report.metrics).toMatchObject({ automaticCoverage: 0.5, cacheHits: 0 });
});
