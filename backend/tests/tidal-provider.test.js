import { jest } from '@jest/globals';
import { writeStore } from '../src/storage/jsonStore.js';
import { setProviderCredentials, getProviderCredentials } from '../src/storage/credentialStore.js';
import tidalProvider from '../src/providers/tidal/index.js';
import { parseIsoDuration } from '../src/providers/tidal/tidalApi.js';
import { classifyProviderError, ERROR_KINDS } from '../src/errors/providerErrors.js';

const response = (body, { status = 200, headers = {} } = {}) => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    json: async () => body,
});

const trackResource = (id, title, artistId, extra = {}) => ({
    id,
    type: 'tracks',
    attributes: { title, duration: 'PT3M20S', isrc: `ISRC${id}`, ...extra },
    relationships: { artists: { data: [{ id: artistId, type: 'artists' }] }, albums: { data: [] } },
});

const connect = (overrides = {}) => setProviderCredentials('tidal', {
    accessToken: 'user-token',
    refreshToken: 'refresh-1',
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    countryCode: 'BR',
    ...overrides,
});

const fetchUrl = (index) => new URL(global.fetch.mock.calls[index][0]);

describe('provedor TIDAL', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        global.fetch = jest.fn();
        writeStore('provider-credentials.json', {});
        process.env.TIDAL_CLIENT_ID = 'tidal-client';
        delete process.env.TIDAL_CLIENT_SECRET;
    });

    afterAll(() => {
        global.fetch = originalFetch;
        delete process.env.TIDAL_CLIENT_ID;
    });

    it('converte duração ISO 8601', () => {
        expect(parseIsoDuration('PT3M20S')).toBe(200000);
        expect(parseIsoDuration('PT1H2M3S')).toBe(3723000);
        expect(parseIsoDuration('PT45.5S')).toBe(45500);
        expect(parseIsoDuration('')).toBe(0);
    });

    it('monta a URL de login com PKCE e troca o code pelo token', async () => {
        const url = new URL(tidalProvider.oauth.getAuthorizationUrl({
            req: { user: { _id: 'local' }, headers: {}, get: () => undefined },
        }));

        expect(url.origin + url.pathname).toBe('https://login.tidal.com/authorize');
        expect(url.searchParams.get('client_id')).toBe('tidal-client');
        expect(url.searchParams.get('code_challenge_method')).toBe('S256');
        expect(url.searchParams.get('scope')).toContain('playlists.write');
        expect(url.searchParams.get('redirect_uri')).toBe('http://127.0.0.1:8000/api/v1/integrations/tidal/callback');

        global.fetch
            .mockResolvedValueOnce(response({ access_token: 'new-token', refresh_token: 'refresh-2', expires_in: 3600 }))
            .mockResolvedValueOnce(response({ data: { id: 'u1', attributes: { username: 'nicolas', country: 'BR' } } }));

        const result = await tidalProvider.oauth.handleCallback({
            query: { code: 'the-code', state: url.searchParams.get('state') },
        });

        expect(result.connected).toBe(true);
        expect(result.redirectUrl).toContain('provider=tidal');
        const tokenBody = global.fetch.mock.calls[0][1].body;
        expect(tokenBody.get('grant_type')).toBe('authorization_code');
        expect(tokenBody.get('code_verifier')).toHaveLength(86);
        expect(tokenBody.has('client_secret')).toBe(false);
        expect(getProviderCredentials('tidal')).toMatchObject({ accessToken: 'new-token', username: 'nicolas', countryCode: 'BR' });
        await expect(tidalProvider.getStatus()).resolves.toMatchObject({ connected: true, canWrite: true, accountName: 'nicolas' });
    });

    it('renova o token vencido antes de chamar a API', async () => {
        connect({ expiresAt: new Date(Date.now() - 1000).toISOString() });
        global.fetch
            .mockResolvedValueOnce(response({ access_token: 'renewed', expires_in: 3600 }))
            .mockResolvedValueOnce(response({ data: [] , links: {} }));

        await tidalProvider.listPlaylists();

        expect(global.fetch.mock.calls[0][1].body.get('grant_type')).toBe('refresh_token');
        expect(global.fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer renewed');
        expect(fetchUrl(1).searchParams.get('filter[owners.id]')).toBe('me');
    });

    it('lê playlist paginada por cursor e completa artistas em lote', async () => {
        connect();
        const playlistId = '36ea71a8-445e-41a4-82ab-6628c581535d';
        global.fetch.mockImplementation(async (url) => {
            const { pathname, searchParams } = new URL(url);
            if (pathname.endsWith(`/playlists/${playlistId}`)) {
                return response({ data: { id: playlistId, attributes: { name: 'Minha TIDAL', numberOfItems: 3 } } });
            }
            if (pathname.endsWith('/relationships/items') && !searchParams.get('page[cursor]')) {
                return response({
                    data: [{ id: '1', type: 'tracks' }, { id: 'v9', type: 'videos' }, { id: '2', type: 'tracks' }],
                    links: { next: `/playlists/${playlistId}/relationships/items?page[cursor]=abc` },
                });
            }
            if (pathname.endsWith('/relationships/items')) {
                return response({ data: [{ id: '3', type: 'tracks' }], links: {} });
            }
            if (pathname.endsWith('/tracks')) {
                return response({
                    data: searchParams.get('filter[id]').split(',').map((id) => trackResource(id, `Faixa ${id}`, 'a1')),
                    included: [{ id: 'a1', type: 'artists', attributes: { name: 'Artista' } }],
                });
            }
            throw new Error(`URL inesperada ${url}`);
        });

        const playlist = await tidalProvider.getPlaylistSnapshot({ playlistId: `https://tidal.com/browse/playlist/${playlistId}` });

        expect(playlist).toMatchObject({ id: playlistId, name: 'Minha TIDAL', totalTracks: 3 });
        expect(playlist.tracks.map((track) => track.name)).toEqual(['Faixa 1', 'Faixa 2', 'Faixa 3']);
        expect(playlist.tracks[0]).toMatchObject({ artist: 'Artista', durationMs: 200000, isrc: 'ISRC1' });
        expect(global.fetch.mock.calls.every(([, init]) => init.headers.Accept === 'application/vnd.api+json')).toBe(true);
    });

    it('busca por ISRC e, sem resultado, por texto com pontuação', async () => {
        connect();
        const client = tidalProvider.createSearchClient();

        global.fetch.mockResolvedValueOnce(response({
            data: [trackResource('77', 'Garota de Ipanema', 'a1')],
            included: [{ id: 'a1', type: 'artists', attributes: { name: 'Antônio Carlos Jobim' } }],
        }));
        await expect(client.searchBestMatch({ track: { name: 'Garota de Ipanema', artist: 'Antônio Carlos Jobim', isrc: 'ISRC77' } }))
            .resolves.toMatchObject({ id: '77', matchScore: 100 });
        expect(fetchUrl(0).searchParams.get('filter[isrc]')).toBe('ISRC77');

        global.fetch
            .mockResolvedValueOnce(response({ data: [], included: [] }))
            .mockResolvedValueOnce(response({ data: [{ id: '10', type: 'tracks' }, { id: '11', type: 'tracks' }] }))
            .mockResolvedValueOnce(response({
                data: [trackResource('10', 'Outra', 'a2'), trackResource('11', 'Garota de Ipanema', 'a1')],
                included: [
                    { id: 'a1', type: 'artists', attributes: { name: 'Antônio Carlos Jobim' } },
                    { id: 'a2', type: 'artists', attributes: { name: 'Banda' } },
                ],
            }));
        const match = await client.searchBestMatch({ track: { name: 'Garota de Ipanema', artist: 'Antônio Carlos Jobim', isrc: 'NOPE' } });

        expect(match.id).toBe('11');
        expect(fetchUrl(2).pathname).toBe(`/v2/searchResults/${encodeURIComponent('Garota de Ipanema Antônio Carlos Jobim')}/relationships/tracks`);
    });

    it('cria playlist e adiciona em lotes de 50 preservando repetições', async () => {
        connect();
        global.fetch
            .mockResolvedValueOnce(response({ data: { id: 'pl-1', type: 'playlists' } }, { status: 201 }))
            .mockResolvedValue(response({ links: {} }));

        const destination = tidalProvider.createDestinationClient();
        const playlistId = await destination.createPlaylist({ title: 'Migrada', description: 'SyncSphere' });
        const ids = Array.from({ length: 120 }, (_, index) => String(index));
        await destination.addTracks({ playlistId, ids: [...ids, '1'] });

        expect(playlistId).toBe('pl-1');
        expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({
            data: { type: 'playlists', attributes: { name: 'Migrada', description: 'SyncSphere', accessType: 'UNLISTED' } },
        });
        const addBodies = global.fetch.mock.calls.filter(([, init]) => init.method === 'POST').slice(1).map(([, init]) => JSON.parse(init.body));
        expect(addBodies.map((body) => body.data.length)).toEqual([50, 50, 21]);
        expect(addBodies[0].meta).toEqual({ onDuplicates: 'ADD' });
        expect(addBodies[0].data[0]).toEqual({ id: '0', type: 'tracks' });
    });

    it('429 do TIDAL vira pausa com Retry-After; sem conta, pede conexão', async () => {
        connect();
        global.fetch.mockResolvedValueOnce(response(
            { errors: [{ status: '429', detail: 'Rate limit exceeded' }] },
            { status: 429, headers: { 'retry-after': '30' } }
        ));
        const error = await tidalProvider.createSearchClient()
            .searchBestMatch({ track: { name: 'A', artist: 'B' } })
            .catch((caught) => caught);
        expect(classifyProviderError(error)).toBe(ERROR_KINDS.RATE_LIMITED);
        expect(error.retryAfter).toBe('30');

        writeStore('provider-credentials.json', {});
        await expect(tidalProvider.ensureWritable()).rejects.toMatchObject({ statusCode: 400 });
        await expect(tidalProvider.getStatus()).resolves.toMatchObject({ connected: false, canRead: false });

        process.env.TIDAL_CLIENT_SECRET = 'secret';
        await expect(tidalProvider.getStatus()).resolves.toMatchObject({ canRead: true, canWrite: false });
    });

    it('reconcilia ocorrências após escrita parcial sem duplicar numa segunda execução', async () => {
        connect();
        const existing = ['1'];
        global.fetch.mockImplementation(async (_url, init) => {
            if (init.method === 'POST') {
                const body = JSON.parse(init.body);
                expect(body.meta.onDuplicates).toBe('ADD');
                existing.push(...body.data.map((track) => track.id));
                return response({ links: {} });
            }
            return response({ data: existing.map((id) => ({ id, type: 'tracks' })), links: {} });
        });
        const ids = ['1', '2', '1'];
        await tidalProvider.createDestinationClient().addTracks({ playlistId: 'lista', ids, expectedIds: ids });
        await tidalProvider.createDestinationClient().addTracks({ playlistId: 'lista', ids, expectedIds: ids });
        expect(existing).toEqual(ids);
        expect(global.fetch.mock.calls.filter(([, init]) => init.method === 'POST')).toHaveLength(1);
    });
    it('sinaliza corte sem confundir vídeos ou faixas indisponíveis', async () => {
        connect();
        const { getPlaylistTrackIds } = await import('../src/providers/tidal/tidalApi.js');
        global.fetch.mockResolvedValueOnce(response({ data: [{ id: '1', type: 'tracks' }, { id: 'v', type: 'videos' }], links: { next: '/playlists/demo/relationships/items?page[cursor]=next' } }));
        const snapshot = await getPlaylistTrackIds({ token: 'fictício', countryCode: 'BR', playlistId: 'demo', limit: 1, withReadInfo: true });
        expect(snapshot).toEqual({ ids: ['1'], truncated: true });
        global.fetch.mockResolvedValueOnce(response({ data: [{ id: '1', type: 'tracks' }, { id: 'v', type: 'videos' }], links: {} }));
        expect(await getPlaylistTrackIds({ token: 'fictício', countryCode: 'BR', playlistId: 'demo', limit: 1, withReadInfo: true })).toEqual({ ids: ['1'], truncated: false });
    });

});
