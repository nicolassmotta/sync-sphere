import express from 'express';
import { startTransfer, getTransferStatus, listTransfers } from '../controllers/transferController.js';
import { protect } from '../middlewares/authMiddleware.js';
import { validate } from '../middlewares/validateMiddleware.js';
import { transferStartSchema } from '../schemas/userSchemas.js';
import { transferLimiter } from '../middlewares/rateLimiter.js';

const router = express.Router();

// Obriga todos os requests abaixo de terem feito login
router.use(protect); 

router.post('/start', transferLimiter, validate(transferStartSchema), startTransfer);
router.get('/', listTransfers);
router.get('/:transferId', getTransferStatus);

export default router;
