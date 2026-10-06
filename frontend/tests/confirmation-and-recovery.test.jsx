import { lazy, Suspense } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import TransferConfirmModal from '../src/components/dashboard/home/TransferConfirmModal';
import DashboardTabBoundary from '../src/components/dashboard/DashboardTabBoundary';

const suppressExpectedFailure = (event) => {
    if (event.error?.message === 'Detalhe interno fictício que não deve aparecer.') event.preventDefault();
};
afterEach(() => { window.removeEventListener('error', suppressExpectedFailure); vi.restoreAllMocks(); });
const modal = (estimate) => render(<TransferConfirmModal isOpen onClose={vi.fn()} sourceLabel="Arquivo" targetLabel="Arquivo"
    selectedPlaylists={[{ id: 'import-ficticio', name: 'Playlist de teste', trackCount: 3 }]} selectedCount={1}
    onStartTransfer={vi.fn()} allowLink={false} estimate={estimate} />);

it('estimativa sem velocidade evita uma frase com o número ausente', () => {
    modal({ trackCount: 3, etaSeconds: 4, tracksPerMinute: null, queueAheadSeconds: 0 });
    expect(screen.getByText('Esta é uma estimativa. O tempo pode variar conforme a plataforma e a fila.')).toBeTruthy();
    expect(screen.queryByText(/Cerca de/)).toBeNull();
    expect(screen.getByText('Playlist de teste')).toBeTruthy();
});

it('estimativa com velocidade medida conserva o número e o tempo de fila', () => {
    modal({ trackCount: 3, etaSeconds: 4, tracksPerMinute: 60, queueAheadSeconds: 90 });
    expect(screen.getByText(/Cerca de/).textContent).toContain('60 faixas por minuto');
    expect(screen.getByText(/Cerca de/).textContent).toContain('a fila ainda tem');
});

it('falha de carregamento de uma aba conserva a navegação e oferece recarga sem expor o erro interno', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    window.addEventListener('error', suppressExpectedFailure);
    const Broken = lazy(() => Promise.reject(new Error('Detalhe interno fictício que não deve aparecer.')));
    const reload = vi.fn(); const user = userEvent.setup();
    render(<><nav><a href="/dashboard?tab=home">Início disponível</a></nav><DashboardTabBoundary onReload={reload}><Suspense fallback="Carregando"><Broken /></Suspense></DashboardTabBoundary></>);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Início disponível' })).toBeTruthy();
    expect(screen.queryByText('Detalhe interno fictício que não deve aparecer.')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Recarregar painel' }));
    expect(reload).toHaveBeenCalledOnce();
});
