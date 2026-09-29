import AppError from '../../../utils/AppError.js';
import fileProvider from '../../../providers/file/index.js';
import { findExport, saveImport } from '../../../providers/file/fileLibrary.js';
import { FILE_FORMATS, parsePlaylistFile, serializePlaylist } from '../../../providers/file/formats.js';

const safeFilename = (name) => (
    String(name || 'playlist').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').slice(0, 80) || 'playlist'
);

/**
 * Recebe o conteúdo do arquivo como texto (`Content-Type: text/plain`) e o
 * nome em `?filename=`. Evita multipart: o navegador lê o arquivo e envia.
 */
export const importPlaylistFile = async (req, res, next) => {
    try {
        const filename = String(req.query.filename || 'playlist.txt');
        const content = typeof req.body === 'string' ? req.body : '';
        if (!content.trim()) {
            throw new AppError('Arquivo vazio.', 400);
        }

        let playlist;
        try {
            playlist = parsePlaylistFile({ filename, content });
        } catch (error) {
            throw new AppError(error.message, 400);
        }

        const record = saveImport({ filename, playlist });
        res.status(201).json({
            status: 'success',
            message: `"${record.name}" importada com ${record.tracks.length} faixas.`,
            data: {
                playlist: {
                    id: record.id,
                    name: record.name,
                    format: record.format,
                    trackCount: record.tracks.length,
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

export const deleteImportedPlaylist = async (req, res, next) => {
    try {
        await fileProvider.deletePlaylist({ playlistId: req.params.importId });
        res.status(200).json({ status: 'success' });
    } catch (error) {
        next(error);
    }
};

export const downloadExport = async (req, res, next) => {
    try {
        const format = FILE_FORMATS.includes(req.query.format) ? req.query.format : 'csv';
        const record = findExport(req.params.exportId);
        if (!record) {
            throw new AppError('Arquivo exportado não encontrado.', 404);
        }

        const file = serializePlaylist(record, format);
        res.setHeader('Content-Type', file.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename(record.name)}.${file.extension}"`);
        res.status(200).send(file.body);
    } catch (error) {
        next(error);
    }
};
