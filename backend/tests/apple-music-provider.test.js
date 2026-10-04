import crypto from 'crypto';
import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { writeStore } from '../src/storage/jsonStore.js';
import { getProviderCredentials, setProviderCredentials } from '../src/storage/credentialStore.js';
import appleMusicProvider from '../src/providers/appleMusic/index.js';
import { resetDeveloperTokenCacheForTests, signDeveloperToken } from '../src/providers/appleMusic/appleMusicAuth.js';
import { classifyProviderError, ERROR_KINDS } from '../src/errors/providerErrors.js';

const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const PRIVATE_PEM = privateKey.export({ type: 'pkcs8', format: 'pem' });

const response = (body, { status = 200 } = {}) => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
});

const song = (id, name, artistName, extra = {}) => ({
    id,
    type: 'songs',
    attributes: { name, artistName, albumName: 'Álbum', durationInMillis: 200000, isrc: `ISRC${id}`, ...extra },
});

const useSigningKey = () => {
    process.env.APPLE_TEAM_ID = 'TEAM123456';
    process.env.APPLE_KEY_ID = 'KEY1234567';
    process.env.APPLE_PRIVATE_KEY = PRIVATE_PEM.replace(/\n/g, '\\n');
};

const fetchCall = (index) => ({ url: new URL(global.fetch.mock.calls[index][0]), init: global.fetch.mock.calls[index][1] });

describe('provedor Apple Music', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        global.fetch = jest.fn();
        writeStore('provider-credentials.json', {});
        process.env.APPLE_MUSIC_AUTO_WEB_TOKEN = 'false';
        ['APPLE_TEAM_ID', 'APPLE_KEY_ID', 'APPLE_PRIVATE_KEY', 'APPLE_PRIVATE_KEY_PATH'].forEach((name) => delete process.env[name]);
        resetDeveloperTokenCacheForTests();
    });

    afterAll(() => {
        global.fetch = originalFetch;
        delete process.env.APPLE_MUSIC_AUTO_WEB_TOKEN;
    });

    it('sem configuração, lê o token público do web player e guarda em cache', async () => {
        delete process.env.APPLE_MUSIC_AUTO_WEB_TOKEN;
        const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 86400 })).toString('base64url');
        const token = `eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NiJ9.${payload}.${'s'.repeat(40)}`;
        const text = (body) => ({ ok: true, status: 200, headers: { get: () => null }, text: async () => body });

        global.fetch
            .mockResolvedValueOnce(text('<script src="/assets/index-legacy~1.js"></script><script src="/assets/index~2.js"></script>'))
            .mockResolvedValueOnce(text(`const t="${token}";`))
            .mockResolvedValue(response({ data: [song('1', 'A', 'X')] }));

        await expect(appleMusicProvider.getStatus()).resolves.toMatchObject({ canRead: true, canWrite: false });
        const client = appleMusicProvider.createSearchClient();
        await client.searchBestMatch({ track: { name: 'A', artist: 'X', isrc: 'ISRC1' } });
        await client.searchBestMatch({ track: { name: 'A', artist: 'X', isrc: 'ISRC1' } });

        expect(global.fetch.mock.calls[1][0]).toBe('https://music.apple.com/assets/index~2.js');
        const apiCalls = global.fetch.mock.calls.filter(([url]) => String(url).startsWith('https://api.music.apple.com'));
        expect(apiCalls).toHaveLength(2);
        expect(apiCalls[0][1].headers).toMatchObject({ Authorization: `Bearer ${token}`, Origin: 'https://music.apple.com' });
    });

    it('assina o developer token ES256 com kid e iss da conta Apple', () => {
        useSigningKey();
        const token = signDeveloperToken({ now: 1_000_000 });
        const decoded = jwt.verify(token, publicKey.export({ type: 'spki', format: 'pem' }), {
            algorithms: ['ES256'],
            complete: true,
            ignoreExpiration: true,
        });

        expect(decoded.header).toMatchObject({ alg: 'ES256', kid: 'KEY1234567' });
        expect(decoded.payload).toMatchObject({ iss: 'TEAM123456', iat: 1_000_000, exp: 1_000_000 + 43_200 });
        expect(appleMusicProvider.getMusicKitDeveloperToken()).toEqual(expect.any(String));
    });

    it('sem chave, exige token do web player e manda Origin do music.apple.com', async () => {
        await expect(appleMusicProvider.saveCredentials({ values: { musicUserToken: 'mut' } }))
            .rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('token do web player') });

        global.fetch.mockResolvedValueOnce(response({ data: [{ id: 'br', type: 'storefronts' }] }));
        await appleMusicProvider.saveCredentials({ values: { musicUserToken: 'mut-1', developerToken: 'Bearer web-token' } });

        const { url, init } = fetchCall(0);
        expect(url.pathname).toBe('/v1/me/storefront');
        expect(init.headers).toMatchObject({
            Authorization: 'Bearer web-token',
            Origin: 'https://music.apple.com',
            'Music-User-Token': 'mut-1',
        });
        await expect(appleMusicProvider.getStatus()).resolves.toMatchObject({
            connected: true,
            canWrite: true,
            authMethod: 'web-player-token',
            accountName: 'loja BR',
        });
    });

    it('desfaz a troca de tokens quando a Apple recusa', async () => {
        useSigningKey();
        setProviderCredentials('appleMusic', { musicUserToken: 'bom', storefront: 'br' });
        global.fetch.mockResolvedValueOnce(response({ errors: [{ status: '403', title: 'Forbidden' }] }, { status: 403 }));

        await expect(appleMusicProvider.saveCredentials({ values: { musicUserToken: 'ruim' } }))
            .rejects.toMatchObject({ statusCode: 400 });
        expect(getProviderCredentials('appleMusic')).toMatchObject({ musicUserToken: 'bom', storefront: 'br' });
    });

    it('lê playlist do catálogo pela loja do link, com paginação', async () => {
        useSigningKey();
        global.fetch
            .mockResolvedValueOnce(response({ data: [{ id: 'pl.abc', attributes: { name: 'Top Brasil', trackCount: 2, description: { standard: 'Desc' } } }] }))
            .mockResolvedValueOnce(response({ data: [song('1', 'A', 'X')], next: '/v1/catalog/us/playlists/pl.abc/tracks?offset=1' }))
            .mockResolvedValueOnce(response({ data: [song('2', 'B', 'Y')] }));

        const playlist = await appleMusicProvider.getPlaylistSnapshot({
            playlistId: 'https://music.apple.com/us/playlist/top-brasil/pl.abc',
        });

        expect(fetchCall(0).url.pathname).toBe('/v1/catalog/us/playlists/pl.abc');
        expect(fetchCall(0).init.headers.Origin).toBeUndefined();
        expect(playlist).toMatchObject({ name: 'Top Brasil', description: 'Desc', totalTracks: 2 });
        expect(playlist.tracks).toEqual([
            expect.objectContaining({ name: 'A', artist: 'X', isrc: 'ISRC1', durationMs: 200000 }),
            expect.objectContaining({ name: 'B' }),
        ]);
    });

    it('lê playlist da biblioteca com ISRC do catálogo', async () => {
        useSigningKey();
        setProviderCredentials('appleMusic', { musicUserToken: 'mut', storefront: 'br' });
        global.fetch
            .mockResolvedValueOnce(response({ data: [{ id: 'p.lib1', attributes: { name: 'Minha' } }] }))
            .mockResolvedValueOnce(response({
                data: [{
                    id: 'i.lib-song',
                    type: 'library-songs',
                    attributes: { name: 'Faixa', artistName: 'Banda', durationInMillis: 100000, playParams: { catalogId: '555' } },
                    relationships: { catalog: { data: [{ id: '555', attributes: { isrc: 'BRXXX0000001' } }] } },
                }],
            }));

        const playlist = await appleMusicProvider.getPlaylistSnapshot({ playlistId: 'p.lib1' });

        expect(fetchCall(1).url.searchParams.get('include')).toBe('catalog');
        expect(fetchCall(1).init.headers['Music-User-Token']).toBe('mut');
        expect(playlist.tracks[0]).toMatchObject({ appleId: '555', isrc: 'BRXXX0000001', name: 'Faixa' });
    });

    it('busca por ISRC e depois por texto na loja da conta', async () => {
        useSigningKey();
        setProviderCredentials('appleMusic', { musicUserToken: 'mut', storefront: 'br' });
        const client = appleMusicProvider.createSearchClient();

        global.fetch.mockResolvedValueOnce(response({ data: [song('9', 'Garota de Ipanema', 'Antônio Carlos Jobim')] }));
        await expect(client.searchBestMatch({ track: { name: 'Garota de Ipanema', artist: 'Antônio Carlos Jobim', isrc: 'ISRC9' } }))
            .resolves.toMatchObject({ id: '9', matchScore: 100 });
        expect(fetchCall(0).url.searchParams.get('filter[isrc]')).toBe('ISRC9');

        global.fetch
            .mockResolvedValueOnce(response({ data: [] }))
            .mockResolvedValueOnce(response({ results: { songs: { data: [song('1', 'Outra', 'Z'), song('2', 'Garota de Ipanema', 'Tom Jobim')] } } }));
        const match = await client.searchBestMatch({ track: { name: 'Garota de Ipanema', artist: 'Tom Jobim', isrc: 'NOPE' } });

        expect(match.id).toBe('2');
        expect(fetchCall(2).url.pathname).toBe('/v1/catalog/br/search');
        expect(fetchCall(2).url.searchParams.get('types')).toBe('songs');
    });

    it('cria playlist na biblioteca e adiciona só faixas novas', async () => {
        useSigningKey();
        setProviderCredentials('appleMusic', { musicUserToken: 'mut', storefront: 'br' });
        global.fetch
            .mockResolvedValueOnce(response({ data: [{ id: 'p.new' }] }, { status: 201 }))
            .mockResolvedValueOnce(response({ data: [{ id: 'p.new', attributes: {} }] }))
            .mockResolvedValueOnce(response({ data: [{ id: 'i.1', type: 'library-songs', attributes: { playParams: { catalogId: '1' } } }] }))
            .mockResolvedValueOnce({ ok: true, status: 204, headers: { get: () => null }, json: async () => null });

        const destination = appleMusicProvider.createDestinationClient();
        const playlistId = await destination.createPlaylist({ title: 'Migrada', description: 'SyncSphere' });
        await destination.addTracks({ playlistId, ids: ['1', '2', '2'] });

        expect(playlistId).toBe('p.new');
        expect(JSON.parse(fetchCall(0).init.body)).toEqual({ attributes: { name: 'Migrada', description: 'SyncSphere' } });
        expect(JSON.parse(fetchCall(3).init.body)).toEqual({ data: [{ id: '2', type: 'songs' }, { id: '2', type: 'songs' }] });
        expect(destination.getPlaylistUrl('p.new')).toBe('https://music.apple.com/library/playlist/p.new');
    });

    it('não insere faixas se não conseguir consultar a playlist de destino', async () => {
        useSigningKey();
        setProviderCredentials('appleMusic', { musicUserToken: 'mut', storefront: 'br' });
        global.fetch.mockResolvedValueOnce(response({ errors: [{ status: '503', title: 'Unavailable' }] }, { status: 503 }));
        await expect(appleMusicProvider.createDestinationClient().addTracks({ playlistId: 'p.new', ids: ['1'] })).rejects.toThrow();
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('token recusado (403) pede reconexão', async () => {
        useSigningKey();
        global.fetch.mockResolvedValueOnce(response({ errors: [{ status: '403', title: 'Forbidden' }] }, { status: 403 }));
        const error = await appleMusicProvider.createSearchClient()
            .searchBestMatch({ track: { name: 'A', artist: 'B' } })
            .catch((caught) => caught);
        expect(classifyProviderError(error)).toBe(ERROR_KINDS.AUTH);
    });
    it('sinaliza corte por paginação mesmo sem total informado', async () => {
        useSigningKey();
        global.fetch
            .mockResolvedValueOnce(response({ data: [{ id: 'pl.abc', attributes: { name: 'Grande' } }] }))
            .mockResolvedValueOnce(response({ data: Array.from({ length: 2000 }, (_, i) => song(String(i), 'A', 'X')), next: '/v1/catalog/br/playlists/pl.abc/tracks?offset=2000' }));
        const playlist = await appleMusicProvider.getPlaylistSnapshot({ playlistId: 'pl.abc' });
        expect(playlist).toMatchObject({ truncated: true, omittedTracks: null, totalTracks: null });
        expect(playlist.tracks).toHaveLength(2000);
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

});
