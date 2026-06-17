import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/models/User.js', () => ({
    default: {
        findById: jest.fn(),
    },
}));

const {
    buildSpotifyAuthorizationUrl,
    exchangeSpotifyCode,
} = await import('../src/services/spotify/spotifyAuth.js');

const tokenResponse = (data, { ok = true } = {}) => ({
    ok,
    json: jest.fn().mockResolvedValue(data),
});

describe('Spotify OAuth PKCE', () => {
    beforeEach(() => {
        process.env.SPOTIFY_CLIENT_ID = 'spotify-client-id';
        process.env.SPOTIFY_REDIRECT_URI = 'http://127.0.0.1:8000/api/v1/integrations/spotify/callback';
        global.fetch = jest.fn().mockResolvedValue(tokenResponse({
            access_token: 'spotify-access-token',
            refresh_token: 'spotify-refresh-token',
            expires_in: 3600,
        }));
    });

    it('gera challenge PKCE e troca o code usando verifier, sem client secret', async () => {
        const state = 'oauth-state-1';
        const authorizationUrl = new URL(buildSpotifyAuthorizationUrl(state));

        expect(authorizationUrl.origin).toBe('https://accounts.spotify.com');
        expect(authorizationUrl.pathname).toBe('/authorize');
        expect(authorizationUrl.searchParams.get('client_id')).toBe('spotify-client-id');
        expect(authorizationUrl.searchParams.get('redirect_uri')).toBe(process.env.SPOTIFY_REDIRECT_URI);
        expect(authorizationUrl.searchParams.get('state')).toBe(state);
        expect(authorizationUrl.searchParams.get('code_challenge_method')).toBe('S256');
        expect(authorizationUrl.searchParams.get('code_challenge')).toEqual(expect.any(String));

        const tokenData = await exchangeSpotifyCode('spotify-code', state);

        expect(tokenData.access_token).toBe('spotify-access-token');
        expect(global.fetch).toHaveBeenCalledWith(
            'https://accounts.spotify.com/api/token',
            expect.objectContaining({
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            })
        );

        const tokenRequestBody = global.fetch.mock.calls[0][1].body;
        expect(tokenRequestBody.get('client_id')).toBe('spotify-client-id');
        expect(tokenRequestBody.get('grant_type')).toBe('authorization_code');
        expect(tokenRequestBody.get('code')).toBe('spotify-code');
        expect(tokenRequestBody.get('redirect_uri')).toBe(process.env.SPOTIFY_REDIRECT_URI);
        expect(tokenRequestBody.get('code_verifier')).toEqual(expect.any(String));
        expect(tokenRequestBody.get('client_secret')).toBeNull();

        expect(() => exchangeSpotifyCode('spotify-code', state))
            .toThrow('Sessão de conexão do Spotify expirada');
    });
});
