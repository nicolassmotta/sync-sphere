import crypto from 'node:crypto';
import { readStore } from '../../storage/jsonStore.js';
import { getProviderCredentials } from '../../storage/credentialStore.js';

export const matchCacheScope = (providerId, userId) => {
    const credentials = getProviderCredentials(providerId) || {};
    const spotifyCredentials = providerId === 'spotify' ? readStore('credentials.json', {}) : {};
    const credentialRevision = crypto.createHash('sha256').update(JSON.stringify([
        credentials.updatedAt || null,
        spotifyCredentials.spotifyRefreshToken || null,
        ...Object.entries(process.env).filter(([key]) => key.startsWith({ spotify: 'SPOTIFY_', youtubeMusic: 'YTMUSIC_',
            deezer: 'DEEZER_', tidal: 'TIDAL_', appleMusic: 'APPLE_', soundcloud: 'SOUNDCLOUD_' }[providerId] || 'UNUSED_'))
            .sort(([a], [b]) => a.localeCompare(b)),
    ])).digest('hex');
    return [providerId, userId, credentialRevision,
        credentials.storefront || process.env.APPLE_MUSIC_STOREFRONT || 'br',
        credentials.countryCode || process.env.TIDAL_COUNTRY_CODE || 'BR',
        credentials.userId || credentials.accountId || null];
};
