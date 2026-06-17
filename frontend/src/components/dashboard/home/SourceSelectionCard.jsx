import { ArrowRightLeft, Link2, Terminal } from 'lucide-react';
import { TRANSFER_DIRECTIONS } from '../../../constants/transferDirections';
import { SpotifyIcon, YoutubeIcon } from '../../ui/BrandIcons';
import SourceMethod from './SourceMethod';

const SourceSelectionCard = ({
    transferDirection,
    spotifyConnected,
    youtubeReady,
    hasManualPlaylist,
    onTransferDirectionChange,
    onOpenManualPlaylist,
}) => {
    const spotifyToYoutubeActive = transferDirection === TRANSFER_DIRECTIONS.SPOTIFY_TO_YOUTUBE;
    const youtubeToSpotifyActive = transferDirection === TRANSFER_DIRECTIONS.YOUTUBE_TO_SPOTIFY;

    return (
        <div className="elevated-card p-6 lg:p-7">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-sm font-bold uppercase text-white/40">Direção da transferência</p>
                    <h2 className="mt-2 text-2xl font-black text-white">Escolha origem e destino</h2>
                </div>
                <Terminal className="text-spotify" size={24} />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <SourceMethod
                    icon={<span className="flex items-center gap-2"><SpotifyIcon /><ArrowRightLeft size={17} className="text-white/45" /><YoutubeIcon /></span>}
                    title="Spotify para YouTube"
                    text={spotifyConnected ? 'Playlists da conta conectada ou link do Spotify.' : 'OAuth recomendado para listar playlists.'}
                    status={spotifyToYoutubeActive ? 'ativo' : 'selecionar'}
                    active={spotifyToYoutubeActive}
                    onClick={() => onTransferDirectionChange(TRANSFER_DIRECTIONS.SPOTIFY_TO_YOUTUBE)}
                />
                <SourceMethod
                    icon={<span className="flex items-center gap-2"><YoutubeIcon /><ArrowRightLeft size={17} className="text-white/45" /><SpotifyIcon /></span>}
                    title="YouTube para Spotify"
                    text={youtubeReady ? 'Use link/ID do YouTube Music e destino Spotify.' : 'Exige YTMUSIC_COOKIE para ler a origem.'}
                    status={youtubeToSpotifyActive ? 'ativo' : 'selecionar'}
                    active={youtubeToSpotifyActive}
                    onClick={() => onTransferDirectionChange(TRANSFER_DIRECTIONS.YOUTUBE_TO_SPOTIFY)}
                />
                <SourceMethod
                    icon={<Link2 size={21} className={youtubeToSpotifyActive ? 'text-youtube' : 'text-cyan-300'} />}
                    title="Link ou ID"
                    text={youtubeToSpotifyActive ? 'Cole uma playlist do YouTube Music.' : 'Cole uma playlist do Spotify.'}
                    status="manual"
                    active={hasManualPlaylist}
                    onClick={onOpenManualPlaylist}
                />
            </div>
        </div>
    );
};

export default SourceSelectionCard;
