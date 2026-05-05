import { jest } from '@jest/globals';
import TrackMatcher from '../src/services/transfer/TrackMatcher.js';

const buildTransferRecord = () => ({
    errors: [],
    processedTracks: 0,
});

describe('TrackMatcher', () => {
    it('propaga falha operacional quando nenhuma busca no YouTube Music funciona', async () => {
        const matcher = new TrackMatcher({ delayMs: 0 });
        const transferRecord = buildTransferRecord();
        const youtubeClient = {
            searchBestVideoMatch: jest.fn().mockRejectedValue(new Error('cota excedida')),
        };

        await expect(matcher.matchPlaylistTracks({
            youtubeClient,
            tracks: [
                { name: 'Folhas de Outono', artist: 'Chet Baker' },
                { name: 'Meu Caminho', artist: 'Frank Sinatra' },
            ],
            transferRecord,
        })).rejects.toMatchObject({
            message: 'Falha ao buscar faixas no YouTube Music: cota excedida',
            isPermanentTransferError: true,
        });

        expect(transferRecord.errors).toHaveLength(2);
        expect(transferRecord.processedTracks).toBe(0);
    });

    it('mantém ordem e remove vídeos duplicados nas correspondências aceitas', async () => {
        const matcher = new TrackMatcher({ delayMs: 0 });
        const transferRecord = buildTransferRecord();
        const youtubeClient = {
            searchBestVideoMatch: jest.fn()
                .mockResolvedValueOnce({ videoId: 'video-1', matchScore: 80 })
                .mockResolvedValueOnce({ videoId: 'video-1', matchScore: 90 })
                .mockResolvedValueOnce({ videoId: 'video-2', matchScore: 70 }),
        };

        const videoIds = await matcher.matchPlaylistTracks({
            youtubeClient,
            tracks: [
                { name: 'Música 1', artist: 'Artista' },
                { name: 'Música 1 duplicada', artist: 'Artista' },
                { name: 'Música 2', artist: 'Artista' },
            ],
            transferRecord,
        });

        expect(videoIds).toEqual(['video-1', 'video-2']);
        expect(transferRecord.processedTracks).toBe(3);
    });
});
