import { useEffect, useState } from 'react';
import api from '../services/api';

/**
 * Estimativa de duração antes de iniciar, baseada na velocidade medida nas
 * migrações anteriores e no que já está na fila.
 */
export const useTransferEstimate = ({ enabled, direction, trackCount }) => {
    const [estimate, setEstimate] = useState(null);

    useEffect(() => {
        if (!enabled || !trackCount) {
            setEstimate(null);
            return undefined;
        }

        let cancelled = false;
        api.get('/transfer/estimate', { params: { direction, count: trackCount } })
            .then((response) => {
                if (!cancelled) setEstimate(response.data.data.estimate);
            })
            .catch(() => {
                if (!cancelled) setEstimate(null);
            });

        return () => {
            cancelled = true;
        };
    }, [enabled, direction, trackCount]);

    return estimate;
};
