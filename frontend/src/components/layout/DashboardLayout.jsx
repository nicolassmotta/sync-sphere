import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { RotateCw, ServerOff } from 'lucide-react';
import { useText } from '../../i18n/useText';
import Sidebar from './Sidebar';
import Header from './Header';
import Button from '../ui/Button';
import { DASHBOARD_TABS, getDashboardTabUrl } from '../../constants/dashboardTabs';

const DashboardLayout = ({ children, activeTab, setActiveTab, backendStatus, onRetryConnection, retryingConnection = false }) => {
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
                <Header activeTab={activeTab} backendStatus={backendStatus} onOpenHelp={() => setActiveTab('settings')} />
                {backendStatus === 'offline' && <div role="alert" className="flex flex-col gap-3 border-b border-red-400/30 bg-red-500/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
                    <p className="flex items-start gap-3 text-sm leading-6 text-red-100">
                        <ServerOff size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
                        <span><strong className="font-semibold text-white">{t("O SyncSphere parou de responder.")}</strong>{' '}{t("Confira se a janela do terminal (ou do Iniciar) continua aberta. O progresso fica salvo e continua quando o aplicativo voltar.")}</span>
                    </p>
                    {onRetryConnection && <Button size="sm" variant="secondary" className="shrink-0" onClick={onRetryConnection} loading={retryingConnection} loadingLabel={t("Verificando...")} leftIcon={<RotateCw size={14} aria-hidden="true" />}>{t("Tentar de novo")}</Button>}
                </div>}

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
