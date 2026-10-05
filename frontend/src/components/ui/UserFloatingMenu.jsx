import { useText } from '../../i18n/useText';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import api from '../../services/api';

const UserFloatingMenu = ({ isOpen, onClose, user }) => {
    const { t } = useText();
    const logout = useAuthStore((state) => state.logout);

    const handleLogout = async () => {
        try {
            await api.post('/auth/logout');
            logout();
        } catch {
            logout();
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <div 
                        className="fixed inset-0 z-40" 
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="absolute right-0 top-14 z-50 w-56 overflow-hidden rounded-lg border border-white/10 bg-surfaceCard/95 shadow-panel backdrop-blur-xl"
                    >
                        <div className="border-b border-white/10 p-4">
                            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
                            <p className="truncate text-xs text-muted">{user?.email}</p>
                        </div>
                        <div className="p-2 space-y-1">
                            <button
                                onClick={handleLogout}
                                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
                            >
                                <LogOut size={16} />{t(" Sair do Sistema")}</button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default UserFloatingMenu;
