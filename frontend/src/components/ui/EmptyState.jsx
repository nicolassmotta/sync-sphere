import { cn } from '../../utils/cn';

const EmptyState = ({
    action,
    className,
    description,
    icon,
    title,
}) => (
    <div className={cn('grid place-items-center rounded-lg border border-white/10 bg-black/25 p-8 text-center', className)}>
        <div className="flex max-w-sm flex-col items-center">
            {icon && (
                <div className="mb-4 grid h-12 w-12 place-items-center rounded-lg border border-white/10 bg-white/[0.045] text-muted">
                    {icon}
                </div>
            )}
            <h3 className="text-base font-extrabold text-white">{title}</h3>
            {description && <p className="mt-2 text-sm leading-6 text-muted">{description}</p>}
            {action && <div className="mt-5">{action}</div>}
        </div>
    </div>
);

export default EmptyState;
