import { useText } from '../i18n/useText';
import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';

const DEFAULT_STATUS = {
    integrations: {
        spotify: { connected: false },
        youtubeMusic: { connected: false },
    },
    providers: [],
};

/**
 * Status das plataformas vindo do back-end: `providers` (lista com
 * capacidades e conexão) e `integrations` (mapa por id).
 */
export const useIntegrationStatus = () => {
    const { t } = useText();
    const [status, setStatus] = useState(DEFAULT_STATUS);
    const [loading, setLoading] = useState(false);
    const inFlightPromiseRef = useRef(null);
    const lastSuccessAtRef = useRef(0);
    const statusRef = useRef(DEFAULT_STATUS);

    const updateStatus = (nextStatus) => {
        statusRef.current = nextStatus;
        setStatus(nextStatus);
    };

    const refreshIntegrations = useCallback(async ({ force = false, minIntervalMs = 5000 } = {}) => {
        const now = Date.now();
        if (!force && now - lastSuccessAtRef.current < minIntervalMs) {
            return statusRef.current.integrations;
        }
        if (inFlightPromiseRef.current) return inFlightPromiseRef.current;

        setLoading(true);
        inFlightPromiseRef.current = (async () => {
            try {
                const response = await api.get('/integrations/status');
                const nextStatus = {
                    integrations: response.data.data.integrations,
                    providers: response.data.data.providers || [],
                };
                updateStatus(nextStatus);
                lastSuccessAtRef.current = Date.now();
                return nextStatus.integrations;
            } catch (err) {
                toast.error(err.response?.data?.message || t("Não foi possível carregar o status das integrações locais."));
                throw err;
            } finally {
                setLoading(false);
                inFlightPromiseRef.current = null;
            }
        })();

        try {
            return await inFlightPromiseRef.current;
        } catch {
            return statusRef.current.integrations;
        }
    }, [t]);

    useEffect(() => {
        refreshIntegrations({ force: true });
    }, [refreshIntegrations]);

    return {
        integrations: status.integrations,
        providers: status.providers,
        loading,
        refreshIntegrations,
    };
};
