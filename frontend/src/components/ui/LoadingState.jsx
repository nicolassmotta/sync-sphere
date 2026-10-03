import { useText } from '../../i18n/useText';
import { translate as text } from '../../i18n/index';
import { cn } from '../../utils/cn';
import Spinner from './Spinner';

const LoadingState = ({
    className,
    description,
    label = text("Carregando..."),
    size = 'md',
}) => {
    const { t } = useText();
    const spinnerSize = size === 'sm' ? 16 : 20;

    return (
        <div
            role="status"
            aria-live="polite"
            className={cn(
                'grid place-items-center rounded-lg border border-white/10 bg-black/25 p-8 text-center text-muted',
                size === 'sm' && 'p-4',
                className
            )}
        >
            <div className="flex max-w-sm flex-col items-center gap-3">
                <Spinner size={spinnerSize} className="text-spotify" />
                <p className="text-sm font-bold text-white/75">{t(label)}</p>
                {description && <p className="text-xs leading-5 text-muted">{t(description)}</p>}
            </div>
        </div>
    );
};

export default LoadingState;
