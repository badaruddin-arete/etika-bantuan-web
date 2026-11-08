import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getHealth, type Mode } from "./api";

export type Health = "unknown" | "checking" | "ok" | "down";

export const PESAN_KEMBALI_DEMO = "Server lokal tidak terhubung. Kembali ke mode Demo.";

const Ctx = createContext<{ mode: Mode; setMode: (m: Mode) => void; health: Health; notice: string | null; fallbackToDemo: () => void }>({
  mode: "demo",
  setMode: () => {},
  health: "unknown",
  notice: null,
  fallbackToDemo: () => {},
});

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, updateMode] = useState<Mode>("demo");
  const [health, setHealth] = useState<Health>("unknown");
  const [notice, setNotice] = useState<string | null>(null);
  const setMode = (m: Mode) => { setNotice(null); updateMode(m); };
  const fallbackToDemo = () => { setNotice(PESAN_KEMBALI_DEMO); updateMode("demo"); };

  // One health check on load and on every toggle change — no polling.
  useEffect(() => {
    let alive = true;
    setHealth("checking");
    getHealth().then((ok) => {
      if (!alive) return;
      setHealth(ok ? "ok" : "down");
      if (!ok && mode === "live") {
        setNotice(PESAN_KEMBALI_DEMO);
        updateMode("demo");
      }
    });
    return () => {
      alive = false;
    };
  }, [mode]);

  return <Ctx.Provider value={{ mode, setMode, health, notice, fallbackToDemo }}>{children}</Ctx.Provider>;
}

export const useMode = () => useContext(Ctx);
