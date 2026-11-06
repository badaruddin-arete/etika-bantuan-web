import { createContext, useContext, useState, type ReactNode } from "react";
import type { Mode } from "./api";

const Ctx = createContext<{ mode: Mode; setMode: (m: Mode) => void }>({
  mode: "demo",
  setMode: () => {},
});

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>("demo");
  return <Ctx.Provider value={{ mode, setMode }}>{children}</Ctx.Provider>;
}

export const useMode = () => useContext(Ctx);
