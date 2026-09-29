import Transfer from '../../models/Transfer.js';
import { appEnv, isTest } from '../../config/env.js';
import { resolveTransferProviders } from '../../constants/transferDirections.js';
import { getProvider } from '../../providers/registry.js';
import AppError from '../../utils/AppError.js';
import { mapWithConcurrency } from '../../utils/concurrency.js';
import { addTransferJob } from '../queueService.js';

const PLAYLIST_VALIDATION_CONCURRENCY = 3;

const ensureLocalWorkerAvailable = () => {
    const workerDisabled = String(process.env.WORKER_ENABLED || '').trim().toLowerCase() === 'false';

    if (workerDisabled && appEnv === 'dev' && !isTest) {
        throw new AppError(
            'O trabalhador local está desativado (WORKER_ENABLED=false). Ative WORKER_ENABLED=true no backend/.env e reinicie o servidor para processar migrações.',
            503
        );
    }
};

const normalizeSourcePlaylistIds = ({ source, sourcePlaylistId, sourcePlaylistIds }) => {
    const rawSourcePlaylistIds = sourcePlaylistIds?.length
        ? sourcePlaylistIds
        : [sourcePlaylistId].filter(Boolean);

    return [...new Set(rawSourcePlaylistIds.map((playlistId) => source.normalizePlaylistId(playlistId.trim())))];
};

const ensureProvidersUsable = async ({ source, target, userId }) => {
    if (source.id === target.id) {
        throw new AppError('Origem e destino precisam ser plataformas diferentes.', 400);
    }
    if (!source.capabilities.read) {
        throw new AppError(`${source.label} ainda não pode ser usado como origem.`, 400);
    }
    if (!target.capabilities.write) {
        throw new AppError(`${target.label} ainda não pode ser usado como destino.`, 400);
    }

    await source.ensureReadable({ userId });
    await target.ensureWritable({ userId });
};

/**
 * Lê uma faixa de cada playlist antes de criar as transferências, para
 * recusar logo o que a plataforma de origem bloqueia.
 */
const ensurePlaylistsReadable = async ({ source, userId, playlistIds }) => {
    const checks = await mapWithConcurrency(
        playlistIds,
        async (playlistId) => {
            try {
                await source.getPlaylistPreview({ playlistId, userId, limit: 1 });
                return { playlistId, readable: true };
            } catch (error) {
                return {
                    playlistId,
                    readable: false,
                    message: error.message || `Não foi possível validar as faixas da playlist no ${source.label}.`,
                };
            }
        },
        PLAYLIST_VALIDATION_CONCURRENCY
    );

    const blockedPlaylists = checks.filter((check) => !check.readable);
    if (!blockedPlaylists.length) return;

    if (blockedPlaylists.length === 1) {
        throw new AppError(blockedPlaylists[0].message, 400);
    }

    const details = blockedPlaylists
        .slice(0, 3)
        .map((playlist) => playlist.message)
        .join(' ');

    throw new AppError(`Algumas playlists não puderam ser lidas no ${source.label} antes da fila. ${details}`, 400);
};

export const queuePlaylistTransfers = async ({
    userId,
    direction,
    sourceProvider,
    targetProvider,
    sourcePlaylistId,
    sourcePlaylistIds,
}) => {
    const providers = resolveTransferProviders({ direction, sourceProvider, targetProvider });
    const source = getProvider(providers.sourceProvider);
    const target = getProvider(providers.targetProvider);
    const normalizedPlaylistIds = normalizeSourcePlaylistIds({ source, sourcePlaylistId, sourcePlaylistIds });

    if (!normalizedPlaylistIds.length) {
        throw new AppError('Selecione ao menos uma playlist de origem.', 400);
    }

    ensureLocalWorkerAvailable();
    await ensureProvidersUsable({ source, target, userId });
    await ensurePlaylistsReadable({ source, userId, playlistIds: normalizedPlaylistIds });

    const queuedTransfers = await Transfer.insertMany(
        normalizedPlaylistIds.map((playlistId) => ({
            user: userId,
            sourcePlaylistId: playlistId,
            sourceProvider: source.id,
            targetProvider: target.id,
            direction: providers.direction,
            playlistName: 'Playlist de migração',
            lastMessage: 'Transferência criada e aguardando fila.',
        }))
    );

    await Promise.all(
        queuedTransfers.map((transfer) => addTransferJob(
            transfer._id,
            userId,
            transfer.sourcePlaylistId,
            providers.direction,
            { lane: target.id }
        ))
    );

    return {
        transfers: queuedTransfers,
        playlistIds: normalizedPlaylistIds,
    };
};
