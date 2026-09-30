import express from 'express';
import {
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
import { searchTrackAlternative, confirmTrackAlternative } from '../controllers/manualMatchController.js';
import { validate } from '../middlewares/validateMiddleware.js';
import {
    transferEstimateSchema,
    transferIdSchema,
    transferStartSchema,
    transferTracksSchema,
    manualMatchSearchSchema,
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
router.get('/:transferId', getTransferStatus);
router.get('/:transferId/tracks', validate(transferTracksSchema), getTransferTracks);
router.post('/:transferId/tracks/:trackIndex/search', transferActionLimiter, validate(manualMatchSearchSchema), searchTrackAlternative);
router.post('/:transferId/tracks/:trackIndex/confirm', transferActionLimiter, validate(manualMatchConfirmSchema), confirmTrackAlternative);
router.post('/:transferId/retry', transferActionLimiter, validate(transferIdSchema), retryTransferTracks);
router.post('/:transferId/resume', transferActionLimiter, validate(transferIdSchema), resumeTransferNow);

export default router;
