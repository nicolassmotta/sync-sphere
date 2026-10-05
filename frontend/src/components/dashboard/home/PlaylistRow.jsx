import { safeExternalUrl } from '../../../utils/safeExternalUrl';
import { useText } from '../../../i18n/useText';
import { memo } from 'react';
import {
    AlertTriangle,
    ChevronDown,
    ChevronRight,
    CheckCircle2,
    ExternalLink,
    Loader2,
    Trash2,
} from 'lucide-react';
import PlaylistArtwork from './PlaylistArtwork';
import PlaylistTrackPreview from './PlaylistTrackPreview';
import { formatTrackCount } from './formatTrackCount';

const PlaylistRow = memo(({ playlist, providerLabel = 'plataforma', preview, selected, onSelect, onTogglePreview, onDelete }) => {
    const { t } = useText();
    const visibleTrackCount = preview?.totalTracks || playlist.trackCount;
    const unavailable = Boolean(preview?.blocked);
    const externalUrl = safeExternalUrl(playlist.externalUrl);
    const checking = Boolean(preview?.loading && !preview?.open);

    return (
        <div className={`[content-visibility:auto] [contain-intrinsic-size:auto_80px] rounded-lg border p-2 transition-colors ${unavailable ? 'border-youtube/35 bg-youtube/10' : selected ? 'border-spotify/60 bg-spotify/10' : 'border-white/10 bg-black/30 hover:border-white/20 hover:bg-white/[0.055]'}`}>
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={() => onSelect(playlist.id)}
                    disabled={unavailable || checking}
                    aria-pressed={selected}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-not-allowed disabled:opacity-70"
                >
                    <PlaylistArtwork imageUrl={playlist.imageUrl} name={playlist.name} />
                    <span className="min-w-0">
                        <span className="block truncate text-sm font-extrabold text-white">{playlist.name}</span>
                        <span className="mt-1 block truncate text-xs font-semibold text-muted">
                            {playlist.ownerName || providerLabel} · {formatTrackCount(visibleTrackCount)}
                        </span>
                    </span>
                </button>

                {checking && <Loader2 size={18} className="shrink-0 animate-spin text-spotify" />}
                {unavailable && <AlertTriangle size={18} className="shrink-0 text-youtube" />}
                {!checking && !unavailable && selected && <CheckCircle2 size={18} className="shrink-0 text-spotify" />}

                <button
                    type="button"
                    onClick={() => onTogglePreview(playlist.id)}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                    aria-label={t("Ver faixas de {{value0}}", { value0: playlist.name })}
                >
                    {preview?.open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                </button>

                {onDelete && (
                    <button
                        type="button"
                        onClick={() => onDelete(playlist.id)}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-white/60 transition-colors hover:bg-red-500/15 hover:text-red-300"
                        aria-label={t("Remover {{value0}}", { value0: playlist.name })}
                    >
                        <Trash2 size={15} />
                    </button>
                )}

                {externalUrl && (
                    <a
                        href={externalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                        aria-label={t("Abrir {{value0}} no {{value1}}", { value0: playlist.name, value1: providerLabel })}
                    >
                        <ExternalLink size={15} />
                    </a>
                )}
            </div>

            {preview?.open && <PlaylistTrackPreview preview={preview} />}
        </div>
    );
});

PlaylistRow.displayName = 'PlaylistRow';

export default PlaylistRow;
