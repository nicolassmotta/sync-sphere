import mongoose from 'mongoose';

/**
 * @typedef {Object} Transfer
 * @description Esquema de Transferência (`transferSchema`). Representa uma solicitação de migração
 * de uma playlist do Spotify conectando para a conta final de destino do usuário no Youtube Music.
 * Possui enums de `status` detalhados para serem escutados no front-end.
 */
const transferSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        sourcePlaylistId: {
            type: String,
            required: true,
        },
        targetPlaylistId: {
            type: String,
        },
        targetPlaylistUrl: {
            type: String,
        },
        targetPlaylistDescription: {
            type: String,
        },
        targetPlaylistImageUrl: {
            type: String,
        },
        targetPlaylistImageSynced: {
            type: Boolean,
            default: false,
        },
        playlistName: {
            type: String,
            required: true,
        },
        lastMessage: {
            type: String,
            default: '',
        },
        status: {
            type: String,
            enum: ['pending', 'processing', 'completed', 'failed'],
            default: 'pending',
            index: true,
        },
        totalTracks: {
            type: Number,
            default: 0,
        },
        processedTracks: {
            type: Number,
            default: 0,
        },
        errors: [
            {
                trackName: String,
                artistName: String,
                reason: String,
                stage: String,
            }
        ]
    },
    { 
        timestamps: true,
        suppressReservedKeysWarning: true 
    }
);

const Transfer = mongoose.model('Transfer', transferSchema);
export default Transfer;
