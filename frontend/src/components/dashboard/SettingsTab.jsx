import { BookOpen } from 'lucide-react';
import FadeInPage from '../ui/FadeInPage';
import LocalSetupGuide from '../setup/LocalSetupGuide';
import SetupChecklist from '../setup/SetupChecklist';

const SettingsTab = ({
    integrations,
    integrationsLoading,
    refreshIntegrations,
    refreshSystemStatus,
    setActiveTab,
    systemStatus,
    systemStatusLoading,
}) => {
    return (
        <FadeInPage className="mx-auto w-full max-w-6xl">
            <div className="mb-8">
                <h2 className="mb-2 flex items-center gap-3 text-4xl font-black text-white">
                    <BookOpen className="text-spotify" /> Guia local
                </h2>
                <p className="max-w-3xl text-muted">
                    Tutorial embutido para rodar o projeto, validar dependências e resolver erros comuns sem sair do painel.
                </p>
            </div>

            <div className="space-y-6">
                <SetupChecklist
                    integrations={integrations}
                    onOpenHistory={() => setActiveTab('history')}
                    onOpenIntegrations={() => setActiveTab('integrations')}
                    onRefreshIntegrations={refreshIntegrations}
                    onRefreshSystemStatus={refreshSystemStatus}
                    refreshLoading={integrationsLoading || systemStatusLoading}
                    systemStatus={systemStatus}
                />
                <LocalSetupGuide />
            </div>
        </FadeInPage>
    );
};

export default SettingsTab;
