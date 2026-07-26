import { createFileRoute, Outlet, redirect, Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
  StickyNote,
  CalendarDays,
  Zap,
  Flag,
  Menu,
  PanelLeftClose,
  Shield,
  PlusCircle,
  CreditCard,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TrialBanner } from "@/components/trial-banner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { isCurrentUserAdmin } from "@/lib/admin.functions";
import logoAsset from "@/assets/stepfighter-logo.png.asset.json";
import { getMyEntitlement, QBANK_ID_TO_SLUG } from "@/lib/entitlements.functions";
import { QBANKS, useActiveQbankId, setActiveQbankId } from "@/lib/active-qbank";
import { PageLoader } from "@/components/loader";




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
      { to: "/performance/improvements", label: "Improvements Required", icon: Flag },
      { to: "/performance/score-calculator", label: "Score Calculator", icon: Calculator },
      { to: "/performance/graphs", label: "Performance Charts", icon: LineChart },
    ],
  },
  {
    key: "notes-study",
    label: "Notes and Study",
    icon: StickyNote,
    items: [
      { to: "/notes", label: "Notes", icon: StickyNote },
      { to: "/medical-library", label: "Medical Library", icon: Library },
    ],
  },
  {
    key: "flashcards",
    label: "Flashcards",
    icon: Zap,
    items: [
      { to: "/flashcards/my-decks", label: "My Decks", icon: Zap },
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
    const { data: prof } = await supabase
      .from("profiles")
      .select("mfa_verified_until")
      .eq("id", data.user.id)
      .maybeSingle();
    const until = prof?.mfa_verified_until ? new Date(prof.mfa_verified_until).getTime() : 0;
    if (until <= Date.now()) throw redirect({ to: "/verify-2fa" });
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

  const checkAdminFn = useServerFn(isCurrentUserAdmin);
  const adminQ = useQuery({ queryKey: ["is-admin"], queryFn: () => checkAdminFn(), staleTime: 5 * 60 * 1000 });
  const isAdmin = adminQ.data?.admin === true;

  const entFn = useServerFn(getMyEntitlement);
  const entQ = useQuery({
    queryKey: ["my-entitlement"],
    queryFn: () => entFn(),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const trialEnded = entQ.data?.plan === "expired" || (entQ.data?.plan === "trial" && !entQ.data?.is_active);

  // Enforce single/limited course access: auto-switch active qbank if user has no access to it.
  const activeQbankId = useActiveQbankId();
  const qc = useQueryClient();
  const entitledAccess = entQ.data?.effective_access;
  const currentSlug = QBANK_ID_TO_SLUG[activeQbankId];
  const activeMatchesEntitlement = !entitledAccess || entitledAccess.length === 0 || (currentSlug && entitledAccess.includes(currentSlug));
  useEffect(() => {
    if (!entitledAccess || entitledAccess.length === 0) return;
    if (!currentSlug || !entitledAccess.includes(currentSlug)) {
      const first = QBANKS.find((q) => entitledAccess.includes(QBANK_ID_TO_SLUG[q.id]));
      if (first && first.id !== activeQbankId) {
        setActiveQbankId(first.id);
        // The active qbank drives most data queries; refresh them so pages
        // don't linger on stale results tied to the previous qbank.
        qc.invalidateQueries();
      }
    }
  }, [entitledAccess, activeQbankId, currentSlug, qc]);

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-open");
    if (saved !== null) {
      setSidebarOpen(saved === "1");
    } else {
      setSidebarOpen(window.matchMedia("(min-width: 768px)").matches);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem("sidebar-open", sidebarOpen ? "1" : "0");
  }, [sidebarOpen, hydrated]);

  const signOut = async () => {
    try {
      const { clearMfaVerification } = await import("@/lib/mfa.functions");
      await clearMfaVerification();
    } catch {
      // non-fatal; proceed with sign-out
    }
    await supabase.auth.signOut();
    router.navigate({ to: "/auth" });
  };

  const isActive = (to: string) => pathname === to || pathname.startsWith(to + "/");

  const hideSidebar = /^\/test\//.test(pathname);

  const closeOnMobile = () => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
      setSidebarOpen(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {!hideSidebar && sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      {!hideSidebar && (
      <aside
        className={cn(
          "border-r border-sidebar-border flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-200 z-40",
          "fixed inset-y-0 left-0 md:static",
          sidebarOpen ? "w-64 translate-x-0" : "w-0 -translate-x-full md:w-0 md:translate-x-0 overflow-hidden",
        )}
      >

        <div className="flex items-center justify-between px-4 h-14 border-b border-sidebar-border">
          <Link to="/dashboard" className="flex items-center gap-2" onClick={closeOnMobile}>
            <img src={logoAsset.url} alt="StepFighter" className="h-8 w-8 object-contain bg-white/95 rounded-md p-0.5" />
            <span className="font-semibold">StepFighter</span>
          </Link>
          <button
            type="button"
            aria-label="Collapse sidebar"
            onClick={() => setSidebarOpen(false)}
            className="p-1 rounded text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {/* Welcome / Dashboard */}
          <Link
            to="/dashboard"
            onClick={closeOnMobile}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive("/dashboard")
                ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-sidebar-primary"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <Gauge className="h-4 w-4" />
            Welcome
          </Link>

          {isAdmin && (
            <Link
              to="/admin"
              onClick={closeOnMobile}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive("/admin")
                  ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-sidebar-primary"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              <Shield className="h-4 w-4" />
              Admin
            </Link>
          )}



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
                    groupActive ? "text-sidebar-foreground" : "text-sidebar-foreground/70 hover:text-sidebar-foreground",
                  )}
                >
                  <span className="flex items-center gap-3">
                    <g.icon className="h-4 w-4" />
                    {g.label}
                  </span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen ? "" : "-rotate-90")} />
                </button>
                {isOpen && (
                  <div className="mt-1 ml-3 pl-3 border-l border-sidebar-border space-y-0.5">
                    {g.items.map((i) => (
                      <Link
                        key={i.to}
                        to={i.to}
                        onClick={closeOnMobile}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                          isActive(i.to)
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
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

          <Link
            to="/subscribe-renew"
            onClick={closeOnMobile}
            className={cn(
              "mt-2 flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive("/subscribe-renew")
                ? "bg-primary text-primary-foreground"
                : "bg-primary/10 text-primary hover:bg-primary/20",
            )}
          >
            <CreditCard className="h-4 w-4" />
            Subscribe or Renew
          </Link>

          {trialEnded && (
            <Link
              to="/upgrade"
              onClick={closeOnMobile}
              className={cn(
                "mt-2 flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive("/upgrade")
                  ? "bg-primary text-primary-foreground"
                  : "bg-primary/10 text-primary hover:bg-primary/20",
              )}
            >
              <PlusCircle className="h-4 w-4" />
              Add Course
            </Link>
          )}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <TrialBanner />
          <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
            <LogOut className="h-4 w-4 mr-2" /> Logout
          </Button>
        </div>


      </aside>
      )}

      <main className="flex-1 overflow-auto min-w-0 flex flex-col">
        {!hideSidebar && !sidebarOpen && (
          <button
            type="button"
            aria-label="Open sidebar"
            onClick={() => setSidebarOpen(true)}
            className="hidden md:flex fixed top-3 left-3 z-30 items-center justify-center h-9 w-9 rounded-md border border-border bg-background/90 backdrop-blur shadow-sm hover:bg-accent hover:text-accent-foreground"
          >
            <Menu className="h-4 w-4" />
          </button>
        )}
        {!hideSidebar && !sidebarOpen && (
          <div className="md:hidden sticky top-0 z-30 flex items-center gap-2 h-12 px-3 border-b border-border bg-background/95 backdrop-blur pt-[env(safe-area-inset-top)]">
            <button
              type="button"
              aria-label="Open sidebar"
              onClick={() => setSidebarOpen(true)}
              className="flex items-center justify-center h-9 w-9 -ml-1 rounded-md hover:bg-accent hover:text-accent-foreground"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link to="/dashboard" className="flex items-center gap-2 min-w-0">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-xs">
                SF
              </div>
              <span className="font-semibold truncate">QBank</span>
            </Link>
          </div>
        )}
        <div className="flex-1 min-w-0">
          {trialEnded && !isAllowedWhenLocked(pathname)
            ? <PaywallGate />
            : !activeMatchesEntitlement
              ? <div className="min-h-full grid place-items-center p-6"><PageLoader label="Loading your workspace" /></div>
              : <Outlet />}
        </div>
      </main>
    </div>
  );
}

const LOCKED_ALLOWLIST = [
  "/subscribe-renew",
  "/upgrade",
  "/account/settings",
  "/account/reset",
];

function isAllowedWhenLocked(pathname: string) {
  return LOCKED_ALLOWLIST.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function PaywallGate() {
  return (
    <div className="min-h-full grid place-items-center p-6">
      <div className="max-w-lg w-full rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-primary/10 text-primary grid place-items-center">
          <Lock className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Your subscription has ended</h1>
        <p className="text-muted-foreground mb-6">
          Your free trial has expired. Subscribe or renew to unlock the QBank,
          self-assessments, flashcards, notes, performance analytics and every
          other feature.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/subscribe-renew"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <CreditCard className="h-4 w-4" />
            Subscribe or Renew
          </Link>
          <Link
            to="/upgrade"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-5 py-2.5 text-sm font-semibold hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
            View Plans
          </Link>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          Need help? Email support@stepfighter.com
        </p>
      </div>
    </div>
  );
}

