import { ArrowRight, ListMusic, Loader2, RefreshCw } from 'lucide-react';
import Button from '../../ui/Button';
import ProviderIcon from '../../ui/ProviderIcon';
import PlaylistRow from './PlaylistRow';

/**
 * Playlists da conta conectada na plataforma de origem, com seleção múltipla
 * e prévia de faixas.
 */
const ProviderPlaylistListCard = ({
    provider,
    connected,
    playlists,
    playlistsSummary,
    playlistsLoading,
    playlistsError,
    sourcePlaylistIds,
    selectedPlaylistIdSet,
    trackPreviews,
    onRefreshPlaylists,
    onSelectAllPlaylists,
    onClearSelectedPlaylists,
    onTogglePlaylist,
    onToggleTrackPreview,
    onOpenIntegrations,
}) => (
    <div className="elevated-card p-6 lg:p-7">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
                <p className="text-sm font-bold uppercase text-white/40">Escolha a origem</p>
                <h2 className="mt-2 text-2xl font-black text-white">Playlists do {provider.label}</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
                    Marque uma ou várias playlists. A prévia lê as primeiras faixas antes de criar tarefas na fila.
                </p>
                {connected && !playlistsLoading && (
                    <p className="mt-2 text-xs font-bold uppercase text-white/35">
                        Mostrando {playlists.length} de {playlistsSummary?.total || playlists.length} playlists
                        {playlistsSummary?.hasMore ? ` · há mais no ${provider.label}` : ''}
                    </p>
                )}
            </div>
            <div className="flex flex-wrap gap-2">
                <Button
                    onClick={onRefreshPlaylists}
                    variant="secondary"
                    size="sm"
                    disabled={!connected || playlistsLoading}
                    leftIcon={playlistsLoading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                >
                    Atualizar
                </Button>
                {playlists.length > 0 && (
                    <>
                        <Button onClick={onSelectAllPlaylists} variant="ghost" size="sm">
                            Selecionar todas
                        </Button>
                        <Button onClick={onClearSelectedPlaylists} variant="ghost" size="sm" disabled={!sourcePlaylistIds.length}>
                            Limpar
                        </Button>
                    </>
                )}
            </div>
        </div>

        {!connected && (
            <div className="rounded-lg border border-white/10 bg-black/30 p-6">
                <div className="mb-4 grid h-12 w-12 place-items-center rounded-lg border border-white/10 bg-white/[0.045]">
                    <ProviderIcon providerId={provider.id} />
                </div>
                <h3 className="text-lg font-black text-white">Conecte o {provider.label}</h3>
                <p className="mt-2 max-w-lg text-sm leading-6 text-muted">
                    A conexão fica no back-end local e libera a listagem de playlists desta conta.
                </p>
                <Button
                    onClick={onOpenIntegrations}
                    variant="primary"
                    className="mt-5"
                    rightIcon={<ArrowRight size={16} />}
                >
                    Abrir integrações
                </Button>
            </div>
        )}

        {connected && playlistsLoading && (
            <div className="grid min-h-52 place-items-center rounded-lg border border-white/10 bg-black/30">
                <div className="flex items-center gap-3 text-sm font-bold text-white/70">
                    <Loader2 className="animate-spin text-spotify" size={19} />
                    Carregando playlists
                </div>
            </div>
        )}

        {connected && !playlistsLoading && playlistsError && (
            <div className="rounded-lg border border-youtube/25 bg-youtube/10 p-5">
                <p className="text-sm font-bold text-white">Não foi possível carregar playlists.</p>
                <p className="mt-2 text-sm leading-6 text-muted">{playlistsError}</p>
            </div>
        )}

        {connected && !playlistsLoading && !playlistsError && (
            <div className="grid max-h-[460px] gap-3 overflow-y-auto pr-1">
                {playlists.length > 0 ? (
                    playlists.map((playlist) => (
                        <PlaylistRow
                            key={playlist.id}
                            playlist={playlist}
                            providerLabel={provider.label}
                            preview={trackPreviews[playlist.id]}
                            selected={selectedPlaylistIdSet.has(playlist.id)}
                            onSelect={onTogglePlaylist}
                            onTogglePreview={onToggleTrackPreview}
                        />
                    ))
                ) : (
                    <div className="rounded-lg border border-white/10 bg-black/30 p-6">
                        <ListMusic className="mb-4 text-muted" size={24} />
                        <h3 className="text-lg font-black text-white">Nenhuma playlist encontrada</h3>
                        <p className="mt-2 text-sm leading-6 text-muted">
                            Atualize a lista ou cole o link de uma playlist para continuar.
                        </p>
                    </div>
                )}
            </div>
        )}
    </div>
);

export default ProviderPlaylistListCard;
