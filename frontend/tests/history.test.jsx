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
