import Sidebar from './Sidebar';
import Header from './Header';
import { DASHBOARD_TABS } from '../../constants/dashboardTabs';

const DashboardLayout = ({ children, activeTab, setActiveTab }) => {
    return (
        <div className="app-shell flex min-h-screen overflow-hidden text-ink selection:bg-spotify/30">
            <a href="#dashboard-content" className="skip-link">Pular para o conteúdo</a>
            <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
            
            <div className="relative z-10 flex min-w-0 flex-1 flex-col border-l border-white/10 bg-black/35 backdrop-blur-3xl shadow-2xl">
                <Header activeTab={activeTab} onOpenHelp={() => setActiveTab('settings')} />

                <nav className="flex gap-2 overflow-x-auto border-b border-white/10 px-4 py-3 md:hidden" aria-label="Navegação do painel">
                    {DASHBOARD_TABS.map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                aria-current={isActive ? 'page' : undefined}
                                className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
                                    isActive
                                        ? 'border-spotify/30 bg-spotify/15 text-spotify'
                                        : 'border-white/10 bg-white/[0.045] text-muted hover:text-white'
                                }`}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </nav>
                
                <main id="dashboard-content" tabIndex={-1} className="w-full flex-1 overflow-y-auto p-5 sm:p-8 lg:p-10">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default DashboardLayout;
