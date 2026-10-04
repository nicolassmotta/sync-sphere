import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import ManualTrackReview from '../src/components/dashboard/ManualTrackReview';
import Modal from '../src/components/ui/Modal';
import api from '../src/services/api';
import i18n from '../src/i18n';

vi.mock('../src/services/api', () => ({ default: { post: vi.fn(), get: vi.fn(async () => ({ data: { data: { candidates: [] } } })) } }));
afterEach(() => api.post.mockReset());
const original = { index: 0, name: 'Arquivo', artist: 'Não encontrada' };
const review = (props = {}) => render(<ManualTrackReview transferId="transferencia-ficticia" track={original} providerLabel="Spotify" onBack={vi.fn()} onQueued={vi.fn()} {...props} />);
it('revisão mantém título e artista originais ao trocar o idioma', async () => {
    const user = userEvent.setup();
    review();
    const title = screen.getByRole('textbox', { name: 'Título para buscar' });
    await user.type(title, ' versão ao vivo');
    await act(async () => i18n.changeLanguage('en'));
    expect(screen.getByRole('textbox', { name: 'Title to search' }).value).toBe('Arquivo versão ao vivo');
    expect(screen.getByRole('textbox', { name: 'Artist to search' }).value).toBe('Não encontrada');
});
it('busca sem resultado orienta outra consulta sem alterar metadados', async () => {
    api.post.mockResolvedValue({ data: { data: { candidate: null } } });
    const user = userEvent.setup(); review();
    await user.click(screen.getByRole('button', { name: 'Buscar alternativa' }));
    expect(await screen.findByText('Nenhuma alternativa encontrada. Tente outro título ou artista.')).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Título para buscar' }).value).toBe('Arquivo');
});
it('busca em andamento impede segunda consulta e confirmação simultânea', async () => {
    let resolve;
    api.post.mockImplementation(() => new Promise((done) => { resolve = done; }));
    const user = userEvent.setup(); review();
    await user.click(screen.getByRole('button', { name: 'Buscar alternativa' }));
    expect(screen.getByRole('button', { name: 'Buscando...' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Voltar às faixas' }).disabled).toBe(true);
    await act(async () => resolve({ data: { data: { candidate: null } } }));
    expect(screen.getByRole('button', { name: 'Buscar alternativa' }).disabled).toBe(false);
});
it('confirmar a proposta reenfileira uma vez usando o identificador recebido', async () => {
    api.post.mockResolvedValueOnce({ data: { data: { candidate: { id: 'candidato-ficticio', name: 'Alternativa', artist: 'Artista fictício' } } } }).mockResolvedValueOnce({ data: { message: 'Reenfileirada', data: { transfer: { _id: 'transferencia-ficticia' } } } });
    const queued = vi.fn(); const user = userEvent.setup(); review({ onQueued: queued });
    await user.click(screen.getByRole('button', { name: 'Buscar alternativa' }));
    await user.click(await screen.findByRole('button', { name: 'Usar esta música' }));
    await waitFor(() => expect(queued).toHaveBeenCalledOnce());
    expect(api.post.mock.calls[1][1]).toEqual({ candidateId: 'candidato-ficticio' });
});
it('falha da proposta mostra a orientação do servidor e mantém a consulta editável', async () => {
    api.post.mockRejectedValue({ response: { data: { message: 'A plataforma limitou as buscas. Aguarde antes de tentar novamente.' } } });
    const user = userEvent.setup(); review();
    await user.click(screen.getByRole('button', { name: 'Buscar alternativa' }));
    expect(await screen.findByText('A plataforma limitou as buscas. Aguarde antes de tentar novamente.')).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Título para buscar' }).disabled).toBe(false);
});
const DialogExample = () => {
    const [open, setOpen] = useState(false);
    const [text, setText] = useState('');
    return <><button onClick={() => setOpen(true)}>Abrir diálogo</button><Modal isOpen={open} onClose={() => setOpen(false)} title="Confirmação"><label>Texto fictício<input value={text} onChange={(event) => setText(event.target.value)} /></label></Modal></>;
};
it('diálogo mantém foco ao digitar e devolve foco ao acionador quando fechado por Escape', async () => {
    const user = userEvent.setup(); render(<DialogExample />);
    const trigger = screen.getByRole('button', { name: 'Abrir diálogo' });
    await user.click(trigger);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Fechar' }));
    const field = screen.getByRole('textbox', { name: 'Texto fictício' });
    await user.type(field, 'Demonstração');
    expect(document.activeElement).toBe(field);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
});

it('proposta com URL executável não oferece link acionável', async () => {
    api.post.mockResolvedValue({ data: { data: { candidate: { id: 'ficticio', name: 'Alternativa', artist: 'Artista', externalUrl: 'javascript:alert(1)' } } } });
    const user = userEvent.setup(); review();
    await user.click(screen.getByRole('button', { name: 'Buscar alternativa' }));
    await screen.findByText('Alternativa');
    expect(screen.queryByRole('link', { name: 'Conferir na plataforma' })).toBeNull();
});

it('compara alternativas por teclado e guarda seleção sem confirmar a transferência', async () => {
    const alternatives = [
        { id: 'primeira', revision: 1, name: 'Música original', artist: 'Artista', reasons: [] },
        { id: 'segunda', revision: 1, name: 'Música (Live)', artist: 'Artista', reasons: ['version_conflict'] },
    ];
    api.get.mockResolvedValueOnce({ data: { data: { candidates: alternatives } } });
    const selected = vi.fn();
    const user = userEvent.setup();
    review({ onSelect: selected });
    const first = await screen.findByRole('radio', { name: 'Música original Artista' });
    first.focus();
    await user.keyboard(' ');
    await user.click(screen.getByRole('button', { name: 'Usar esta música' }));
    expect(selected).toHaveBeenCalledWith({ trackIndex: 0, action: 'choose', candidateId: 'primeira', revision: 1 });
    expect(api.post).not.toHaveBeenCalled();
});
