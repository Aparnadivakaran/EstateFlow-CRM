// App-wide state: who is logged in, and toast notifications.
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api, auth } from "./api.js";

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

export function AppProvider({ children }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(!!auth.token);   // true while we verify a saved token
  const [bootError, setBootError] = useState(null);
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((message, type = "success") => {
    const id = Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), type === "error" ? 6000 : 3500);
  }, []);

  const logout = useCallback(() => {
    auth.token = null;
    setUser(null);
    queryClient.clear();          // never show the previous user's cached data to the next user
    navigate("/");
  }, [navigate, queryClient]);

  const login = useCallback(({ token, user }) => {
    auth.token = token;
    setUser(user);
    navigate("/");
  }, [navigate]);

  useEffect(() => {
    if (!auth.token) return;
    api.me().then(setUser, (e) => (e.status === 401 ? logout() : setBootError(e))).finally(() => setBooting(false));
  }, []);

  useEffect(() => {
    window.addEventListener("crm:logout", logout);   // api.js fires this when the token expires
    return () => window.removeEventListener("crm:logout", logout);
  }, [logout]);

  return (
    <AppContext.Provider value={{ user, booting, bootError, toast, login, logout }}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={"toast " + t.type}>{t.message}</div>)}
      </div>
    </AppContext.Provider>
  );
}
