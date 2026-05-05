import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { io } from 'socket.io-client';
import { API_ORIGIN } from '../services/api';

const normalizeTransferIds = (transferIds) => (
    Array.isArray(transferIds) ? transferIds : [transferIds].filter(Boolean)
);

export const useTransferSocket = (transferIds) => {
    const [isTransferring, setIsTransferring] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressMessage, setProgressMessage] = useState('');

    const prepareTransferProgress = useCallback((message) => {
        setIsTransferring(true);
        setProgress(0);
        setProgressMessage(message);
    }, []);

    const stopTransferProgress = useCallback(() => {
        setIsTransferring(false);
    }, []);

    useEffect(() => {
        const activeTransferIds = normalizeTransferIds(transferIds);
        if (!activeTransferIds.length) return undefined;

        const socket = io(API_ORIGIN, { withCredentials: true });
        const progressByTransferId = new Map(
            activeTransferIds.map((activeTransferId) => [String(activeTransferId), {
                progress: 0,
                status: 'pending',
                message: '',
            }])
        );

        const updateAggregateProgress = () => {
            const snapshots = [...progressByTransferId.values()];
            const totalProgress = snapshots.reduce((sum, snapshot) => sum + (snapshot.progress || 0), 0);
            const nextProgress = Math.round(totalProgress / snapshots.length);
            const runningCount = snapshots.filter((snapshot) => !['completed', 'failed'].includes(snapshot.status)).length;
            const failedCount = snapshots.filter((snapshot) => snapshot.status === 'failed').length;
            const completedCount = snapshots.filter((snapshot) => snapshot.status === 'completed').length;

            setProgress(nextProgress);
            setIsTransferring(runningCount > 0);

            if (snapshots.length === 1) {
                setProgressMessage(snapshots[0].message || '');
                return;
            }

            if (runningCount > 0) {
                setProgressMessage(`${completedCount}/${snapshots.length} playlists concluídas. ${runningCount} em andamento.`);
                return;
            }

            setProgressMessage(failedCount
                ? `${completedCount}/${snapshots.length} playlists concluídas. ${failedCount} falharam.`
                : `${completedCount}/${snapshots.length} playlists concluídas.`);
        };

        socket.on('connect', () => {
            activeTransferIds.forEach((activeTransferId) => {
                socket.emit('subscribe_transfer', activeTransferId);
            });
        });

        socket.on('transfer_update', (data) => {
            const activeTransferId = String(data.transferId || '');
            if (!progressByTransferId.has(activeTransferId)) return;

            progressByTransferId.set(activeTransferId, {
                progress: data.progress || 0,
                status: data.status || progressByTransferId.get(activeTransferId)?.status || 'processing',
                message: data.message || '',
            });
            updateAggregateProgress();

            if (data.status === 'completed' || data.status === 'failed') {
                const snapshots = [...progressByTransferId.values()];
                const finished = snapshots.every((snapshot) => ['completed', 'failed'].includes(snapshot.status));
                if (finished) {
                    const failedCount = snapshots.filter((snapshot) => snapshot.status === 'failed').length;
                    if (failedCount) {
                        toast.error(`${failedCount}/${snapshots.length} playlists falharam.`);
                    } else {
                        toast.success(snapshots.length === 1 ? data.message : `${snapshots.length} playlists migradas.`);
                    }
                    socket.disconnect();
                }
            }
        });

        socket.on('transfer_error', (data) => {
            toast.error(data.message || 'Falha na conexão em tempo real.');
        });

        return () => socket.disconnect();
    }, [transferIds]);

    return {
        isTransferring,
        progress,
        progressMessage,
        prepareTransferProgress,
        stopTransferProgress,
    };
};
