import { Link } from 'react-router-dom';
import { useText } from '../../i18n/useText';
import { BookOpen, LayoutDashboard, RefreshCw, History, Plug } from 'lucide-react';
import { LayoutGroup, motion } from 'framer-motion';
import { DASHBOARD_TABS, getDashboardTabUrl } from '../../constants/dashboardTabs';

const tabIcons = {
    home: LayoutDashboard,
    integrations: Plug,
    history: History,
    settings: BookOpen,
};

const SidebarItem = ({ icon: Icon, label, isActive, href }) => {
    const { t } = useText();
    return <Link
        to={href}
        aria-current={isActive ? 'page' : undefined}
        className={`relative flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition-colors duration-300 ${
            isActive 
                ? 'text-white' 
                : 'text-muted hover:bg-white/5 hover:text-white'
        }`}
    >
        {isActive && (
            <motion.span
                layoutId="sidebar-active"
                className="absolute inset-0 rounded-lg border border-spotify/25 bg-spotify/15"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            />
        )}
        <Icon aria-hidden="true" size={20} className={`relative z-10 ${isActive ? 'text-spotify' : ''}`} />
        <span className="relative z-10">{t(label)}</span>
    </Link>;
};

const Sidebar = ({ activeTab }) => {
    const { t } = useText();
    return (
        <aside className="relative z-30 hidden w-72 flex-col border-r border-white/10 bg-black/60 md:flex">
            <div className="flex h-20 items-center border-b border-white/10 px-6">
                <Link to="/dashboard" className="flex items-center gap-3 text-spotify" aria-label="SyncSphere">
                    <div className="grid h-10 w-10 place-items-center rounded-lg border border-spotify/25 bg-spotify/15">
                        <RefreshCw size={20} className="text-spotify" />
                    </div>
                    <p translate="no" className="text-xl font-extrabold text-white">SyncSphere</p>
                </Link>
            </div>

            <nav className="flex-1 space-y-2 px-4 py-6">
                <p className="mb-4 px-4 text-xs font-bold uppercase text-gray-300">{t("Menu")}</p>
                <LayoutGroup>
                    {DASHBOARD_TABS.map((tab) => (
                        <SidebarItem
                            key={tab.id}
                            icon={tabIcons[tab.id]}
                            label={t(tab.label)}
                            isActive={activeTab === tab.id}
                            href={getDashboardTabUrl(tab.id)}
                        />
                    ))}
                </LayoutGroup>
            </nav>
        </aside>
    );
};

export default Sidebar;
