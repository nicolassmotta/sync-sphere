import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';

const DEFAULT_INTEGRATIONS = {
    spotify: { connected: false },
    youtubeMusic: { connected: false },
};

export const useIntegrationStatus = () => {
    const [integrations, setIntegrations] = useState(DEFAULT_INTEGRATIONS);
    const [loading, setLoading] = useState(false);
    const inFlightPromiseRef = useRef(null);
    const lastSuccessAtRef = useRef(0);
    const integrationsRef = useRef(DEFAULT_INTEGRATIONS);

    const updateIntegrations = (nextIntegrations) => {
        integrationsRef.current = nextIntegrations;
        setIntegrations(nextIntegrations);
    };

    const refreshIntegrations = useCallback(async ({ force = false, minIntervalMs = 5000 } = {}) => {
        const now = Date.now();
        if (!force && now - lastSuccessAtRef.current < minIntervalMs) {
            return integrationsRef.current;
        }
        if (inFlightPromiseRef.current) return inFlightPromiseRef.current;

        setLoading(true);
        inFlightPromiseRef.current = (async () => {
            try {
                const response = await api.get('/integrations/status');
                const nextIntegrations = response.data.data.integrations;
                updateIntegrations(nextIntegrations);
                lastSuccessAtRef.current = Date.now();
                return nextIntegrations;
            } catch (err) {
                toast.error(err.response?.data?.message || 'Não foi possível carregar o status das integrações locais.');
                throw err;
            } finally {
                setLoading(false);
                inFlightPromiseRef.current = null;
            }
        })();

        try {
            return await inFlightPromiseRef.current;
        } catch {
            return integrationsRef.current;
        }
    }, []);

    useEffect(() => {
        refreshIntegrations({ force: true });
    }, [refreshIntegrations]);

    return {
        integrations,
        loading,
        refreshIntegrations,
    };
};
