import { useState } from 'react';
import { Music2 } from 'lucide-react';

const PlaylistArtwork = ({ imageUrl, name }) => {
    const [failedUrl, setFailedUrl] = useState(null);
    if (imageUrl && failedUrl !== imageUrl) {
        return (
            <img
                src={imageUrl}
                width={48}
                height={48}
                onError={() => setFailedUrl(imageUrl)}
                alt={name}
                className="h-12 w-12 shrink-0 rounded-lg object-cover"
                loading="lazy"
                decoding="async"
            />
        );
    }

    return (
        <div className="grid h-12 w-12 place-items-center rounded-lg border border-spotify/20 bg-spotify/10">
            <Music2 aria-hidden="true" size={20} className="text-spotify" />
        </div>
    );
};

export default PlaylistArtwork;
