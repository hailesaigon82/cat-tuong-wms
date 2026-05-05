// src/lib/api.ts
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

// ─── Token storage ────────────────────────────────────────────────────────
export const tokenStorage = {
  getAccess: (): string | null =>
    typeof window !== "undefined" ? localStorage.getItem("wms_access_token") : null,
  getRefresh: (): string | null =>
    typeof window !== "undefined" ? localStorage.getItem("wms_refresh_token") : null,
  set: (accessToken: string, refreshToken: string) => {
    localStorage.setItem("wms_access_token", accessToken);
    localStorage.setItem("wms_refresh_token", refreshToken);
  },
  clear: () => {
    localStorage.removeItem("wms_access_token");
    localStorage.removeItem("wms_refresh_token");
  },
};

// ─── Error class ──────────────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(public status: number, message: string, public data?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

// ─── Refresh token ────────────────────────────────────────────────────────
let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = tokenStorage.getRefresh();
  if (!refreshToken) return null;

  if (isRefreshing) {
    return new Promise((resolve) => refreshQueue.push(resolve));
  }

  isRefreshing = true;
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      tokenStorage.clear();
      refreshQueue.forEach((cb) => cb(null));
      refreshQueue = [];
      return null;
    }
    const data = await res.json();
    localStorage.setItem("wms_access_token", data.accessToken);
    refreshQueue.forEach((cb) => cb(data.accessToken));
    refreshQueue = [];
    return data.accessToken;
  } catch {
    tokenStorage.clear();
    refreshQueue.forEach((cb) => cb(null));
    refreshQueue = [];
    return null;
  } finally {
    isRefreshing = false;
  }
}

// ─── Friendly error messages ──────────────────────────────────────────────
function getFriendlyMessage(status: number, serverMessage?: string): string {
  if (status === 401) return serverMessage ?? "Tên đăng nhập hoặc mật khẩu không đúng";
  if (status === 403) return serverMessage ?? "Bạn không có quyền thực hiện thao tác này";
  if (status === 404) return serverMessage ?? "Không tìm thấy dữ liệu";
  if (status === 400) return serverMessage ?? "Dữ liệu không hợp lệ";
  if (status === 429) return "Quá nhiều yêu cầu, vui lòng thử lại sau";
  if (status >= 500)  return "Máy chủ đang gặp sự cố, vui lòng thử lại sau giây lát";
  return serverMessage ?? `Lỗi ${status}`;
}

// ─── Core fetch ───────────────────────────────────────────────────────────
interface FetchOptions extends RequestInit {
  skipAuth?: boolean;       // true → không gửi token, không auto-refresh
  skipRefresh?: boolean;    // true → có gửi token nhưng không auto-refresh khi 401
}

export async function apiFetch<T = unknown>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { skipAuth = false, skipRefresh = false, ...init } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };

  if (!skipAuth) {
    const token = tokenStorage.getAccess();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let res = await fetch(`${BASE_URL}${path}`, { ...init, headers });

  // Auto-refresh khi token hết hạn — KHÔNG áp dụng cho auth routes
  if (res.status === 401 && !skipAuth && !skipRefresh) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`;
      res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
    } else {
      // Refresh thất bại → về login, nhưng KHÔNG redirect nếu đang ở /login
      tokenStorage.clear();
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
      throw new ApiError(401, "Phiên đăng nhập hết hạn, vui lòng đăng nhập lại");
    }
  }

  // Parse response body
  let data: unknown;
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    data = await res.json();
  }

  if (!res.ok) {
    const serverMessage = (data as any)?.message;
    throw new ApiError(res.status, getFriendlyMessage(res.status, serverMessage), data);
  }

  return data as T;
}

// ─── Typed methods ────────────────────────────────────────────────────────
export const api = {
  get:    <T>(path: string) =>
    apiFetch<T>(path, { method: "GET" }),

  post:   <T>(path: string, body?: unknown, opts?: FetchOptions) =>
    apiFetch<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined, ...opts }),

  put:    <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),

  delete: <T>(path: string) =>
    apiFetch<T>(path, { method: "DELETE" }),
};
