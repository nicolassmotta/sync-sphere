import { jest } from '@jest/globals';
import { setProviderCredentials } from '../src/storage/credentialStore.js';

const getPlaylistVideos = jest.fn();
const constructRequest = jest.fn();
jest.unstable_mockModule('ytmusic-api', () => ({
    default: class {
        config = { INNERTUBE_API_KEY: 'teste' };
        client = { defaults: { headers: {} }, interceptors: { request: { clear() {}, use() {} } } };
        cookiejar = { setCookieSync() {} };
        initialize = async () => {};
        getPlaylistVideos = getPlaylistVideos;
        constructRequest = constructRequest;
    },
}));
const { createYoutubeMusicCookieDestinationClient } = await import('../src/services/youtubeMusicService.js');

beforeEach(() => {
    jest.clearAllMocks();
    setProviderCredentials('youtubeMusic', { cookie: 'SAPISID=teste; SID=teste' });
    constructRequest.mockResolvedValue({ status: 'STATUS_SUCCEEDED' });
});

it('preserva a repetição intencional e só envia o restante após escrita parcial', async () => {
    const ids = ['A', 'B', 'A'];
    getPlaylistVideos.mockResolvedValueOnce([{ videoId: 'A' }])
        .mockResolvedValueOnce(ids.map((videoId) => ({ videoId })));
    const client = createYoutubeMusicCookieDestinationClient();
    await client.addVideosToPlaylist({ playlistId: 'lista', videoIds: ids, expectedIds: ids });
    await client.addVideosToPlaylist({ playlistId: 'lista', videoIds: ids, expectedIds: ids });
    expect(constructRequest).toHaveBeenCalledTimes(1);
    expect(constructRequest).toHaveBeenCalledWith('browse/edit_playlist', {
        playlistId: 'lista', actions: [
            { action: 'ACTION_ADD_VIDEO', addedVideoId: 'B' },
            { action: 'ACTION_ADD_VIDEO', addedVideoId: 'A' },
        ],
    });
});

it('não escreve quando a leitura das faixas existentes falha', async () => {
    getPlaylistVideos.mockRejectedValueOnce(new Error('Falha ao ler a playlist'));
    await expect(createYoutubeMusicCookieDestinationClient().addVideosToPlaylist({ playlistId: 'lista', videoIds: ['A'] })).rejects.toThrow('Falha ao ler');
    expect(constructRequest).not.toHaveBeenCalled();
});
