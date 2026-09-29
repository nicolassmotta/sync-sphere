import { Music } from 'lucide-react';
import { cn } from '../../utils/cn';
import { SpotifyIcon, YoutubeIcon } from './BrandIcons';

const sizes = {
    sm: 'h-5 w-5',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
};

/**
 * Ícone da plataforma. Plataformas sem marca própria usam um ícone genérico.
 */
const ProviderIcon = ({ providerId, size = 'md', className }) => {
    const sizeClass = sizes[size] || sizes.md;

    if (providerId === 'spotify') return <SpotifyIcon className={cn(sizeClass, 'fill-spotify', className)} />;
    if (providerId === 'youtubeMusic') return <YoutubeIcon className={cn(sizeClass, 'fill-youtube', className)} />;
    return <Music className={cn(sizeClass, 'text-white/70', className)} aria-hidden="true" />;
};

export default ProviderIcon;
