// src/store/index.ts
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
          // skipRefresh: true — nếu sai pass trả 401, không cố refresh token
          const res = await api.post<LoginResponse>("/auth/login", { username, password }, { skipRefresh: true });
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

      clearError: () => set({ error: null }),

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
          const user = await api.get<ApiUser & { permissions: string[] }>("/auth/me");
          set({ currentUser: user });
        } catch (err) {
          // Token hết hạn hoặc lỗi → clear, nhưng KHÔNG set error (tránh hiện lỗi ở login page)
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
