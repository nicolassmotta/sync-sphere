import { jest } from '@jest/globals';
import { writeStore } from '../src/storage/jsonStore.js';
import { setProviderCredentials } from '../src/storage/credentialStore.js';
import soundcloudProvider from '../src/providers/soundcloud/index.js';
import { resetSoundcloudCacheForTests } from '../src/providers/soundcloud/soundcloudClient.js';

const CLIENT_ID = 'a'.repeat(32);
const text = (body) => ({ ok: true, status: 200, headers: { get: () => null }, text: async () => body });
const json = (body, { status = 200 } = {}) => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
});

const scTrack = (id, title, username, extra = {}) => ({
    id,
    title,
    duration: 200000,
    permalink_url: `https://soundcloud.com/${username}/${id}`,
    user: { username },
    ...extra,
});

const mockScrape = (clientId = CLIENT_ID) => {
    global.fetch
        .mockResolvedValueOnce(text('<script src="https://a-v2.sndcdn.com/assets/1-a.js"></script><script src="https://a-v2.sndcdn.com/assets/2-b.js"></script>'))
        .mockResolvedValueOnce(text(`e.client_id="${clientId}";`));
};

const apiUrl = (index) => new URL(global.fetch.mock.calls[index][0]);

describe('provedor SoundCloud', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        global.fetch = jest.fn();
        writeStore('provider-credentials.json', {});
        resetSoundcloudCacheForTests();
        delete process.env.SOUNDCLOUD_CLIENT_ID;
    });

    afterAll(() => {
        global.fetch = originalFetch;
    });

    it('lê playlist pública pelo link, completando faixas resumidas em ordem', async () => {
        mockScrape();
        global.fetch
            .mockResolvedValueOnce(json({
                kind: 'playlist',
                id: 576708342,
                title: 'Bossa Nova',
                track_count: 3,
                user: { username: 'playlisteem' },
                tracks: [scTrack(1, 'Tom Jobim - Garota de Ipanema', 'fan'), { id: 3 }, { id: 2 }],
            }))
            .mockResolvedValueOnce(json([
                scTrack(2, 'Chega de Saudade', 'joaogilberto', { publisher_metadata: { artist: 'João Gilberto', isrc: 'BR0000000002' } }),
                scTrack(3, 'Aguas de Marco', 'elis'),
            ]));

        const playlist = await soundcloudProvider.getPlaylistSnapshot({
            playlistId: 'https://soundcloud.com/playlisteem/sets/bossa-nova?si=abc',
        });

        expect(global.fetch.mock.calls[1][0]).toBe('https://a-v2.sndcdn.com/assets/2-b.js');
        expect(apiUrl(2).pathname).toBe('/resolve');
        expect(apiUrl(2).searchParams.get('url')).toBe('https://soundcloud.com/playlisteem/sets/bossa-nova');
        expect(apiUrl(2).searchParams.get('client_id')).toBe(CLIENT_ID);
        expect(apiUrl(3).searchParams.get('ids')).toBe('3,2');
        expect(playlist.tracks).toEqual([
            expect.objectContaining({ name: 'Garota de Ipanema', artist: 'Tom Jobim' }),
            expect.objectContaining({ name: 'Aguas de Marco', artist: 'elis' }),
            expect.objectContaining({ name: 'Chega de Saudade', artist: 'João Gilberto', isrc: 'BR0000000002' }),
        ]);
    });

    it('renova o client_id quando o SoundCloud o recusa', async () => {
        mockScrape('b'.repeat(32));
        global.fetch.mockResolvedValueOnce(json({}, { status: 401 }));
        mockScrape('c'.repeat(32));
        global.fetch.mockResolvedValueOnce(json({ collection: [] }));

        await soundcloudProvider.createSearchClient().searchBestMatch({ track: { name: 'A', artist: 'B' } });

        expect(new URL(global.fetch.mock.calls.at(-1)[0]).searchParams.get('client_id')).toBe('c'.repeat(32));
    });

    it('busca ignorando prévias de 30 s e uploads sem o nome da música', async () => {
        process.env.SOUNDCLOUD_CLIENT_ID = CLIENT_ID;
        global.fetch.mockResolvedValueOnce(json({
            collection: [
                scTrack(10, 'Garota de Ipanema', 'Tom Jobim', { policy: 'SNIP', duration: 30000 }),
                scTrack(11, 'Tom Jobim ao vivo em 1985', 'fa-clube'),
                scTrack(12, 'Tom Jobim - Garota de Ipanema', 'arquivo-mpb'),
            ],
        }));

        const match = await soundcloudProvider.createSearchClient().searchBestMatch({
            track: { name: 'Garota de Ipanema', artist: 'Tom Jobim', durationMs: 200000 },
        });

        expect(match.id).toBe('12');
        expect(match.matchScore).toBeGreaterThanOrEqual(45);
        expect(apiUrl(0).searchParams.get('q')).toBe('Tom Jobim Garota de Ipanema');
    });

    it('sem conta lê mas não escreve; valida o oauth_token em /me', async () => {
        await expect(soundcloudProvider.getStatus()).resolves.toMatchObject({ connected: false, canRead: true, canWrite: false });
        await expect(soundcloudProvider.ensureWritable()).rejects.toMatchObject({ statusCode: 400 });

        process.env.SOUNDCLOUD_CLIENT_ID = CLIENT_ID;
        global.fetch.mockResolvedValueOnce(json({ id: 42, username: 'nicolas' }));
        await soundcloudProvider.saveCredentials({ values: { oauthToken: 'OAuth 2-123456-42-AbCdEfGhIjKlMn' } });

        expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe('OAuth 2-123456-42-AbCdEfGhIjKlMn');
        await expect(soundcloudProvider.getStatus()).resolves.toMatchObject({ connected: true, accountName: 'nicolas' });
    });

    it('cria playlist privada e adiciona mesclando com as faixas atuais', async () => {
        process.env.SOUNDCLOUD_CLIENT_ID = CLIENT_ID;
        setProviderCredentials('soundcloud', { oauthToken: '2-123456-42-token' });
        global.fetch
            .mockResolvedValueOnce(json({ id: 900, permalink_url: 'https://soundcloud.com/nicolas/sets/migrada' }))
            .mockResolvedValueOnce(json({ id: 900, tracks: [{ id: 1 }] }))
            .mockResolvedValueOnce(json({ id: 900 }));

        const destination = soundcloudProvider.createDestinationClient();
        const playlistId = await destination.createPlaylist({ title: 'Migrada', description: 'SyncSphere' });
        await destination.addTracks({ playlistId, ids: ['1', '2', '3', '2'] });

        expect(JSON.parse(global.fetch.mock.calls[0][1].body).playlist).toMatchObject({ title: 'Migrada', sharing: 'private', tracks: [] });
        expect(global.fetch.mock.calls[2][1].method).toBe('PUT');
        expect(JSON.parse(global.fetch.mock.calls[2][1].body)).toEqual({ playlist: { tracks: [1, 2, 3] } });
        expect(destination.getPlaylistUrl('900')).toBe('https://soundcloud.com/nicolas/sets/migrada');
    });
});
