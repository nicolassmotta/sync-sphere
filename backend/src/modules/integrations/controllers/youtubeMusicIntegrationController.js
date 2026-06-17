import AppError from '../../../utils/AppError.js';
import { getYoutubeMusicPlaylistTracksPreview } from '../../../services/youtubeMusicService.js';

export const getYoutubeMusicPlaylistTracks = async (req, res, next) => {
    try {
        const playlistId = req.query.playlistId || req.params.playlistId;
        if (!playlistId) {
            return next(new AppError('Informe o link ou ID da playlist do YouTube Music.', 400));
        }

        const result = await getYoutubeMusicPlaylistTracksPreview({
            playlistId,
            limit: req.query.limit,
        });

        res.status(200).json({
            status: 'success',
            results: result.tracks.length,
            data: result,
        });
    } catch (error) {
        next(new AppError(error.message || 'Não foi possível listar faixas da playlist do YouTube Music.', 400));
    }
};
