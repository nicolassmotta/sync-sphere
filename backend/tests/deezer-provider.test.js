import { jest } from '@jest/globals';
import { writeStore } from '../src/storage/jsonStore.js';
import deezerProvider from '../src/providers/deezer/index.js';
import { classifyProviderError, ERROR_KINDS } from '../src/errors/providerErrors.js';

const ARL = 'a'.repeat(192);

const jsonResponse = (body, { headers = {} } = {}) => ({
    ok: true,
    status: 200,
    headers: {
        get: (name) => headers[name.toLowerCase()] ?? null,
        getSetCookie: () => (headers['set-cookie'] ? [headers['set-cookie']] : []),
    },
    json: async () => body,
});

const deezerTrack = (id, title, artist, extra = {}) => ({
    id,
    title,
    duration: 200,
    link: `https://www.deezer.com/track/${id}`,
    artist: { name: artist },
    album: { title: 'Álbum' },
    ...extra,
});

describe('provedor Deezer', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        global.fetch = jest.fn();
        writeStore('provider-credentials.json', {});
        delete process.env.DEEZER_ARL;
    });

    afterAll(() => {
        global.fetch = originalFetch;
    });

    it('lê playlist pública paginada sem login, com ISRC', async () => {
        global.fetch
            .mockResolvedValueOnce(jsonResponse({
                id: 908622995,
                title: 'En mode 60',
                nb_tracks: 3,
                picture_xl: 'https://cdn/xl.jpg',
                creator: { name: 'Deezer' },
                tracks: {
                    data: [deezerTrack(1, 'A', 'X', { isrc: 'FR0000000001' }), deezerTrack(2, 'B', 'Y')],
                    next: 'https://api.deezer.com/playlist/908622995/tracks?index=2',
                },
            }))
            .mockResolvedValueOnce(jsonResponse({ data: [deezerTrack(3, 'C', 'Z')] }));

        const playlist = await deezerProvider.getPlaylistSnapshot({
            playlistId: 'https://www.deezer.com/br/playlist/908622995?utm=x',
        });

        expect(global.fetch.mock.calls[0][0]).toBe('https://api.deezer.com/playlist/908622995');
        expect(playlist).toMatchObject({ id: '908622995', name: 'En mode 60', totalTracks: 3 });
        expect(playlist.tracks).toEqual([
            expect.objectContaining({ name: 'A', artist: 'X', isrc: 'FR0000000001', durationMs: 200000 }),
            expect.objectContaining({ name: 'B' }),
            expect.objectContaining({ name: 'C', artist: 'Z' }),
        ]);
    });

    it('busca por ISRC primeiro e usa texto quando não encontra', async () => {
        const client = deezerProvider.createSearchClient();

        global.fetch.mockResolvedValueOnce(jsonResponse(deezerTrack(77, 'Garota de Ipanema', 'Antônio Carlos Jobim', {
            isrc: 'USPR36400012',
        })));
        await expect(client.searchBestMatch({
            track: { name: 'Garota de Ipanema', artist: 'Antônio Carlos Jobim', isrc: 'USPR36400012' },
        })).resolves.toMatchObject({ id: '77', matchScore: 100 });

        global.fetch
            .mockResolvedValueOnce(jsonResponse({ error: { type: 'DataException', message: 'no data', code: 800 } }))
            .mockResolvedValueOnce(jsonResponse({
                data: [
                    deezerTrack(10, 'Garota de Ipanema (Backing Track)', 'The Backing Tracks'),
                    deezerTrack(11, 'Garota de Ipanema', 'Antônio Carlos Jobim'),
                ],
            }));
        const match = await client.searchBestMatch({
            track: { name: 'Garota de Ipanema', artist: 'Tom Jobim', durationMs: 200000, isrc: 'XX0000000000' },
        });

        expect(match.id).toBe('11');
        expect(match.matchScore).toBeGreaterThanOrEqual(45);
        const searchUrl = new URL(global.fetch.mock.calls.at(-1)[0]);
        expect(searchUrl.searchParams.get('q')).toBe('Garota de Ipanema Tom Jobim');
    });

    it('transforma limite de cota do Deezer em pausa (rate_limited)', async () => {
        global.fetch.mockResolvedValueOnce(jsonResponse({ error: { type: 'Exception', message: 'Quota limit exceeded', code: 4 } }));

        const error = await deezerProvider.createSearchClient()
            .searchBestMatch({ track: { name: 'A', artist: 'B' } })
            .catch((caught) => caught);

        expect(classifyProviderError(error)).toBe(ERROR_KINDS.RATE_LIMITED);
    });

    it('lê sem login, mas exige arl para escrever', async () => {
        await expect(deezerProvider.getStatus()).resolves.toMatchObject({
            connected: false,
            canRead: true,
            canWrite: false,
            authMethod: 'public-api',
        });
        await expect(deezerProvider.ensureWritable()).rejects.toMatchObject({ statusCode: 400 });
    });

    it('valida o arl no gateway, cria playlist privada e adiciona só faixas novas', async () => {
        const userData = jsonResponse(
            { error: [], results: { checkForm: 'token-1', USER: { USER_ID: 555, BLOG_NAME: 'Nicolas' } } },
            { headers: { 'set-cookie': 'sid=fr123; path=/; secure' } }
        );
        global.fetch.mockResolvedValueOnce(userData);
        await deezerProvider.saveCredentials({ values: { arl: ARL } });
        await expect(deezerProvider.getStatus()).resolves.toMatchObject({
            connected: true,
            canWrite: true,
            accountName: 'Nicolas',
            credentialSource: 'panel',
        });

        global.fetch
            .mockResolvedValueOnce(userData)
            .mockResolvedValueOnce(jsonResponse({ error: [], results: 9001 }))
            .mockResolvedValueOnce(jsonResponse({ error: [], results: { data: [{ SNG_ID: '11' }] } }))
            .mockResolvedValueOnce(jsonResponse({ error: [], results: true }));

        const destination = deezerProvider.createDestinationClient();
        const playlistId = await destination.createPlaylist({ title: 'Minha', description: 'Migrada' });
        await destination.addTracks({ playlistId, ids: ['11', '12', '12'] });

        expect(playlistId).toBe('9001');
        const [createUrl, createInit] = global.fetch.mock.calls[2];
        expect(new URL(createUrl).searchParams.get('method')).toBe('playlist.create');
        expect(new URL(createUrl).searchParams.get('api_token')).toBe('token-1');
        expect(createInit.headers.Cookie).toBe(`arl=${ARL}; sid=fr123`);
        expect(JSON.parse(createInit.body)).toEqual({ title: 'Minha', status: 1, description: 'Migrada', songs: [] });

        const [, addInit] = global.fetch.mock.calls[4];
        expect(JSON.parse(addInit.body)).toEqual({ PLAYLIST_ID: '9001', songs: [[12, 0], [12, 0]], offset: -1 });
        expect(destination.getPlaylistUrl('9001')).toBe('https://www.deezer.com/playlist/9001');
    });

    it('recusa arl com formato errado e arl expirado', async () => {
        await expect(deezerProvider.saveCredentials({ values: { arl: 'abc' } }))
            .rejects.toMatchObject({ statusCode: 400 });

        global.fetch.mockResolvedValueOnce(jsonResponse({ error: [], results: { checkForm: 'x', USER: { USER_ID: 0 } } }));
        await expect(deezerProvider.saveCredentials({ values: { arl: ARL } }))
            .rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('inválido ou expirou') });
    });

    it('renova o token do gateway quando o Deezer responde CSRF inválido', async () => {
        process.env.DEEZER_ARL = ARL;
        const userData = (token) => jsonResponse({ error: [], results: { checkForm: token, USER: { USER_ID: 1 } } });
        global.fetch
            .mockResolvedValueOnce(userData('old'))
            .mockResolvedValueOnce(jsonResponse({ error: { VALID_TOKEN_REQUIRED: 'Invalid CSRF token' }, results: {} }))
            .mockResolvedValueOnce(userData('new'))
            .mockResolvedValueOnce(jsonResponse({ error: [], results: 42 }));

        await expect(deezerProvider.createDestinationClient().createPlaylist({ title: 'T' })).resolves.toBe('42');
        expect(new URL(global.fetch.mock.calls[3][0]).searchParams.get('api_token')).toBe('new');
    });
    it('preserva total e omissões ao atingir o limite público', async () => {
        const { getPublicPlaylist } = await import('../src/providers/deezer/deezerPublicApi.js');
        global.fetch.mockResolvedValueOnce(jsonResponse({ id: 123, nb_tracks: 3, tracks: { data: [deezerTrack(1, 'A', 'X')], next: 'https://api.deezer.com/playlist/123/tracks?index=1' } }));
        expect(await getPublicPlaylist('123', { limit: 1 })).toMatchObject({ totalTracks: 3, truncated: true, omittedTracks: 2 });
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

});
