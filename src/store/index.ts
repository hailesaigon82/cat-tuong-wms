// src/store/index.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api, tokenStorage, ApiError } from "@/lib/api";
import type { LoginResponse, AuthUser } from "@/types/api";

interface AuthStore {
  currentUser: AuthUser | null;
  hasHydrated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  clearError: () => void;
  can: (permission: string) => boolean;
  hydrate: () => Promise<void>;
  setHasHydrated: (value: boolean) => void;
}

export const useAppStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      currentUser: null,
      hasHydrated: false,
      isLoading: false,
      error: null,

      login: async (username, password) => {
        set({ isLoading: true, error: null });
        try {
          // skipRefresh: true — nếu sai pass trả 401, không cố refresh token
          const res = await api.post<LoginResponse>(
            "/auth/login",
            { username: username.trim().toLowerCase(), password },
            { skipAuth: true, skipRefresh: true }
          );
          tokenStorage.set(res.accessToken, res.refreshToken);
          set({ currentUser: res.user, isLoading: false, error: null });
          return true;
        } catch (err) {
          const message = err instanceof ApiError
            ? err.message
            : "Không thể kết nối máy chủ, vui lòng thử lại";
          set({ error: message, isLoading: false });
          return false;
        }
      },

      logout: async () => {
        const refreshToken = tokenStorage.getRefresh();
        if (refreshToken) {
          try { await api.post("/auth/logout", { refreshToken }, { skipRefresh: true }); } catch {}
        }
        tokenStorage.clear();
        set({ currentUser: null, error: null });
      },

      changePassword: async (currentPassword, newPassword) => {
        await api.post("/auth/change-password", { currentPassword, newPassword });
        tokenStorage.clear();
        set({ currentUser: null, error: null });
      },

      clearError: () => set({ error: null }),
      setHasHydrated: (value) => set({ hasHydrated: value }),

      can: (permission: string) => {
        const { currentUser } = get();
        if (!currentUser) return false;
        return currentUser.permissions.includes(permission);
      },

      // Gọi khi app khởi động — khôi phục session từ token đã lưu
      hydrate: async () => {
        const token = tokenStorage.getAccess();
        if (!token) return; // Không có token → không cần hydrate

        try {
          const user = await api.get<AuthUser>("/auth/me");
          set({ currentUser: user });
        } catch (err) {
          // Chỉ clear session khi server xác nhận token/session không hợp lệ.
          // Lỗi mạng/timeout tạm thời không nên đá user ra login sau refresh trang.
          if (err instanceof ApiError && [401, 403, 404].includes(err.status)) {
            tokenStorage.clear();
            set({ currentUser: null });
          }
        }
      },
    }),
    {
      name: "cat-tuong-auth",
      partialize: (state) => ({ currentUser: state.currentUser }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

export const ROLE_NAMES: Record<string, string> = {
  admin:     "Quản trị viên",
  manager:   "Quản lý",
  office:    "Nhân viên văn phòng",
  warehouse: "Nhân viên kho",
};
