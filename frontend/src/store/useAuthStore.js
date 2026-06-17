import { create } from 'zustand';

// Usuário local fixo: no modo self-hosted não há contas nem login.
const LOCAL_USER = { id: 'local', name: 'Você', email: null };

export const useAuthStore = create((set) => ({
    user: LOCAL_USER,
    isAuthenticated: true,
    isCheckingAuth: true, // Começa true só para alinhar o primeiro render; resolvido por checkAuth.

    // Ações básicas (mantidas para compatibilidade com componentes existentes).
    login: () => set({ user: LOCAL_USER, isAuthenticated: true }),
    logout: () => set({ user: LOCAL_USER, isAuthenticated: true }),
    updateUser: (userData) => set((state) => ({ user: { ...state.user, ...userData } })),

    // Modo local: não há login. A sessão já começa autenticada como o dono da máquina.
    checkAuth: async () => {
        set({
            user: LOCAL_USER,
            isAuthenticated: true,
            isCheckingAuth: false,
        });
    },
}));
