import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { translate } from './index';

export const useText = () => {
    const { i18n } = useTranslation();
    const language = i18n.resolvedLanguage || i18n.language;
    const t = useCallback((message, values) => translate(message, values, language), [language]);
    return { t, locale: language, i18n };
};
