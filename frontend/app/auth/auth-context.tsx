"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { apiFetch, apiUrl, readApiResponse } from "../lib/api";

type AuthUser = {
  id: number;
  email: string;
  name: string;
};

type LoginInput = {
  email: string;
  password: string;
};

type LoginResponse = {
  accessToken: string;
  expiresIn: number;
  user: AuthUser;
};

type AuthContextValue = {
  accessToken: string | null;
  user: AuthUser | null;
  isAuthReady: boolean;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  authorizedFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  clearAuth: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);
let refreshRequest: Promise<LoginResponse> | null = null;

function requestSessionRefresh() {
  if (!refreshRequest) {
    refreshRequest = apiFetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include"
    })
      .then(async (response) => {
        return readApiResponse<LoginResponse>(response, "세션을 복구할 수 없습니다.");
      })
      .finally(() => {
        refreshRequest = null;
      });
  }

  return refreshRequest;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // 액세스 토큰은 localStorage나 쿠키가 아닌 React 메모리에만 보관한다.
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    void requestSessionRefresh()
      .then((result) => {
        setAccessToken(result.accessToken);
        setUser(result.user);
      })
      .catch(() => {
        setAccessToken(null);
        setUser(null);
      })
      .finally(() => {
        setIsAuthReady(true);
      });
  }, []);

  async function login(input: LoginInput) {
    const response = await apiFetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(input)
    });

    const result = await readApiResponse<LoginResponse>(response, "로그인 중 문제가 발생했습니다.");
    setAccessToken(result.accessToken);
    setUser(result.user);
  }

  function clearAuth() {
    setAccessToken(null);
    setUser(null);
  }

  async function logout() {
    try {
      await apiFetch("/api/auth/logout", {
        method: "POST",
        credentials: "include"
      });
    } finally {
      // 네트워크 오류가 있더라도 현재 탭의 액세스 토큰은 즉시 제거한다.
      clearAuth();
    }
  }

  async function authorizedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
    if (!accessToken) {
      throw new Error("로그인이 필요합니다.");
    }

    const sendRequest = (token: string) => {
      const headers = new Headers(init.headers);
      headers.set("Authorization", `Bearer ${token}`);

      return fetch(input, {
        ...init,
        headers,
        credentials: "include"
      });
    };

    const response = await sendRequest(accessToken);

    if (response.status !== 401) {
      return response;
    }

    try {
      const refreshed = await requestSessionRefresh();
      setAccessToken(refreshed.accessToken);
      setUser(refreshed.user);
      return sendRequest(refreshed.accessToken);
    } catch {
      clearAuth();
      throw new Error("로그인이 만료되었습니다. 다시 로그인해주세요.");
    }
  }

  const value = useMemo(
    () => ({ accessToken, user, isAuthReady, login, logout, authorizedFetch, clearAuth }),
    [accessToken, user, isAuthReady]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth는 AuthProvider 안에서 사용해야 합니다.");
  }

  return context;
}
