import { useText } from '../../i18n/useText';
import { BookOpen } from 'lucide-react';
import FadeInPage from '../ui/FadeInPage';
import LocalSetupGuide from '../setup/LocalSetupGuide';
import SupportCenter from '../setup/SupportCenter';
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
    const { t } = useText();
    return (
        <FadeInPage className="mx-auto w-full max-w-6xl">
            <div className="mb-8">
                <h1 className="mb-2 flex items-center gap-3 text-4xl font-black text-white">
                    <BookOpen className="text-spotify" aria-hidden="true" />{t(" Ajuda e segurança")}</h1>
                <p className="max-w-3xl text-muted">{t("Orientação para continuar sua migração, proteger seus dados e pedir ajuda sem compartilhar credenciais.")}</p>
            </div>

            <div className="space-y-6">
                <SupportCenter onOpenTab={setActiveTab} />
                <details>
                    <summary className="cursor-pointer text-lg font-semibold text-white">{t("Configuração avançada e instalação pelo código")}</summary>
                <div className="mt-5 space-y-6">
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
                </details>
            </div>
        </FadeInPage>
    );
};

export default SettingsTab;
