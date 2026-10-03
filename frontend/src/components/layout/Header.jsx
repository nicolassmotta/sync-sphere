import { useText } from '../../i18n/useText';
import { Command, HelpCircle, Server } from 'lucide-react';
import Button from '../ui/Button';
import LanguageSelector from '../ui/LanguageSelector';
import { DASHBOARD_TAB_LABELS } from '../../constants/dashboardTabs';

const Header = ({ activeTab, onOpenHelp }) => {
    const { t } = useText();
    return <header className="relative z-20 flex h-20 items-center justify-between gap-3 border-b border-white/10 px-5 sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
            <div className="hidden h-10 items-center gap-3 rounded-lg border border-white/15 px-4 text-sm text-muted sm:flex">
                <Command size={16} aria-hidden="true" className="text-spotify" />
                <span className="truncate">{t(DASHBOARD_TAB_LABELS[activeTab] || 'Painel')}</span>
            </div>
            <span className="flex items-center gap-2 rounded-lg border border-spotify/30 bg-spotify/10 px-3 py-2 text-xs font-semibold text-spotify">
                <Server size={14} aria-hidden="true" />{t(" Neste computador")}</span>
        </div>
        <div className="flex items-center gap-2"><LanguageSelector />
        <Button size="sm" variant="ghost" onClick={onOpenHelp} leftIcon={<HelpCircle size={16} aria-hidden="true" />}>{t("Ajuda")}</Button></div>
    </header>;
};
export default Header;
