import { AudioLines, FileMusic, Music, Music2, Waves } from 'lucide-react';
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
    if (providerId === 'deezer') return <AudioLines className={cn(sizeClass, 'text-[#A238FF]', className)} aria-hidden="true" />;
    if (providerId === 'tidal') return <Waves className={cn(sizeClass, 'text-cyan-300', className)} aria-hidden="true" />;
    if (providerId === 'appleMusic') return <Music2 className={cn(sizeClass, 'text-[#FA2D48]', className)} aria-hidden="true" />;
    if (providerId === 'file') return <FileMusic className={cn(sizeClass, 'text-sky-300', className)} aria-hidden="true" />;
    return <Music className={cn(sizeClass, 'text-white/70', className)} aria-hidden="true" />;
};

export default ProviderIcon;
