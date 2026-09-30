import { confirmManualMatch, searchManualMatch } from '../services/transfer/manualMatchService.js';

export const searchTrackAlternative = async (req, res, next) => {
    try {
        const candidate = await searchManualMatch({
            ...req.params, userId: req.user._id, name: req.body.name, artist: req.body.artist,
        });
        res.status(200).json({ status: 'success', data: { candidate } });
    } catch (error) {
        next(error);
    }
};

export const confirmTrackAlternative = async (req, res, next) => {
    try {
        const transfer = await confirmManualMatch({
            ...req.params, userId: req.user._id, candidateId: req.body.candidateId,
        });
        res.status(202).json({
            status: 'success', message: 'Escolha confirmada. A faixa será adicionada à playlist.',
            data: { transfer },
        });
    } catch (error) {
        next(error);
    }
};
