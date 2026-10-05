import { candidateUrl } from '../matching/trackUrls.js';
import { safeTrackUrl } from '../matching/identity.js';
import { localizeText } from '../../i18n/localization.js';
import { getOwnedTransfer } from './transferQueryService.js';
import { loadTransferTracks, summarizeTransferTracks } from './TransferTrackStore.js';

const safeCell = (value) => {
    const text = String(value ?? '');
    return `"${(/^[\s]*[=+@-]/.test(text) ? "'" : '') + text.replaceAll('"', '""')}"`;
};
const OUTCOMES = {
    matched: 'aguardando inserção', not_found: 'não encontrada', needs_review: 'aguardando revisão',
    skipped: 'ignorada', failed: 'falha técnica', retry_queued: 'nova tentativa agendada', pending: 'pendente',
};

export const buildTransferReport = async ({ transferId, userId, format = 'json', locale = 'pt-BR' }) => {
    const t = (message) => localizeText(message, locale);
    const transfer = await getOwnedTransfer({ transferId, userId });
    const tracks = loadTransferTracks(transfer._id) || [];
    const counters = (track) => {
        if (!track.searchCheckpoint || ['cache', 'manual_cache'].includes(track.matchSource) || track.matching?.strategy === 'preserved_choice') {
            return { queries: track.matching?.queries ?? null, requests: track.matching?.requests ?? null };
        }
        return { queries: track.searchCheckpoint.queries + (track.searchCheckpoint.previousQueries || 0),
            requests: (track.searchCheckpoint.requests || 0) + (track.searchCheckpoint.previousRequests || 0) + (track.cacheRequestCount || 0) };
    };
    const rows = tracks.map((track) => ({
        position: track.index + 1,
        name: track.name, artist: track.artist,
        outcome: t(track.inserted ? 'adicionada' : OUTCOMES[track.status] || 'pendente'),
        matchSource: track.matchSource || null, matchScore: track.matchScore ?? null,
        source: { id: track.sourceId || null, name: track.name, artist: track.artist,
            artists: track.artists || null, album: track.album || null, durationMs: track.durationMs || null,
            isrc: track.isrc || null, url: safeTrackUrl(track.uri) },
        target: track.chosenCandidate || track.matching?.best?.candidate || (track.targetId ? { targetId: track.targetId } : null),
        targetUrl: track.targetId ? candidateUrl(transfer.targetProvider, track.targetId, track.chosenCandidate || {}) : null,
        status: track.status, inserted: Boolean(track.inserted),
        decision: track.matchSource === 'manual' || track.matchSource === 'manual_cache' ? 'manual' : track.matching?.decision || null,
        strategy: track.matching?.strategy || null,
        reasons: track.review?.evidence?.reasons || track.matching?.reasons || null,
        evidence: track.review?.evidence?.evidence || track.matching?.best?.evidence || null,
        algorithmVersion: track.matching?.algorithmVersion || null,
        attempts: track.attempts || 0, ...counters(track),
        searchLatencyMs: track.searchLatencyMs ?? null,
        failure: track.errorKind ? { kind: track.errorKind } : null,
        reviewedAt: track.review?.at || null, insertedAt: track.insertedAt || null,
        destinationPresence: track.destinationPresence || 'unverified',
        legacy: Boolean(track.matching?.legacy) || (!track.formatVersion && !track.matching && !track.review),
    }));
    const total = tracks.length;
    const automaticallyResolved = tracks.filter((track) => track.status === 'matched' && ['search', 'cache'].includes(track.matchSource)).length;
    const inserted = tracks.filter((track) => track.inserted).length;
    const report = {
        format: 'syncsphere-transfer-report', version: 2, generatedAt: new Date().toISOString(),
        playlistName: transfer.playlistName, sourceProvider: transfer.sourceProvider,
        targetProvider: transfer.targetProvider, status: transfer.status,
        sourceTotalTracks: transfer.sourceTotalTracks ?? null, sourceTruncated: Boolean(transfer.sourceTruncated),
        omittedTracks: transfer.sourceOmittedTracks ?? null, unavailableTracks: transfer.sourceUnavailableTracks ?? null,
        counts: { ...summarizeTransferTracks(tracks), inserted },
        metrics: {
            automaticCoverage: total ? automaticallyResolved / total : null,
            insertedCoverage: total ? inserted / total : null,
            cacheHits: tracks.filter((track) => ['cache', 'manual_cache'].includes(track.matchSource) && track.matching?.strategy !== 'preserved_choice').length,
            queries: rows.reduce((sum, track) => sum + (track.queries || 0), 0),
            requests: rows.reduce((sum, track) => sum + (track.requests || 0), 0),
            searchLatencyMs: tracks.reduce((sum, track) => sum + (track.searchLatencyMs || 0), 0),
            precision: null,
        },
        destinationVerification: transfer.destinationVerification || { state: 'unverified', orderPreserved: null },
        creationIntent: transfer.creationIntent || null,
        tracks: rows,
        note: t(total ? 'O relatório descreve o estado confirmado pelo aplicativo.' : 'Este registro não possui detalhes por faixa.'),
    };
    if (format === 'csv') {
        const header = ['Posição', 'Música', 'Artista', 'Resultado', 'Correspondência', 'Pontuação',
            'ID de destino', 'Título no destino', 'Artista no destino', 'Estratégia', 'Razões', 'Algoritmo',
            'Tentativas', 'Consultas', 'Falha', 'Presença no destino', 'Legado',
            'Álbum de origem', 'Duração de origem (ms)', 'ISRC de origem', 'Link de origem',
            'Álbum de destino', 'Duração de destino (ms)', 'ISRC de destino', 'Link de destino', 'Decisão'].map(t);
        const csvRows = rows.map((row) => [row.position, row.name, row.artist, row.outcome, row.matchSource, row.matchScore,
            row.target?.targetId || null, row.target?.name || null, row.target?.artist || row.target?.artists?.join(', ') || null,
            row.strategy, row.reasons?.join('; ') || null, row.algorithmVersion, row.attempts,
            row.queries, row.failure?.kind || null, row.destinationPresence, row.legacy,
            row.source.album, row.source.durationMs, row.source.isrc, row.source.url,
            row.target?.album, row.target?.durationMs, row.target?.isrc, row.targetUrl, row.decision]);
        return { body: '\uFEFF' + [header, ...csvRows].map((row) => row.map(safeCell).join(',')).join('\r\n'),
            contentType: 'text/csv; charset=utf-8', extension: 'csv' };
    }
    return { body: JSON.stringify(report, null, 2), contentType: 'application/json; charset=utf-8', extension: 'json' };
};
