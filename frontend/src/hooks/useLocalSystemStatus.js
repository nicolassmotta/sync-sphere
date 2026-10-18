import { useText } from '../i18n/useText';
import { useCallback, useEffect, useState } from 'react';
import { API_ORIGIN } from '../services/api';

const DEFAULT_STATUS = {
    backend: {
        status: 'checking',
        message: 'Verificando back-end local...',
        uptimeSeconds: null,
    },
    dependencies: {
        storage: 'unknown',
        queue: 'unknown',
    },
    checkedAt: null,
};

const readJson = async (response) => {
    try {
        return await response.json();
    } catch {
        return {};
    }
};

const POLL_INTERVAL_MS = 20000;
const sameStatus = (current, next) => current.backend.status === next.backend.status
    && current.backend.message === next.backend.message
    && current.dependencies.storage === next.dependencies.storage
    && current.dependencies.queue === next.dependencies.queue;

export const useLocalSystemStatus = () => {
    const { t } = useText();
    const [systemStatus, setSystemStatus] = useState(DEFAULT_STATUS);
    const [loading, setLoading] = useState(false);

    // `silent` confere em segundo plano sem acionar indicadores de carregamento.
    const refreshSystemStatus = useCallback(async ({ silent = false } = {}) => {
        if (!silent) setLoading(true);

        const healthUrl = `${API_ORIGIN}/api/health`;
        const readyUrl = `${API_ORIGIN}/api/ready`;

        const [healthResult, readyResult] = await Promise.allSettled([
            fetch(healthUrl, { credentials: 'include' }),
            fetch(readyUrl, { credentials: 'include' }),
        ]);

        const nextStatus = {
            backend: {
                status: 'offline',
                message: t("Sem resposta em {{value0}}", { value0: healthUrl }),
                uptimeSeconds: null,
            },
            dependencies: {
                storage: 'unknown',
                queue: 'unknown',
            },
            checkedAt: new Date().toISOString(),
        };

        if (healthResult.status === 'fulfilled') {
            const healthPayload = await readJson(healthResult.value);
            nextStatus.backend = {
                status: healthResult.value.ok ? 'online' : 'offline',
                message: healthPayload.message || (healthResult.value.ok ? t("Back-end respondeu ao endpoint de saúde.") : t("Back-end respondeu com erro.")),
                uptimeSeconds: healthPayload.uptimeSeconds ?? null,
            };
        }

        if (readyResult.status === 'fulfilled') {
            const readyPayload = await readJson(readyResult.value);
            nextStatus.dependencies = {
                storage: readyPayload.dependencies?.storage || 'unknown',
                queue: readyPayload.dependencies?.queue || 'unknown',
            };
        }

        setSystemStatus((current) => (silent && sameStatus(current, nextStatus) ? current : nextStatus));
        if (!silent) setLoading(false);
        return nextStatus;
    }, [t]);

    useEffect(() => {
        refreshSystemStatus();
    }, [refreshSystemStatus]);

    // Percebe quando a janela do aplicativo é fechada enquanto o painel continua aberto.
    useEffect(() => {
        if (typeof document === 'undefined') return undefined;
        const check = () => { if (document.visibilityState === 'visible') refreshSystemStatus({ silent: true }); };
        const interval = window.setInterval(check, POLL_INTERVAL_MS);
        document.addEventListener('visibilitychange', check);
        window.addEventListener('focus', check);
        return () => {
            window.clearInterval(interval);
            document.removeEventListener('visibilitychange', check);
            window.removeEventListener('focus', check);
        };
    }, [refreshSystemStatus]);

    return {
        loading,
        refreshSystemStatus,
        systemStatus,
    };
};
