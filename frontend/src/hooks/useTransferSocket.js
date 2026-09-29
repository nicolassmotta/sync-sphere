import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { io } from 'socket.io-client';
import { API_ORIGIN } from '../services/api';

const TERMINAL_STATUSES = ['completed', 'failed'];

const normalizeTransferIds = (transferIds) => (
    Array.isArray(transferIds) ? transferIds : [transferIds].filter(Boolean)
);

const buildInitialSnapshot = (transferId) => ({
    transferId,
    status: 'pending',
    phase: 'queued',
    progress: 0,
    message: '',
    counts: null,
    etaSeconds: null,
    recentTracks: [],
});

const isTerminal = (snapshot) => TERMINAL_STATUSES.includes(snapshot.status);

/**
 * Acompanha uma ou mais transferências via Socket.io. Expõe a lista com o
 * estado de cada uma (contadores, ETA, faixas recentes, pausa) e o agregado
 * usado pelos cards mais simples.
 */
export const useTransferSocket = (transferIds) => {
    const [isTransferring, setIsTransferring] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressMessage, setProgressMessage] = useState('');
    const [transfers, setTransfers] = useState([]);

    const prepareTransferProgress = useCallback((message) => {
        setIsTransferring(true);
        setProgress(0);
        setProgressMessage(message);
    }, []);

    const stopTransferProgress = useCallback(() => {
        setIsTransferring(false);
    }, []);

    useEffect(() => {
        const activeTransferIds = normalizeTransferIds(transferIds).map(String);
        if (!activeTransferIds.length) return undefined;

        const socket = io(API_ORIGIN, { withCredentials: true });
        const snapshots = new Map(
            activeTransferIds.map((transferId) => [transferId, buildInitialSnapshot(transferId)])
        );
        const notifiedStatuses = new Map();

        const publish = () => {
            const list = [...snapshots.values()];
            const running = list.filter((snapshot) => !isTerminal(snapshot));
            const completedCount = list.filter((snapshot) => snapshot.status === 'completed').length;
            const failedCount = list.filter((snapshot) => snapshot.status === 'failed').length;
            const totalProgress = list.reduce((sum, snapshot) => sum + (snapshot.progress || 0), 0);

            setTransfers(list);
            setProgress(Math.round(totalProgress / list.length));
            setIsTransferring(running.length > 0);

            if (list.length === 1) {
                setProgressMessage(list[0].message || '');
            } else if (running.length) {
                setProgressMessage(`${completedCount}/${list.length} playlists concluídas. ${running.length} em andamento.`);
            } else {
                setProgressMessage(failedCount
                    ? `${completedCount}/${list.length} playlists concluídas. ${failedCount} falharam.`
                    : `${completedCount}/${list.length} playlists concluídas.`);
            }
        };

        const notifyStatusChange = (snapshot) => {
            const previous = notifiedStatuses.get(snapshot.transferId);
            notifiedStatuses.set(snapshot.transferId, snapshot.status);
            if (!previous || previous === snapshot.status) return;

            const name = snapshot.playlistName ? `"${snapshot.playlistName}"` : 'A transferência';
            if (snapshot.status === 'paused' && snapshot.pauseReason === 'rate_limited') {
                toast(`${name} foi pausada: a plataforma limitou as buscas. Ela volta sozinha.`);
            }
            if (snapshot.status === 'needs_auth') {
                toast.error(`${name} precisa que você reconecte a integração para continuar.`);
            }
        };

        socket.on('connect', () => {
            activeTransferIds.forEach((transferId) => socket.emit('subscribe_transfer', transferId));
        });

        socket.on('transfer_update', (data) => {
            const transferId = String(data.transferId || '');
            if (!snapshots.has(transferId)) return;

            const snapshot = {
                ...snapshots.get(transferId),
                ...data,
                transferId,
                status: data.status || snapshots.get(transferId).status,
            };
            snapshots.set(transferId, snapshot);
            notifyStatusChange(snapshot);
            publish();

            if (!isTerminal(snapshot)) return;

            const list = [...snapshots.values()];
            if (!list.every(isTerminal)) return;

            const failedCount = list.filter((item) => item.status === 'failed').length;
            if (failedCount) {
                toast.error(`${failedCount}/${list.length} playlists falharam.`);
            } else {
                toast.success(list.length === 1 ? snapshot.message : `${list.length} playlists migradas.`);
            }
            socket.disconnect();
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
        transfers,
        prepareTransferProgress,
        stopTransferProgress,
    };
};
