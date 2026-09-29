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
import { validate } from '../middlewares/validateMiddleware.js';
import {
    transferEstimateSchema,
    transferIdSchema,
    transferStartSchema,
    transferTracksSchema,
} from '../schemas/userSchemas.js';
import { transferActionLimiter, transferLimiter } from '../middlewares/rateLimiter.js';

const router = express.Router();

// Obriga todos os requests abaixo de terem feito login
router.use(protect); 

router.post('/start', transferLimiter, validate(transferStartSchema), startTransfer);
router.get('/', listTransfers);
router.get('/estimate', validate(transferEstimateSchema), getTransferEstimate);
router.post('/retry-all', transferActionLimiter, retryAllTransferTracks);
router.get('/:transferId', getTransferStatus);
router.get('/:transferId/tracks', validate(transferTracksSchema), getTransferTracks);
router.post('/:transferId/retry', transferActionLimiter, validate(transferIdSchema), retryTransferTracks);
router.post('/:transferId/resume', transferActionLimiter, validate(transferIdSchema), resumeTransferNow);

export default router;
