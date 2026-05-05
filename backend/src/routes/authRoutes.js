import express from 'express';
import {
    login,
    register,
    logout,
    getMe,
} from '../controllers/authController.js';
import { validate } from '../middlewares/validateMiddleware.js';
import { protect } from '../middlewares/authMiddleware.js';
import {
    registerSchema,
    loginSchema,
} from '../schemas/userSchemas.js';
import { authLimiter } from '../middlewares/rateLimiter.js';

const router = express.Router();

router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/logout', logout);

// Acesso restrito protegido por cookie seguro.
router.get('/me', protect, getMe);

export default router;
