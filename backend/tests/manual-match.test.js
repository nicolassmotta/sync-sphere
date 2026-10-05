import { jest } from '@jest/globals';
import request from 'supertest';
import AppError from '../src/utils/AppError.js';

const searchBestMatch = jest.fn();
const ensureWritable = jest.fn();
const addTransferJob = jest.fn();
const hasTransferJob = jest.fn(() => false);
const addTracks = jest.fn();
const provider = {
    id: 'youtubeMusic', label: 'YouTube Music', capabilities: { read: true, write: true },
    ensureWritable, getMatchId: (match) => match?.videoId,
    createSearchClient: () => ({ searchBestMatch }),
    createDestinationClient: () => ({
        addTracks, createPlaylist: jest.fn(), getPlaylistUrl: () => 'https://music.youtube.com/playlist?list=existing',
    }),
};
jest.unstable_mockModule('../src/providers/registry.js', () => ({
    getProvider: (id) => ({ ...provider, id }),
    findProvider: (id) => ['spotify', 'youtubeMusic', 'file'].includes(id) ? { ...provider, id } : null,
    listProviders: () => [provider], describeProvider: (value) => value,
    getProviderStatus: async () => ({ connected: true }),
}));
jest.unstable_mockModule('../src/services/queueService.js', () => ({
    addTransferJob, hasTransferJob, runTransferNow: jest.fn(),
}));

const { default: app } = await import('../src/app.js');
const { default: Transfer } = await import('../src/models/Transfer.js');
const { default: TransferProcessor } = await import('../src/services/transfer/TransferProcessor.js');
const { default: TrackMatcher } = await import('../src/services/transfer/TrackMatcher.js');
const { searchManualMatch, confirmManualMatch } = await import('../src/services/transfer/manualMatchService.js');
const { buildTransferTracks, saveTransferTracks, loadTransferTracks } = await import('../src/services/transfer/TransferTrackStore.js');

const setup = async (fields = {}) => {
    const [transfer] = await Transfer.insertMany([{
        user: 'local', sourcePlaylistId: 'source', playlistName: 'Lista', status: 'completed',
        targetPlaylistId: 'existing', ...fields,
    }]);
    const tracks = buildTransferTracks([
        { name: 'Já migrada', artist: 'Artista' },
        { name: 'Não encontrada', artist: 'Artista', isrc: 'ORIGINAL' },
    ]);
    Object.assign(tracks[0], { status: 'matched', targetId: 'original', inserted: true });
    Object.assign(tracks[1], { status: 'not_found' });
    saveTransferTracks(transfer._id, tracks);
    return { transfer, options: { transferId: transfer._id, userId: 'local', trackIndex: '1' } };
};

beforeEach(() => {
    jest.clearAllMocks();
    ensureWritable.mockResolvedValue(undefined);
    hasTransferJob.mockReturnValue(false);
    searchBestMatch.mockResolvedValue({ videoId: 'manual', title: 'Título encontrado', artist: { name: 'Outro artista' }, matchScore: 80 });
});

it('busca pelo texto ajustado sem ISRC e exige confirmação antes de enfileirar', async () => {
    const { transfer } = await setup();
    const response = await request(app).post(`/api/v1/transfer/${transfer._id}/tracks/1/search`)
        .send({ name: 'Título ajustado', artist: 'Outro artista' });
    expect(response.status).toBe(200);
    expect(response.body.data.candidate).toMatchObject({ name: 'Título encontrado', artist: 'Outro artista' });
    expect(searchBestMatch).toHaveBeenCalledWith({ track: expect.objectContaining({ name: 'Título ajustado', isrc: null }) });
    expect(loadTransferTracks(transfer._id)[1]).toMatchObject({ name: 'Não encontrada', status: 'not_found', isrc: 'ORIGINAL' });
    expect(addTransferJob).not.toHaveBeenCalled();
});

it('confirma a proposta do servidor e insere apenas a nova escolha na playlist existente', async () => {
    const { transfer, options } = await setup();
    const candidate = await searchManualMatch({ ...options, name: 'Título', artist: 'Artista' });
    const response = await request(app).post(`/api/v1/transfer/${transfer._id}/tracks/1/confirm`)
        .send({ candidateId: candidate.id, targetId: 'id-injetado' });
    expect(response.status).toBe(202);
    expect(loadTransferTracks(transfer._id)[1]).toMatchObject({ targetId: 'manual', matchSource: 'manual', inserted: false });
    expect(addTransferJob).toHaveBeenCalledWith(transfer._id, 'local', 'source', 'spotify_to_youtube', { mode: 'manual', lane: 'youtubeMusic' });
    const processor = new TransferProcessor({
        repository: {
            getTransferForProcessing: async () => transfer,
            getUserWithTransferSecrets: async () => ({}),
            update: async (record, values) => { Object.assign(record, values); await record.save(); },
            save: (record) => record.save(), markFailed: jest.fn(),
        },
        publisher: { emit: jest.fn() },
        trackMatcher: new TrackMatcher({ delayMs: 0 }), createMatchCache: () => null,
    });
    searchBestMatch.mockClear();
    await processor.process({ id: 'manual-job', data: { transferId: transfer._id, userId: 'local', sourcePlaylistId: 'source' } });
    expect(searchBestMatch).not.toHaveBeenCalled();
    expect(addTracks).toHaveBeenCalledWith({ playlistId: 'existing', ids: ['manual'], expectedIds: ['original', 'manual'] });
    expect(loadTransferTracks(transfer._id).every((track) => track.inserted)).toBe(true);
});

it('recusa proposta expirada ou de outra busca', async () => {
    const { options } = await setup();
    const old = await searchManualMatch({ ...options, name: 'Título', artist: 'Artista' });
    await searchManualMatch({ ...options, name: 'Outro título', artist: 'Artista' });
    await expect(confirmManualMatch({ ...options, candidateId: old.id })).rejects.toMatchObject({ statusCode: 409 });
    const tracks = loadTransferTracks(options.transferId);
    tracks[1].manualCandidate.expiresAt = 0;
    tracks[1].manualCandidates[0].expiresAt = 0;
    saveTransferTracks(options.transferId, tracks);
    await expect(confirmManualMatch({ ...options, candidateId: tracks[1].manualCandidate.id })).rejects.toMatchObject({ statusCode: 409 });
    expect(addTransferJob).not.toHaveBeenCalled();
});

it.each(['pending', 'processing', 'paused', 'needs_auth'])('recusa revisão com transferência %s', async (status) => {
    const { options } = await setup({ status });
    await expect(searchManualMatch({ ...options, name: 'Título', artist: 'Artista' })).rejects.toMatchObject({ statusCode: 409 });
    expect(searchBestMatch).not.toHaveBeenCalled();
});

it('recusa transferências alheias, faixas resolvidas e índices inválidos', async () => {
    const { transfer, options } = await setup();
    await expect(searchManualMatch({ ...options, userId: 'outro', name: 'Título', artist: 'Artista' })).rejects.toMatchObject({ statusCode: 403 });
    await expect(searchManualMatch({ ...options, trackIndex: 0, name: 'Título', artist: 'Artista' })).rejects.toMatchObject({ statusCode: 409 });
    const response = await request(app).post(`/api/v1/transfer/${transfer._id}/tracks/-1/search`).send({ name: '', artist: '' });
    expect(response.status).toBe(400);
    expect(searchBestMatch).not.toHaveBeenCalled();
});

it('descarta o resultado se outra ação retomar a transferência durante a busca', async () => {
    const { transfer, options } = await setup();
    searchBestMatch.mockImplementationOnce(async () => {
        transfer.status = 'processing';
        await transfer.save();
        return { videoId: 'manual', matchScore: 80 };
    });
    await expect(searchManualMatch({ ...options, name: 'Título', artist: 'Artista' })).rejects.toMatchObject({ statusCode: 409 });
    expect(loadTransferTracks(transfer._id)[1].manualCandidate).toBeUndefined();
});

it('pede reconexão e libera a revisão após falha de credencial', async () => {
    const { options } = await setup();
    ensureWritable.mockRejectedValueOnce(new AppError('Reconecte a conta.', 401));
    await expect(searchManualMatch({ ...options, name: 'Título', artist: 'Artista' })).rejects.toMatchObject({ statusCode: 401 });
    expect(searchBestMatch).not.toHaveBeenCalled();
    expect(await searchManualMatch({ ...options, name: 'Título', artist: 'Artista' })).not.toBeNull();
});

it('não deixa uma busca sem resultado manter proposta antiga', async () => {
    const { options } = await setup();
    await searchManualMatch({ ...options, name: 'Título', artist: 'Artista' });
    searchBestMatch.mockResolvedValueOnce(null);
    expect(await searchManualMatch({ ...options, name: 'Outro', artist: 'Artista' })).toBeNull();
    expect(loadTransferTracks(options.transferId)[1].manualCandidate).toBeUndefined();
});

it('retorna bloqueio da plataforma como erro operacional e permite outra busca depois', async () => {
    const { transfer } = await setup();
    searchBestMatch.mockRejectedValueOnce(Object.assign(new Error('Too Many Requests'), { status: 429 }));
    const response = await request(app).post(`/api/v1/transfer/${transfer._id}/tracks/1/search`)
        .send({ name: 'Título', artist: 'Artista' });
    expect(response.status).toBe(429);
    expect(loadTransferTracks(transfer._id)[1].manualCandidate).toBeUndefined();
});

const { confirmManualMatchBatch, listManualCandidates } = await import('../src/services/transfer/manualMatchService.js');
const { recoverUnfinishedTransfers } = await import('../src/services/transfer/transferQueueActions.js');

const setupBatch = async () => {
    const context = await setup();
    const tracks = loadTransferTracks(context.transfer._id);
    tracks.push({ ...tracks[1], index: 2, name: 'Segunda pendência', status: 'needs_review' });
    saveTransferTracks(context.transfer._id, tracks);
    const first = await searchManualMatch({ ...context.options, name: 'Primeira', artist: 'Artista' });
    const second = await searchManualMatch({ ...context.options, trackIndex: 2, name: 'Segunda', artist: 'Artista' });
    return { ...context, choices: [
        { trackIndex: 1, action: 'choose', candidateId: first.id, revision: first.revision },
        { trackIndex: 2, action: 'choose', candidateId: second.id, revision: second.revision },
    ] };
};

it('valida todo o lote antes de salvar e rejeita alternativa de outra faixa', async () => {
    const { transfer, options, choices } = await setupBatch();
    await expect(confirmManualMatchBatch({ ...options, choices: [choices[0], { ...choices[1], candidateId: choices[0].candidateId }] }))
        .rejects.toMatchObject({ statusCode: 409 });
    expect(loadTransferTracks(transfer._id).map((track) => track.status)).toEqual(['matched', 'not_found', 'needs_review']);
    expect(addTransferJob).not.toHaveBeenCalled();
});

it('lote e confirmação repetida criam somente um job', async () => {
    const { options, choices } = await setupBatch();
    await confirmManualMatchBatch({ ...options, choices });
    hasTransferJob.mockReturnValue(true);
    await confirmManualMatchBatch({ ...options, choices });
    expect(addTransferJob).toHaveBeenCalledTimes(1);
    expect(loadTransferTracks(options.transferId).slice(1).every((track) => track.status === 'matched' && !track.inserted)).toBe(true);
});

it('ignorar não insere faixa nem inventa confiança manual', async () => {
    const { options } = await setup();
    await confirmManualMatchBatch({ ...options, choices: [{ trackIndex: 1, action: 'skip' }] });
    expect(loadTransferTracks(options.transferId)[1]).toMatchObject({ status: 'skipped', targetId: null, matchScore: null });
    expect(addTransferJob).not.toHaveBeenCalled();
});

it('falha entre salvar escolhas e enfileirar conserva inserções recuperáveis', async () => {
    const { options, choices, transfer } = await setupBatch();
    addTransferJob.mockRejectedValueOnce(new Error('Fila indisponível'));
    await expect(confirmManualMatchBatch({ ...options, choices })).rejects.toThrow('Fila indisponível');
    transfer.status = 'completed';
    await transfer.save();
    await recoverUnfinishedTransfers();
    expect(addTransferJob).toHaveBeenCalledWith(transfer._id, 'local', 'source', 'spotify_to_youtube', expect.objectContaining({ lane: 'youtubeMusic' }));
    expect(loadTransferTracks(transfer._id)[1]).toMatchObject({ status: 'matched', inserted: false });
});

it('propostas automáticas ficam limitadas e sobrevivem à releitura', async () => {
    const { options } = await setup();
    const tracks = loadTransferTracks(options.transferId);
    tracks[1].status = 'needs_review';
    tracks[1].matching = { candidates: Array.from({ length: 8 }, (_, index) => ({ candidate: { targetId: `id-${index}`, name: 'Alternativa', artists: ['Artista'] } })) };
    saveTransferTracks(options.transferId, tracks);
    const candidates = await listManualCandidates(options);
    expect(candidates).toHaveLength(5);
    expect(await listManualCandidates(options)).toEqual(candidates);
});

const { recreateOrderedPlaylist } = await import('../src/services/transfer/recreateOrderedPlaylist.js');
it('cópia ordenada conserva ocorrências resolvidas e mantém a playlist anterior', async () => {
    const { transfer, options } = await setup();
    const tracks = loadTransferTracks(transfer._id);
    Object.assign(tracks[1], { status: 'matched', targetId: 'manual', inserted: true, matchSource: 'manual' });
    tracks.push({ ...tracks[0], index: 2 });
    saveTransferTracks(transfer._id, tracks);
    const copy = await recreateOrderedPlaylist(options);
    expect(copy._id).not.toBe(transfer._id);
    expect(copy.targetPlaylistId).toBeNull();
    expect(copy.sourceTransferId).toBe(transfer._id);
    expect(transfer.targetPlaylistId).toBe('existing');
    expect(loadTransferTracks(copy._id).map((track) => [track.targetId, track.inserted])).toEqual([
        ['original', false], ['manual', false], ['original', false],
    ]);
    hasTransferJob.mockImplementation((id) => id === copy._id);
    expect((await recreateOrderedPlaylist(options))._id).toBe(copy._id);
    expect(addTransferJob).toHaveBeenCalledTimes(1);
});

it('corrige uma ocorrência já inserida somente na cópia confirmada', async () => {
    const { transfer, options } = await setup();
    const tracks = loadTransferTracks(transfer._id);
    Object.assign(tracks[1], { status: 'skipped' });
    saveTransferTracks(transfer._id, tracks);
    const proposal = await searchManualMatch({ ...options, trackIndex: 0, allowInserted: true, name: 'Nova gravação', artist: 'Outro artista' });
    const copy = await recreateOrderedPlaylist({ ...options, choices: [{ trackIndex: 0, candidateId: proposal.id, revision: proposal.revision }] });
    expect(loadTransferTracks(copy._id)[0]).toMatchObject({ targetId: 'manual', inserted: false, matchScore: null });
    expect(loadTransferTracks(transfer._id)[0]).toMatchObject({ targetId: 'original', inserted: true });
    expect(transfer.targetPlaylistId).toBe('existing');
});

it('ignorar não transforma um UUID enviado junto em escolha reaproveitável', async () => {
    const { options } = await setup();
    const candidate = await searchManualMatch({ ...options, name: 'Título', artist: 'Artista' });
    await confirmManualMatchBatch({ ...options, choices: [{ trackIndex: 1, action: 'skip', candidateId: candidate.id }] });
    expect(loadTransferTracks(options.transferId)[1]).toMatchObject({ status: 'skipped', targetId: null, chosenCandidate: null });
});
