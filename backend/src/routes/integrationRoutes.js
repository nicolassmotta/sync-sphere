import express from 'express';
import { getIntegrationStatus } from '../modules/integrations/controllers/integrationStatusController.js';
import {
    disconnectSpotify,
    getSpotifyAuthorization,
    getSpotifyPlaylistTracks,
    getSpotifyPlaylists,
    spotifyCallback,
} from '../modules/integrations/controllers/spotifyIntegrationController.js';
import { getYoutubeMusicPlaylistTracks } from '../modules/integrations/controllers/youtubeMusicIntegrationController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/spotify/callback', spotifyCallback);

router.use(protect);

router.get('/status', getIntegrationStatus);
router.get('/spotify/login', getSpotifyAuthorization);
router.get('/spotify/playlists', getSpotifyPlaylists);
router.get('/spotify/playlists/:playlistId/tracks', getSpotifyPlaylistTracks);
router.delete('/spotify', disconnectSpotify);
router.get('/youtube-music/playlist-tracks', getYoutubeMusicPlaylistTracks);

export default router;
