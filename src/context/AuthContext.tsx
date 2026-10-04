import React, { createContext, useContext, useState, useEffect } from "react";
import { User, UserSettings, QuotaStatus } from "../types";

interface AuthContextType {
  user: User | null;
  quota: QuotaStatus | null;
  settings: UserSettings | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  updateSettings: (partial: Partial<UserSettings>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("bharmashira_token"));
  const [loading, setLoading] = useState<boolean>(true);

  const refreshMe = async () => {
    const savedToken = localStorage.getItem("bharmashira_token");
    if (!savedToken) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/me", {
        headers: {
          Authorization: `Bearer ${savedToken}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setQuota(data.quota);
        setSettings(data.settings);
      } else {
        localStorage.removeItem("bharmashira_token");
        setToken(null);
        setUser(null);
      }
    } catch {
      // Network or offline
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshMe();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Login failed");
    }

    localStorage.setItem("bharmashira_token", data.token);
    setToken(data.token);
    setUser(data.user);
    setQuota(data.quota);
    setSettings(data.settings);
  };

  const register = async (email: string, password: string) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Registration failed");
    }

    localStorage.setItem("bharmashira_token", data.token);
    setToken(data.token);
    setUser(data.user);
    setQuota(data.quota);
    setSettings(data.settings);
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    localStorage.removeItem("bharmashira_token");
    setToken(null);
    setUser(null);
    setQuota(null);
    setSettings(null);
  };

  const updateSettings = async (partial: Partial<UserSettings>) => {
    if (!token) return;
    const nextSettings = { ...settings, ...partial } as UserSettings;
    setSettings(nextSettings);

    try {
      await fetch("/api/auth/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(partial),
      });
    } catch {
      // ignore
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        quota,
        settings,
        token,
        loading,
        login,
        register,
        logout,
        refreshMe,
        updateSettings,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
