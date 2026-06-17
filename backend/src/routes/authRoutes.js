import express from 'express';
import { getMe, logout } from '../controllers/authController.js';

const router = express.Router();

// No modo local não há registro nem login: só a confirmação da sessão local.
router.get('/me', getMe);
router.post('/logout', logout);

export default router;
