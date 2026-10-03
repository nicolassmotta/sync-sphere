import { MESSAGE_PARAMETER_TYPES, PROVIDER_MESSAGE_PARAMETERS } from './messageParameters.js';

export const SUPPORTED_LOCALES = ['pt-BR', 'en'];
export const normalizeLocale = (value) => {
    const tag = String(value || '').toLowerCase().replaceAll('_', '-');
    if (tag === 'pt' || tag.startsWith('pt-')) return 'pt-BR';
    if (tag === 'en' || tag.startsWith('en-')) return 'en';
    return null;
};
export const preferredLocale = (saved, languages = []) => normalizeLocale(saved)
    || languages.map(normalizeLocale).find(Boolean) || 'pt-BR';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const interpolate = (text, values) => text.replace(/\{\{(\w+)\}\}/g, (match, key) => String(values[key] ?? match));

/** Catálogo de mensagens próprias. Metadados interpolados permanecem no idioma original. */
export const createLocalizer = (portuguese, english) => {
    const exact = new Map();
    const patterns = [];
    for (const [key, pt] of Object.entries(portuguese)) {
        const en = english[key];
        if (typeof en !== 'string') continue;
        exact.set(pt, { key, pt, en });
        exact.set(en, { key, pt, en });
        if (!key.includes('{{')) continue;
        for (const source of [pt, en]) {
            const names = [];
            let position = 0;
            let expression = '';
            for (const match of source.matchAll(/\{\{(\w+)\}\}/g)) {
                expression += escapeRegex(source.slice(position, match.index)) + '([\\s\\S]*?)';
                names.push(match[1]);
                position = match.index + match[0].length;
            }
            expression += escapeRegex(source.slice(position));
            const literalLength = source.replace(/\{\{\w+\}\}/g, '').length;
            if (literalLength < 8) continue;
            patterns.push({ expression: new RegExp(`^${expression}$`), names, key, pt, en, literalLength });
        }
    }
    patterns.sort((a, b) => b.literalLength - a.literalLength);
    const localize = (message, locale, values = {}, depth = 0) => {
        if (typeof message !== 'string') return message;
        const language = normalizeLocale(locale) === 'en' ? 'en' : 'pt';
        const entry = exact.get(message);
        const parametersFor = (key, parameters) => {
            const types = { ...PROVIDER_MESSAGE_PARAMETERS[key], ...MESSAGE_PARAMETER_TYPES[key] };
            return Object.fromEntries(Object.entries(parameters).map(([name, value]) => {
                if (types[name] === 'provider') return [name, value === 'Arquivo' || value === 'File' ? (language === 'en' ? 'File' : 'Arquivo') : value];
                if ((types[name] === 'grammar' || types[name] === 'message') && depth < 3) return [name, localize(value, locale, {}, depth + 1)];
                return [name, value];
            }));
        };
        if (entry) return interpolate(entry[language], parametersFor(entry.key, values));
        if (message.length > 2048) return message;
        for (const pattern of patterns) {
            const match = pattern.expression.exec(message);
            if (!match) continue;
            const parameters = Object.fromEntries(pattern.names.map((name, index) => [name, match[index + 1]]));
            return interpolate(pattern[language], parametersFor(pattern.key, parameters));
        }
        return interpolate(message, values);
    };
    return localize;
};
