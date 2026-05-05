import { Loader2 } from 'lucide-react';
import { formatTrackCount } from './formatTrackCount';

const PlaylistTrackPreview = ({ preview }) => {
    if (!preview) return null;

    if (preview.loading) {
        return (
            <div className="mt-3 rounded-lg border border-white/10 bg-black/25 p-3 text-xs font-bold text-white/60">
                <span className="inline-flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin text-spotify" />
                    Carregando faixas...
                </span>
            </div>
        );
    }

    if (preview.error) {
        return (
            <div className="mt-3 rounded-lg border border-youtube/25 bg-youtube/10 p-3 text-xs font-semibold text-red-200">
                {preview.error}
            </div>
        );
    }

    return (
        <div className="mt-3 rounded-lg border border-white/10 bg-black/25 p-3">
            <div className="mb-2 flex items-center justify-between text-xs font-bold text-white/45">
                <span>{formatTrackCount(preview.totalTracks)}</span>
                {preview.hasMore && <span>mostrando {preview.tracks.length}</span>}
            </div>
            <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                {preview.tracks.length > 0 ? (
                    preview.tracks.map((track, index) => (
                        <div key={`${track.spotifyId || track.uri}-${index}`} className="flex min-w-0 items-center gap-3 rounded-lg bg-white/[0.035] px-3 py-2">
                            <span className="w-5 shrink-0 text-right text-xs font-black text-white/35">{index + 1}</span>
                            <div className="min-w-0">
                                <p className="truncate text-xs font-extrabold text-white">{track.name}</p>
                                <p className="truncate text-xs font-semibold text-muted">{track.artist}</p>
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="text-xs font-semibold text-muted">Nenhuma faixa migrável encontrada nessa playlist.</p>
                )}
            </div>
        </div>
    );
};

export default PlaylistTrackPreview;
