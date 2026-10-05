import { localizeText } from '../i18n/localization.js';
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
        const t = (message) => localizeText(message, req.locale);
        const record = saveImport({ filename: 'demonstracao.json', playlist: {
            name: t('Minha primeira playlist'), format: 'json', description: t('Demonstração do SyncSphere com dados fictícios.'),
            tracks: [
                { name: t('Primeiro acorde'), artist: t('Banda de exemplo'), album: t('Começar'), durationMs: 180000 },
                { name: t('Estrada de casa'), artist: t('Artista de exemplo'), album: t('Caminhos'), durationMs: 210000 },
                { name: t('Primeiro acorde'), artist: t('Banda de exemplo'), album: t('Começar'), durationMs: 180000 },
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
