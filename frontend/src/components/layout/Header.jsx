import { useState } from 'react';
import { Command, Server } from 'lucide-react';
import UserFloatingMenu from '../ui/UserFloatingMenu';
import { DASHBOARD_TAB_LABELS } from '../../constants/dashboardTabs';

const Header = ({ user, activeTab }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <header className="relative z-20 flex h-20 items-center justify-between border-b border-white/10 px-5 sm:px-8">
            <div className="flex min-w-0 items-center gap-3">
                <div className="hidden h-10 items-center gap-3 rounded-lg border border-white/10 bg-white/[0.045] px-4 text-sm text-muted sm:flex">
                    <Command size={16} className="text-spotify" />
                    <span className="truncate">{DASHBOARD_TAB_LABELS[activeTab] || 'Painel'}</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-spotify/20 bg-spotify/10 px-3 py-2 text-xs font-bold text-spotify">
                    <Server size={14} />
                    Local
                </div>
            </div>
            
            <div className="flex items-center gap-4">
                <div className="relative">
                    <button 
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="flex items-center gap-3 transition-opacity hover:opacity-85 focus:outline-none"
                    >
                        <div className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-white/15 bg-white/[0.08] font-bold text-white transition-colors hover:bg-white/[0.12]">
                            {user?.name?.charAt(0)?.toUpperCase()}
                        </div>
                    </button>
                    
                    <UserFloatingMenu 
                        isOpen={isMenuOpen} 
                        onClose={() => setIsMenuOpen(false)} 
                        user={user}
                    />
                </div>
            </div>
        </header>
    );
};

export default Header;
