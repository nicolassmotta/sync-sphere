import { forwardRef } from 'react';
import { cn } from '../../utils/cn';
import Spinner from './Spinner';

const variants = {
    primary: 'border border-spotify/30 bg-spotify text-black hover:bg-spotify/90',
    youtube: 'bg-red-700 text-white shadow-[0_18px_50px_rgba(255,0,0,0.18)] hover:bg-red-800',
    secondary: 'border border-white/10 bg-white/10 text-white hover:bg-white/20',
    ghost: 'bg-white/5 text-gray-200 hover:bg-white/10',
    danger: 'border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20',
    inverse: 'bg-white text-black shadow-[0_18px_50px_rgba(255,255,255,0.12)] hover:bg-gray-100',
};

const sizes = {
    sm: 'min-h-9 px-3 py-2 text-xs',
    md: 'min-h-11 px-4 py-3 text-sm',
    lg: 'min-h-12 px-5 py-3.5 text-base',
};

const Button = forwardRef(({
    children,
    className,
    disabled,
    fullWidth = false,
    loading = false,
    loadingLabel = 'Carregando...',
    leftIcon,
    rightIcon,
    size = 'md',
    type = 'button',
    variant = 'secondary',
    ...props
}, ref) => {
    const isDisabled = disabled || loading;

    return (
        <button
            ref={ref}
            type={type}
            disabled={isDisabled}
            aria-busy={loading || undefined}
            className={cn(
                'inline-flex items-center justify-center gap-2 rounded-lg font-extrabold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-spotify focus-visible:ring-offset-2 focus-visible:ring-offset-darkBackground disabled:cursor-not-allowed disabled:opacity-60',
                variants[variant],
                sizes[size],
                fullWidth && 'w-full',
                className
            )}
            {...props}
        >
            {loading ? <Spinner size={size === 'sm' ? 14 : 18} /> : leftIcon}
            <span>{loading ? loadingLabel : children}</span>
            {!loading && rightIcon}
        </button>
    );
});

Button.displayName = 'Button';

export default Button;
