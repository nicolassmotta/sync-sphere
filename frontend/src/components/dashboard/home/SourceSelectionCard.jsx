import { FileText, Link2, Terminal } from 'lucide-react';
import { SpotifyIcon } from '../../ui/BrandIcons';
import SourceMethod from './SourceMethod';

const SourceSelectionCard = ({
    spotifyConnected,
    hasManualPlaylist,
    onRefreshSpotifyPlaylists,
    onOpenManualPlaylist,
    onOpenIntegrations,
}) => (
    <div className="elevated-card p-6 lg:p-7">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <p className="text-sm font-bold uppercase text-white/40">Escolha uma plataforma de origem</p>
                <h2 className="mt-2 text-2xl font-black text-white">De onde vem a música?</h2>
            </div>
            <Terminal className="text-spotify" size={24} />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
            <SourceMethod
                icon={<SpotifyIcon />}
                title="Spotify"
                text={spotifyConnected ? 'OAuth ativo; carregue playlists da conta.' : 'Conecte via OAuth para listar playlists.'}
                status={spotifyConnected ? 'conectado' : 'conectar'}
                active={spotifyConnected}
                onClick={spotifyConnected ? onRefreshSpotifyPlaylists : onOpenIntegrations}
            />
            <SourceMethod
                icon={<Link2 size={21} className="text-cyan-300" />}
                title="Link da playlist"
                text="Cole um link/ID do Spotify para testar uma playlist específica."
                status="link"
                active={hasManualPlaylist}
                onClick={onOpenManualPlaylist}
            />
            <SourceMethod
                icon={<FileText size={21} className="text-amber-200" />}
                title="Texto livre"
                text="Entrada manual de faixas ainda não implementada."
                status="em breve"
                disabled
            />
        </div>
    </div>
);

export default SourceSelectionCard;
