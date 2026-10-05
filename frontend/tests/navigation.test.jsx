import { afterEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import Dashboard from '../src/pages/Dashboard';
import api from '../src/services/api';

vi.mock('../src/services/api', async (load) => ({ ...await load(), default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));
const Address = () => <output aria-label="Endereço atual">{useLocation().search}</output>;
afterEach(() => vi.unstubAllGlobals());
it('aba possui link próprio e permanece na URL ao abrir o Histórico', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ status: 'ready', dependencies: { storage: 'local', queue: 'local-persistent' } }) })));
    api.get.mockImplementation(async (url) => ({ data: { data: url === '/integrations/status' ? { providers: [], integrations: {} } : { transfers: [] } } }));
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/dashboard?tab=history']}><Address /><Dashboard /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Histórico de migrações' })).toBeTruthy();
    expect(screen.getByLabelText('Endereço atual').textContent).toBe('?tab=history');
    const links = screen.getAllByRole('link', { name: 'Ajuda e segurança', exact: true });
    expect(links[0].getAttribute('href')).toBe('/dashboard?tab=settings');
    await user.click(links[0]);
    expect(await screen.findByRole('heading', { name: 'Ajuda e segurança', level: 1 })).toBeTruthy();
    expect(screen.getByLabelText('Endereço atual').textContent).toBe('?tab=settings');
});
