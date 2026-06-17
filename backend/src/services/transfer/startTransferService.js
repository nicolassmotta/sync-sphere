import Transfer from '../../models/Transfer.js';
import { appEnv, isTest } from '../../config/env.js';
import {
    getTransferDirectionProviders,
    TRANSFER_DIRECTIONS,
} from '../../constants/transferDirections.js';
import AppError from '../../utils/AppError.js';
import { mapWithConcurrency } from '../../utils/concurrency.js';
import { addTransferJob } from '../queueService.js';
import {
    ensureSpotifyDestinationReady,
    getSpotifyPlaylistTracksPreview,
    normalizeSpotifyPlaylistId,
} from '../spotifyService.js';
import {
    getYoutubeMusicPlaylistTracksPreview,
    isYoutubeMusicCookieDestinationConfigured,
    normalizeYoutubeMusicPlaylistId,
    validateYoutubeMusicCookieDestinationConfig,
} from '../youtubeMusicService.js';

const SPOTIFY_PLAYLIST_VALIDATION_CONCURRENCY = 3;

const ensureLocalWorkerAvailable = () => {
    const workerDisabled = String(process.env.WORKER_ENABLED || '').trim().toLowerCase() === 'false';

    if (workerDisabled && appEnv === 'dev' && !isTest) {
        throw new AppError(
            'O trabalhador local está desativado (WORKER_ENABLED=false). Ative WORKER_ENABLED=true no backend/.env e reinicie o servidor para processar migrações.',
            503
        );
    }
};

const normalizeSourcePlaylistIds = ({ direction, sourcePlaylistId, sourcePlaylistIds }) => {
    const rawSourcePlaylistIds = sourcePlaylistIds?.length
        ? sourcePlaylistIds
        : [sourcePlaylistId].filter(Boolean);
    const normalizePlaylistId = direction === TRANSFER_DIRECTIONS.YOUTUBE_TO_SPOTIFY
        ? normalizeYoutubeMusicPlaylistId
        : normalizeSpotifyPlaylistId;

    return [...new Set(rawSourcePlaylistIds.map((playlistId) => normalizePlaylistId(playlistId.trim())))];
};

const ensureYoutubeMusicDestinationConfigured = () => {
    if (!isYoutubeMusicCookieDestinationConfigured()) {
        throw new AppError('Configure YTMUSIC_COOKIE no backend/.env para criar playlists no YouTube Music.', 400);
    }

    validateYoutubeMusicCookieDestinationConfig();
};

const ensureYoutubeMusicSourceConfigured = () => {
    if (!isYoutubeMusicCookieDestinationConfigured()) {
        throw new AppError('Configure YTMUSIC_COOKIE no backend/.env para ler playlists do YouTube Music.', 400);
    }

    validateYoutubeMusicCookieDestinationConfig();
};

const ensureSpotifyDestinationConfigured = async ({ userId }) => {
    try {
        await ensureSpotifyDestinationReady({ userId });
    } catch (error) {
        throw new AppError(
            error.message || 'Conecte o Spotify com permissão de escrita para criar playlists.',
            400
        );
    }
};

const ensureSpotifyPlaylistsReadable = async ({ userId, playlistIds }) => {
    const checks = await mapWithConcurrency(
        playlistIds,
        async (playlistId) => {
            try {
                await getSpotifyPlaylistTracksPreview({ playlistId, userId, limit: 1 });
                return { playlistId, readable: true };
            } catch (error) {
                return {
                    playlistId,
                    readable: false,
                    message: error.message || 'Não foi possível validar as faixas da playlist no Spotify.',
                };
            }
        },
        SPOTIFY_PLAYLIST_VALIDATION_CONCURRENCY
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

    throw new AppError(`Algumas playlists não puderam ser lidas pelo Spotify antes da fila. ${details}`, 400);
};

const ensureYoutubeMusicPlaylistsReadable = async ({ playlistIds }) => {
    const checks = await mapWithConcurrency(
        playlistIds,
        async (playlistId) => {
            try {
                await getYoutubeMusicPlaylistTracksPreview({ playlistId, limit: 1 });
                return { playlistId, readable: true };
            } catch (error) {
                return {
                    playlistId,
                    readable: false,
                    message: error.message || 'Não foi possível validar as faixas da playlist no YouTube Music.',
                };
            }
        },
        SPOTIFY_PLAYLIST_VALIDATION_CONCURRENCY
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

    throw new AppError(`Algumas playlists não puderam ser lidas no YouTube Music antes da fila. ${details}`, 400);
};

export const queuePlaylistTransfers = async ({
    userId,
    direction = TRANSFER_DIRECTIONS.SPOTIFY_TO_YOUTUBE,
    sourcePlaylistId,
    sourcePlaylistIds,
}) => {
    const normalizedPlaylistIds = normalizeSourcePlaylistIds({ direction, sourcePlaylistId, sourcePlaylistIds });
    const { sourceProvider, targetProvider } = getTransferDirectionProviders(direction);

    if (!normalizedPlaylistIds.length) {
        throw new AppError('Selecione ao menos uma playlist de origem.', 400);
    }

    ensureLocalWorkerAvailable();

    if (direction === TRANSFER_DIRECTIONS.YOUTUBE_TO_SPOTIFY) {
        ensureYoutubeMusicSourceConfigured();
        await ensureSpotifyDestinationConfigured({ userId });
        await ensureYoutubeMusicPlaylistsReadable({ playlistIds: normalizedPlaylistIds });
    } else {
        ensureYoutubeMusicDestinationConfigured();
        await ensureSpotifyPlaylistsReadable({ userId, playlistIds: normalizedPlaylistIds });
    }

    const queuedTransfers = await Transfer.insertMany(
        normalizedPlaylistIds.map((playlistId) => ({
            user: userId,
            sourcePlaylistId: playlistId,
            sourceProvider,
            targetProvider,
            direction,
            playlistName: 'Playlist de migração',
            lastMessage: 'Transferência criada e aguardando fila.',
        }))
    );

    await Promise.all(
        queuedTransfers.map((transfer) =>
            addTransferJob(transfer._id, userId, transfer.sourcePlaylistId, direction)
        )
    );

    return {
        transfers: queuedTransfers,
        playlistIds: normalizedPlaylistIds,
    };
};
