import React, { createContext, useContext, useEffect, useState } from "react";
import { api, setToken, getToken } from "./api.js";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!getToken()) {
      setUser(null);
      return;
    }
    try {
      const { user } = await api.me();
      setUser(user);
    } catch {
      setToken(null);
      setUser(null);
    }
  };

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { token, user } = await api.login(email, password);
    setToken(token);
    setUser(user);
  };
  const signup = async (email, password) => {
    const { token, user } = await api.signup(email, password);
    setToken(token);
    setUser(user);
  };
  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, loading, login, signup, logout, refresh }}>
      {children}
    </Ctx.Provider>
  );
}
