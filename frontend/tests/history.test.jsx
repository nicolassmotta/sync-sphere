import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HistoryTab from '../src/components/dashboard/HistoryTab';
import api from '../src/services/api';

vi.mock('../src/services/api', async (load) => ({ ...await load(), default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));
const completed = { _id: 'transferencia-ficticia', playlistName: 'Arquivo', sourceProvider: 'file', targetProvider: 'file', status: 'completed', totalTracks: 3, processedTracks: 3, createdAt: '2026-10-02T12:00:00Z' };

describe('Histórico e recuperação', () => {
    it('falha de carregamento aparece como erro e permite tentar novamente, sem sugerir histórico vazio', async () => {
        api.get.mockRejectedValueOnce(new Error('Rede simulada')).mockResolvedValueOnce({ data: { data: { transfers: [completed] } } });
        const user = userEvent.setup();
        render(<HistoryTab />);
        const alert = await screen.findByRole('alert');
        expect(alert.textContent).toContain('Não foi possível carregar o histórico.');
        expect(screen.queryByText('Nenhuma migração listada.')).toBeNull();
        await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
        expect((await screen.findAllByText('Arquivo')).length).toBeGreaterThan(0);
        expect(screen.queryByRole('alert')).toBeNull();
    });
    it('falha de leitura das faixas não é apresentada como resultado resolvido', async () => {
        let attempts = 0;
        api.get.mockImplementation(async (url) => {
            if (url === '/transfer') return { data: { data: { transfers: [completed] } } };
            if (!attempts++) throw new Error('Leitura simulada indisponível');
            return { data: { data: { counts: { total: 3 }, tracks: [{ index: 0, name: 'Arquivo', artist: 'Artista fictício', status: 'not_found' }] } } };
        });
        const user = userEvent.setup();
        render(<HistoryTab />);
        await user.click(await screen.findByRole('button', { name: 'Ver detalhes', exact: true }));
        const dialog = screen.getByRole('dialog');
        expect((await within(dialog).findByRole('alert')).textContent).toContain('Não foi possível carregar as faixas deste relatório.');
        expect(within(dialog).queryByText('Nenhuma faixa pendente.')).toBeNull();
        await user.click(within(dialog).getByRole('button', { name: 'Tentar carregar as faixas novamente' }));
        expect(await within(dialog).findByRole('tab', { name: 'Não encontradas (1)' })).toBeTruthy();
        expect(within(dialog).queryByRole('alert')).toBeNull();
    });
});

it('conclusão com música não encontrada orienta revisão do resultado', async () => {
    api.get.mockResolvedValue({ data: { data: { transfers: [{ ...completed, matchedCount: 2, notFoundCount: 1 }] } } });
    render(<HistoryTab />);
    expect((await screen.findAllByText('Revisar resultado')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Não encontradas').length).toBeGreaterThan(0);
});

it('registro failed totalmente inserido não oferece retry sem trabalho pendente', async () => {
    api.get.mockImplementation(async (url) => ({ data: { data: url === '/transfer'
        ? { transfers: [{ ...completed, status: 'failed', matchedCount: 3, analyzedCount: 3, pendingInsertCount: 0 }] }
        : { counts: { total: 3 }, tracks: [] } } }));
    const user = userEvent.setup();
    render(<HistoryTab />);
    await user.click(await screen.findByRole('button', { name: 'Ver detalhes', exact: true }));
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull();
});

it('origem cortada por limite orienta divisão em vez de oferecer retry repetitivo', async () => {
    api.get.mockImplementation(async (url) => ({ data: { data: url === '/transfer'
        ? { transfers: [{ ...completed, status: 'failed', sourceTruncated: true, sourceTotalTracks: 5, sourceOmittedTracks: 2 }] }
        : { counts: { total: 0 }, tracks: [] } } }));
    const user = userEvent.setup(); render(<HistoryTab />);
    await user.click(await screen.findByRole('button', { name: 'Ver detalhes', exact: true }));
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Tentar todas' })).toBeNull();
});
it('data ausente ou inválida não impede consultar o restante do histórico', async () => {
    api.get.mockResolvedValue({ data: { data: { transfers: [{ ...completed, createdAt: 'data-invalida-ficticia' }] } } });
    render(<HistoryTab />);
    expect((await screen.findAllByText('Data indisponível')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Arquivo').length).toBeGreaterThan(0);
});

it.each(['pending', 'processing', 'paused', 'needs_auth'])('estado %s usa acompanhamento/retomada e não oferece retry concorrente', async (status) => {
    api.get.mockResolvedValue({ data: { data: { transfers: [{ ...completed, status, matchedCount: 3, analyzedCount: 3, pendingInsertCount: 3 }] } } });
    render(<HistoryTab />);
    await screen.findAllByText('Arquivo');
    expect(screen.queryByRole('button', { name: 'Tentar todas' })).toBeNull();
});

it('seleciona duas ocorrências e confirma um lote depois de mostrar o resumo', async () => {
    const transfer = { ...completed, targetProvider: 'spotify', needsReviewCount: 2, matchedCount: 0, pendingInsertCount: 0 };
    const tracks = [0, 1].map((index) => ({ index, name: `Faixa ${index}`, artist: 'Fictício', status: 'needs_review' }));
    api.get.mockImplementation(async (url) => ({ data: { data: url === '/transfer'
        ? { transfers: [transfer] } : url.endsWith('/candidates')
            ? { candidates: [{ id: url.includes('/tracks/0/') ? 'primeira' : 'segunda', revision: 1, name: 'Original', artist: 'Fictício' }] }
            : { counts: { total: 2 }, tracks } } }));
    api.post.mockResolvedValue({ data: { message: 'Revisão salva', data: { transfer } } });
    const queued = vi.fn();
    const user = userEvent.setup();
    render(<HistoryTab onTransfersQueued={queued} />);
    await user.click(await screen.findByRole('button', { name: 'Ver detalhes', exact: true }));
    for (let index = 0; index < 2; index += 1) {
        await user.click((await screen.findAllByRole('button', { name: 'Escolher alternativa' }))[index]);
        await user.click(await screen.findByRole('radio', { name: 'Original Fictício' }));
        await user.click(screen.getByRole('button', { name: 'Usar esta música' }));
    }
    expect(api.post).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Revisar escolhas antes de confirmar' }));
    expect(screen.getByText('As escolhas confirmadas serão adicionadas ao fim da playlist.')).toBeTruthy();
    expect(screen.getAllByText('Original · Fictício')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Confirmar escolhas' }));
    expect(api.post).toHaveBeenCalledWith('/transfer/transferencia-ficticia/review', { choices: [
        { trackIndex: 0, action: 'choose', candidateId: 'primeira', revision: 1 },
        { trackIndex: 1, action: 'choose', candidateId: 'segunda', revision: 1 },
    ] });
});

it('combina filtro de atenção e busca, e permite limpar um resultado vazio', async () => {
    const transfers = [completed,
        { ...completed, _id: 'revisao', playlistName: 'Rock para revisar', needsReviewCount: 1 },
        { ...completed, _id: 'falha', playlistName: 'Jazz com falha', status: 'failed' },
        { ...completed, _id: 'ativa', playlistName: 'Migração ativa', status: 'processing' }];
    api.get.mockResolvedValue({ data: { data: { transfers } } });
    const user = userEvent.setup(); render(<HistoryTab />);
    await user.click(await screen.findByRole('button', { name: 'Precisam de atenção 2' }));
    expect(screen.queryByRole('cell', { name: 'Arquivo' })).toBeNull();
    expect(screen.getByRole('cell', { name: 'Rock para revisar' })).toBeTruthy();
    expect(screen.queryByRole('cell', { name: 'Migração ativa' })).toBeNull();
    await user.type(screen.getByRole('textbox', { name: 'Buscar playlist' }), 'rock');
    expect(screen.queryByRole('cell', { name: 'Jazz com falha' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Concluídas 1' }));
    expect(screen.getAllByText('Nenhuma migração neste filtro.')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(screen.getByRole('textbox', { name: 'Buscar playlist' }).value).toBe('');
    expect(screen.getByRole('cell', { name: 'Arquivo' })).toBeTruthy();
    expect(screen.getByRole('cell', { name: 'Rock para revisar' })).toBeTruthy();
});

it('abre uma migração sem pendências na aba das músicas adicionadas', async () => {
    api.get.mockImplementation(async (url) => ({ data: { data: url === '/transfer'
        ? { transfers: [completed] } : { counts: { total: 3 }, tracks: [{ index: 0, name: 'Música adicionada', artist: 'Artista', status: 'matched', inserted: true }] } } }));
    const user = userEvent.setup(); render(<HistoryTab />);
    await user.click(await screen.findByRole('button', { name: 'Ver detalhes', exact: true }));
    expect((await screen.findByRole('tab', { name: 'Adicionadas (1)' })).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel').textContent).toContain('Música adicionada');
    expect(screen.queryByText('Nenhuma faixa pendente.')).toBeNull();
});

it('abre diretamente as não encontradas quando elas são a única pendência', async () => {
    api.get.mockImplementation(async (url) => ({ data: { data: url === '/transfer'
        ? { transfers: [{ ...completed, notFoundCount: 1 }] }
        : { counts: { total: 3 }, tracks: [{ index: 0, name: 'Música ausente', status: 'not_found' }] } } }));
    const user = userEvent.setup(); render(<HistoryTab />);
    await user.click(await screen.findByRole('button', { name: 'Ver detalhes', exact: true }));
    expect((await screen.findByRole('tab', { name: 'Não encontradas (1)' })).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel').textContent).toContain('Música ausente');
});

it('remove uma escolha do resumo sem enviar a ocorrência removida para a API', async () => {
    const transfer = { ...completed, targetProvider: 'spotify', needsReviewCount: 2, matchedCount: 0 };
    const tracks = [0, 1].map((index) => ({ index, name: `Faixa ${index}`, artist: 'Artista', status: 'needs_review' }));
    api.get.mockImplementation(async (url) => ({ data: { data: url === '/transfer' ? { transfers: [transfer] }
        : url.endsWith('/candidates') ? { candidates: [] } : { counts: { total: 2 }, tracks } } }));
    api.post.mockResolvedValue({ data: { message: 'Salva', data: { transfer } } });
    const user = userEvent.setup(); render(<HistoryTab />);
    await user.click(await screen.findByRole('button', { name: 'Ver detalhes', exact: true }));
    for (let index = 0; index < 2; index += 1) {
        await user.click((await screen.findAllByRole('button', { name: 'Escolher alternativa' }))[index]);
        await screen.findByText('Nenhuma alternativa disponível ainda. Busque pelo título e artista acima.');
        await user.click(screen.getByRole('button', { name: 'Ignorar esta faixa' }));
    }
    await user.click(screen.getByRole('button', { name: 'Revisar escolhas antes de confirmar' }));
    await user.click(screen.getByRole('button', { name: 'Remover escolha da faixa 1' }));
    expect(api.post).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Confirmar escolhas' }));
    expect(api.post).toHaveBeenCalledWith('/transfer/transferencia-ficticia/review', { choices: [{ trackIndex: 1, action: 'skip' }] });
});

it('atualiza um resultado em andamento sem fechar o relatório', async () => {
    let updated = false;
    api.get.mockImplementation(async (url) => ({ data: { data: url === '/transfer'
        ? { transfers: [{ ...completed, status: updated ? 'completed' : 'processing', processedTracks: updated ? 3 : 1 }] }
        : { counts: { total: 3 }, tracks: [{ index: 0, name: 'Faixa confirmada', status: 'matched', inserted: true }] } } }));
    const user = userEvent.setup(); render(<HistoryTab />);
    await user.click(await screen.findByRole('button', { name: 'Ver detalhes', exact: true }));
    expect(screen.getByRole('heading', { name: 'Sua migração continua em andamento' })).toBeTruthy();
    updated = true;
    await user.click(screen.getByRole('button', { name: 'Atualizar resultado' }));
    expect(await screen.findByRole('heading', { name: 'Sua migração foi concluída' })).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Atualizar resultado' })).toBeNull();
});

it('impede confirmar uma cópia ordenada enquanto existem faixas pendentes', async () => {
    api.get.mockImplementation(async (url) => ({ data: { data: url === '/transfer'
        ? { transfers: [{ ...completed, targetProvider: 'spotify', targetPlaylistId: 'playlist-ficticia', needsReviewCount: 1 }] }
        : { counts: { total: 2 }, tracks: [
            { index: 0, name: 'Inserida', status: 'matched', inserted: true },
            { index: 1, name: 'Pendente', status: 'needs_review' },
        ] } } }));
    const user = userEvent.setup(); render(<HistoryTab />);
    await user.click(await screen.findByRole('button', { name: 'Ver detalhes', exact: true }));
    await screen.findByRole('tab', { name: 'Pendências (1)' });
    await user.click(screen.getByText('Correções e preferências'));
    await user.click(screen.getByRole('button', { name: 'Criar cópia na ordem da origem' }));
    expect(screen.getByRole('button', { name: 'Confirmar nova playlist' }).disabled).toBe(true);
    expect(api.post).not.toHaveBeenCalled();
});

it('mostra a correção escolhida e envia somente seu identificador e revisão para a cópia', async () => {
    const transfer = { ...completed, targetProvider: 'spotify', targetPlaylistId: 'playlist-ficticia' };
    const alternative = { id: 'alternativa-copia', revision: 2, name: 'Versão escolhida', artist: 'Artista', album: 'Álbum escolhido' };
    api.get.mockImplementation(async (url) => ({ data: { data: url === '/transfer' ? { transfers: [transfer] }
        : url.endsWith('/correction-candidates') ? { candidates: [alternative] }
            : { counts: { total: 1 }, tracks: [{ index: 0, name: 'Faixa original', status: 'matched', inserted: true }] } } }));
    api.post.mockResolvedValue({ data: { message: 'Cópia criada', data: { transfer } } });
    const user = userEvent.setup(); render(<HistoryTab />);
    await user.click(await screen.findByRole('button', { name: 'Ver detalhes', exact: true }));
    await screen.findByRole('tab', { name: 'Adicionadas (1)' });
    await user.click(screen.getByText('Correções e preferências'));
    await user.click(screen.getByText('Corrigir faixas em uma nova playlist'));
    await user.click(screen.getByRole('button', { name: 'Escolher correção' }));
    await user.click(await screen.findByRole('radio', { name: 'Versão escolhida Artista' }));
    await user.click(screen.getByRole('button', { name: 'Usar esta música' }));
    expect(screen.getByText('Versão escolhida · Artista')).toBeTruthy();
    expect(screen.getByText('Álbum escolhido')).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Confirmar nova playlist' }));
    expect(api.post).toHaveBeenCalledWith('/transfer/transferencia-ficticia/ordered-copy', { choices: [{ trackIndex: 0, candidateId: 'alternativa-copia', revision: 2 }] });
});
