import { UnrecoverableError } from '../../errors/UnrecoverableError.js';
import {
    classifyProviderError,
    ERROR_KINDS,
    getRetryAfterMs,
    TransferNeedsAuthError,
    TransferPausedError,
} from '../../errors/providerErrors.js';
import { resolveTransferProviders, TRANSFER_DIRECTIONS } from '../../constants/transferDirections.js';
import { getProvider } from '../../providers/registry.js';
import logger from '../../utils/logger.js';
import { getPauseDelayMs } from './TrackMatcher.js';
import TransferMetrics from './TransferMetrics.js';
import { buildTransferSnapshot, TRANSFER_PHASES } from './transferProgressSnapshot.js';
import {
    buildTransferErrors,
    buildTransferTracks,
    getTracksToInsert,
    loadTransferTracks,
    saveTransferTracks,
    summarizeTransferTracks,
    TRACK_STATUS,
} from './TransferTrackStore.js';

// Intervalo entre rodadas automáticas para faixas com falha temporária.
export const RETRY_ROUND_DELAYS_MS = [30_000, 60_000, 2 * 60_000, 5 * 60_000, 10 * 60_000];
const RECENT_TRACKS_LIMIT = 5;

const buildDescription = (sourceLabel) => (playlist) => {
    const description = playlist.description?.trim();
    return description || `Migrada do ${sourceLabel} pelo SyncSphere. Origem: ${playlist.id}`;
};

/**
 * Monta o fluxo da transferência a partir dos provedores de origem e destino.
 * O processamento é o mesmo para qualquer par: ler origem, buscar no
 * destino, criar playlist, inserir.
 */
const buildTransferConfig = ({ transferRecord, direction }) => {
    const providers = resolveTransferProviders({
        sourceProvider: transferRecord?.sourceProvider,
        targetProvider: transferRecord?.targetProvider,
        direction: transferRecord?.direction || direction,
    });
    const source = getProvider(providers.sourceProvider);
    const target = getProvider(providers.targetProvider);

    return {
        sourceLabel: source.label,
        targetLabel: target.label,
        targetProvider: target.id,
        stage: `${target.id}-matching`,
        noConfidentMatchReason: `Nenhum resultado confiável encontrado no ${target.label}.`,
        searchDelayMs: target.getSearchDelayMs?.(),
        loadSource: ({ playlistId, userId }) => source.getPlaylistSnapshot({ playlistId, userId }),
        createSearchClient: ({ userId }) => target.createSearchClient({ userId }),
        createDestinationClient: ({ userId }) => target.createDestinationClient({ userId }),
        getMatchId: target.getMatchId,
        addTracks: (client, { playlistId, ids }) => client.addTracks({ playlistId, ids }),
        buildDescription: buildDescription(source.label),
    };
};

const permanentError = (message) => {
    const error = new Error(message);
    error.isPermanentTransferError = true;
    return error;
};

export default class TransferProcessor {
    constructor({
        repository,
        publisher,
        trackMatcher,
        trackStore = { load: loadTransferTracks, save: saveTransferTracks },
        createMetrics = (options) => new TransferMetrics(options),
        getQueuePosition = () => null,
        now = () => Date.now(),
    }) {
        this.repository = repository;
        this.publisher = publisher;
        this.trackMatcher = trackMatcher;
        this.trackStore = trackStore;
        this.createMetrics = createMetrics;
        this.getQueuePosition = getQueuePosition;
        this.now = now;
        this.live = new Map();
    }

    getLive(transferId) {
        if (!this.live.has(transferId)) {
            this.live.set(transferId, { currentTrack: null, recentTracks: [], lastStatus: null });
        }
        return this.live.get(transferId);
    }

    publish(transferId, transferRecord) {
        const live = this.getLive(transferId);
        const statusChanged = live.lastStatus !== transferRecord.status;
        live.lastStatus = transferRecord.status;

        this.publisher.emit(
            transferId,
            buildTransferSnapshot(transferRecord, {
                currentTrack: live.currentTrack,
                recentTracks: live.recentTracks,
                queuePosition: this.getQueuePosition(transferId),
            }),
            { force: statusChanged }
        );
    }

    applyCounts(transferRecord, tracks, { metrics, stage, withErrors = false } = {}) {
        const counts = summarizeTransferTracks(tracks);
        transferRecord.totalTracks = counts.total;
        transferRecord.analyzedCount = counts.analyzed;
        transferRecord.matchedCount = counts.matched;
        transferRecord.notFoundCount = counts.notFound;
        transferRecord.retryQueuedCount = counts.retryQueued;
        transferRecord.failedCount = counts.failed;
        transferRecord.processedTracks = counts.matched;

        if (metrics) {
            const pendingInserts = tracks.filter((track) => track.status === TRACK_STATUS.MATCHED && !track.inserted).length;
            transferRecord.etaSeconds = metrics.estimateRemainingSeconds({
                remainingSearches: counts.pending,
                pendingInserts,
            });
            transferRecord.tracksPerMinute = metrics.tracksPerMinute();
        }

        if (withErrors) {
            transferRecord.errors = buildTransferErrors(tracks, stage);
        }

        return counts;
    }

    async process(job) {
        const {
            transferId,
            userId,
            sourcePlaylistId,
            direction: jobDirection = TRANSFER_DIRECTIONS.SPOTIFY_TO_YOUTUBE,
        } = job.data;
        let transferRecord;
        let config = { sourceLabel: 'origem', targetLabel: 'destino' };

        logger.info(`[Trabalhador] Iniciando tarefa ${job.id} para transferência ${transferId} (${jobDirection}).`);

        try {
            transferRecord = await this.repository.getTransferForProcessing(transferId);
            await this.repository.getUserWithTransferSecrets(userId);
            config = buildTransferConfig({ transferRecord, direction: jobDirection });

            return await this.run({ transferId, userId, sourcePlaylistId, transferRecord, config });
        } catch (error) {
            if (transferRecord) {
                const kind = error instanceof TransferPausedError || error instanceof TransferNeedsAuthError
                    ? null
                    : classifyProviderError(error);

                if (error instanceof TransferPausedError || kind === ERROR_KINDS.RATE_LIMITED) {
                    return this.pause(transferId, transferRecord, error);
                }

                if (error instanceof TransferNeedsAuthError || kind === ERROR_KINDS.AUTH) {
                    return this.waitForAuth(transferId, transferRecord, error, config);
                }
            }

            logger.error(`[Trabalhador] Falha crítica na transferência ${transferId}: ${error.message}`);
            const isPermanentTransferError = error?.name === 'SpotifyPlaylistAccessError'
                || error?.isPermanentTransferError
                || classifyProviderError(error) === ERROR_KINDS.PERMANENT;

            if (transferRecord) {
                transferRecord.phase = TRANSFER_PHASES.DONE;
                transferRecord.etaSeconds = null;
                await this.repository.markFailed(
                    transferRecord,
                    error.message || 'Falha crítica na transferência.'
                );
                this.publish(transferId, transferRecord);
            }

            throw isPermanentTransferError
                ? new UnrecoverableError(error.message)
                : error;
        } finally {
            this.live.delete(transferId);
        }
    }

    async loadTracks({ transferId, userId, sourcePlaylistId, transferRecord, config }) {
        const storedTracks = this.trackStore.load(transferId);
        if (storedTracks?.length) {
            await this.repository.update(transferRecord, {
                status: 'processing',
                resumeAt: null,
                pauseReason: null,
                lastMessage: 'Retomando a transferência de onde parou.',
            });
            return storedTracks;
        }

        await this.repository.update(transferRecord, {
            status: 'processing',
            phase: TRANSFER_PHASES.READING,
            resumeAt: null,
            pauseReason: null,
            lastMessage: `Lendo playlist no ${config.sourceLabel}...`,
            processedTracks: 0,
            errors: [],
        });
        this.publish(transferId, transferRecord);

        const playlist = await config.loadSource({ playlistId: sourcePlaylistId, userId });

        await this.repository.update(transferRecord, {
            playlistName: playlist.name,
            totalTracks: playlist.tracks.length,
            sourceTotalTracks: playlist.totalTracks,
            sourcePlaylistDescription: playlist.description || '',
            sourcePlaylistImageUrl: playlist.imageUrl || null,
            lastMessage: `Playlist "${playlist.name}" carregada com ${playlist.tracks.length} faixas.`,
        });

        if (!playlist.tracks.length) {
            throw new Error(`A playlist do ${config.sourceLabel} não possui faixas migráveis.`);
        }

        const tracks = buildTransferTracks(playlist.tracks);
        this.trackStore.save(transferId, tracks);
        return tracks;
    }

    async run({ transferId, userId, sourcePlaylistId, transferRecord, config }) {
        const tracks = await this.loadTracks({ transferId, userId, sourcePlaylistId, transferRecord, config });
        const live = this.getLive(transferId);
        const metrics = this.createMetrics({
            provider: config.targetProvider,
            concurrency: this.trackMatcher.searchConcurrency,
        });

        transferRecord.phase = TRANSFER_PHASES.MATCHING;
        transferRecord.lastMessage = `Procurando correspondências no ${config.targetLabel}...`;
        this.applyCounts(transferRecord, tracks, { metrics, stage: config.stage, withErrors: true });
        await this.repository.save(transferRecord);
        this.publish(transferId, transferRecord);

        const saveCheckpoint = async () => {
            this.trackStore.save(transferId, tracks);
            this.applyCounts(transferRecord, tracks, { metrics, stage: config.stage, withErrors: true });
            await this.repository.save(transferRecord);
        };

        try {
            await this.trackMatcher.matchTracks({
                searchClient: config.createSearchClient({ userId }),
                tracks,
                getMatchId: config.getMatchId,
                providerLabel: config.targetLabel,
                noConfidentMatchReason: config.noConfidentMatchReason,
                pauseCount: transferRecord.pauseCount || 0,
                delayMs: config.searchDelayMs,
                metrics,
                onTrackStart: (track) => {
                    live.currentTrack = { index: track.index, name: track.name, artist: track.artist };
                    transferRecord.lastMessage = `Procurando no ${config.targetLabel}: ${track.name} - ${track.artist}`;
                    this.publish(transferId, transferRecord);
                },
                onTrackDone: (track) => {
                    live.recentTracks = [
                        { index: track.index, name: track.name, artist: track.artist, status: track.status },
                        ...live.recentTracks,
                    ].slice(0, RECENT_TRACKS_LIMIT);
                    const counts = this.applyCounts(transferRecord, tracks, { metrics });
                    transferRecord.lastMessage = `${counts.analyzed}/${counts.total} faixas analisadas.`;
                    this.publish(transferId, transferRecord);
                },
                onCheckpoint: saveCheckpoint,
            });
        } finally {
            metrics.persist();
        }

        live.currentTrack = null;
        transferRecord.pauseCount = 0;
        let counts = this.applyCounts(transferRecord, tracks, { metrics, stage: config.stage, withErrors: true });

        if (!counts.matched) {
            if (counts.retryQueued) return this.scheduleRetryRound(transferId, transferRecord, counts);

            const failedTrack = tracks.find((track) => track.status === TRACK_STATUS.FAILED);
            throw permanentError(failedTrack
                ? `Falha ao buscar faixas no ${config.targetLabel}: ${failedTrack.lastError}`
                : `Nenhuma faixa da playlist foi encontrada no ${config.targetLabel}.`);
        }

        const tracksToInsert = getTracksToInsert(tracks);
        if (tracksToInsert.length) {
            await this.insertTracks({ transferId, userId, transferRecord, config, tracks, tracksToInsert, metrics });
        }

        counts = this.applyCounts(transferRecord, tracks, { metrics, stage: config.stage, withErrors: true });
        if (counts.retryQueued) return this.scheduleRetryRound(transferId, transferRecord, counts);

        const pendingNote = counts.failed
            ? ` ${counts.failed} ${counts.failed === 1 ? 'faixa ficou' : 'faixas ficaram'} nas pendências.`
            : '';
        await this.repository.update(transferRecord, {
            status: 'completed',
            phase: TRANSFER_PHASES.DONE,
            etaSeconds: 0,
            resumeAt: null,
            pauseReason: null,
            retryRound: 0,
            lastMessage: `Migração concluída no ${config.targetLabel}: ${counts.matched}/${counts.total} faixas adicionadas.${pendingNote}`,
        });

        logger.info(`[Trabalhador] Transferência ${transferId} concluída. Sucesso: ${counts.matched}/${counts.total}.`);
        this.publish(transferId, transferRecord);
        return { status: 'completed' };
    }

    async ensureTargetPlaylist({ transferId, transferRecord, config, destinationClient }) {
        const targetPlaylistDescription = config.buildDescription({
            id: transferRecord.sourcePlaylistId,
            description: transferRecord.sourcePlaylistDescription,
        });
        let targetPlaylistId = transferRecord.targetPlaylistId;

        if (!targetPlaylistId) {
            transferRecord.lastMessage = `Criando playlist privada no ${config.targetLabel}...`;
            this.publish(transferId, transferRecord);

            targetPlaylistId = await destinationClient.createPlaylist({
                title: transferRecord.playlistName,
                description: targetPlaylistDescription,
            });

            await this.repository.update(transferRecord, {
                targetPlaylistId,
                targetPlaylistUrl: destinationClient.getPlaylistUrl(targetPlaylistId),
                targetPlaylistDescription,
                targetPlaylistImageUrl: transferRecord.sourcePlaylistImageUrl || null,
                targetPlaylistImageSynced: false,
                lastMessage: 'Playlist criada. Inserindo faixas encontradas.',
            });
        } else {
            await this.repository.update(transferRecord, {
                targetPlaylistUrl: transferRecord.targetPlaylistUrl || destinationClient.getPlaylistUrl(targetPlaylistId),
                targetPlaylistDescription: transferRecord.targetPlaylistDescription || targetPlaylistDescription,
                targetPlaylistImageUrl: transferRecord.targetPlaylistImageUrl || transferRecord.sourcePlaylistImageUrl || null,
                lastMessage: 'Playlist já criada. Inserindo faixas encontradas.',
            });
        }

        const imageUrl = transferRecord.targetPlaylistImageUrl;
        if (imageUrl && destinationClient.setPlaylistImage && !transferRecord.targetPlaylistImageSynced) {
            try {
                await destinationClient.setPlaylistImage({ playlistId: targetPlaylistId, imageUrl });
                await this.repository.update(transferRecord, { targetPlaylistImageSynced: true });
            } catch (imageError) {
                transferRecord.targetPlaylistImageError = imageError.message || 'Não foi possível copiar a capa da playlist.';
                logger.warn(`[Trabalhador] Capa da playlist ${transferId} não foi copiada: ${imageError.message}`);
            }
        }

        return targetPlaylistId;
    }

    async insertTracks({ transferId, userId, transferRecord, config, tracks, tracksToInsert, metrics }) {
        transferRecord.phase = TRANSFER_PHASES.INSERTING;
        this.publish(transferId, transferRecord);

        const destinationClient = config.createDestinationClient({ userId });
        const playlistId = await this.ensureTargetPlaylist({ transferId, transferRecord, config, destinationClient });

        transferRecord.lastMessage = `Adicionando ${tracksToInsert.length} faixas na playlist...`;
        this.publish(transferId, transferRecord);

        const startedAt = this.now();
        await config.addTracks(destinationClient, {
            playlistId,
            ids: tracksToInsert.map((track) => track.targetId),
        });
        const chunks = Math.max(1, Math.ceil(tracksToInsert.length / (metrics.chunkSize || 100)));
        metrics.recordInsertChunk((this.now() - startedAt) / chunks);

        tracksToInsert.forEach((track) => {
            track.inserted = true;
        });
        this.trackStore.save(transferId, tracks);
    }

    async scheduleRetryRound(transferId, transferRecord, counts) {
        const round = (transferRecord.retryRound || 0) + 1;
        const delay = RETRY_ROUND_DELAYS_MS[Math.min(round - 1, RETRY_ROUND_DELAYS_MS.length - 1)];
        const resumeAt = new Date(this.now() + delay);

        await this.repository.update(transferRecord, {
            status: 'paused',
            pauseReason: 'retry_scheduled',
            resumeAt: resumeAt.toISOString(),
            retryRound: round,
            lastMessage: `${counts.retryQueued} ${counts.retryQueued === 1 ? 'faixa teve' : 'faixas tiveram'} falha temporária. Nova tentativa automática em instantes.`,
        });
        this.publish(transferId, transferRecord);
        return { status: 'paused', rescheduleAt: resumeAt };
    }

    async pause(transferId, transferRecord, error) {
        const pauseCount = transferRecord.pauseCount || 0;
        const resumeAt = error.resumeAt
            || new Date(this.now() + getPauseDelayMs(pauseCount, getRetryAfterMs(error)));

        logger.warn(`[Trabalhador] Transferência ${transferId} pausada até ${resumeAt.toISOString()}: ${error.message}`);
        await this.repository.update(transferRecord, {
            status: 'paused',
            pauseReason: ERROR_KINDS.RATE_LIMITED,
            resumeAt: resumeAt.toISOString(),
            pauseCount: pauseCount + 1,
            etaSeconds: transferRecord.etaSeconds ?? null,
            lastMessage: `${error.message} Retomada automática programada.`,
        });
        this.publish(transferId, transferRecord);
        return { status: 'paused', rescheduleAt: resumeAt };
    }

    async waitForAuth(transferId, transferRecord, error, config) {
        const message = error instanceof TransferNeedsAuthError
            ? error.message
            : `A conexão precisa ser renovada (${config.sourceLabel} ou ${config.targetLabel}): ${error.message}`;

        logger.warn(`[Trabalhador] Transferência ${transferId} aguardando reconexão: ${error.message}`);
        await this.repository.update(transferRecord, {
            status: 'needs_auth',
            pauseReason: ERROR_KINDS.AUTH,
            resumeAt: null,
            lastMessage: message,
        });
        this.publish(transferId, transferRecord);
        return { status: 'needs_auth' };
    }
}
