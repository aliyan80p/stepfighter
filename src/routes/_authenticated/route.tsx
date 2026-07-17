import { createFileRoute, Outlet, redirect, Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Gauge,
  BookOpen,
  Landmark,
  History,
  HelpCircle,
  Search,
  GraduationCap,
  ClipboardList,
  LineChart,
  Calculator,
  BarChart2,
  Users,
  Sparkles,
  PieChart,
  UserCog,
  Settings,
  RotateCcw,
  LogOut,
  ChevronDown,
  Library,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Item = { to: string; label: string; icon: React.ComponentType<{ className?: string }> };
type Group = { key: string; label: string; icon: React.ComponentType<{ className?: string }>; items: Item[] };

const groups: Group[] = [
  {
    key: "courses",
    label: "Courses",
    icon: BookOpen,
    items: [{ to: "/courses/my-courses", label: "My Courses", icon: BookOpen }],
  },
  {
    key: "qbanks",
    label: "Qbanks",
    icon: Landmark,
    items: [
      { to: "/tests", label: "Previous Test", icon: History },
      { to: "/new-test", label: "Generate Quiz", icon: HelpCircle },
      { to: "/qbanks/search", label: "Search", icon: Search },
    ],
  },
  {
    key: "self",
    label: "Self Assessments",
    icon: GraduationCap,
    items: [
      { to: "/self-assessments/assessments", label: "Assessments", icon: ClipboardList },
      { to: "/self-assessments/report", label: "Report", icon: LineChart },
      { to: "/self-assessments/score-predictor", label: "Score Predictor", icon: Calculator },
      { to: "/self-assessments/nbme-library", label: "NBME Library", icon: Library },
    ],
  },
  {
    key: "performance",
    label: "Performance",
    icon: BarChart2,
    items: [
      { to: "/performance/overall", label: "Overall", icon: PieChart },
      { to: "/performance/peer-ranking", label: "Peer Ranking", icon: Users },
      { to: "/performance/ai-test-analysis", label: "AI Test Analysis", icon: Sparkles },
      { to: "/performance/score-calculator", label: "Score Calculator", icon: Calculator },
      { to: "/performance/graphs", label: "Graphs", icon: LineChart },
    ],
  },
  {
    key: "account",
    label: "Account",
    icon: UserCog,
    items: [
      { to: "/account/settings", label: "Settings", icon: Settings },
      { to: "/account/reset", label: "Reset", icon: RotateCcw },
    ],
  },
];

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const initialOpen = () => {
    const state: Record<string, boolean> = {};
    for (const g of groups) state[g.key] = g.items.some((i) => pathname.startsWith(i.to));
    // default: open Courses like the reference
    if (!Object.values(state).some(Boolean)) state.courses = true;
    return state;
  };
  const [open, setOpen] = useState<Record<string, boolean>>(initialOpen);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth" });
  };

  const isActive = (to: string) => pathname === to || pathname.startsWith(to + "/");

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="w-64 border-r border-border flex flex-col bg-card/40">
        <Link to="/dashboard" className="flex items-center gap-2 px-4 h-14 border-b border-border">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-sm">
            IMD
          </div>
          <span className="font-semibold">QBank</span>
        </Link>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {/* Welcome / Dashboard */}
          <Link
            to="/dashboard"
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive("/dashboard")
                ? "bg-primary/15 text-primary border-l-2 border-primary"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Gauge className="h-4 w-4" />
            Welcome
          </Link>

          {groups.map((g) => {
            const isOpen = open[g.key];
            const groupActive = g.items.some((i) => isActive(i.to));
            return (
              <div key={g.key} className="pt-1">
                <button
                  type="button"
                  onClick={() => setOpen((o) => ({ ...o, [g.key]: !o[g.key] }))}
                  className={cn(
                    "w-full flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors",
                    groupActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="flex items-center gap-3">
                    <g.icon className="h-4 w-4" />
                    {g.label}
                  </span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen ? "" : "-rotate-90")} />
                </button>
                {isOpen && (
                  <div className="mt-1 ml-3 pl-3 border-l border-border space-y-0.5">
                    {g.items.map((i) => (
                      <Link
                        key={i.to}
                        to={i.to}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                          isActive(i.to)
                            ? "bg-accent text-accent-foreground"
                            : "text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground",
                        )}
                      >
                        <i.icon className="h-4 w-4" />
                        {i.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border space-y-4">
          <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start">
            <LogOut className="h-4 w-4 mr-2" /> Logout
          </Button>

          <div className="space-y-3 text-center">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">USMLE Step 1 Qbank (Trial)</p>
              <p className="text-sm font-semibold">Expiration Date</p>
              <p className="text-xs text-muted-foreground">Aug 19, 2025</p>
              <Button size="sm" className="mt-1 h-7 px-4">Renew</Button>
            </div>
            <div className="space-y-1 pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground">USMLE Step 2 CK Qbank</p>
              <p className="text-sm font-semibold">Expiration Date</p>
              <p className="text-xs text-muted-foreground">Sep 22, 2026</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
