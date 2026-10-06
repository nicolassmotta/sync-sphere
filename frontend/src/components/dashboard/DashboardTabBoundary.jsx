import { Component } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { useText } from '../../i18n/useText';
import Button from '../ui/Button';

const reloadPanel = () => window.location.reload();
const TabFailure = ({ onReload }) => {
    const { t } = useText();
    return <div role="alert" className="elevated-card mx-auto max-w-2xl p-6 sm:p-8">
        <AlertTriangle aria-hidden="true" size={28} className="text-amber-200" />
        <h1 className="mt-4 text-2xl font-bold text-white">{t('Não foi possível abrir esta tela.')}</h1>
        <p className="mt-3 text-sm leading-7 text-muted">{t('Recarregue o painel para tentar novamente. Suas migrações continuam salvas.')}</p>
        <Button className="mt-5" variant="primary" leftIcon={<RotateCw aria-hidden="true" size={16} />} onClick={onReload}>{t('Recarregar painel')}</Button>
    </div>;
};

class DashboardTabBoundary extends Component {
    state = { failed: false };

    static getDerivedStateFromError() { return { failed: true }; }

    render() {
        return this.state.failed ? <TabFailure onReload={this.props.onReload || reloadPanel} /> : this.props.children;
    }
}

export default DashboardTabBoundary;
