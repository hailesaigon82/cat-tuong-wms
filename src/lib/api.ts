// src/lib/api.ts
// API client tập trung — xử lý auth header, token refresh, error handling

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

// ─── Token storage helpers ────────────────────────────────────────────────
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

// ─── Refresh access token tự động ────────────────────────────────────────
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = tokenStorage.getRefresh();
  if (!refreshToken) return null;

  if (isRefreshing) {
    // Nếu đang refresh rồi, chờ kết quả thay vì gọi thêm
    return new Promise((resolve) => {
      refreshQueue.push(resolve);
    });
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
      return null;
    }

    const data = await res.json();
    localStorage.setItem("wms_access_token", data.accessToken);

    // Giải phóng queue
    refreshQueue.forEach((cb) => cb(data.accessToken));
    refreshQueue = [];

    return data.accessToken;
  } finally {
    isRefreshing = false;
  }
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────
interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { skipAuth = false, ...init } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };

  if (!skipAuth) {
    const token = tokenStorage.getAccess();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let res = await fetch(`${BASE_URL}${path}`, { ...init, headers });

  // Token hết hạn → thử refresh
  if (res.status === 401 && !skipAuth) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`;
      res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
    } else {
      // Refresh thất bại → về login
      tokenStorage.clear();
      window.location.href = "/login";
      throw new ApiError(401, "Phiên đăng nhập hết hạn");
    }
  }

  // Parse response
  let data: unknown;
  const contentType = res.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    data = await res.json();
  }

  if (!res.ok) {
    const errData = data as any;
    throw new ApiError(
      res.status,
      errData?.message ?? `HTTP ${res.status}`,
      data
    );
  }

  return data as T;
}

// ─── Typed API methods ────────────────────────────────────────────────────
export const api = {
  get: <T>(path: string) =>
    apiFetch<T>(path, { method: "GET" }),

  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(path: string) =>
    apiFetch<T>(path, { method: "DELETE" }),
};
