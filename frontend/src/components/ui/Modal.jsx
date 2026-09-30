import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';

const sizes = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
};

const Modal = ({
    children,
    className,
    description,
    footer,
    isOpen,
    onClose,
    size = 'md',
    title,
}) => {
    const titleId = useId();
    const descriptionId = useId();
    const closeButtonRef = useRef(null);
    const dialogRef = useRef(null);

    useEffect(() => {
        if (!isOpen) return undefined;

        const previousActiveElement = document.activeElement;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        closeButtonRef.current?.focus();

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                onClose?.();
                return;
            }

            if (event.key !== 'Tab' || !dialogRef.current) return;

            const focusableElements = dialogRef.current.querySelectorAll(
                'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
            );
            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (!firstElement || !lastElement) {
                event.preventDefault();
                return;
            }

            if (event.shiftKey && document.activeElement === firstElement) {
                event.preventDefault();
                lastElement.focus();
            } else if (!event.shiftKey && document.activeElement === lastElement) {
                event.preventDefault();
                firstElement.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleKeyDown);
            previousActiveElement?.focus?.();
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const modal = (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:items-center">
            <div
                aria-hidden="true"
                className="absolute inset-0 h-full w-full cursor-default"
                onClick={onClose}
            />
            <section
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? titleId : undefined}
                aria-describedby={description ? descriptionId : undefined}
                className={cn(
                    'elevated-card relative flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden p-6 sm:p-8',
                    sizes[size],
                    className
                )}
            >
                <button
                    ref={closeButtonRef}
                    type="button"
                    aria-label="Fechar"
                    onClick={onClose}
                    className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-muted transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-spotify"
                >
                    <X size={20} />
                </button>

                {(title || description) && (
                    <div className="mb-6 shrink-0 pr-10">
                        {title && <h2 id={titleId} className="text-2xl font-bold text-white">{title}</h2>}
                        {description && <p id={descriptionId} className="mt-2 text-sm leading-6 text-muted">{description}</p>}
                    </div>
                )}

                <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                    {children}
                </div>

                {footer && (
                    <footer className="mt-6 shrink-0 border-t border-white/10 pt-4 sm:flex sm:justify-end">
                        {footer}
                    </footer>
                )}
            </section>
        </div>
    );

    return createPortal(modal, document.body);
};

export default Modal;
