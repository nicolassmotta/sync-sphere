import { saveImport } from '../providers/file/fileLibrary.js';
import { buildDiagnostic } from '../services/system/diagnosticService.js';
import { getProviderSetup, saveProviderSetup } from '../services/system/providerSetupService.js';
import { createBackup } from '../services/system/backupService.js';

export const getDiagnostic = (req, res, next) => {
    try { res.json({ status: 'success', data: buildDiagnostic() }); } catch (error) { next(error); }
};

export const downloadBackup = (req, res, next) => {
    try {
        const body = createBackup(req.body.password);
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', 'attachment; filename="syncsphere-backup.ssb"');
        res.send(body);
    } catch (error) { next(error); }
};

export const importDemo = (req, res, next) => {
    try {
        const record = saveImport({ filename: 'demonstracao.json', playlist: {
            name: 'Minha primeira playlist', format: 'json', description: 'Demonstração do SyncSphere com dados fictícios.',
            tracks: [
                { name: 'Primeiro acorde', artist: 'Banda de exemplo', album: 'Começar', durationMs: 180000 },
                { name: 'Estrada de casa', artist: 'Artista de exemplo', album: 'Caminhos', durationMs: 210000 },
                { name: 'Primeiro acorde', artist: 'Banda de exemplo', album: 'Começar', durationMs: 180000 },
            ],
        } });
        res.status(201).json({ status: 'success', data: { playlist: { id: record.id, name: record.name, trackCount: record.tracks.length } } });
    } catch (error) { next(error); }
};


export const getProviderSetupStatus = (req, res) => {
    res.json({ status: 'success', data: getProviderSetup(req.params.providerId) });
};

export const configureProviderApp = (req, res, next) => {
    try {
        const data = saveProviderSetup({ providerId: req.params.providerId, clientId: req.body.clientId.trim() });
        res.json({ status: 'success', data });
    } catch (error) { next(error); }
};
