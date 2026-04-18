import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authService } from '../services/auth.service';

const STORAGE_KEY = 'findden_auth';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      loading: false,
      error: null,

      login: async (credentials) => {
        set({ loading: true, error: null });
        try {
          const res = await authService.login(credentials);
          set({ user: res.data.user, token: res.data.token, loading: false });
          return { success: true };
        } catch (err) {
          set({ error: err.message, loading: false });
          return { success: false, error: err.message };
        }
      },

      register: async (data) => {
        set({ loading: true, error: null });
        try {
          const res = await authService.register(data);
          set({ user: res.data.user, token: res.data.token, loading: false });
          return { success: true };
        } catch (err) {
          set({ error: err.message, loading: false });
          return { success: false, error: err.message };
        }
      },

      logout: () => {
        set({ user: null, token: null, error: null });
      },

      clearError: () => set({ error: null }),

      isAuthenticated: () => !!get().token,
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
);
