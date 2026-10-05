import { useText } from '../../i18n/useText';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '../../utils/cn';

const tones = {
    neutral: {
        icon: <Info size={18} aria-hidden="true" />,
        classes: 'border-white/10 bg-white/[0.045] text-white',
        iconClasses: 'text-muted',
    },
    success: {
        icon: <CheckCircle2 size={18} aria-hidden="true" />,
        classes: 'border-spotify/20 bg-spotify/10 text-white',
        iconClasses: 'text-spotify',
    },
    warning: {
        icon: <AlertTriangle size={18} aria-hidden="true" />,
        classes: 'border-yellow-500/20 bg-yellow-500/10 text-white',
        iconClasses: 'text-yellow-300',
    },
    danger: {
        icon: <XCircle size={18} aria-hidden="true" />,
        classes: 'border-red-500/20 bg-red-500/10 text-white',
        iconClasses: 'text-red-300',
    },
    youtube: {
        icon: <Info size={18} aria-hidden="true" />,
        classes: 'border-youtube/20 bg-youtube/10 text-white',
        iconClasses: 'text-red-200',
    },
};

const Alert = ({
    action,
    children,
    className,
    icon,
    role,
    title,
    tone = 'neutral',
}) => {
    const { t } = useText();
    const selectedTone = tones[tone] || tones.neutral;
    const alertRole = role ?? (tone === 'danger' ? 'alert' : 'status');

    return (
        <div
            role={alertRole}
            className={cn(
                'flex gap-3 rounded-lg border p-4 text-sm leading-6',
                selectedTone.classes,
                className
            )}
        >
            <span className={cn('mt-0.5 shrink-0', selectedTone.iconClasses)}>
                {icon ?? selectedTone.icon}
            </span>
            <div className="min-w-0 flex-1">
                {title && <p className="font-extrabold text-white">{t(title)}</p>}
                {children && <div className={cn('text-muted', title && 'mt-1')}>{children}</div>}
                {action && <div className="mt-3">{action}</div>}
            </div>
        </div>
    );
};

export default Alert;
