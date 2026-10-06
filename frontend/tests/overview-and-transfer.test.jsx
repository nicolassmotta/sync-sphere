import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '../src/pages/Dashboard';
import api from '../src/services/api';

vi.mock('../src/services/api', async (load) => ({ ...await load(), default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));
vi.mock('../src/hooks/useTransferSocket', () => ({ useTransferSocket: () => ({
    isTransferring: false, progress: 0, progressMessage: '', connectionState: 'connected', transfers: [],
    prepareTransferProgress: vi.fn(), stopTransferProgress: vi.fn(),
}) }));
const ids = ['spotify', 'youtubeMusic', 'deezer', 'tidal', 'appleMusic', 'soundcloud', 'file'];
const labels = ['Spotify', 'YouTube Music', 'Deezer', 'TIDAL', 'Apple Music', 'SoundCloud', 'Arquivo'];
const providers = ids.map((id, index) => ({ id, label: labels[index], connected: true, canRead: true, canWrite: true,
    auth: { type: id === 'file' ? 'file' : 'cookie' }, capabilities: { read: true, write: true, listUserPlaylists: true, sameProviderTransfer: id === 'file' },
}));
let imports;
let demos;
beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('syncsphere-migration-v1', JSON.stringify({ sourceProvider: 'file', targetProvider: 'file', step: 0 }));
    imports = [{ id: 'import-ficticio-0001', name: 'Playlist demonstrativa', trackCount: 3 }, { id: 'import-ficticio-0002', name: 'Segunda playlist', trackCount: 3 }];
    demos = 0;
    api.get.mockReset(); api.post.mockReset();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ status: 'ready', dependencies: { storage: 'local', queue: 'local-persistent' } }) })));
    api.get.mockImplementation(async (url) => ({ data: { data: url === '/integrations/status' ? { providers, integrations: {} }
        : url === '/transfer' ? { transfers: [] }
            : url.endsWith('/playlists') ? { playlists: url.includes('/file/') ? [...imports] : [{ id: 'playlist-spotify-0001', name: 'Lista Spotify', trackCount: 3 }], total: imports.length }
                : url.endsWith('/tracks') ? { tracks: [{ name: 'Faixa', artist: 'Artista' }], totalTracks: 3 }
                    : { trackCount: 3, etaSeconds: 1, tracksPerMinute: 180 } } }));
    api.post.mockImplementation(async (url) => {
        if (url === '/system/demo') {
            const playlist = { id: `import-demo-ficticio-${++demos}`, name: `Demonstração ${demos}`, trackCount: 3 };
            imports.push(playlist);
            return { data: { data: { playlist } } };
        }
        return { data: { data: { transferId: 'transferencia-ficticia', transferIds: ['transferencia-ficticia'] } } };
    });
});
afterEach(() => vi.unstubAllGlobals());
const open = () => render(<MemoryRouter initialEntries={['/dashboard']}><Dashboard /></MemoryRouter>);
const playlistButton = () => screen.findByRole('button', { name: 'Playlist demonstrativa Arquivo · 3 faixas' });

it('visão geral preserva seleção ao alternar para o guia e voltar', async () => {
    const user = userEvent.setup(); open();
    await user.click(await playlistButton());
    expect(screen.getByRole('button', { name: 'Conferir e migrar' }).disabled).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Passo a passo' }));
    expect(screen.getByRole('heading', { name: 'De onde vêm suas playlists?' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Visão geral' }));
    expect((await playlistButton()).getAttribute('aria-pressed')).toBe('true');
    expect(api.post).not.toHaveBeenCalled();
});

it('trocar a origem descarta a seleção anterior e pede uma playlist da nova plataforma', async () => {
    const user = userEvent.setup(); open();
    await user.click(await playlistButton());
    await user.click(within(screen.getByRole('group', { name: 'Origem', exact: true })).getByRole('button', { name: 'Spotify' }));
    expect(await screen.findByRole('heading', { name: 'Playlists do Spotify' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Conferir e migrar' }).disabled).toBe(true);
    expect(api.post).not.toHaveBeenCalled();
});

it('demonstração repetida atualiza a lista e mostra a nova playlist na confirmação', async () => {
    const user = userEvent.setup(); open(); await playlistButton();
    for (let attempt = 1; attempt <= 2; attempt += 1) {
        await user.click(screen.getByRole('button', { name: 'Experimentar sem contas' }));
        expect(await screen.findByRole('button', { name: `Demonstração ${attempt} Arquivo · 3 faixas` })).toBeTruthy();
    }
    await user.click(screen.getByRole('button', { name: 'Conferir e migrar' }));
    expect(within(screen.getByRole('dialog')).getByText('Demonstração 2')).toBeTruthy();
    expect(api.post.mock.calls.every(([url]) => url === '/system/demo')).toBe(true);
});

it('duas playlists só criam a transferência depois da confirmação, com os IDs selecionados', async () => {
    const user = userEvent.setup(); open();
    await user.click(await playlistButton());
    await user.click(screen.getByRole('button', { name: 'Segunda playlist Arquivo · 3 faixas' }));
    await user.click(screen.getByRole('button', { name: 'Conferir e migrar' }));
    expect(api.post).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Migrar 2 playlists' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledOnce());
    expect(api.post).toHaveBeenCalledWith('/transfer/start', { sourceProvider: 'file', targetProvider: 'file', sourcePlaylistIds: ['import-ficticio-0001', 'import-ficticio-0002'] });
});

it('playlist cuja prévia falha não pode ser selecionada nem enviada para migração', async () => {
    const previous = api.get.getMockImplementation();
    api.get.mockImplementation((url, options) => url.includes('/import-ficticio-0001/tracks')
        ? Promise.reject({ response: { data: { message: 'A plataforma não permitiu ler as faixas.' } } }) : previous(url, options));
    const user = userEvent.setup(); open();
    await user.click(await playlistButton());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Playlist demonstrativa Arquivo · 3 faixas' }).disabled).toBe(true));
    expect(screen.getByRole('button', { name: 'Conferir e migrar' }).disabled).toBe(true);
    expect(api.post).not.toHaveBeenCalled();
});

it('falha na leitura de um link bloqueia a confirmação até uma nova prévia funcionar', async () => {
    sessionStorage.setItem('syncsphere-migration-v1', JSON.stringify({ sourceProvider: 'deezer', targetProvider: 'file', step: 0 }));
    const previous = api.get.getMockImplementation(); let attempt = 0;
    api.get.mockImplementation(async (url, options) => {
        if (url === '/integrations/status') return { data: { data: { providers: providers.map((provider) => provider.id === 'deezer'
            ? { ...provider, connected: false, capabilities: { ...provider.capabilities, readByLink: true } } : provider), integrations: {} } } };
        if (url.endsWith('/playlist-tracks')) {
            if (!attempt++) throw new Error('Falha de leitura fictícia');
            return { data: { data: { name: 'Playlist pública', totalTracks: 3, tracks: [] } } };
        }
        return previous(url, options);
    });
    const user = userEvent.setup(); open();
    await user.type(await screen.findByRole('textbox', { name: 'Link ou ID da playlist no Deezer' }), 'playlist-publica-ficticia');
    await user.click(screen.getByRole('button', { name: 'Pré-visualizar' }));
    expect(await screen.findByText('Não foi possível carregar as faixas dessa playlist.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Revisar transferência' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Conferir e migrar' }).disabled).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Pré-visualizar' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Conferir e migrar' }).disabled).toBe(false));
    expect(api.post).not.toHaveBeenCalled();
});
