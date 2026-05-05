import { cn } from '../../utils/cn';

export const Card = ({ children, className, as: Component = 'section' }) => (
    <Component className={cn('elevated-card p-6 sm:p-8', className)}>
        {children}
    </Component>
);

export const CardHeader = ({ children, className }) => (
    <header className={cn('mb-6', className)}>
        {children}
    </header>
);

export const CardTitle = ({ children, className }) => (
    <h3 className={cn('text-xl font-bold text-white', className)}>
        {children}
    </h3>
);

export const CardDescription = ({ children, className }) => (
    <p className={cn('mt-2 text-sm leading-6 text-muted', className)}>
        {children}
    </p>
);

export default Card;
