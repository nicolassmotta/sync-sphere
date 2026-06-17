import { UnrecoverableError } from '../../errors/UnrecoverableError.js';
import { TRANSFER_DIRECTIONS } from '../../constants/transferDirections.js';
import {
    createSpotifyDestinationClient,
    createSpotifySearchClient,
    getSpotifyPlaylistSnapshot,
    SpotifyPlaylistAccessError,
} from '../spotifyService.js';
import {
    createYoutubeMusicSearchClient,
    createYoutubeMusicCookieDestinationClient,
    getYoutubeMusicPlaylistSnapshot,
} from '../youtubeMusicService.js';
import logger from '../../utils/logger.js';

const buildYoutubePlaylistDescription = (spotifyPlaylist) => {
    const description = spotifyPlaylist.description?.trim();
    return description || `Migrada do Spotify pelo SyncSphere. Origem: ${spotifyPlaylist.id}`;
};

const buildSpotifyPlaylistDescription = (youtubePlaylist) => {
    const description = youtubePlaylist.description?.trim();
    return description || `Migrada do YouTube Music pelo SyncSphere. Origem: ${youtubePlaylist.id}`;
};

const createYoutubeDestinationClient = ({ userId }) => {
    return createYoutubeMusicCookieDestinationClient({ userId });
};

export default class TransferProcessor {
    constructor({ repository, publisher, trackMatcher }) {
        this.repository = repository;
        this.publisher = publisher;
        this.trackMatcher = trackMatcher;
    }

    async process(job) {
        const {
            transferId,
            userId,
            sourcePlaylistId,
            direction: jobDirection = TRANSFER_DIRECTIONS.SPOTIFY_TO_YOUTUBE,
        } = job.data;
        let transferRecord;

        logger.info(`[Trabalhador] Iniciando tarefa ${job.id} para transferência ${transferId} (${jobDirection}).`);

        try {
            transferRecord = await this.repository.getTransferForProcessing(transferId);
            await this.repository.getUserWithTransferSecrets(userId);

            const direction = transferRecord.direction || jobDirection;
            if (direction === TRANSFER_DIRECTIONS.YOUTUBE_TO_SPOTIFY) {
                await this.processYoutubeToSpotify({ transferId, userId, sourcePlaylistId, transferRecord });
                return;
            }

            await this.processSpotifyToYoutube({ transferId, userId, sourcePlaylistId, transferRecord });
        } catch (error) {
            logger.error(`[Trabalhador] Falha crítica na transferência ${transferId}: ${error.message}`);
            const isPermanentTransferError = error instanceof SpotifyPlaylistAccessError || error?.isPermanentTransferError;

            if (transferRecord) {
                await this.repository.markFailed(
                    transferRecord,
                    error.message || 'Falha crítica na transferência.'
                );

                this.publisher.emit(transferId, {
                    status: 'failed',
                    message: transferRecord.lastMessage,
                    progress: 100,
                });
            }

            throw isPermanentTransferError
                ? new UnrecoverableError(error.message)
                : error;
        }
    }

    async processSpotifyToYoutube({ transferId, userId, sourcePlaylistId, transferRecord }) {
        await this.repository.update(transferRecord, {
            status: 'processing',
            lastMessage: 'Lendo playlist no Spotify.',
            processedTracks: 0,
            errors: [],
        });
        this.publisher.emit(transferId, {
            status: 'processing',
            message: 'Lendo playlist no Spotify...',
            progress: 5,
        });

        const spotifyPlaylist = await getSpotifyPlaylistSnapshot({
            playlistId: sourcePlaylistId,
            userId,
        });

        await this.repository.update(transferRecord, {
            playlistName: spotifyPlaylist.name,
            totalTracks: spotifyPlaylist.totalTracks,
            lastMessage: `Playlist "${spotifyPlaylist.name}" carregada com ${spotifyPlaylist.totalTracks} faixas.`,
        });

        if (!spotifyPlaylist.tracks.length) {
            throw new Error('A playlist do Spotify não possui faixas migráveis.');
        }

        this.publisher.emit(transferId, {
            message: 'Procurando correspondências no YouTube Music...',
            progress: 10,
        });

        const youtubeClient = createYoutubeMusicSearchClient();
        const matchedVideoIds = await this.trackMatcher.matchPlaylistTracks({
            searchClient: youtubeClient,
            tracks: spotifyPlaylist.tracks,
            transferRecord,
            providerLabel: 'YouTube Music',
            noConfidentMatchReason: 'Nenhum resultado confiável encontrado no YouTube Music.',
            getMatchId: (match) => match?.videoId,
            stage: 'youtube-matching',
            onTrackProgress: ({ track, progress }) => {
                this.publisher.emit(transferId, {
                    message: `Procurando no YouTube Music: ${track.name} - ${track.artist}`,
                    progress,
                });
            },
            onCheckpoint: () => this.repository.save(transferRecord),
        });

        if (!matchedVideoIds.length) {
            const noMatchesError = new Error('Nenhuma faixa da playlist foi encontrada no YouTube Music.');
            noMatchesError.isPermanentTransferError = true;
            throw noMatchesError;
        }

        this.publisher.emit(transferId, {
            message: transferRecord.targetPlaylistId
                ? 'Retomando playlist privada já criada no YouTube Music...'
                : 'Criando playlist privada no YouTube Music...',
            progress: 85,
        });

        const destinationClient = createYoutubeDestinationClient({ userId });
        const targetPlaylistDescription = buildYoutubePlaylistDescription(spotifyPlaylist);
        let targetPlaylistId = transferRecord.targetPlaylistId;

        if (!targetPlaylistId) {
            targetPlaylistId = await destinationClient.createPlaylist({
                title: spotifyPlaylist.name,
                description: targetPlaylistDescription,
            });

            await this.repository.update(transferRecord, {
                targetPlaylistId,
                targetPlaylistUrl: destinationClient.getPlaylistUrl(targetPlaylistId),
                targetPlaylistDescription,
                targetPlaylistImageUrl: spotifyPlaylist.imageUrl,
                targetPlaylistImageSynced: false,
                lastMessage: 'Playlist criada. Inserindo faixas encontradas.',
            });
        } else {
            await this.repository.update(transferRecord, {
                targetPlaylistUrl: transferRecord.targetPlaylistUrl || destinationClient.getPlaylistUrl(targetPlaylistId),
                targetPlaylistDescription: transferRecord.targetPlaylistDescription || targetPlaylistDescription,
                targetPlaylistImageUrl: transferRecord.targetPlaylistImageUrl || spotifyPlaylist.imageUrl,
                lastMessage: 'Playlist já criada. Retomando inserção de faixas encontradas.',
            });
        }

        if (spotifyPlaylist.imageUrl && destinationClient.setPlaylistImage && !transferRecord.targetPlaylistImageSynced) {
            try {
                this.publisher.emit(transferId, {
                    message: 'Copiando capa da playlist...',
                    progress: 88,
                });

                await destinationClient.setPlaylistImage({
                    playlistId: targetPlaylistId,
                    imageUrl: spotifyPlaylist.imageUrl,
                });

                await this.repository.update(transferRecord, {
                    targetPlaylistImageSynced: true,
                    lastMessage: 'Capa copiada. Inserindo faixas encontradas.',
                });
            } catch (imageError) {
                transferRecord.errors.push({
                    trackName: spotifyPlaylist.name,
                    artistName: '',
                    reason: imageError.message || 'Não foi possível copiar a capa da playlist.',
                    stage: 'youtube-playlist-image',
                });
                await this.repository.save(transferRecord);
                logger.warn(`[Trabalhador] Capa da playlist ${transferId} não foi copiada: ${imageError.message}`);
            }
        }

        this.publisher.emit(transferId, {
            message: 'Adicionando faixas na playlist criada...',
            progress: 92,
        });

        await destinationClient.addVideosToPlaylist({
            playlistId: targetPlaylistId,
            videoIds: matchedVideoIds,
        });

        await this.repository.update(transferRecord, {
            status: 'completed',
            lastMessage: `Migração concluída: ${matchedVideoIds.length}/${spotifyPlaylist.tracks.length} faixas adicionadas.`,
        });

        logger.info(`[Trabalhador] Transferência ${transferId} concluída. Sucesso: ${matchedVideoIds.length}/${spotifyPlaylist.tracks.length}.`);
        this.publisher.emit(transferId, {
            status: 'completed',
            message: 'Migração concluída no YouTube Music.',
            progress: 100,
            targetPlaylistUrl: transferRecord.targetPlaylistUrl,
        });
    }

    async processYoutubeToSpotify({ transferId, userId, sourcePlaylistId, transferRecord }) {
        await this.repository.update(transferRecord, {
            status: 'processing',
            lastMessage: 'Lendo playlist no YouTube Music.',
            processedTracks: 0,
            errors: [],
        });
        this.publisher.emit(transferId, {
            status: 'processing',
            message: 'Lendo playlist no YouTube Music...',
            progress: 5,
        });

        const youtubePlaylist = await getYoutubeMusicPlaylistSnapshot({
            playlistId: sourcePlaylistId,
        });

        await this.repository.update(transferRecord, {
            playlistName: youtubePlaylist.name,
            totalTracks: youtubePlaylist.totalTracks,
            lastMessage: `Playlist "${youtubePlaylist.name}" carregada com ${youtubePlaylist.totalTracks} faixas.`,
        });

        if (!youtubePlaylist.tracks.length) {
            throw new Error('A playlist do YouTube Music não possui faixas migráveis.');
        }

        this.publisher.emit(transferId, {
            message: 'Procurando correspondências no Spotify...',
            progress: 10,
        });

        const spotifyClient = createSpotifySearchClient({ userId });
        const matchedTrackUris = await this.trackMatcher.matchPlaylistTracks({
            searchClient: spotifyClient,
            tracks: youtubePlaylist.tracks,
            transferRecord,
            providerLabel: 'Spotify',
            noConfidentMatchReason: 'Nenhum resultado confiável encontrado no Spotify.',
            getMatchId: (match) => match?.uri,
            stage: 'spotify-matching',
            onTrackProgress: ({ track, progress }) => {
                this.publisher.emit(transferId, {
                    message: `Procurando no Spotify: ${track.name} - ${track.artist}`,
                    progress,
                });
            },
            onCheckpoint: () => this.repository.save(transferRecord),
        });

        if (!matchedTrackUris.length) {
            const noMatchesError = new Error('Nenhuma faixa da playlist foi encontrada no Spotify.');
            noMatchesError.isPermanentTransferError = true;
            throw noMatchesError;
        }

        this.publisher.emit(transferId, {
            message: transferRecord.targetPlaylistId
                ? 'Retomando playlist privada já criada no Spotify...'
                : 'Criando playlist privada no Spotify...',
            progress: 85,
        });

        const destinationClient = createSpotifyDestinationClient({ userId });
        const targetPlaylistDescription = buildSpotifyPlaylistDescription(youtubePlaylist);
        let targetPlaylistId = transferRecord.targetPlaylistId;

        if (!targetPlaylistId) {
            targetPlaylistId = await destinationClient.createPlaylist({
                title: youtubePlaylist.name,
                description: targetPlaylistDescription,
            });

            await this.repository.update(transferRecord, {
                targetPlaylistId,
                targetPlaylistUrl: destinationClient.getPlaylistUrl(targetPlaylistId),
                targetPlaylistDescription,
                targetPlaylistImageUrl: youtubePlaylist.imageUrl,
                targetPlaylistImageSynced: false,
                lastMessage: 'Playlist criada. Inserindo faixas encontradas.',
            });
        } else {
            await this.repository.update(transferRecord, {
                targetPlaylistUrl: transferRecord.targetPlaylistUrl || destinationClient.getPlaylistUrl(targetPlaylistId),
                targetPlaylistDescription: transferRecord.targetPlaylistDescription || targetPlaylistDescription,
                targetPlaylistImageUrl: transferRecord.targetPlaylistImageUrl || youtubePlaylist.imageUrl,
                lastMessage: 'Playlist já criada. Retomando inserção de faixas encontradas.',
            });
        }

        this.publisher.emit(transferId, {
            message: 'Adicionando faixas na playlist criada...',
            progress: 92,
        });

        await destinationClient.addTracksToPlaylist({
            playlistId: targetPlaylistId,
            trackUris: matchedTrackUris,
        });

        await this.repository.update(transferRecord, {
            status: 'completed',
            lastMessage: `Migração concluída: ${matchedTrackUris.length}/${youtubePlaylist.tracks.length} faixas adicionadas.`,
        });

        logger.info(`[Trabalhador] Transferência ${transferId} concluída. Sucesso: ${matchedTrackUris.length}/${youtubePlaylist.tracks.length}.`);
        this.publisher.emit(transferId, {
            status: 'completed',
            message: 'Migração concluída no Spotify.',
            progress: 100,
            targetPlaylistUrl: transferRecord.targetPlaylistUrl,
        });
    }
}
