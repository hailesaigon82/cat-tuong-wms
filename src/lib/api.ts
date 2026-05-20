// src/lib/api.ts
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const DEFAULT_TIMEOUT_MS = 30000;
const ACCESS_TOKEN_KEY = "wms_access_token";
const REFRESH_TOKEN_KEY = "wms_refresh_token";

function clearLegacyLocalStorageTokens() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

// ─── Token storage ────────────────────────────────────────────────────────
export const tokenStorage = {
  getAccess: (): string | null => {
    if (typeof window === "undefined") return null;
    clearLegacyLocalStorageTokens();
    return sessionStorage.getItem(ACCESS_TOKEN_KEY);
  },
  getRefresh: (): string | null => {
    if (typeof window === "undefined") return null;
    clearLegacyLocalStorageTokens();
    return sessionStorage.getItem(REFRESH_TOKEN_KEY);
  },
  setAccess: (accessToken: string) => {
    if (typeof window === "undefined") return;
    clearLegacyLocalStorageTokens();
    sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  },
  set: (accessToken: string, refreshToken: string) => {
    if (typeof window === "undefined") return;
    clearLegacyLocalStorageTokens();
    sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },
  clear: () => {
    if (typeof window === "undefined") return;
    clearLegacyLocalStorageTokens();
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

// ─── Error class ──────────────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(public status: number, message: string, public data?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const sourceSignal = init.signal;

  const abortFromSource = () => controller.abort();
  if (sourceSignal) {
    if (sourceSignal.aborted) controller.abort();
    else sourceSignal.addEventListener("abort", abortFromSource, { once: true });
  }

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError(0, "Yêu cầu quá lâu, vui lòng thử lại");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
    sourceSignal?.removeEventListener("abort", abortFromSource);
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
    const res = await fetchWithTimeout(`${BASE_URL}/auth/refresh`, {
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
    tokenStorage.setAccess(data.accessToken);
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
  timeoutMs?: number;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { skipAuth = false, skipRefresh = false, timeoutMs = DEFAULT_TIMEOUT_MS, ...init } = options;

  const headers = new Headers(init.headers);

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (!skipAuth) {
    const token = tokenStorage.getAccess();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  let res: Response;
  try {
    res = await fetchWithTimeout(`${BASE_URL}${path}`, { ...init, headers }, timeoutMs);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(0, "Không thể kết nối máy chủ, vui lòng thử lại");
  }

  // Auto-refresh khi token hết hạn — KHÔNG áp dụng cho auth routes
  if (res.status === 401 && !skipAuth && !skipRefresh) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers.set("Authorization", `Bearer ${newToken}`);
      try {
        res = await fetchWithTimeout(`${BASE_URL}${path}`, { ...init, headers }, timeoutMs);
      } catch (err) {
        if (err instanceof ApiError) throw err;
        throw new ApiError(0, "Không thể kết nối máy chủ, vui lòng thử lại");
      }
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
