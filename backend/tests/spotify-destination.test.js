import { jest } from '@jest/globals';
import User from '../src/models/User.js';
import { createSpotifyDestinationClient } from '../src/services/spotifyService.js';

const originalFetch = global.fetch;
const response = (data, status = 200) => ({ ok: status < 400, status, headers: { get: () => null }, json: async () => data });

beforeEach(async () => {
    global.fetch = jest.fn();
    process.env.SPOTIFY_CLIENT_ID = 'client-id-de-teste';
    const user = await User.findById('local');
    user.spotifyToken = 'token-de-teste';
    user.spotifyTokenExpiresAt = new Date(Date.now() + 3600000);
    await user.save();
});
afterEach(() => { global.fetch = originalFetch; });

it('cria playlist pelo endpoint da conta atual', async () => {
    global.fetch.mockResolvedValueOnce(response({ id: 'nova' }, 201));
    expect(await createSpotifyDestinationClient({ userId: 'local' }).createPlaylist({ title: 'Lista', description: '' })).toBe('nova');
    expect(new URL(global.fetch.mock.calls[0][0]).pathname).toBe('/v1/me/playlists');
    expect(JSON.parse(global.fetch.mock.calls[0][1].body).public).toBe(false);
});

it('consulta items paginados, preserva repetições e não repete uma escrita concluída', async () => {
    let current = ['spotify:track:A'];
    global.fetch.mockImplementation(async (url, options) => {
        if (options?.method === 'POST') {
            current.push(...JSON.parse(options.body).uris);
            return response({ snapshot_id: 'atualizado' }, 201);
        }
        const address = new URL(url);
        if (!address.searchParams.has('offset')) return response({ items: [], next: 'https://api.spotify.com/v1/playlists/lista/items?offset=1' });
        return response({ items: current.map((uri) => ({ item: { uri } })), next: null });
    });
    const desired = ['spotify:track:A', 'spotify:track:B', 'spotify:track:A'];
    const client = createSpotifyDestinationClient({ userId: 'local' });
    await client.addTracksToPlaylist({ playlistId: 'lista', trackUris: desired, expectedIds: desired });
    await client.addTracksToPlaylist({ playlistId: 'lista', trackUris: desired, expectedIds: desired });
    expect(current).toEqual(desired);
    const writes = global.fetch.mock.calls.filter(([, options]) => options?.method === 'POST');
    expect(writes).toHaveLength(1);
    expect(new URL(writes[0][0]).pathname).toBe('/v1/playlists/lista/items');
    expect(JSON.parse(writes[0][1].body).uris).toEqual(['spotify:track:B', 'spotify:track:A']);
});

it('não insere às cegas quando a consulta da playlist falha', async () => {
    global.fetch.mockResolvedValueOnce(response({ error: { message: 'Service unavailable' } }, 503));
    await expect(createSpotifyDestinationClient({ userId: 'local' }).addTracksToPlaylist({ playlistId: 'lista', trackUris: ['spotify:track:A'] })).rejects.toThrow();
    expect(global.fetch).toHaveBeenCalledTimes(1);
});
