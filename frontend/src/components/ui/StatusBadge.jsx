import { AlertTriangle, CheckCircle2, Clock, KeyRound, PauseCircle, XCircle } from 'lucide-react';
import Badge from './Badge';

const statusPresets = {
    completed: {
        icon: <CheckCircle2 size={12} aria-hidden="true" />,
        label: 'Sucesso',
        tone: 'success',
    },
    connected: {
        icon: <CheckCircle2 size={12} aria-hidden="true" />,
        label: 'Conectado',
        tone: 'success',
    },
    failed: {
        icon: <XCircle size={12} aria-hidden="true" />,
        label: 'Falhou',
        tone: 'danger',
    },
    disconnected: {
        icon: <AlertTriangle size={12} aria-hidden="true" />,
        label: 'Pendente',
        tone: 'warning',
    },
    pending: {
        icon: <Clock size={12} aria-hidden="true" />,
        label: 'Na fila',
        tone: 'info',
    },
    paused: {
        icon: <PauseCircle size={12} aria-hidden="true" />,
        label: 'Pausada',
        tone: 'warning',
    },
    needs_auth: {
        icon: <KeyRound size={12} aria-hidden="true" />,
        label: 'Reconectar',
        tone: 'danger',
    },
    processing: {
        icon: <Clock size={12} aria-hidden="true" />,
        label: 'Processando',
        tone: 'warning',
    },
    queued: {
        icon: <Clock size={12} aria-hidden="true" />,
        label: 'Na fila',
        tone: 'info',
    },
};

const StatusBadge = ({
    className,
    icon,
    label,
    size,
    status,
    tone,
}) => {
    const preset = statusPresets[status] || statusPresets.pending;

    return (
        <Badge
            className={className}
            icon={icon ?? preset.icon}
            size={size}
            tone={tone ?? preset.tone}
        >
            {label ?? preset.label}
        </Badge>
    );
};

export default StatusBadge;
