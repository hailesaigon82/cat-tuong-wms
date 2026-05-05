// src/store/index.ts
// Store mới: auth state từ JWT, data fetch từ API
// Không còn lưu items/transactions trong store — fetch trực tiếp từ backend

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api, tokenStorage, ApiError } from "@/lib/api";
import type { LoginResponse, ApiUser } from "@/types/api";

interface AuthStore {
  currentUser: (ApiUser & { permissions: string[] }) | null;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
  can: (permission: string) => boolean;
  hydrate: () => Promise<void>;
}

export const useAppStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      currentUser: null,
      isLoading: false,
      error: null,

      login: async (username, password) => {
        set({ isLoading: true, error: null });
        try {
          const res = await api.post<LoginResponse>("/auth/login", { username, password });
          tokenStorage.set(res.accessToken, res.refreshToken);
          set({ currentUser: res.user, isLoading: false });
          return true;
        } catch (err) {
          const message = err instanceof ApiError ? err.message : "Đã xảy ra lỗi, vui lòng thử lại";
          set({ error: message, isLoading: false });
          return false;
        }
      },

      logout: async () => {
        const refreshToken = tokenStorage.getRefresh();
        if (refreshToken) {
          try { await api.post("/auth/logout", { refreshToken }); } catch {}
        }
        tokenStorage.clear();
        set({ currentUser: null });
      },

      clearError: () => set({ error: null }),

      can: (permission: string) => {
        const { currentUser } = get();
        if (!currentUser) return false;
        return currentUser.permissions.includes(permission);
      },

      hydrate: async () => {
        const token = tokenStorage.getAccess();
        if (!token) return;
        try {
          const user = await api.get<ApiUser & { permissions: string[] }>("/auth/me");
          set({ currentUser: user });
        } catch {
          tokenStorage.clear();
          set({ currentUser: null });
        }
      },
    }),
    {
      name: "cat-tuong-auth",
      partialize: (state) => ({ currentUser: state.currentUser }),
    }
  )
);

export const ROLE_NAMES: Record<string, string> = {
  admin:     "Quản trị viên",
  manager:   "Quản lý",
  office:    "Nhân viên văn phòng",
  warehouse: "Nhân viên kho",
};
