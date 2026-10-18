import { useText } from '../../i18n/useText';
import { BookOpen, HelpCircle, History, LayoutDashboard, Plug, Server, ServerOff } from 'lucide-react';
import Button from '../ui/Button';
import LanguageSelector from '../ui/LanguageSelector';
import { DASHBOARD_TAB_LABELS } from '../../constants/dashboardTabs';
import { cn } from '../../utils/cn';

const tabIcons = { home: LayoutDashboard, integrations: Plug, history: History, settings: BookOpen };

const Header = ({ activeTab, onOpenHelp, backendStatus = 'checking' }) => {
    const { t } = useText();
    const TabIcon = tabIcons[activeTab] || LayoutDashboard;
    const offline = backendStatus === 'offline';
    return <header className="sticky top-0 z-20 flex h-20 bg-darkBackground/95 items-center justify-between gap-3 border-b border-white/10 px-5 sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
            <div className="hidden h-10 items-center gap-3 rounded-lg border border-white/15 px-4 text-sm text-muted sm:flex">
                <TabIcon size={16} aria-hidden="true" className="text-spotify" />
                <span className="truncate">{t(DASHBOARD_TAB_LABELS[activeTab] || 'Painel')}</span>
            </div>
            <span role="status" className={cn('flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold',
                offline ? 'border-red-400/40 bg-red-500/10 text-red-200' : 'border-spotify/30 bg-spotify/10 text-spotify')}>
                {offline ? <ServerOff size={14} aria-hidden="true" /> : <Server size={14} aria-hidden="true" />}
                <span className="sr-only min-[380px]:not-sr-only">{offline ? t("Aplicativo parado") : t(" Neste computador")}</span></span>
        </div>
        <div className="flex items-center gap-2"><LanguageSelector />
        <Button size="sm" variant="ghost" onClick={onOpenHelp} leftIcon={<HelpCircle size={16} aria-hidden="true" />}>{t("Ajuda")}</Button></div>
    </header>;
};
export default Header;
