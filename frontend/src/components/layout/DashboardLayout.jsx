import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useText } from '../../i18n/useText';
import Sidebar from './Sidebar';
import Header from './Header';
import { DASHBOARD_TABS, getDashboardTabUrl } from '../../constants/dashboardTabs';

const DashboardLayout = ({ children, activeTab, setActiveTab }) => {
    const { t } = useText();
    const mainRef = useRef(null);
    const previousTab = useRef(activeTab);
    useEffect(() => {
        if (previousTab.current !== activeTab) mainRef.current?.focus();
        previousTab.current = activeTab;
    }, [activeTab]);
    return (
        <div className="app-shell flex min-h-screen overflow-hidden text-ink selection:bg-spotify/30">
            <a href="#dashboard-content" className="skip-link">{t("Pular para o conteúdo")}</a>
            <Sidebar activeTab={activeTab} />
            
            <div className="relative z-10 flex min-w-0 flex-1 flex-col border-l border-white/10 bg-black/35 backdrop-blur-3xl shadow-2xl">
                <Header activeTab={activeTab} onOpenHelp={() => setActiveTab('settings')} />

                <nav className="sticky top-20 z-20 flex gap-2 overflow-x-auto bg-darkBackground border-b border-white/10 px-4 py-3 md:hidden" aria-label={t("Navegação do painel")}>
                    {DASHBOARD_TABS.map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (
                            <Link
                                key={tab.id}
                                to={getDashboardTabUrl(tab.id)}
                                aria-current={isActive ? 'page' : undefined}
                                className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
                                    isActive
                                        ? 'border-spotify/30 bg-spotify/15 text-spotify'
                                        : 'border-white/10 bg-white/[0.045] text-muted hover:text-white'
                                }`}
                            >
                                {t(tab.label)}
                            </Link>
                        );
                    })}
                </nav>
                
                <main ref={mainRef} id="dashboard-content" tabIndex={-1} className="w-full flex-1 overflow-y-auto p-5 sm:p-8 lg:p-10">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default DashboardLayout;
