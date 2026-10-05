import fs from 'node:fs';
import path from 'node:path';
import { PROJECT_ROOT } from '../config/paths.js';
import { createLocalizer, normalizeLocale } from '../../../shared/localization.js';

const readCatalog = (locale) => JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'shared', 'locales', `${locale}.json`), 'utf8'));
export const localizeText = createLocalizer(readCatalog('pt-BR'), readCatalog('en'));
export const requestLocale = (req) => {
    const preferences = String(req.get('Accept-Language') || '').slice(0, 256).split(',').map((value, index) => {
        const [tag, quality] = value.trim().split(';');
        const q = quality?.startsWith('q=') ? Number(quality.slice(2)) : 1;
        return { locale: normalizeLocale(tag), quality: Number.isFinite(q) ? q : 0, index };
    }).filter((entry) => entry.locale && entry.quality > 0);
    preferences.sort((a, b) => b.quality - a.quality || a.index - b.index);
    return preferences[0]?.locale || 'pt-BR';
};

/** Traduz somente campos escritos pelo aplicativo, preservando os dados de playlists. */
export const localizeResponse = (body, locale) => {
    if (!body || typeof body !== 'object') return body;
    const result = { ...body };
    if (typeof result.message === 'string') result.message = localizeText(result.message, locale);
    if (!result.data || typeof result.data !== 'object') return result;
    result.data = { ...result.data };
    const provider = (value) => {
        const localized = { ...value };
        if (value.id === 'file') localized.label = locale === 'en' ? 'File' : 'Arquivo';
        if (value.auth) localized.auth = { ...value.auth, fields: value.auth.fields?.map((field) => ({
            ...field, label: localizeText(field.label, locale), placeholder: localizeText(field.placeholder, locale),
        })) };
        return localized;
    };
    if (Array.isArray(result.data.providers)) result.data.providers = result.data.providers.map(provider);
    if (result.data.integrations) result.data.integrations = Object.fromEntries(Object.entries(result.data.integrations).map(([id, value]) => [id, provider({ ...value, id })]));
    const transfer = (value) => ({ ...value, lastMessage: localizeText(value.lastMessage, locale) });
    if (result.data.transfer) result.data.transfer = transfer(result.data.transfer);
    if (Array.isArray(result.data.transfers)) result.data.transfers = result.data.transfers.map(transfer);
    if (Array.isArray(result.data.tracks) && result.data.counts) result.data.tracks = result.data.tracks.map((track) => ({ ...track, lastError: localizeText(track.lastError, locale) }));
    return result;
};

export const languageMiddleware = (req, res, next) => {
    req.locale = requestLocale(req);
    res.setHeader('Content-Language', req.locale);
    res.vary('Accept-Language');
    const sendJson = res.json.bind(res);
    res.json = (body) => sendJson(localizeResponse(body, req.locale));
    next();
};
