import { act, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import IntegrationsTab from '../src/components/dashboard/IntegrationsTab';
import ProviderPairCard from '../src/components/dashboard/home/ProviderPairCard';
import api from '../src/services/api';

vi.mock('../src/services/api', async (load) => ({ ...await load(), default: { get: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
beforeEach(() => { api.put.mockReset(); api.put.mockResolvedValue({ data: {} }); });
const cookies = [
    ['youtubeMusic', 'YouTube Music', 'cookie'], ['deezer', 'Deezer', 'arl'],
    ['appleMusic', 'Apple Music', 'musicUserToken'], ['soundcloud', 'SoundCloud', 'oauthToken'],
];
const open = (id, label, field, refresh = vi.fn()) => render(<IntegrationsTab
    providers={[{ id, label, connected: false, configured: true, auth: { type: 'cookie', fields: [{ name: field, label: 'Credencial fictícia' }] } }]}
    preferredProviderIds={[id]} refreshIntegrations={refresh} systemStatus={{ backend: { status: 'online' } }} />);

it.each(cookies)('%s envia a credencial por Enter, remove espaços e limpa o campo após validação', async (id, label, field) => {
    const refresh = vi.fn(); const user = userEvent.setup(); open(id, label, field, refresh);
    await user.type(screen.getByLabelText(/^Credencial fictícia/), '  valor-ficticio  ');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(api.put).toHaveBeenCalledWith(`/integrations/${id}/credentials`, { values: { [field]: 'valor-ficticio' } });
    expect(screen.getByLabelText(/^Credencial fictícia/).value).toBe('');
});

it('validação em andamento bloqueia edição e segunda confirmação', async () => {
    let finish;
    api.put.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const user = userEvent.setup(); open('youtubeMusic', 'YouTube Music', 'cookie');
    const field = screen.getByLabelText(/^Credencial fictícia/);
    await user.type(field, 'valor-ficticio'); await user.keyboard('{Enter}');
    expect(field.closest('fieldset').disabled).toBe(true);
    await user.type(field, 'não substituir'); await user.keyboard('{Enter}');
    expect(field.value).toBe('valor-ficticio');
    expect(api.put).toHaveBeenCalledOnce();
    await act(async () => finish({ data: {} }));
    expect(field.closest('fieldset').disabled).toBe(false);
});

it('credencial recusada mostra o erro e conserva o valor para correção', async () => {
    api.put.mockRejectedValue({ response: { data: { message: 'Credencial fictícia expirada.' } } });
    const user = userEvent.setup(); open('deezer', 'Deezer', 'arl');
    await user.type(screen.getByLabelText(/^Credencial fictícia/), 'valor-ficticio'); await user.keyboard('{Enter}');
    expect(await screen.findByText('Credencial fictícia expirada.')).toBeTruthy();
    expect(screen.getByLabelText(/^Credencial fictícia/).value).toBe('valor-ficticio');
    expect(screen.getByLabelText(/^Credencial fictícia/).closest('fieldset').disabled).toBe(false);
});

it('leitura pública de Deezer não é apresentada como autorização para escrever no destino', () => {
    render(<ProviderPairCard sourceProvider="deezer" targetProvider="file" onChange={vi.fn()} providers={[
        { id: 'deezer', label: 'Deezer', connected: false, canRead: true, canWrite: false, capabilities: { read: true, write: true } },
        { id: 'file', label: 'Arquivo', connected: true, canRead: true, canWrite: true, capabilities: { read: true, write: true, sameProviderTransfer: true } },
    ]} />);
    expect(within(screen.getByRole('group', { name: 'Origem', exact: true })).getByText('leitura pública')).toBeTruthy();
    const destination = within(screen.getByRole('group', { name: 'Destino', exact: true })).getByRole('button', { name: 'Deezer' });
    expect(within(destination).getByText('precisa conectar')).toBeTruthy();
    expect(within(destination).queryByText('leitura pública')).toBeNull();
});
