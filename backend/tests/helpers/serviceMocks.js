import { jest } from '@jest/globals';

/**
 * Mocks completos dos serviços das plataformas. Os adaptadores em
 * `src/providers/` importam várias funções nomeadas; um mock ESM parcial
 * quebraria o carregamento. Cada teste sobrescreve só o que usa.
 */
const SPOTIFY_SERVICE_EXPORTS = [
    'buildSpotifyAuthorizationUrl',
    'createSpotifyDestinationClient',
    'createSpotifySearchClient',
    'ensureSpotifyDestinationReady',
    'exchangeSpotifyCode',
    'getSpotifyPlaylistSnapshot',
    'getSpotifyPlaylistTracksPreview',
    'listSpotifyUserPlaylists',
    'normalizeSpotifyPlaylistId',
];

const YOUTUBE_MUSIC_SERVICE_EXPORTS = [
    'clearYoutubeMusicCookie',
    'createYoutubeMusicCookieDestinationClient',
    'createYoutubeMusicSearchClient',
    'getYoutubeMusicCookieSource',
    'getYoutubeMusicPlaylistSnapshot',
    'getYoutubeMusicPlaylistTracksPreview',
    'isYoutubeMusicCookieDestinationConfigured',
    'normalizeYoutubeMusicPlaylistId',
    'saveYoutubeMusicCookie',
    'validateYoutubeMusicCookieDestinationConfig',
];

const buildModule = (names, overrides) => ({
    ...Object.fromEntries(names.map((name) => [name, jest.fn()])),
    ...overrides,
});

export const buildSpotifyServiceMock = (overrides = {}) => buildModule(SPOTIFY_SERVICE_EXPORTS, {
    normalizeSpotifyPlaylistId: (input) => {
        const trimmed = String(input).trim();
        const match = trimmed.match(/playlist\/([a-zA-Z0-9]+)/);
        return match ? match[1] : trimmed.split('?')[0];
    },
    ...overrides,
});

export const buildYoutubeMusicServiceMock = (overrides = {}) => buildModule(YOUTUBE_MUSIC_SERVICE_EXPORTS, {
    isYoutubeMusicCookieDestinationConfigured: () => Boolean(process.env.YTMUSIC_COOKIE?.trim()),
    getYoutubeMusicCookieSource: () => (process.env.YTMUSIC_COOKIE?.trim() ? 'env' : null),
    normalizeYoutubeMusicPlaylistId: (input) => {
        const trimmed = String(input).trim();
        const match = trimmed.match(/[?&]list=([a-zA-Z0-9_-]+)/);
        return match ? match[1] : trimmed.split('?')[0];
    },
    ...overrides,
});
