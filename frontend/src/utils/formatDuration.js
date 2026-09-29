/**
 * Formata segundos como tempo aproximado: "menos de 1 min", "~4 min", "~1 h 12 min".
 */
export const formatEta = (seconds) => {
    if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return null;
    if (seconds < 60) return 'menos de 1 min';

    const totalMinutes = Math.round(seconds / 60);
    if (totalMinutes < 60) return `~${totalMinutes} min`;

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes ? `~${hours} h ${minutes} min` : `~${hours} h`;
};

/**
 * Contagem regressiva "mm:ss" (ou "h:mm:ss") até uma data.
 */
export const formatCountdown = (targetDate, now = Date.now()) => {
    if (!targetDate) return null;
    const remaining = Math.max(0, Math.round((new Date(targetDate).getTime() - now) / 1000));
    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    const seconds = String(remaining % 60).padStart(2, '0');

    return hours
        ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
        : `${minutes}:${seconds}`;
};

export const formatTime = (date) => (
    date
        ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(date))
        : null
);
