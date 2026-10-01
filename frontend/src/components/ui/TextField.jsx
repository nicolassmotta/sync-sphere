import { forwardRef, useId } from 'react';
import { cn } from '../../utils/cn';

const toneClasses = {
    spotify: {
        field: 'focus-within:border-spotify focus-within:ring-spotify',
        icon: 'text-spotify',
    },
    youtube: {
        field: 'focus-within:border-youtube focus-within:ring-youtube',
        icon: 'text-youtube',
    },
    neutral: {
        field: 'focus-within:border-white/30 focus-within:ring-white/20',
        icon: 'text-muted',
    },
};

const TextField = forwardRef(({
    className,
    containerClassName,
    disabled,
    error,
    hint,
    id,
    label,
    labelAction,
    leadingIcon,
    required,
    tone = 'spotify',
    trailingElement,
    type = 'text',
    ...props
}, ref) => {
    const selectedTone = toneClasses[tone] || toneClasses.spotify;
    const generatedId = useId();
    const inputId = id || generatedId;
    const hintId = hint ? `${inputId}-hint` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;
    const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

    return (
        <div className={cn('space-y-1.5', containerClassName)}>
            {(label || labelAction) && (
                <div className="ml-1 flex items-center justify-between gap-3">
                    {label ? (
                        <label htmlFor={inputId} className="block text-sm font-semibold text-white/70">
                            {label}
                            {required && <span className="text-spotify"> *</span>}
                        </label>
                    ) : (
                        <span />
                    )}
                    {labelAction}
                </div>
            )}

            <div className={cn(
                'flex min-h-12 items-center gap-3 rounded-lg border border-white/10 bg-black/45 px-4 text-white transition-all focus-within:ring-1',
                selectedTone.field,
                error && 'border-red-500/50 focus-within:border-red-400 focus-within:ring-red-400',
                disabled && 'opacity-60',
            )}>
                {leadingIcon && <span className={cn('shrink-0', selectedTone.icon)}>{leadingIcon}</span>}
                <input
                    ref={ref}
                    id={inputId}
                    type={type}
                    disabled={disabled}
                    required={required}
                    aria-invalid={Boolean(error) || undefined}
                    aria-describedby={describedBy}
                    className={cn('w-full bg-transparent py-3 text-sm outline-none placeholder:text-gray-400', className)}
                    {...props}
                />
                {trailingElement}
            </div>

            {hint && !error && (
                <p id={hintId} className="ml-1 text-xs leading-5 text-muted">{hint}</p>
            )}
            {error && (
                <p id={errorId} role="alert" className="ml-1 text-xs leading-5 text-red-300">{error}</p>
            )}
        </div>
    );
});

TextField.displayName = 'TextField';

export default TextField;
