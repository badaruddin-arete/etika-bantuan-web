import { Link, useRouterState } from "@tanstack/react-router";
import { ClipboardCheck, Scale, History } from "lucide-react";
import type { ReactNode } from "react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import { Switch } from "@/components/ui/switch";
import { useMode } from "@/lib/mode";

const items = [
  { title: "Audit Batch", url: "/", icon: ClipboardCheck },
  { title: "Perbandingan Etika", url: "/perbandingan", icon: Scale },
  { title: "Riwayat Audit", url: "/riwayat", icon: History },
] as const;

function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-sidebar-border font-serif text-sm">
            EB
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="font-serif text-base">Etika Bantuan</div>
              <div className="text-[11px] text-muted-foreground">Audit tata kelola</div>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigasi</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((it) => (
                <SidebarMenuItem key={it.url}>
                  <SidebarMenuButton asChild isActive={path === it.url} tooltip={it.title}>
                    <Link to={it.url}>
                      <it.icon className="h-4 w-4" />
                      <span>{it.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

function ConnectionChip() {
  const { mode, setMode, health } = useMode();
  const live = mode === "live";
  const tone = !live
    ? "border-warn/40 bg-warn-soft text-warn"
    : health === "down"
      ? "border-bad/40 bg-bad-soft text-bad"
      : health === "ok"
        ? "border-ok/40 bg-ok-soft text-ok"
        : "border-border text-muted-foreground";
  const dot = !live ? "bg-warn" : health === "down" ? "bg-bad" : health === "ok" ? "bg-ok" : "bg-muted-foreground";
  const label = !live
    ? "Demo · Data demo"
    : health === "down"
      ? "Live · Server tidak terjangkau"
      : health === "ok"
        ? "Live · Terhubung"
        : "Live · Memeriksa…";
  return (
    <div className="flex items-center gap-3">
      <span
        role="status"
        className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs ${tone}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        {label}
      </span>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        Live
        <Switch checked={live} onCheckedChange={(v) => setMode(v ? "live" : "demo")} aria-label="Mode live" />
      </label>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-12 items-center justify-between border-b px-3">
            <SidebarTrigger />
            <ConnectionChip />
          </header>
          <main className="flex-1 px-6 py-8">{children}</main>
          <footer className="border-t px-6 py-4 text-xs text-muted-foreground">
            Prototipe portofolio. Parameter kebijakan bersifat ilustratif dan data bersifat fiktif.
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
}
