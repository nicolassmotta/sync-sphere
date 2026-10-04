import { expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppSetupForm from '../src/components/setup/AppSetupForm';
import api from '../src/services/api';

vi.mock('../src/services/api', () => ({ default: { get: vi.fn(), put: vi.fn() } }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn() } }));
it('Client ID pode ser salvo com Enter e falha de validação preserva o valor para correção', async () => {
    api.get.mockResolvedValue({ data: { data: { redirectUri: 'http://127.0.0.1:8000/callback' } } });
    api.put.mockRejectedValueOnce({ response: { data: { message: 'Confira o Client ID copiado da plataforma.' } } }).mockResolvedValueOnce({});
    const saved = vi.fn();
    const user = userEvent.setup();
    render(<AppSetupForm providerId="spotify" onSaved={saved} />);
    const field = screen.getByRole('textbox', { name: 'Client ID do seu aplicativo' });
    await user.type(field, 'a'.repeat(32));
    await user.keyboard('{Enter}');
    expect((await screen.findByRole('alert')).textContent).toContain('Confira o Client ID');
    expect(field.value).toBe('a'.repeat(32));
    expect(document.activeElement).toBe(field);
    await user.keyboard('{Enter}');
    await waitFor(() => expect(saved).toHaveBeenCalledOnce());
    expect(field.value).toBe('');
});
