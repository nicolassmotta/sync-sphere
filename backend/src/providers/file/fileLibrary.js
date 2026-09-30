import crypto from 'crypto';
import { readStore, writeStore } from '../../storage/jsonStore.js';

/**
 * Playlists importadas de arquivo (origem) e exportadas (destino), cifradas
 * em `data/file-imports.json` e `data/file-exports.json`.
 */
const IMPORTS_STORE = 'file-imports.json';
const EXPORTS_STORE = 'file-exports.json';
const MAX_IMPORTS = 200;

const newId = (prefix) => `${prefix}-${crypto.randomUUID()}`;

export const listImports = () => readStore(IMPORTS_STORE, []);

export const findImport = (importId) => listImports().find((item) => item.id === importId) || null;

export const saveImport = ({ filename, playlist }) => {
    const record = {
        id: newId('import'),
        filename,
        name: playlist.name,
        description: playlist.description || '',
        format: playlist.format,
        tracks: playlist.tracks,
        createdAt: new Date().toISOString(),
    };
    writeStore(IMPORTS_STORE, [record, ...listImports()].slice(0, MAX_IMPORTS));
    return record;
};

export const deleteImport = (importId) => {
    const imports = listImports();
    const next = imports.filter((item) => item.id !== importId);
    writeStore(IMPORTS_STORE, next);
    return next.length !== imports.length;
};

const listExports = () => readStore(EXPORTS_STORE, []);

export const findExport = (exportId) => listExports().find((item) => item.id === exportId) || null;

export const createExport = ({ title, description }) => {
    const record = {
        id: newId('export'),
        name: title,
        description: description || '',
        tracks: [],
        createdAt: new Date().toISOString(),
    };
    writeStore(EXPORTS_STORE, [record, ...listExports()]);
    return record;
};

/** Acrescenta faixas preservando ordem e repetições da playlist de origem. */
export const appendExportTracks = (exportId, tracks) => {
    const exports = listExports();
    const record = exports.find((item) => item.id === exportId);
    if (!record) throw new Error('Arquivo de destino não encontrado. Ele pode ter sido apagado.');

    record.tracks.push(...tracks);
    record.updatedAt = new Date().toISOString();
    writeStore(EXPORTS_STORE, exports);
    return record;
};
