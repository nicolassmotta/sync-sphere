import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProviderRow } from '../src/components/dashboard/home/ProviderRow';
import ProviderPlaylistListCard from '../src/components/dashboard/home/ProviderPlaylistListCard';
import TransferConfirmModal from '../src/components/dashboard/home/TransferConfirmModal';
import IntegrationsTab from '../src/components/dashboard/IntegrationsTab';

vi.mock('../src/services/api', async (load) => ({ ...await load(), default: { get: vi.fn(async () => ({ data: { data: {} } })), put: vi.fn(), delete: vi.fn() } }));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));

const providers = [
    { id: 'spotify', label: 'Spotify', connected: true, canRead: true, canWrite: true, capabilities: { read: true, write: true } },
    { id: 'deezer', label: 'Deezer', connected: false, canRead: true, canWrite: false, capabilities: { read: true, write: true } },
    { id: 'file', label: 'Arquivo', connected: true, canRead: true, canWrite: true, auth: { type: 'file' }, capabilities: { read: true, write: true, sameProviderTransfer: true } },
];

describe('escolha de destino', () => {
    it('mostra a origem como indisponível em vez de inverter o par sem avisar', async () => {
        const select = vi.fn();
        const user = userEvent.setup();
        render(<ProviderRow title="Escolha o destino" role="target" providers={providers} selectedId="file" onSelect={select}
            disabledIds={['spotify']} disabledReason="escolhida como origem" />);
        const origin = screen.getByRole('button', { name: 'Spotify (escolhida como origem)' });
        expect(origin.disabled).toBe(true);
        await user.click(origin);
        expect(select).not.toHaveBeenCalled();
        // No destino importa poder criar: leitura pública não basta.
        expect(within(screen.getByRole('button', { name: 'Deezer' })).getByText('precisa conectar')).toBeTruthy();
        expect(within(screen.getByRole('button', { name: 'Arquivo' })).getByText('sem conta')).toBeTruthy();
    });
});

describe('lista de playlists', () => {
    const playlists = Array.from({ length: 8 }, (_, index) => ({ id: `lista-${index}`, name: index < 2 ? `Rock ${index + 1}` : `Jazz ${index}`, trackCount: 3 }));
    const renderList = (props = {}) => render(<ProviderPlaylistListCard provider={{ id: 'spotify', label: 'Spotify' }} connected playlists={playlists}
        playlistsSummary={{ total: playlists.length }} playlistsLoading={false} playlistsError="" sourcePlaylistIds={[]} selectedPlaylistIdSet={new Set()}
        trackPreviews={{}} onRefreshPlaylists={vi.fn()} onSelectAllPlaylists={vi.fn()} onClearSelectedPlaylists={vi.fn()}
        onTogglePlaylist={vi.fn()} onToggleTrackPreview={vi.fn()} onOpenIntegrations={vi.fn()} {...props} />);

    it('busca pelo nome e seleciona somente as playlists encontradas', async () => {
        const selectAll = vi.fn();
        const user = userEvent.setup();
        renderList({ onSelectAllPlaylists: selectAll });
        await user.type(screen.getByRole('searchbox', { name: 'Buscar playlist pelo nome' }), 'rock');
        expect(screen.getByText('Rock 1')).toBeTruthy();
        expect(screen.queryByText('Jazz 3')).toBeNull();
        await user.click(screen.getByRole('button', { name: 'Selecionar as 2 encontradas' }));
        expect(selectAll).toHaveBeenCalledWith([playlists[0], playlists[1]]);
    });

    it('busca sem resultado permite limpar e voltar à lista completa', async () => {
        const user = userEvent.setup();
        renderList();
        await user.type(screen.getByRole('searchbox', { name: 'Buscar playlist pelo nome' }), 'samba');
        expect(screen.getByText('Nenhuma playlist com esse nome.')).toBeTruthy();
        await user.click(screen.getByRole('button', { name: 'Limpar busca' }));
        expect(screen.getAllByRole('button', { pressed: false }).length).toBeGreaterThanOrEqual(playlists.length);
    });

    it('oferece colar o link de uma playlist que não está na conta', async () => {
        const preview = vi.fn();
        const user = userEvent.setup();
        renderList({ playlists: [], playlistsSummary: { total: 0 }, link: { value: 'https://open.spotify.com/playlist/ficticia', preview: null, onChange: vi.fn(), onPreview: preview } });
        expect(screen.getByText('Atualize a lista ou cole o link de uma playlist logo abaixo.')).toBeTruthy();
        await user.click(screen.getByRole('button', { name: 'Pré-visualizar' }));
        expect(preview).toHaveBeenCalledOnce();
    });
});

describe('confirmação da transferência', () => {
    const confirm = (targetProvider, targetLabel) => render(<TransferConfirmModal isOpen onClose={vi.fn()} sourceLabel="Spotify" targetLabel={targetLabel}
        targetProvider={targetProvider} selectedPlaylists={[{ id: 'lista', name: 'Lista fictícia', trackCount: 3 }]} sourcePlaylistId=""
        onManualPlaylistChange={vi.fn()} onStartTransfer={vi.fn()} selectedCount={1} isTransferring={false} estimate={null} allowLink={false} />);

    it('explica que cada playlist vira uma nova playlist privada no destino', () => {
        confirm('youtubeMusic', 'YouTube Music');
        expect(screen.getByText(/Cada playlist vira uma nova playlist no YouTube Music, com o mesmo nome\. Visibilidade: privada\./)).toBeTruthy();
    });

    it('explica que o destino Arquivo gera um arquivo para baixar', () => {
        confirm('file', 'Arquivo');
        expect(screen.getByText('O resultado vira um arquivo. Ao terminar, baixe em CSV, JSON, M3U ou TXT no Histórico.')).toBeTruthy();
    });
});

describe('conexões', () => {
    it('abre na plataforma indicada com o passo a passo completo e links clicáveis', () => {
        const youtube = { id: 'youtubeMusic', label: 'YouTube Music', connected: false, canRead: false, auth: { type: 'cookie', fields: [{ name: 'cookie', label: 'Cookie' }] }, capabilities: { read: true, write: true } };
        render(<IntegrationsTab providers={[providers[0], youtube]} preferredProviderIds={['spotify', 'youtubeMusic']} focusProviderId="youtubeMusic"
            refreshIntegrations={vi.fn()} refreshSystemStatus={vi.fn()} systemStatus={{ backend: { status: 'online' } }} />);
        expect(screen.getByRole('heading', { name: 'YouTube Music', level: 2 })).toBeTruthy();
        const steps = screen.getAllByRole('listitem');
        expect(steps.length).toBeGreaterThanOrEqual(5);
        expect(screen.getByRole('link', { name: 'music.youtube.com' }).getAttribute('href')).toBe('https://music.youtube.com');
        expect(screen.getByText(/Copiar como cURL/)).toBeTruthy();
    });
});
