import { createFileRoute, Outlet, redirect, Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  Stethoscope,
  BookMarked,
  Layers,
  History,
  Wand2,
  Search,
  Award,
  ClipboardCheck,
  LineChart,
  Calculator,
  TrendingUp,
  Users,
  Sparkles,
  PieChart,
  SlidersHorizontal,
  Settings,
  RotateCcw,
  LogOut,
  ChevronDown,
  NotebookPen,
  StickyNote,
  BookOpen,
  Brain,
  Flag,
  Menu,
  PanelLeftClose,
  ShieldCheck,
  PlusCircle,
  CreditCard,
  Lock,
  Pin,
  PinOff,
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
import { AppearanceQuickPanel } from "@/components/appearance-quick-panel";
import { useUserSettings } from "@/lib/user-settings";

type Item = { to: string; label: string; icon: React.ComponentType<{ className?: string }> };
type Group = {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  iconTint: string;
  items: Item[];
};

const groups: Group[] = [
  {
    key: "courses",
    label: "Courses",
    icon: Stethoscope,
    iconTint: "bg-sky-500/20 text-sky-300",
    items: [{ to: "/courses/my-courses", label: "My Courses", icon: BookMarked }],
  },
  {
    key: "qbanks",
    label: "Qbanks",
    icon: Layers,
    iconTint: "bg-indigo-500/20 text-indigo-300",
    items: [
      { to: "/tests", label: "Previous Test", icon: History },
      { to: "/new-test", label: "Generate Quiz", icon: Wand2 },
      { to: "/qbanks/search", label: "Search", icon: Search },
    ],
  },
  {
    key: "self",
    label: "Self Assessments",
    icon: Award,
    iconTint: "bg-amber-500/20 text-amber-300",
    items: [
      { to: "/self-assessments/assessments", label: "Assessments", icon: ClipboardCheck },
      { to: "/self-assessments/report", label: "Report", icon: LineChart },
      { to: "/self-assessments/score-predictor", label: "Score Predictor", icon: TrendingUp },
    ],
  },
  {
    key: "performance",
    label: "Performance",
    icon: TrendingUp,
    iconTint: "bg-emerald-500/20 text-emerald-300",
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
    icon: NotebookPen,
    iconTint: "bg-rose-500/20 text-rose-300",
    items: [
      { to: "/notes", label: "Notes", icon: StickyNote },
      { to: "/medical-library", label: "Medical Library", icon: BookOpen },
    ],
  },
  {
    key: "flashcards",
    label: "Flashcards",
    icon: Brain,
    iconTint: "bg-purple-500/20 text-purple-300",
    items: [
      { to: "/flashcards/my-decks", label: "My Decks", icon: Layers },
    ],
  },
  {
    key: "account",
    label: "Account",
    icon: SlidersHorizontal,
    iconTint: "bg-teal-500/20 text-teal-300",
    items: [
      { to: "/account/settings", label: "Settings", icon: Settings },
      { to: "/account/reset", label: "Reset", icon: RotateCcw },
    ],
  },
];

const AUTH_CACHE_TTL_MS = 3 * 60 * 1000;
let cachedAuth: { user: any; mfaUntil: number; fetchedAt: number } | null = null;
let authListenerBound = false;

function ensureAuthCacheListener() {
  if (authListenerBound || typeof window === "undefined") return;
  authListenerBound = true;
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT" || event === "USER_UPDATED" || event === "SIGNED_IN") {
      cachedAuth = null;
    }
  });
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    ensureAuthCacheListener();
    const now = Date.now();
    if (cachedAuth && now - cachedAuth.fetchedAt < AUTH_CACHE_TTL_MS && cachedAuth.mfaUntil > now) {
      return { user: cachedAuth.user };
    }
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      cachedAuth = null;
      throw redirect({ to: "/auth" });
    }
    const { data: prof } = await supabase
      .from("profiles")
      .select("mfa_verified_until")
      .eq("id", data.user.id)
      .maybeSingle();
    const until = prof?.mfa_verified_until ? new Date(prof.mfa_verified_until).getTime() : 0;
    if (until <= now) {
      cachedAuth = null;
      throw redirect({ to: "/verify-2fa" });
    }
    cachedAuth = { user: data.user, mfaUntil: until, fetchedAt: now };
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isNavigating = useRouterState({ select: (s) => s.status === "pending" || s.isLoading });

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
    staleTime: 60_000,
    refetchOnWindowFocus: false,
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

  const [userSettings, setUserSettings] = useUserSettings();
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [sidebarPinned, setSidebarPinned] = useState<boolean>(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const savedPin = localStorage.getItem("sidebar-pinned");
    const isWide = window.matchMedia("(min-width: 1024px)").matches;
    if (savedPin !== null) {
      const pinned = savedPin === "1";
      setSidebarPinned(pinned);
      setSidebarOpen(pinned);
    } else {
      // Auto-hide by default unless wide desktop AND autoHideSidebar is off
      const defaultPinned = isWide && !userSettings.autoHideSidebar && userSettings.autoShowSidebar !== false;
      setSidebarPinned(defaultPinned);
      setSidebarOpen(defaultPinned);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem("sidebar-pinned", sidebarPinned ? "1" : "0");
  }, [sidebarPinned, hydrated]);

  // Auto-close sidebar whenever route changes if not pinned or autoHideSidebar is enabled
  useEffect(() => {
    if (!sidebarPinned || userSettings.autoHideSidebar) {
      setSidebarOpen(false);
    }
  }, [pathname, sidebarPinned, userSettings.autoHideSidebar]);

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

  const closeAfterNav = () => {
    if (!sidebarPinned || userSettings.autoHideSidebar || (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches)) {
      setSidebarOpen(false);
    }
  };

  const togglePin = () => {
    const next = !sidebarPinned;
    setSidebarPinned(next);
    setSidebarOpen(next);
    setUserSettings({ autoHideSidebar: !next });
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground relative">
      {isNavigating && (
        <div className="fixed top-0 inset-x-0 z-50 h-[2.5px] overflow-hidden bg-primary/15 pointer-events-none">
          <div className="sf-nav-progress h-full w-1/2 rounded-full bg-primary" />
        </div>
      )}
      {/* Left-edge hover trigger: glide mouse to left edge to smoothly reveal sidebar */}
      {!hideSidebar && !sidebarOpen && (
        <div
          onMouseEnter={() => setSidebarOpen(true)}
          className="hidden md:block fixed inset-y-0 left-0 w-3 z-30 cursor-e-resize"
          aria-hidden="true"
        />
      )}
      {/* Click-outside backdrop whenever sidebar is open as an overlay (mobile or unpinned) */}
      {!hideSidebar && sidebarOpen && !sidebarPinned && (
        <div
          className="fixed inset-0 z-30 bg-black/35 backdrop-blur-[1px] transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      {!hideSidebar && sidebarOpen && sidebarPinned && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-[1px] transition-opacity duration-300 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      {!hideSidebar && (
      <aside
        onMouseLeave={() => {
          if (!sidebarPinned) setSidebarOpen(false);
        }}
        className={cn(
          "border-r border-sidebar-border flex flex-col bg-sidebar text-sidebar-foreground transition-[width,transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform z-40 shrink-0",
          sidebarPinned ? "fixed inset-y-0 left-0 md:static" : "fixed inset-y-0 left-0 shadow-2xl",
          sidebarOpen
            ? "w-64 translate-x-0 opacity-100"
            : sidebarPinned
              ? "w-0 -translate-x-full md:w-0 opacity-0 overflow-hidden border-r-0 pointer-events-none"
              : "w-64 -translate-x-full opacity-0 pointer-events-none",
        )}
      >

        <div className="flex items-center justify-between px-4 h-14 border-b border-sidebar-border">
          <Link to="/dashboard" className="flex items-center gap-2.5 group" onClick={closeAfterNav}>
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-sky-400 p-0.5 shadow-sm ring-1 ring-white/20 flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105">
              <img src={logoAsset.url} alt="StepFighter" className="h-full w-full object-contain rounded-[6px] bg-white/95 p-0.5" />
            </div>
            <div className="leading-tight">
              <span className="font-bold tracking-tight block text-sm">StepFighter</span>
              <span className="text-[10px] text-sidebar-foreground/60 font-medium">USMLE QBank</span>
            </div>
          </Link>
          <div className="flex items-center gap-1">
            <button
              type="button"
              title={sidebarPinned ? "Unpin sidebar (auto-hide)" : "Pin sidebar open"}
              aria-label={sidebarPinned ? "Unpin sidebar" : "Pin sidebar"}
              onClick={togglePin}
              className={cn(
                "hidden md:flex p-1.5 rounded transition-colors",
                sidebarPinned
                  ? "text-primary bg-sidebar-accent/70 hover:bg-sidebar-accent"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              {sidebarPinned ? <Pin className="h-3.5 w-3.5" /> : <PinOff className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              aria-label="Collapse sidebar"
              onClick={() => {
                setSidebarPinned(false);
                setSidebarOpen(false);
              }}
              className="p-1.5 rounded text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {/* Welcome / Dashboard */}
          <Link
            to="/dashboard"
            onClick={closeAfterNav}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-150",
              isActive("/dashboard")
                ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-xs border-l-2 border-sidebar-primary"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <span className="h-6 w-6 rounded-md bg-blue-500/20 text-blue-300 flex items-center justify-center shrink-0">
              <LayoutDashboard className="h-3.5 w-3.5" />
            </span>
            Welcome
          </Link>

          {isAdmin && (
            <Link
              to="/admin"
              onClick={closeAfterNav}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-150",
                isActive("/admin")
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-xs border-l-2 border-sidebar-primary"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              <span className="h-6 w-6 rounded-md bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
                <ShieldCheck className="h-3.5 w-3.5" />
              </span>
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
                    "w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                    groupActive ? "text-sidebar-foreground" : "text-sidebar-foreground/75 hover:text-sidebar-foreground hover:bg-sidebar-accent/35",
                  )}
                >
                  <span className="flex items-center gap-2.5">
                    <span className={cn("h-6 w-6 rounded-md flex items-center justify-center shrink-0", g.iconTint)}>
                      <g.icon className="h-3.5 w-3.5" />
                    </span>
                    {g.label}
                  </span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isOpen ? "" : "-rotate-90")} />
                </button>
                <div className="sf-accordion" data-open={isOpen ? "true" : "false"}>
                  <div>
                    <div className="mt-1 ml-5 pl-3 border-l border-sidebar-border space-y-0.5 py-0.5">
                      {g.items.map((i) => (
                        <Link
                          key={i.to}
                          to={i.to}
                          onClick={closeAfterNav}
                          className={cn(
                            "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors duration-150",
                            isActive(i.to)
                              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                          )}
                        >
                          <i.icon className="h-3.5 w-3.5 shrink-0 opacity-85" />
                          {i.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <Link
            to="/subscribe-renew"
            onClick={closeAfterNav}
            className={cn(
              "mt-2 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
              isActive("/subscribe-renew")
                ? "bg-primary text-primary-foreground"
                : "bg-primary/15 text-primary hover:bg-primary/25",
            )}
          >
            <CreditCard className="h-4 w-4" />
            Subscribe or Renew
          </Link>

          {trialEnded && (
            <Link
              to="/upgrade"
              onClick={closeAfterNav}
              className={cn(
                "mt-2 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                isActive("/upgrade")
                  ? "bg-primary text-primary-foreground"
                  : "bg-primary/15 text-primary hover:bg-primary/25",
              )}
            >
              <PlusCircle className="h-4 w-4" />
              Add Course
            </Link>
          )}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <TrialBanner />
          <AppearanceQuickPanel onNavigate={closeAfterNav} />
          <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
            <LogOut className="h-4 w-4 mr-2" /> Logout
          </Button>
        </div>


      </aside>
      )}

      <main className="sf-main-canvas flex-1 overflow-auto min-w-0 flex flex-col">
        {!hideSidebar && !sidebarOpen && (
          <button
            type="button"
            aria-label="Open sidebar"
            onClick={() => setSidebarOpen(true)}
            className="hidden md:flex fixed top-3 left-3 z-30 items-center justify-center h-9 w-9 rounded-md border border-border bg-background/90 backdrop-blur shadow-sm hover:bg-accent hover:text-accent-foreground transition-all duration-200"
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
              : <div className="min-h-full"><Outlet /></div>}
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

