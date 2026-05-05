import { useCallback, useEffect, useState } from 'react';
import { API_ORIGIN } from '../services/api';

const DEFAULT_STATUS = {
    backend: {
        status: 'checking',
        message: 'Verificando back-end local...',
        uptimeSeconds: null,
    },
    dependencies: {
        mongo: 'unknown',
        redis: 'unknown',
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

export const useLocalSystemStatus = () => {
    const [systemStatus, setSystemStatus] = useState(DEFAULT_STATUS);
    const [loading, setLoading] = useState(false);

    const refreshSystemStatus = useCallback(async () => {
        setLoading(true);

        const healthUrl = `${API_ORIGIN}/api/health`;
        const readyUrl = `${API_ORIGIN}/api/ready`;

        const [healthResult, readyResult] = await Promise.allSettled([
            fetch(healthUrl, { credentials: 'include' }),
            fetch(readyUrl, { credentials: 'include' }),
        ]);

        const nextStatus = {
            backend: {
                status: 'offline',
                message: `Sem resposta em ${healthUrl}`,
                uptimeSeconds: null,
            },
            dependencies: {
                mongo: 'unknown',
                redis: 'unknown',
            },
            checkedAt: new Date().toISOString(),
        };

        if (healthResult.status === 'fulfilled') {
            const healthPayload = await readJson(healthResult.value);
            nextStatus.backend = {
                status: healthResult.value.ok ? 'online' : 'offline',
                message: healthPayload.message || (healthResult.value.ok ? 'Back-end respondeu ao endpoint de saúde.' : 'Back-end respondeu com erro.'),
                uptimeSeconds: healthPayload.uptimeSeconds ?? null,
            };
        }

        if (readyResult.status === 'fulfilled') {
            const readyPayload = await readJson(readyResult.value);
            nextStatus.dependencies = {
                mongo: readyPayload.dependencies?.mongo || 'unknown',
                redis: readyPayload.dependencies?.redis || 'unknown',
            };
        }

        setSystemStatus(nextStatus);
        setLoading(false);
        return nextStatus;
    }, []);

    useEffect(() => {
        refreshSystemStatus();
    }, [refreshSystemStatus]);

    return {
        loading,
        refreshSystemStatus,
        systemStatus,
    };
};
