import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import portuguese from '../../../shared/locales/pt-BR.json';
import english from '../../../shared/locales/en.json';
import { createLocalizer, preferredLocale } from '../../../shared/localization.js';

export const LANGUAGE_STORAGE_KEY = 'syncsphere-language-v1';
let saved;
try { saved = localStorage.getItem(LANGUAGE_STORAGE_KEY); } catch { /* A tradução funciona sem persistência do navegador. */ }
const initialLanguage = preferredLocale(saved, typeof navigator === 'undefined' ? [] : navigator.languages);
const localize = createLocalizer(portuguese, english);

i18next.use(initReactI18next).init({
    resources: { 'pt-BR': { translation: portuguese }, en: { translation: english } },
    lng: initialLanguage,
    fallbackLng: 'pt-BR',
    supportedLngs: ['pt-BR', 'en'],
    load: 'currentOnly',
    initAsync: false,
    keySeparator: false,
    nsSeparator: false,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
});

export const translate = (message, values, language = i18next.resolvedLanguage || i18next.language) => localize(message, language, values);
export const currentLocale = () => i18next.resolvedLanguage || i18next.language || 'pt-BR';
const applyLanguage = (language) => {
    document.documentElement.lang = language;
    document.title = language === 'en' ? 'SyncSphere | Playlist transfers across platforms' : 'SyncSphere | Migração de playlists entre plataformas';
    try { localStorage.setItem(LANGUAGE_STORAGE_KEY, language); } catch { /* Preferência permanece ativa nesta sessão. */ }
};
if (typeof document !== 'undefined') {
    applyLanguage(initialLanguage);
    i18next.on('languageChanged', applyLanguage);
}
export default i18next;
