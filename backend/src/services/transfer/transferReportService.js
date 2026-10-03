import { localizeText } from '../../i18n/localization.js';
import { getOwnedTransfer } from './transferQueryService.js';
import { loadTransferTracks, summarizeTransferTracks } from './TransferTrackStore.js';

const safeCell = (value) => {
    const text = String(value ?? '');
    return `"${(/^[\s]*[=+@-]/.test(text) ? "'" : '') + text.replaceAll('"', '""')}"`;
};

export const buildTransferReport = async ({ transferId, userId, format = 'json', locale = 'pt-BR' }) => {
    const t = (message) => localizeText(message, locale);
    const transfer = await getOwnedTransfer({ transferId, userId });
    const tracks = loadTransferTracks(transfer._id) || [];
    const rows = tracks.map((track) => ({
        position: track.index + 1,
        name: track.name,
        artist: track.artist,
        outcome: t(track.inserted ? 'adicionada' : track.status === 'matched' ? 'aguardando inserção'
            : track.status === 'not_found' ? 'não encontrada' : 'pendente'),
        matchSource: track.matchSource || null,
        matchScore: track.matchScore ?? null,
    }));
    const report = {
        format: 'syncsphere-transfer-report',
        version: 1,
        generatedAt: new Date().toISOString(),
        playlistName: transfer.playlistName,
        sourceProvider: transfer.sourceProvider,
        targetProvider: transfer.targetProvider,
        status: transfer.status,
        sourceTotalTracks: transfer.sourceTotalTracks ?? null,
        sourceTruncated: Boolean(transfer.sourceTruncated),
        omittedTracks: transfer.sourceOmittedTracks ?? null,
        unavailableTracks: transfer.sourceUnavailableTracks ?? null,
        counts: { ...summarizeTransferTracks(tracks), inserted: tracks.filter((track) => track.inserted).length },
        tracks: rows,
        note: t(tracks.length ? 'O relatório descreve o estado confirmado pelo aplicativo.' : 'Este registro não possui detalhes por faixa.'),
    };
    if (format === 'csv') {
        const header = ['Posição', 'Música', 'Artista', 'Resultado', 'Correspondência', 'Pontuação'].map(t);
        return { body: '\uFEFF' + [header, ...rows.map((row) => Object.values(row))].map((row) => row.map(safeCell).join(',')).join('\r\n'), contentType: 'text/csv; charset=utf-8', extension: 'csv' };
    }
    return { body: JSON.stringify(report, null, 2), contentType: 'application/json; charset=utf-8', extension: 'json' };
};
