import { act, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import ActiveTransferCard from '../src/components/dashboard/home/ActiveTransferCard';
import i18n from '../src/i18n';

it('conclusão com revisão não mostra sucesso nem progresso de 100% como resultado resolvido', () => {
    render(<ActiveTransferCard isTransferring={false} progress={100} onOpenHistory={vi.fn()} transfers={[{
        transferId: 'revisao-ficticia', playlistName: 'Playlist ambígua', status: 'completed', progress: 100,
        counts: { total: 3, analyzed: 3, matched: 0, needsReview: 3 },
    }]} />);
    expect(screen.getByRole('heading', { name: 'Resultado para revisar' })).toBeTruthy();
    expect(screen.getByText('3 para revisar')).toBeTruthy();
    expect(screen.getByText('Revisar resultado')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ver pendências no histórico' })).toBeTruthy();
    expect(screen.queryByText('Sucesso')).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
});

it('estado de revisão do feed acompanha a troca de idioma', async () => {
    render(<ActiveTransferCard isTransferring progress={40} transfers={[{
        transferId: 'busca-ficticia', status: 'processing', phase: 'matching', progress: 40,
        recentTracks: [{ index: 0, name: 'Música', artist: 'Artista', status: 'needs_review' }],
    }]} />);
    expect(screen.getByRole('img', { name: 'Aguardando revisão' })).toBeTruthy();
    await act(async () => i18n.changeLanguage('en'));
    expect(screen.getByRole('img', { name: 'Awaiting review' })).toBeTruthy();
    expect(screen.queryByRole('img', { name: 'Aguardando revisão' })).toBeNull();
});
