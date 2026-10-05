import { recreateOrderedPlaylist } from '../services/transfer/recreateOrderedPlaylist.js';
import { forgetManualChoice, confirmManualMatch, confirmManualMatchBatch, listManualCandidates, searchManualMatches } from '../services/transfer/manualMatchService.js';

export const searchTrackAlternative = async (req, res, next) => {
    try {
        const candidates = await searchManualMatches({
            ...req.params, userId: req.user._id, name: req.body.name, artist: req.body.artist,
        });
        res.status(200).json({ status: 'success', data: { candidate: candidates[0] || null, candidates } });
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

export const getTrackAlternatives = async (req, res, next) => {
    try {
        const candidates = await listManualCandidates({ ...req.params, userId: req.user._id });
        res.json({ status: 'success', data: { candidates } });
    } catch (error) { next(error); }
};

export const confirmTrackBatch = async (req, res, next) => {
    try {
        const transfer = await confirmManualMatchBatch({ ...req.params, userId: req.user._id, choices: req.body.choices });
        res.status(202).json({ status: 'success', message: 'Revisão salva. As escolhas serão inseridas na playlist.', data: { transfer } });
    } catch (error) { next(error); }
};

export const forgetTrackChoice = async (req, res, next) => {
    try {
        await forgetManualChoice({ ...req.params, userId: req.user._id });
        res.json({ status: 'success', message: 'Escolha esquecida para futuras transferências.' });
    } catch (error) { next(error); }
};

export const createOrderedCopy = async (req, res, next) => {
    try {
        const transfer = await recreateOrderedPlaylist({ ...req.params, userId: req.user._id, choices: req.body?.choices });
        res.status(202).json({ status: 'success', message: 'Nova playlist enfileirada na ordem da origem.', data: { transfer } });
    } catch (error) { next(error); }
};

export const getCorrectionAlternatives = async (req, res, next) => {
    try {
        const candidates = await listManualCandidates({ ...req.params, userId: req.user._id, allowInserted: true });
        res.json({ status: 'success', data: { candidates } });
    } catch (error) { next(error); }
};
export const searchCorrectionAlternative = async (req, res, next) => {
    try {
        const candidates = await searchManualMatches({ ...req.params, ...req.body, userId: req.user._id, allowInserted: true });
        res.json({ status: 'success', data: { candidates } });
    } catch (error) { next(error); }
};
