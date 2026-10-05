import { translate as text } from '../i18n';
import { useText } from '../i18n/useText';
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
    const { t } = useText();
    const [isTransferring, setIsTransferring] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressMessage, setProgressMessage] = useState('');
    const [transfers, setTransfers] = useState([]);
    const [connectionState, setConnectionState] = useState('idle');

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
        let disposed = false;
        setConnectionState('connecting');
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
                setProgressMessage(text(list[0].message || ''));
            } else if (running.length) {
                setProgressMessage(text("{{value0}}/{{value1}} playlists concluídas. {{value2}} em andamento.", { value0: completedCount, value1: list.length, value2: running.length }));
            } else {
                setProgressMessage(failedCount
                    ? text("{{value0}}/{{value1}} playlists concluídas. {{value2}} falharam.", { value0: completedCount, value1: list.length, value2: failedCount })
                    : text("{{value0}}/{{value1}} playlists concluídas.", { value0: completedCount, value1: list.length }));
            }
        };

        const notifyStatusChange = (snapshot) => {
            const previous = notifiedStatuses.get(snapshot.transferId);
            notifiedStatuses.set(snapshot.transferId, snapshot.status);
            if (!previous || previous === snapshot.status) return;

            const name = snapshot.playlistName ? `"${snapshot.playlistName}"` : text("A transferência");
            if (snapshot.status === 'paused' && snapshot.pauseReason === 'rate_limited') {
                toast(text("{{value0}} foi pausada: a plataforma limitou as buscas. Ela volta sozinha.", { value0: name }));
            }
            if (snapshot.status === 'needs_auth') {
                toast.error(text("{{value0}} precisa que você reconecte a integração para continuar.", { value0: name }));
            }
        };

        socket.on('connect', () => {
            if (disposed) return;
            setConnectionState('connected');
            activeTransferIds.forEach((transferId) => socket.emit('subscribe_transfer', transferId));
        });

        const reconnecting = () => {
            if (!disposed && ![...snapshots.values()].every(isTerminal)) setConnectionState('reconnecting');
        };
        socket.on('disconnect', reconnecting);
        socket.on('connect_error', reconnecting);

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
                toast.error(text("{{value0}}/{{value1}} playlists falharam.", { value0: failedCount, value1: list.length }));
            } else {
                toast.success(list.length === 1 ? text(snapshot.message) : text("{{value0}} playlists migradas.", { value0: list.length }));
            }
            socket.disconnect();
        });

        socket.on('transfer_error', (data) => {
            toast.error(text(data.message) || text("Falha na conexão em tempo real."));
        });

        return () => { disposed = true; socket.disconnect(); };
    }, [transferIds]);

    return {
        isTransferring,
        progress,
        progressMessage: t(progressMessage),
        transfers,
        connectionState,
        prepareTransferProgress,
        stopTransferProgress,
    };
};
