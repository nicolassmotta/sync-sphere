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
    expect(addTracks).toHaveBeenCalledWith({ playlistId: 'existing', ids: ['manual'] });
    expect(loadTransferTracks(transfer._id).every((track) => track.inserted)).toBe(true);
});

it('recusa proposta expirada ou de outra busca', async () => {
    const { options } = await setup();
    const old = await searchManualMatch({ ...options, name: 'Título', artist: 'Artista' });
    await searchManualMatch({ ...options, name: 'Outro título', artist: 'Artista' });
    await expect(confirmManualMatch({ ...options, candidateId: old.id })).rejects.toMatchObject({ statusCode: 409 });
    const tracks = loadTransferTracks(options.transferId);
    tracks[1].manualCandidate.expiresAt = 0;
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
