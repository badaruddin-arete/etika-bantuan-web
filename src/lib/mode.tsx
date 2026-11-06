import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getHealth, type Mode } from "./api";

export type Health = "unknown" | "checking" | "ok" | "down";

const Ctx = createContext<{ mode: Mode; setMode: (m: Mode) => void; health: Health }>({
  mode: "demo",
  setMode: () => {},
  health: "unknown",
});

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>("demo");
  const [health, setHealth] = useState<Health>("unknown");

  // One health check on load and on every toggle change — no polling.
  useEffect(() => {
    let alive = true;
    setHealth("checking");
    getHealth().then((ok) => alive && setHealth(ok ? "ok" : "down"));
    return () => {
      alive = false;
    };
  }, [mode]);

  return <Ctx.Provider value={{ mode, setMode, health }}>{children}</Ctx.Provider>;
}

export const useMode = () => useContext(Ctx);
