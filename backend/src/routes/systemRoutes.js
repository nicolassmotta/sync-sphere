import express from 'express';
import { getDiagnostic, downloadBackup, importDemo, getProviderSetupStatus, configureProviderApp } from '../controllers/systemController.js';
import { validate } from '../middlewares/validateMiddleware.js';
import { providerSetupQuerySchema, providerSetupSchema, backupSchema } from '../schemas/systemSchemas.js';
import AppError from '../utils/AppError.js';

const router = express.Router();
router.use((req, res, next) => {
    const address = req.socket.remoteAddress;
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address)) {
        return next(new AppError('Abra o aplicativo neste computador para usar backup e diagnóstico.', 403));
    }
    res.setHeader('Cache-Control', 'no-store');
    next();
});
router.get('/providers/:providerId/setup', validate(providerSetupQuerySchema), getProviderSetupStatus);
router.put('/providers/:providerId/setup', validate(providerSetupSchema), configureProviderApp);
router.get('/diagnostic', getDiagnostic);
router.post('/demo', importDemo);
router.post('/backups', validate(backupSchema), downloadBackup);
export default router;
