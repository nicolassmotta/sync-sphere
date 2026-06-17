import User from '../../../models/User.js';
import { hasSpotifyConnection } from '../../../services/integrations/connectionState.js';
import {
    isYoutubeMusicCookieDestinationConfigured,
} from '../../../services/youtubeMusicService.js';

const getUserWithIntegrationSecrets = (id) => {
    return User.findById(id).select('+spotifyToken +spotifyRefreshToken');
};

export const getIntegrationStatus = async (req, res, next) => {
    try {
        const user = await getUserWithIntegrationSecrets(req.user._id);
        const cookieDestinationConfigured = isYoutubeMusicCookieDestinationConfigured();

        res.status(200).json({
            status: 'success',
            data: {
                integrations: {
                    spotify: {
                        connected: hasSpotifyConnection(user),
                        expiresAt: user?.spotifyTokenExpiresAt || null,
                        roles: ['source', 'destination'],
                    },
                    youtubeMusic: {
                        connected: cookieDestinationConfigured,
                        authMethod: cookieDestinationConfigured ? 'ytmusic-cookie' : null,
                        expiresAt: null,
                        roles: ['source', 'destination'],
                    },
                },
            },
        });
    } catch (error) {
        next(error);
    }
};
