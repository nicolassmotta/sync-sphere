export const DASHBOARD_TABS = [
    { id: 'home', label: 'Início' },
    { id: 'integrations', label: 'Integrações' },
    { id: 'history', label: 'Histórico' },
    { id: 'settings', label: 'Ajuda e segurança' },
];

export const DASHBOARD_TAB_LABELS = DASHBOARD_TABS.reduce((labels, tab) => {
    labels[tab.id] = tab.label;
    return labels;
}, {});

export const getDashboardTabUrl = (tab) => tab === 'home' ? '/dashboard' : `/dashboard?tab=${tab}`;
