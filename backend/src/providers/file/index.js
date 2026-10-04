import AppError from '../../utils/AppError.js';
import {
    appendExportTracks,
    createExport,
    deleteImport,
    findImport,
    findExport,
    listImports,
} from './fileLibrary.js';

const TRACK_FIELDS = ['name', 'artist', 'album', 'isrc', 'durationMs'];

// No destino "arquivo" não há busca: o ID da faixa é a própria faixa serializada.
const encodeTrack = (track) => JSON.stringify(Object.fromEntries(TRACK_FIELDS.map((field) => [field, track[field] ?? null])));

const decodeTrack = (id) => {
    try {
        return JSON.parse(id);
    } catch {
        return null;
    }
};

const toSummary = (record) => ({
    id: record.id,
    name: record.name,
    description: record.description,
    ownerName: `${record.format.toUpperCase()} · ${record.filename}`,
    trackCount: record.tracks.length,
    imageUrl: null,
    externalUrl: null,
    createdAt: record.createdAt,
});

const requireImport = (playlistId) => {
    const record = findImport(playlistId);
    if (!record) {
        throw new AppError('Arquivo importado não encontrado. Importe o arquivo de novo.', 404);
    }
    return record;
};

export const getExportDownloadPath = (exportId, format = 'csv') => (
    `/api/v1/integrations/file/exports/${exportId}/download?format=${format}`
);

/**
 * Arquivo: importa CSV/JSON/M3U/TXT como origem e gera arquivo como destino.
 * Serve de ponte para qualquer app que exporte ou importe listas.
 */
const fileProvider = {
    id: 'file',
    label: 'Arquivo',
    aliases: ['arquivo'],
    auth: { type: 'file' },
    capabilities: {
        read: true,
        write: true,
        listUserPlaylists: true,
        readByLink: false,
        isrcSearch: false,
        setImage: false,
        // Arquivo -> Arquivo converte formatos (ex.: CSV do Exportify em M3U).
        sameProviderTransfer: true,
    },
    playlistUrlExample: 'Importe um arquivo CSV, JSON, M3U ou TXT',

    getSearchDelayMs() {
        return 0;
    },

    async getStatus() {
        return { connected: true, authMethod: 'file', expiresAt: null, importedPlaylists: listImports().length };
    },

    async ensureReadable() {},
    async ensureWritable() {},

    normalizePlaylistId: (input) => String(input || '').trim(),

    async listPlaylists() {
        const imports = listImports();
        return { playlists: imports.map(toSummary), total: imports.length, limit: imports.length, hasMore: false };
    },

    async getPlaylistSnapshot({ playlistId }) {
        const record = requireImport(playlistId);
        return {
            id: record.id,
            name: record.name,
            description: record.description,
            imageUrl: null,
            totalTracks: record.tracks.length,
            tracks: record.tracks.map((track, index) => ({ ...track, sourceId: `${record.id}:${index}` })),
        };
    },

    async getPlaylistPreview({ playlistId, limit = 25 }) {
        const record = requireImport(playlistId);
        const previewLimit = Math.max(1, Math.min(Number(limit) || 25, 100));
        const tracks = record.tracks.slice(0, previewLimit);
        return {
            id: record.id,
            name: record.name,
            imageUrl: null,
            totalTracks: record.tracks.length,
            returnedTracks: tracks.length,
            hasMore: record.tracks.length > tracks.length,
            tracks,
        };
    },

    createSearchClient() {
        return {
            searchBestMatch: async ({ track }) => ({ id: encodeTrack(track), matchScore: 100, matching: { decision: 'accepted', algorithmVersion: 'file-preservation-v1', reasons: ['metadata_preserved'], candidates: [] } }),
        };
    },

    getMatchId: (match) => match?.id,

    createDestinationClient() {
        return {
            createPlaylist: async ({ title, description }) => createExport({ title, description }).id,
            readTrackIds: async ({ playlistId }) => (findExport(playlistId)?.tracks || []).map(encodeTrack),
            addTracks: async ({ playlistId, ids, expectedIds }) => {
                appendExportTracks(playlistId, ids.map(decodeTrack).filter(Boolean), expectedIds?.map(decodeTrack).filter(Boolean));
            },
            getPlaylistUrl: (playlistId) => getExportDownloadPath(playlistId),
            setPlaylistImage: null,
        };
    },

    async deletePlaylist({ playlistId }) {
        if (!deleteImport(playlistId)) {
            throw new AppError('Arquivo importado não encontrado.', 404);
        }
    },

    async disconnect() {},
};

export default fileProvider;
