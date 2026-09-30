/**
 * Leitura e escrita de playlists em arquivo: CSV (Exportify e genérico),
 * JSON (formato do SyncSphere ou lista de faixas), M3U/M3U8 e TXT
 * ("Artista - Título" por linha). Sem dependências externas.
 */
export const FILE_FORMATS = ['csv', 'json', 'm3u', 'txt'];
export const MAX_IMPORT_TRACKS = 5000;

const COLUMN_ALIASES = {
    name: ['track name', 'name', 'title', 'track', 'song', 'música', 'musica', 'título', 'titulo', 'faixa'],
    artist: ['artist name(s)', 'artist names', 'artist', 'artists', 'artista', 'artistas'],
    album: ['album name', 'album', 'álbum'],
    isrc: ['isrc'],
    durationMs: ['track duration (ms)', 'duration (ms)', 'duration_ms', 'durationms'],
    duration: ['duration', 'duração', 'duracao', 'length', 'time'],
};

const normalizeHeader = (value) => String(value || '').replace(/^﻿/, '').trim().toLowerCase();

const detectDelimiter = (firstLine) => {
    const counts = [',', ';', '\t'].map((delimiter) => [delimiter, firstLine.split(delimiter).length]);
    return counts.sort((a, b) => b[1] - a[1])[0][0];
};

/**
 * Parser CSV (RFC 4180): aspas, aspas escapadas, quebras de linha dentro de
 * campos e separador `,`, `;` ou tab.
 */
export const parseCsvRows = (content) => {
    const text = String(content || '').replace(/^﻿/, '');
    const delimiter = detectDelimiter(text.split(/\r?\n/, 1)[0] || '');
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let index = 0; index < text.length; index += 1) {
        const char = text[index];

        if (inQuotes) {
            if (char === '"' && text[index + 1] === '"') {
                field += '"';
                index += 1;
            } else if (char === '"') {
                inQuotes = false;
            } else {
                field += char;
            }
            continue;
        }

        if (char === '"') {
            inQuotes = true;
        } else if (char === delimiter) {
            row.push(field);
            field = '';
        } else if (char === '\n' || char === '\r') {
            if (char === '\r' && text[index + 1] === '\n') index += 1;
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
        } else {
            field += char;
        }
    }

    if (field || row.length) {
        row.push(field);
        rows.push(row);
    }

    return rows.filter((cells) => cells.some((cell) => cell.trim()));
};

const parseDurationToMs = (value) => {
    const text = String(value || '').trim();
    if (!text) return 0;
    if (/^\d+:\d{1,2}(:\d{1,2})?$/.test(text)) {
        return text.split(':').map(Number).reduce((total, part) => total * 60 + part, 0) * 1000;
    }
    const number = Number(text);
    if (!Number.isFinite(number)) return 0;
    // Valores pequenos são segundos; grandes, milissegundos.
    return number > 10000 ? Math.round(number) : Math.round(number * 1000);
};

const cleanTrack = (track) => ({
    name: String(track.name || '').trim(),
    artist: String(track.artist || '').trim() || 'Unknown',
    album: String(track.album || '').trim(),
    isrc: String(track.isrc || '').trim().toUpperCase() || null,
    durationMs: Number(track.durationMs) || 0,
});

const parseCsv = (content) => {
    const [header = [], ...rows] = parseCsvRows(content);
    const headers = header.map(normalizeHeader);
    const findColumn = (field) => headers.findIndex((name) => COLUMN_ALIASES[field].includes(name));
    const columns = Object.fromEntries(Object.keys(COLUMN_ALIASES).map((field) => [field, findColumn(field)]));

    if (columns.name === -1) {
        throw new Error('CSV sem coluna de nome da faixa. Use um cabeçalho como "Track Name", "name", "title" ou "música".');
    }

    const cell = (cells, field) => (columns[field] === -1 ? '' : cells[columns[field]] || '');

    return {
        tracks: rows.map((cells) => cleanTrack({
            name: cell(cells, 'name'),
            artist: cell(cells, 'artist'),
            album: cell(cells, 'album'),
            isrc: cell(cells, 'isrc'),
            durationMs: cell(cells, 'durationMs')
                ? Number(cell(cells, 'durationMs'))
                : parseDurationToMs(cell(cells, 'duration')),
        })),
    };
};

const splitArtistTitle = (text) => {
    const cleaned = String(text || '').replace(/\.(mp3|flac|m4a|aac|ogg|wav|opus)$/i, '').trim();
    const separator = cleaned.indexOf(' - ');
    if (separator === -1) return { artist: '', name: cleaned };
    return { artist: cleaned.slice(0, separator).trim(), name: cleaned.slice(separator + 3).trim() };
};

const parseM3u = (content) => {
    const lines = String(content || '').replace(/^﻿/, '').split(/\r?\n/).map((line) => line.trim());
    const tracks = [];
    let name = null;
    let pending = null;

    for (const line of lines) {
        if (!line) continue;
        if (line.startsWith('#PLAYLIST:')) {
            name = line.slice('#PLAYLIST:'.length).trim();
        } else if (line.startsWith('#EXTINF:')) {
            const [durationPart, ...titleParts] = line.slice('#EXTINF:'.length).split(',');
            const seconds = Number.parseFloat(durationPart);
            pending = {
                ...splitArtistTitle(titleParts.join(',')),
                durationMs: Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 1000) : 0,
            };
        } else if (!line.startsWith('#')) {
            // Sem #EXTINF, usa o nome do arquivo ("Artista - Título.mp3").
            tracks.push(cleanTrack(pending || splitArtistTitle(line.split(/[\\/]/).pop())));
            pending = null;
        }
    }

    return { name, tracks };
};

const parseTxt = (content) => ({
    tracks: String(content || '')
        .replace(/^﻿/, '')
        .split(/\r?\n/)
        .map((line) => line.replace(/^\s*\d+[.)]\s+/, '').trim())
        .filter(Boolean)
        .map((line) => cleanTrack(splitArtistTitle(line))),
});

const parseJson = (content) => {
    let data;
    try {
        data = JSON.parse(String(content || '').replace(/^﻿/, ''));
    } catch {
        throw new Error('JSON inválido.');
    }

    const tracks = Array.isArray(data) ? data : data.tracks;
    if (!Array.isArray(tracks)) {
        throw new Error('JSON sem lista de faixas. Use { "name": "...", "tracks": [{ "name", "artist" }] } ou uma lista de faixas.');
    }

    return {
        name: Array.isArray(data) ? null : data.name,
        description: Array.isArray(data) ? '' : data.description,
        tracks: tracks.map((track) => cleanTrack({
            name: track.name || track.title,
            artist: track.artist || (Array.isArray(track.artists) ? track.artists.join(', ') : track.artists),
            album: track.album,
            isrc: track.isrc,
            durationMs: track.durationMs ?? track.duration_ms ?? parseDurationToMs(track.duration),
        })),
    };
};

export const detectFileFormat = (filename = '', content = '') => {
    const extension = String(filename).toLowerCase().split('.').pop();
    if (extension === 'm3u8' || extension === 'm3u') return 'm3u';
    if (FILE_FORMATS.includes(extension)) return extension;

    const trimmed = String(content).trimStart();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
    if (trimmed.startsWith('#EXTM3U')) return 'm3u';
    return String(content).split(/\r?\n/, 1)[0].includes(',') ? 'csv' : 'txt';
};

const PARSERS = { csv: parseCsv, json: parseJson, m3u: parseM3u, txt: parseTxt };

const playlistNameFromFilename = (filename) => (
    String(filename || 'Playlist importada').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Playlist importada'
);

/**
 * Converte o conteúdo do arquivo em playlist: `{ name, description, format, tracks }`.
 */
export const parsePlaylistFile = ({ filename, content }) => {
    const format = detectFileFormat(filename, content);
    const parsed = PARSERS[format](content);
    const tracks = parsed.tracks.filter((track) => track.name);
    if (tracks.length > MAX_IMPORT_TRACKS) {
        throw new Error(`O arquivo excede o limite de ${MAX_IMPORT_TRACKS} faixas. Divida a playlist em arquivos menores.`);
    }

    if (!tracks.length) {
        throw new Error('Nenhuma faixa encontrada no arquivo.');
    }

    return {
        name: parsed.name || playlistNameFromFilename(filename),
        description: parsed.description || '',
        format,
        tracks,
    };
};

const csvCell = (value) => {
    const text = String(value ?? '');
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/**
 * Gera o arquivo de uma playlist exportada. Devolve `{ body, contentType, extension }`.
 */
export const serializePlaylist = ({ name, description, tracks }, format) => {
    if (format === 'json') {
        return {
            body: JSON.stringify({ name, description, exportedBy: 'SyncSphere', tracks }, null, 2),
            contentType: 'application/json; charset=utf-8',
            extension: 'json',
        };
    }

    if (format === 'm3u') {
        const lines = ['#EXTM3U', `#PLAYLIST:${name}`];
        tracks.forEach((track) => {
            lines.push(`#EXTINF:${Math.round((track.durationMs || 0) / 1000) || -1},${track.artist} - ${track.name}`);
            lines.push(`${track.artist} - ${track.name}`);
        });
        return { body: `${lines.join('\n')}\n`, contentType: 'audio/x-mpegurl; charset=utf-8', extension: 'm3u8' };
    }

    if (format === 'txt') {
        return {
            body: `${tracks.map((track) => `${track.artist} - ${track.name}`).join('\n')}\n`,
            contentType: 'text/plain; charset=utf-8',
            extension: 'txt',
        };
    }

    const header = ['Track Name', 'Artist Name(s)', 'Album Name', 'ISRC', 'Duration (ms)'];
    const rows = tracks.map((track) => [track.name, track.artist, track.album, track.isrc || '', track.durationMs || '']);
    return {
        body: `﻿${[header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`,
        contentType: 'text/csv; charset=utf-8',
        extension: 'csv',
    };
};
