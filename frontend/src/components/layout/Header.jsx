import { useText } from '../../i18n/useText';
import { Command, HelpCircle, Server } from 'lucide-react';
import { Link } from 'react-router-dom';
import Button from '../ui/Button';
import LanguageSelector from '../ui/LanguageSelector';
import { DASHBOARD_TAB_LABELS } from '../../constants/dashboardTabs';

const Header = ({ activeTab, onOpenHelp }) => {
    const { t } = useText();
    return <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-white/10 bg-darkBackground/75 px-5 backdrop-blur-xl sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
            <Link to="/dashboard" translate="no" className="text-sm font-bold text-white md:hidden">SyncSphere</Link>
            <div className="hidden h-10 items-center gap-3 rounded-lg border border-white/15 px-4 text-sm text-muted sm:flex">
                <Command size={16} aria-hidden="true" className="text-spotify" />
                <span className="truncate">{t(DASHBOARD_TAB_LABELS[activeTab] || 'Painel')}</span>
            </div>
            <span className="hidden items-center gap-2 rounded-lg border border-spotify/30 bg-spotify/10 px-3 py-2 text-xs font-semibold text-green-300 md:flex">
                <Server size={14} aria-hidden="true" /><span className="sr-only min-[380px]:not-sr-only">{t(" Neste computador")}</span></span>
        </div>
        <div className="flex items-center gap-2"><LanguageSelector />
        <Button size="sm" variant="ghost" onClick={onOpenHelp} leftIcon={<HelpCircle size={16} aria-hidden="true" />}>{t("Ajuda")}</Button></div>
    </header>;
};
export default Header;
