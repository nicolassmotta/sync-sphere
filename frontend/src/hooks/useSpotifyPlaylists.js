import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';

export const useSpotifyPlaylists = ({ enabled = false } = {}) => {
    const [playlists, setPlaylists] = useState([]);
    const [summary, setSummary] = useState({ total: 0, hasMore: false });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const inFlightPromiseRef = useRef(null);
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
        if (inFlightPromiseRef.current) return inFlightPromiseRef.current;

        setLoading(true);
        setError('');

        inFlightPromiseRef.current = (async () => {
            try {
                const response = await api.get('/integrations/spotify/playlists');
                const nextPlaylists = response.data.data.playlists || [];
                updatePlaylists(nextPlaylists);
                setSummary({
                    total: response.data.data.total || nextPlaylists.length,
                    hasMore: Boolean(response.data.data.hasMore),
                });
                lastSuccessAtRef.current = Date.now();
                return nextPlaylists;
            } catch (err) {
                const message = err.response?.data?.message || 'Não foi possível carregar playlists do Spotify.';
                setError(message);
                updatePlaylists([]);
                setSummary({ total: 0, hasMore: false });

                if (!silent) {
                    toast.error(message);
                }

                return [];
            } finally {
                setLoading(false);
                inFlightPromiseRef.current = null;
            }
        })();

        return inFlightPromiseRef.current;
    }, [enabled]);

    useEffect(() => {
        if (enabled) {
            refreshPlaylists({ silent: true, force: true });
            return;
        }

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
