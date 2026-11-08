import { act, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getHealth } from "@/lib/api";
import { ModeProvider, useMode } from "@/lib/mode";

vi.mock("@/lib/api", () => ({ getHealth: vi.fn() }));
let state: ReturnType<typeof useMode>;
function Probe() { state = useMode(); return null; }
afterEach(() => vi.resetAllMocks());

describe("Local server mode", () => {
  it("starts in Demo", () => {
    vi.mocked(getHealth).mockResolvedValue(true);
    render(<ModeProvider><Probe /></ModeProvider>);
    expect(state.mode).toBe("demo");
  });
  it("returns to Demo when the Live health check fails", async () => {
    vi.mocked(getHealth).mockResolvedValue(false);
    render(<ModeProvider><Probe /></ModeProvider>);
    act(() => state.setMode("live"));
    await waitFor(() => expect(state.mode).toBe("demo"));
    expect(state.notice).toBeTruthy();
  });
  it("returns to Demo when a Live API call reports a lost connection", () => {
    vi.mocked(getHealth).mockResolvedValue(true);
    render(<ModeProvider><Probe /></ModeProvider>);
    act(() => state.setMode("live"));
    expect(state.mode).toBe("live");
    act(() => state.fallbackToDemo());
    expect(state.mode).toBe("demo");
  });
});