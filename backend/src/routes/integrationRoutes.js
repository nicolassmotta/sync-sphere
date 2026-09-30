import express from 'express';
import {
    disconnectProvider,
    getIntegrationStatus,
    getMusicKitDeveloperToken,
    getProviderPlaylistTracks,
    listProviderPlaylists,
    providerCallback,
    saveProviderCredentials,
    startProviderAuthorization,
} from '../modules/integrations/controllers/providerIntegrationController.js';
import {
    deleteImportedPlaylist,
    downloadExport,
    importPlaylistFile,
} from '../modules/integrations/controllers/fileIntegrationController.js';
import { protect } from '../middlewares/authMiddleware.js';
import { validate } from '../middlewares/validateMiddleware.js';
import { providerCredentialsSchema } from '../schemas/userSchemas.js';

const router = express.Router();

// Callback OAuth vem do navegador, redirecionado pela plataforma.
router.get('/:provider/callback', providerCallback);

router.use(protect);

router.get('/status', getIntegrationStatus);

// Plataforma "arquivo": importação e download de exportações.
router.post('/file/imports', express.text({ type: () => true, limit: '5mb' }), importPlaylistFile);
router.delete('/file/imports/:importId', deleteImportedPlaylist);
router.get('/file/exports/:exportId/download', downloadExport);

router.get('/:provider/login', startProviderAuthorization);
router.get('/:provider/developer-token', getMusicKitDeveloperToken);
router.put('/:provider/credentials', validate(providerCredentialsSchema), saveProviderCredentials);
router.delete('/:provider', disconnectProvider);
router.get('/:provider/playlists', listProviderPlaylists);
router.get('/:provider/playlists/:playlistId/tracks', getProviderPlaylistTracks);
router.get('/:provider/playlist-tracks', getProviderPlaylistTracks);

export default router;
