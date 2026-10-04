import express from 'express';
import {
    downloadTransferReport,
    getTransferEstimate,
    getTransferStatus,
    getTransferTracks,
    listTransfers,
    resumeTransferNow,
    retryAllTransferTracks,
    retryTransferTracks,
    startTransfer,
} from '../controllers/transferController.js';
import { protect } from '../middlewares/authMiddleware.js';
import { searchTrackAlternative, confirmTrackAlternative, confirmTrackBatch, getTrackAlternatives, forgetTrackChoice, createOrderedCopy, getCorrectionAlternatives, searchCorrectionAlternative } from '../controllers/manualMatchController.js';
import { validate } from '../middlewares/validateMiddleware.js';
import {
    transferEstimateSchema,
    transferIdSchema,
    transferStartSchema,
    transferTracksSchema,
    manualMatchSearchSchema,
    manualCandidatesSchema,
    orderedCopySchema,
    manualMatchBatchSchema,
    manualMatchConfirmSchema,
} from '../schemas/userSchemas.js';
import { transferActionLimiter, transferLimiter } from '../middlewares/rateLimiter.js';

const router = express.Router();

// Usa o único usuário local nas rotas de transferência.
router.use(protect); 

router.post('/start', transferLimiter, validate(transferStartSchema), startTransfer);
router.get('/', listTransfers);
router.get('/estimate', validate(transferEstimateSchema), getTransferEstimate);
router.post('/retry-all', transferActionLimiter, retryAllTransferTracks);
router.get('/:transferId/report', validate(transferIdSchema), downloadTransferReport);
router.get('/:transferId', getTransferStatus);
router.get('/:transferId/tracks', validate(transferTracksSchema), getTransferTracks);
router.get('/:transferId/tracks/:trackIndex/correction-candidates', validate(manualCandidatesSchema), getCorrectionAlternatives);
router.post('/:transferId/tracks/:trackIndex/correction-search', transferActionLimiter, validate(manualMatchSearchSchema), searchCorrectionAlternative);
router.delete('/:transferId/tracks/:trackIndex/choice', transferActionLimiter, validate(manualCandidatesSchema), forgetTrackChoice);
router.get('/:transferId/tracks/:trackIndex/candidates', validate(manualCandidatesSchema), getTrackAlternatives);
router.post('/:transferId/ordered-copy', transferActionLimiter, validate(orderedCopySchema), createOrderedCopy);
router.post('/:transferId/review', transferActionLimiter, validate(manualMatchBatchSchema), confirmTrackBatch);
router.post('/:transferId/tracks/:trackIndex/search', transferActionLimiter, validate(manualMatchSearchSchema), searchTrackAlternative);
router.post('/:transferId/tracks/:trackIndex/confirm', transferActionLimiter, validate(manualMatchConfirmSchema), confirmTrackAlternative);
router.post('/:transferId/retry', transferActionLimiter, validate(transferIdSchema), retryTransferTracks);
router.post('/:transferId/resume', transferActionLimiter, validate(transferIdSchema), resumeTransferNow);

export default router;
