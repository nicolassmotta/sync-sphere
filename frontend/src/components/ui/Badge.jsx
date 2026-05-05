import { cn } from '../../utils/cn';

const tones = {
    neutral: 'border-white/10 bg-white/[0.055] text-white/70',
    success: 'border-spotify/20 bg-spotify/10 text-spotify',
    warning: 'border-yellow-500/20 bg-yellow-500/10 text-yellow-300',
    danger: 'border-red-500/20 bg-red-500/10 text-red-400',
    info: 'border-sky-400/20 bg-sky-400/10 text-sky-300',
    spotify: 'border-spotify/20 bg-spotify/10 text-spotify',
    youtube: 'border-youtube/20 bg-youtube/10 text-red-200',
};

const sizes = {
    sm: 'gap-1.5 px-2.5 py-1 text-xs',
    md: 'gap-2 px-3 py-1.5 text-sm',
};

const Badge = ({
    as: Component = 'span',
    children,
    className,
    icon,
    size = 'sm',
    tone = 'neutral',
    ...props
}) => (
    <Component
        className={cn(
            'inline-flex items-center rounded-full border font-bold',
            tones[tone] || tones.neutral,
            sizes[size] || sizes.sm,
            className
        )}
        {...props}
    >
        {icon}
        {children}
    </Component>
);

export default Badge;
