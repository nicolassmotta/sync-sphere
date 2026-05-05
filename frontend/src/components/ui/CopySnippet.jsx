import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../utils/cn';
import Button from './Button';

const writeClipboard = async (value) => {
    if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
};

const CopySnippet = ({
    className,
    code,
    label = 'Comando',
    language = 'bash',
}) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        await writeClipboard(code);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
    };

    return (
        <div className={cn('overflow-hidden rounded-lg border border-white/10 bg-black/55', className)}>
            <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.045] px-4 py-3">
                <p className="min-w-0 truncate text-xs font-bold uppercase text-white/45">{label}</p>
                <Button
                    onClick={handleCopy}
                    size="sm"
                    variant="ghost"
                    leftIcon={copied ? <Check size={14} /> : <Copy size={14} />}
                >
                    {copied ? 'Copiado' : 'Copiar'}
                </Button>
            </div>
            <pre className="max-h-72 overflow-x-auto p-4 text-xs leading-6 text-gray-200 sm:text-sm">
                <code className={`language-${language}`}>{code}</code>
            </pre>
        </div>
    );
};

export default CopySnippet;
