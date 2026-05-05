import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

const Spinner = ({ className, size = 18 }) => (
    <Loader2
        aria-hidden="true"
        size={size}
        className={cn('shrink-0 animate-spin', className)}
    />
);

export default Spinner;
