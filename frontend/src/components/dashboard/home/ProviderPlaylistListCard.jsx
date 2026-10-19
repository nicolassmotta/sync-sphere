import { useText } from '../../../i18n/useText';
import { useMemo, useRef, useState } from 'react';
import { ArrowRight, Link2, ListMusic, Loader2, RefreshCw, Search, Upload } from 'lucide-react';
import Button from '../../ui/Button';
import ProviderIcon from '../../ui/ProviderIcon';
import TextField from '../../ui/TextField';
import { getProviderUi } from '../../../constants/providers';
import PlaylistRow from './PlaylistRow';
import PlaylistTrackPreview from './PlaylistTrackPreview';

// A busca aparece quando a lista deixa de caber de uma vez na tela.
const SEARCH_THRESHOLD = 6;

/**
 * Playlists da conta conectada na plataforma de origem, com seleção múltipla,
 * busca por nome e prévia de faixas. `link` permite migrar uma playlist que
 * não está na conta (por exemplo, pública de outra pessoa).
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
    onImportFile,
    onDeletePlaylist,
    link,
}) => {
    const { t } = useText();
    const fileInputRef = useRef(null);
    const [importing, setImporting] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [query, setQuery] = useState('');
    const acceptsFiles = provider.auth?.type === 'file' && Boolean(onImportFile);
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const visiblePlaylists = useMemo(() => (normalizedQuery
        ? playlists.filter((playlist) => `${playlist.name || ''} ${playlist.ownerName || ''}`.toLocaleLowerCase().includes(normalizedQuery))
        : playlists), [normalizedQuery, playlists]);
    const showSearch = playlists.length > SEARCH_THRESHOLD;

    const importFiles = async (files) => {
        const file = files?.[0];
        if (!file) return;
        setImporting(true);
        await onImportFile(file);
        setImporting(false);
    };

    const handleFileChange = async (event) => {
        const { files } = event.target;
        await importFiles(files);
        event.target.value = '';
    };

    // Arrastar um arquivo para o cartão importa como o botão Importar arquivo.
    const dropProps = acceptsFiles ? {
        onDragOver: (event) => { event.preventDefault(); setDragging(true); },
        onDragLeave: (event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); },
        onDrop: (event) => { event.preventDefault(); setDragging(false); importFiles(event.dataTransfer?.files); },
    } : {};

    return (
    <div className={`elevated-card p-6 transition-colors lg:p-7 ${dragging ? 'ring-2 ring-spotify/60' : ''}`} {...dropProps}>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
                <p className="inline-flex items-center gap-2 text-sm font-bold uppercase text-muted">
                    <ProviderIcon providerId={provider.id} size="sm" />{t("Origem: {{value0}}", { value0: t(provider.label) })}</p>
                <h2 className="mt-2 text-2xl font-black text-white">{t("Playlists do ")}{t(provider.label)}</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted">{acceptsFiles
                    ? t("Importe um arquivo ou arraste-o para este cartão. Marque uma ou várias playlists para migrar.")
                    : t("Marque uma ou várias playlists. A prévia lê as primeiras faixas antes de criar tarefas na fila.")}</p>
                {connected && !playlistsLoading && (
                    <p className="mt-2 text-xs font-bold uppercase text-muted">{t("Mostrando ")}{visiblePlaylists.length}{t(" de ")}{playlistsSummary?.total || playlists.length}{t(" playlists")}{playlistsSummary?.hasMore ? t(" · há mais no {{value0}}", { value0: provider.label }) : ''}
                    </p>
                )}
            </div>
            <div className="flex flex-wrap gap-2 sm:max-w-[22rem] sm:justify-end">
                {acceptsFiles && (
                    <>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv,.json,.m3u,.m3u8,.txt,text/csv,application/json,text/plain"
                            className="hidden"
                            onChange={handleFileChange}
                        />
                        <Button
                            onClick={() => fileInputRef.current?.click()}
                            variant="primary"
                            size="sm"
                            loading={importing}
                            loadingLabel={t("Importando...")}
                            leftIcon={<Upload size={15} />}
                        >{t("Importar arquivo")}</Button>
                    </>
                )}
                <Button
                    onClick={onRefreshPlaylists}
                    variant="secondary"
                    size="sm"
                    disabled={!connected || playlistsLoading}
                    leftIcon={playlistsLoading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                >{t("Atualizar")}</Button>
                {visiblePlaylists.length > 0 && (
                    <>
                        <Button onClick={() => onSelectAllPlaylists(visiblePlaylists)} variant="ghost" size="sm">
                            {!normalizedQuery ? t("Selecionar todas") : visiblePlaylists.length === 1 ? t("Selecionar a encontrada") : t("Selecionar as {{value0}} encontradas", { value0: visiblePlaylists.length })}</Button>
                        <Button onClick={onClearSelectedPlaylists} variant="ghost" size="sm" disabled={!sourcePlaylistIds.length}>{t("Limpar")}</Button>
                    </>
                )}
            </div>
        </div>

        {!connected && (
            <div className="rounded-lg border border-white/10 bg-black/30 p-6">
                <div className="mb-4 grid h-12 w-12 place-items-center rounded-lg border border-white/10 bg-white/[0.045]">
                    <ProviderIcon providerId={provider.id} />
                </div>
                <h3 className="text-lg font-black text-white">{t("Conecte o ")}{t(provider.label)}</h3>
                <p className="mt-2 max-w-lg text-sm leading-6 text-muted">{t("A conexão fica no back-end local e libera a listagem de playlists desta conta.")}</p>
                <Button
                    onClick={onOpenIntegrations}
                    variant="primary"
                    className="mt-5"
                    rightIcon={<ArrowRight size={16} />}
                >{t("Conectar ")}{t(provider.label)}</Button>
            </div>
        )}

        {connected && playlistsLoading && (
            <div className="grid min-h-52 place-items-center rounded-lg border border-white/10 bg-black/30">
                <div className="flex items-center gap-3 text-sm font-bold text-white/70">
                    <Loader2 className="animate-spin text-spotify" size={19} />{t("Carregando playlists")}</div>
            </div>
        )}

        {connected && !playlistsLoading && playlistsError && (
            <div className="rounded-lg border border-youtube/25 bg-youtube/10 p-5">
                <p className="text-sm font-bold text-white">{t("Não foi possível carregar playlists.")}</p>
                <p className="mt-2 text-sm leading-6 text-muted">{t(playlistsError)}</p>
                <Button className="mt-4" size="sm" variant="secondary" onClick={onRefreshPlaylists} leftIcon={<RefreshCw size={14} />}>{t("Tentar novamente")}</Button>
            </div>
        )}

        {connected && !playlistsLoading && !playlistsError && showSearch && (
            <TextField
                containerClassName="mb-4"
                aria-label={t("Buscar playlist pelo nome")}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                tone="neutral"
                leadingIcon={<Search size={17} />}
                placeholder={t("Buscar playlist pelo nome...")}
            />
        )}

        {connected && !playlistsLoading && !playlistsError && (
            <div className="grid max-h-[460px] gap-3 overflow-y-auto pr-1">
                {visiblePlaylists.length > 0 ? (
                    visiblePlaylists.map((playlist) => (
                        <PlaylistRow
                            key={playlist.id}
                            playlist={playlist}
                            providerLabel={t(provider.label)}
                            preview={trackPreviews[playlist.id]}
                            selected={selectedPlaylistIdSet.has(playlist.id)}
                            onSelect={onTogglePlaylist}
                            onTogglePreview={onToggleTrackPreview}
                            onDelete={onDeletePlaylist}
                        />
                    ))
                ) : normalizedQuery ? (
                    <div className="rounded-lg border border-white/10 bg-black/30 p-6">
                        <p className="font-bold text-white">{t("Nenhuma playlist com esse nome.")}</p>
                        <button type="button" onClick={() => setQuery('')} className="mt-2 text-sm font-semibold text-white underline underline-offset-4">{t("Limpar busca")}</button>
                    </div>
                ) : (
                    <div className="rounded-lg border border-white/10 bg-black/30 p-6">
                        <ListMusic className="mb-4 text-muted" size={24} />
                        <h3 className="text-lg font-black text-white">
                            {acceptsFiles ? t("Nenhum arquivo importado") : t("Nenhuma playlist encontrada")}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-muted">
                            {acceptsFiles
                                ? t("Importe um CSV (Exportify e outros), JSON, M3U/M3U8 ou TXT com \"Artista - Título\" por linha.")
                                : link ? t("Atualize a lista ou cole o link de uma playlist logo abaixo.") : t("Atualize a lista para buscar suas playlists de novo.")}
                        </p>
                    </div>
                )}
            </div>
        )}

        {link && connected && !playlistsLoading && (
            <details className="mt-5 rounded-lg border border-white/10 bg-black/20 p-4" open={Boolean(link.value) || (!playlistsError && !playlists.length) || undefined}>
                <summary className="cursor-pointer text-sm font-semibold text-white">
                    <Link2 size={15} aria-hidden="true" className="mr-2 inline text-spotify" />{t("Usar o link de uma playlist")}</summary>
                <p className="mt-3 text-sm leading-6 text-muted">{t("Serve para playlists públicas que não estão na sua conta. O link substitui a seleção da lista.")}
                    {provider.id === 'spotify' && ` ${t("O Spotify pode bloquear a leitura de playlists de outras contas; a prévia avisa quando isso acontece.")}`}</p>
                <TextField
                    containerClassName="mt-3"
                    label={t("Link ou ID da playlist no {{value0}}", { value0: t(provider.label) })}
                    value={link.value}
                    onChange={link.onChange}
                    tone={getProviderUi(provider.id).tone}
                    leadingIcon={<Link2 size={18} />}
                    placeholder={provider.playlistUrlExample || t("Link da playlist")}
                />
                <Button className="mt-3" size="sm" variant="secondary" onClick={link.onPreview} disabled={!link.value?.trim() || link.preview?.loading}
                    leftIcon={link.preview?.loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}>{t("Pré-visualizar")}</Button>
                {link.preview && <PlaylistTrackPreview preview={link.preview} />}
            </details>
        )}
    </div>
    );
};

export default ProviderPlaylistListCard;
