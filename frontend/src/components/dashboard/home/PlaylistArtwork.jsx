import { Music2 } from 'lucide-react';

const PlaylistArtwork = ({ imageUrl, name }) => {
    if (imageUrl) {
        return (
            <img
                src={imageUrl}
                alt={name}
                className="h-12 w-12 rounded-lg object-cover"
                loading="lazy"
            />
        );
    }

    return (
        <div className="grid h-12 w-12 place-items-center rounded-lg border border-spotify/20 bg-spotify/10">
            <Music2 size={20} className="text-spotify" />
        </div>
    );
};

export default PlaylistArtwork;
