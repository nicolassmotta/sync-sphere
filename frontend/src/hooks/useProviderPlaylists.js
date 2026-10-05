import { useText } from '../i18n/useText';
import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';

/**
 * Playlists da conta conectada em plataformas que listam playlists
 * (`capabilities.listUserPlaylists`).
 */
export const useProviderPlaylists = ({ providerId, providerLabel = 'plataforma', enabled = false } = {}) => {
    const { t } = useText();
    const [playlists, setPlaylists] = useState([]);
    const [summary, setSummary] = useState({ total: 0, hasMore: false });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const inFlightPromiseRef = useRef(null);
    const requestIdRef = useRef(0);
    const pendingProviderRef = useRef(null);
    const lastSuccessAtRef = useRef(0);
    const playlistsRef = useRef([]);

    const updatePlaylists = (nextPlaylists) => {
        playlistsRef.current = nextPlaylists;
        setPlaylists(nextPlaylists);
    };

    const refreshPlaylists = useCallback(async ({ silent = false, force = false, minIntervalMs = 8000 } = {}) => {
        if (!enabled) {
            updatePlaylists([]);
            setSummary({ total: 0, hasMore: false });
            setError('');
            return [];
        }

        const now = Date.now();
        if (!force && now - lastSuccessAtRef.current < minIntervalMs) {
            return playlistsRef.current;
        }
        if (inFlightPromiseRef.current && pendingProviderRef.current === providerId) return inFlightPromiseRef.current;

        const requestId = ++requestIdRef.current;
        pendingProviderRef.current = providerId;
        setLoading(true);
        setError('');

        inFlightPromiseRef.current = (async () => {
            try {
                const response = await api.get(`/integrations/${providerId}/playlists`);
                if (requestId !== requestIdRef.current) return [];
                const nextPlaylists = response.data.data.playlists || [];
                updatePlaylists(nextPlaylists);
                setSummary({
                    total: response.data.data.total || nextPlaylists.length,
                    hasMore: Boolean(response.data.data.hasMore),
                });
                lastSuccessAtRef.current = Date.now();
                return nextPlaylists;
            } catch (err) {
                if (requestId !== requestIdRef.current) return [];
                const message = err.response?.data?.message || t("Não foi possível carregar playlists do {{value0}}.", { value0: providerLabel });
                setError(message);
                updatePlaylists([]);
                setSummary({ total: 0, hasMore: false });

                if (!silent) {
                    toast.error(message);
                }

                return [];
            } finally {
                if (requestId === requestIdRef.current) {
                    setLoading(false);
                    inFlightPromiseRef.current = null;
                }
            }
        })();

        return inFlightPromiseRef.current;
    }, [enabled, providerId, providerLabel, t]);

    useEffect(() => {
        lastSuccessAtRef.current = 0;
        if (enabled) {
            refreshPlaylists({ silent: true, force: true });
            return () => { requestIdRef.current += 1; inFlightPromiseRef.current = null; };
        }

        requestIdRef.current += 1;
        inFlightPromiseRef.current = null;
        setLoading(false);
        updatePlaylists([]);
        setSummary({ total: 0, hasMore: false });
        setError('');
    }, [enabled, refreshPlaylists]);

    return {
        playlists,
        summary,
        loading,
        error,
        refreshPlaylists,
    };
};
