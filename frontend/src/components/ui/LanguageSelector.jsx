import { useText } from '../../i18n/useText';

const LanguageSelector = () => {
    const { locale, i18n } = useText();
    return (
        <label className="inline-flex min-h-10 items-center gap-2 text-sm text-gray-200">
            <span className="sr-only">{locale === 'en' ? 'Language' : 'Idioma'}</span>
            <select name="language" aria-label={locale === 'en' ? 'Language' : 'Idioma'} value={locale}
                onChange={(event) => i18n.changeLanguage(event.target.value)}
                className="max-w-36 rounded-lg border border-white/20 bg-surfaceCard px-2 py-2 text-sm text-white">
                <option value="pt-BR" lang="pt-BR">Português (Brasil)</option>
                <option value="en" lang="en">English</option>
            </select>
        </label>
    );
};
export default LanguageSelector;
