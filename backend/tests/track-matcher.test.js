import { jest } from '@jest/globals';
import TrackMatcher, { PAUSE_STEPS_MS } from '../src/services/transfer/TrackMatcher.js';
import { TransferNeedsAuthError, TransferPausedError } from '../src/errors/providerErrors.js';
import { buildTransferTracks, TRACK_STATUS } from '../src/services/transfer/TransferTrackStore.js';

const NOW = new Date('2026-09-29T12:00:00Z').getTime();

const buildMatcher = (overrides = {}) => new TrackMatcher({
    delayMs: 0,
    inlineRetryBaseMs: 0,
    searchConcurrency: 1,
    now: () => NOW,
    ...overrides,
});

const buildTracks = (count) => buildTransferTracks(
    Array.from({ length: count }, (_, index) => ({ name: `Música ${index + 1}`, artist: 'Artista' }))
);

const httpError = (status, message = `HTTP ${status}`, headers = {}) => {
    const error = new Error(message);
    error.response = { status, headers };
    return error;
};

describe('TrackMatcher', () => {
    it('marca faixas encontradas e não encontradas sem lançar erro', async () => {
        const tracks = buildTracks(3);
        const searchClient = {
            searchBestMatch: jest.fn()
                .mockResolvedValueOnce({ videoId: 'video-1', name: 'Música 1', artist: 'Artista', matchScore: 80 })
                .mockResolvedValueOnce({ videoId: 'video-2', matchScore: 10 })
                .mockResolvedValueOnce(null),
        };

        await buildMatcher().matchTracks({ searchClient, tracks, getMatchId: (match) => match?.videoId });

        expect(tracks.map((track) => track.status)).toEqual([
            TRACK_STATUS.MATCHED,
            TRACK_STATUS.NEEDS_REVIEW,
            TRACK_STATUS.NOT_FOUND,
        ]);
        expect(tracks[0].targetId).toBe('video-1');
    });

    it('pausa ao receber 429, respeita Retry-After e não dispara novas buscas', async () => {
        const tracks = buildTracks(4);
        const onCheckpoint = jest.fn();
        const searchClient = {
            searchBestMatch: jest.fn()
                .mockResolvedValueOnce({ videoId: 'video-1', name: 'Música 1', artist: 'Artista', matchScore: 90 })
                .mockRejectedValueOnce(httpError(429, 'Too Many Requests', { 'retry-after': '600' })),
        };

        const error = await buildMatcher()
            .matchTracks({ searchClient, tracks, getMatchId: (match) => match?.videoId, onCheckpoint })
            .catch((caught) => caught);

        expect(error).toBeInstanceOf(TransferPausedError);
        expect(error.resumeAt.getTime()).toBe(NOW + 600_000);
        expect(searchClient.searchBestMatch).toHaveBeenCalledTimes(2);
        expect(tracks.map((track) => track.status)).toEqual([
            TRACK_STATUS.MATCHED,
            TRACK_STATUS.RETRY_QUEUED,
            TRACK_STATUS.PENDING,
            TRACK_STATUS.PENDING,
        ]);
        expect(tracks[1].attempts).toBe(0);
        expect(onCheckpoint).toHaveBeenCalled();
    });

    it('usa pausa escalonada quando o bloqueio não informa Retry-After', async () => {
        const tracks = buildTracks(1);
        const searchClient = {
            searchBestMatch: jest.fn().mockRejectedValue(new Error('Sign in to confirm you’re not a bot')),
        };

        const error = await buildMatcher()
            .matchTracks({ searchClient, tracks, pauseCount: 2 })
            .catch((caught) => caught);

        expect(error).toBeInstanceOf(TransferPausedError);
        expect(error.resumeAt.getTime()).toBe(NOW + PAUSE_STEPS_MS[2]);
    });

    it('retomada busca só o que faltou, sem refazer faixas resolvidas', async () => {
        const tracks = buildTracks(3);
        tracks[0].status = TRACK_STATUS.MATCHED;
        tracks[0].targetId = 'video-1';
        tracks[1].status = TRACK_STATUS.RETRY_QUEUED;
        const searchClient = {
            searchBestMatch: jest.fn().mockResolvedValue({ videoId: 'video-x', matchScore: 90 }),
        };

        await buildMatcher().matchTracks({ searchClient, tracks, getMatchId: (match) => match?.videoId });

        expect(searchClient.searchBestMatch).toHaveBeenCalledTimes(2);
        expect(searchClient.searchBestMatch.mock.calls.map(([{ track }]) => track.index)).toEqual([1, 2]);
        expect(tracks[0].targetId).toBe('video-1');
    });

    it('interrompe e pede reconexão quando o token expira', async () => {
        const tracks = buildTracks(2);
        const searchClient = {
            searchBestMatch: jest.fn().mockRejectedValue(new Error('Conecte sua conta Spotify para continuar.')),
        };

        await expect(buildMatcher().matchTracks({ searchClient, tracks, providerLabel: 'Spotify' }))
            .rejects.toBeInstanceOf(TransferNeedsAuthError);
        expect(searchClient.searchBestMatch).toHaveBeenCalledTimes(1);
        expect(tracks[0].status).toBe(TRACK_STATUS.RETRY_QUEUED);
        expect(tracks[1].status).toBe(TRACK_STATUS.PENDING);
    });

    it('tenta de novo falhas temporárias e manda para a fila de retry até o limite', async () => {
        const tracks = buildTracks(1);
        const searchClient = {
            searchBestMatch: jest.fn().mockRejectedValue(httpError(503, 'Service Unavailable')),
        };
        const matcher = buildMatcher({ inlineRetries: 2, maxTrackAttempts: 2 });

        await matcher.matchTracks({ searchClient, tracks });
        expect(searchClient.searchBestMatch).toHaveBeenCalledTimes(3);
        expect(tracks[0]).toMatchObject({ status: TRACK_STATUS.RETRY_QUEUED, attempts: 1 });

        await matcher.matchTracks({ searchClient, tracks });
        expect(tracks[0]).toMatchObject({ status: TRACK_STATUS.FAILED, attempts: 2 });
    });

    it('registra o tempo de cada busca nas métricas', async () => {
        let clock = NOW;
        const tracks = buildTracks(2);
        const metrics = { recordSearch: jest.fn() };
        const searchClient = {
            searchBestMatch: jest.fn(async () => {
                clock += 1200;
                return { videoId: 'video', matchScore: 90 };
            }),
        };

        await buildMatcher({ now: () => clock }).matchTracks({ searchClient, tracks, metrics });

        expect(metrics.recordSearch).toHaveBeenCalledTimes(2);
        expect(metrics.recordSearch).toHaveBeenCalledWith(1200);
    });
});
