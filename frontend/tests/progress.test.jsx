import { act, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useTransferSocket } from '../src/hooks/useTransferSocket';
import i18n from '../src/i18n';

const transport = vi.hoisted(() => ({ handlers: {}, emit: vi.fn(), disconnect: vi.fn() }));
vi.mock('socket.io-client', () => ({ io: vi.fn(() => ({ on: (name, handler) => { transport.handlers[name] = handler; }, emit: transport.emit, disconnect: transport.disconnect })) }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
const ids = ['transferencia-ficticia'];
const Viewer = () => {
    const state = useTransferSocket(ids);
    return <><p>{state.isTransferring ? 'Acompanhando' : 'Encerrado'}</p><p>{state.progressMessage}</p><output aria-label="Conexão">{state.connectionState}</output></>;
};
beforeEach(() => { transport.handlers = {}; });
const publish = async (event, value) => { await act(async () => transport.handlers[event](value)); };

it('pausa temporária mantém acompanhamento e conclusão posterior encerra normalmente', async () => {
    render(<Viewer />);
    await publish('connect');
    await publish('transfer_update', { transferId: ids[0], status: 'paused', pauseReason: 'retry_scheduled', progress: 90, message: 'Falha temporária: HTTP 503 Nova tentativa automática programada.' });
    expect(screen.getByText('Acompanhando')).toBeTruthy();
    expect(transport.disconnect).not.toHaveBeenCalled();
    await publish('transfer_update', { transferId: ids[0], status: 'completed', progress: 100, message: 'Migração concluída no Arquivo: 3/3 faixas adicionadas.' });
    expect(screen.getByText('Encerrado')).toBeTruthy();
    expect(transport.disconnect).toHaveBeenCalledOnce();
});
it('troca de idioma durante processamento não interrompe o socket ou muda a playlist', async () => {
    render(<Viewer />);
    await publish('connect');
    await publish('transfer_update', { transferId: ids[0], playlistName: 'Arquivo', status: 'processing', progress: 90, message: 'Adicionando 3 faixas na playlist...' });
    await act(async () => i18n.changeLanguage('en'));
    expect(screen.getByText('Adding 3 tracks to the playlist...')).toBeTruthy();
    expect(screen.getByText('Acompanhando')).toBeTruthy();
    expect(transport.disconnect).not.toHaveBeenCalled();
    expect(transport.emit).toHaveBeenCalledTimes(1);
});
it('perda da conexão informa reconexão sem encerrar a transferência', async () => {
    render(<Viewer />);
    await publish('connect');
    await publish('transfer_update', { transferId: ids[0], status: 'processing', progress: 50, message: 'Processando' });
    await publish('disconnect', 'transport close');
    expect(screen.getByLabelText('Conexão').textContent).toBe('reconnecting');
    expect(screen.getByText('Acompanhando')).toBeTruthy();
    await publish('connect');
    expect(screen.getByLabelText('Conexão').textContent).toBe('connected');
});
