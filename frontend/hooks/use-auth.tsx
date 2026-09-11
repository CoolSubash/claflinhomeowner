"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import type { AuthSession, User } from "@/lib/types";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type LoginResult =
  | { ok: true }
  | { ok: false; message: string; code?: "EMAIL_NOT_VERIFIED" };

interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  // A getter, not a plain field: the token lives in a ref (see below) so
  // reading it never goes stale between renders - only components that
  // need to attach it to a request (e.g. a POST to a permission-gated API
  // route) should call this, right before the request.
  getAccessToken: () => string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Refresh a bit before the access token actually expires, so a request
// mid-flight never races an expiring token.
const REFRESH_LEAD_SECONDS = 60;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const accessTokenRef = useRef<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applySessionRef = useRef<((session: AuthSession) => Promise<boolean>) | null>(null);

  useEffect(() => {
    const clearRefreshTimer = () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };

    const fetchCurrentUser = async (accessToken: string): Promise<User | null> => {
      const response = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      if (!response.ok) return null;
      return (await response.json()) as User;
    };

    // applySession and refreshSession call each other (a session, once
    // applied, schedules the next silent refresh) - both are defined here
    // so the recursive closure stays valid for the life of the provider.
    const applySession = async (session: AuthSession): Promise<boolean> => {
      accessTokenRef.current = session.access_token;
      const currentUser = await fetchCurrentUser(session.access_token);
      if (!currentUser) {
        accessTokenRef.current = null;
        setUser(null);
        setStatus("unauthenticated");
        return false;
      }
      setUser(currentUser);
      setStatus("authenticated");
      clearRefreshTimer();
      const delayMs = Math.max(session.expires_in - REFRESH_LEAD_SECONDS, 5) * 1000;
      refreshTimerRef.current = setTimeout(() => {
        void refreshSession();
      }, delayMs);
      return true;
    };

    const refreshSession = async (): Promise<boolean> => {
      const response = await fetch("/api/auth/refresh", { method: "POST", cache: "no-store" });
      if (!response.ok) {
        accessTokenRef.current = null;
        setUser(null);
        setStatus("unauthenticated");
        return false;
      }
      const session = (await response.json()) as AuthSession;
      return applySession(session);
    };

    applySessionRef.current = applySession;
    void refreshSession();

    return clearRefreshTimer;
    // Runs once: the closures above only ever write via stable setState
    // functions and refs, so they never read stale state from this render.
  }, []);

  const login = async (email: string, password: string): Promise<LoginResult> => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();

    if (!response.ok) {
      const message =
        typeof data?.detail === "string" ? data.detail : "Unable to sign in. Please try again.";
      return { ok: false, message, code: response.status === 403 ? "EMAIL_NOT_VERIFIED" : undefined };
    }

    const applied = await applySessionRef.current?.(data as AuthSession);
    if (!applied) {
      return { ok: false, message: "Unable to sign in. Please try again." };
    }
    return { ok: true };
  };

  const logout = async (): Promise<void> => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      accessTokenRef.current = null;
      setUser(null);
      setStatus("unauthenticated");
    }
  };

  const getAccessToken = () => accessTokenRef.current;

  return (
    <AuthContext.Provider value={{ user, status, login, logout, getAccessToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
