import { create } from 'zustand';
import api from '../services/api';

export const useAuthStore = create((set) => ({
    user: null, // Guarda os dados do usuário vindos do Mongo.
    isAuthenticated: false,
    isCheckingAuth: true, // Começa como true para pausar a renderização enquanto a sessão é conferida.
    
    // Ações básicas.
    login: (userData) => set({ user: userData, isAuthenticated: true }),
    logout: () => set({ user: null, isAuthenticated: false }),
    updateUser: (userData) => set((state) => ({ user: { ...state.user, ...userData } })),

    // Hidrata a sessão sempre que o front-end acorda, como ao recarregar a página.
    checkAuth: async () => {
        try {
            // Pede ao Express para validar o cookie HttpOnly via middleware `protect`.
            const response = await api.get('/auth/me');
            set({ 
                user: response.data.data.user, 
                isAuthenticated: true, 
                isCheckingAuth: false 
            });
        } catch {
            // Se cair aqui, o cookie expirou, foi apagado ou não existe. O front-end volta ao estado inicial.
            set({ 
                user: null, 
                isAuthenticated: false, 
                isCheckingAuth: false 
            });
        }
    }
}));
