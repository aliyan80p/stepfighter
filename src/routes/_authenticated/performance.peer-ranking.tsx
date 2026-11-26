import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { getPeerRanking, getPeerCategoryBreakdown } from "@/lib/performance.functions";
import { QBANKS, useActiveQbankId } from "@/lib/active-qbank";
import {
  BarChart3, Users, TrendingUp, ThumbsUp, ThumbsDown,
  BookOpen, Layers, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/performance/peer-ranking")({
  component: PeerRankingPage,
});

type Opt = { key: string; label: string; qbankId: number; sources?: string[] };
const STEP1_NBMES = [25, 26, 27, 28, 29, 30, 31, 32, 33];
const STEP2_NBMES = [8, 9, 10, 11, 12, 13, 14, 15, 16];
const STEP2_CMS = [
  { tag: "EM", specialty: "Emergency Medicine", forms: [1, 2, 3] },
  { tag: "FM", specialty: "Family Medicine", forms: [2, 3, 5] },
  { tag: "IM", specialty: "Internal Medicine", forms: [5, 6, 7, 8, 9, 10] },
  { tag: "NEU", specialty: "Neurology", forms: [5, 6, 7, 8, 9] },
  { tag: "OBG", specialty: "Ob/Gyn", forms: [5, 6, 7, 8, 9, 10] },
  { tag: "PEDS", specialty: "Pediatrics", forms: [5, 6, 7, 8, 9] },
  { tag: "PSY", specialty: "Psychiatry", forms: [5, 6, 7, 8] },
  { tag: "SUR", specialty: "Surgery", forms: [5, 6, 7, 8, 9] },
];
const qbId = (slug: string) => QBANKS.find((q) => q.slug === slug)?.id ?? 1;
function buildOptions(): Opt[] {
  const out: Opt[] = [];
  const s1 = qbId("step1");
  out.push({ key: "step1-uw", label: "UWorld Step 1", qbankId: s1, sources: ["main"] });
  for (const n of [1, 2, 3]) out.push({ key: `step1-sa${n}`, label: `Step 1 SA ${n}`, qbankId: s1, sources: [`SA${n}`] });
  for (const n of STEP1_NBMES) out.push({ key: `step1-nbme${n}`, label: `Step 1 NBME ${n}`, qbankId: s1, sources: [`NBME${n}`] });
  const s2 = qbId("step2");
  out.push({ key: "step2-uw", label: "UWorld Step 2 CK", qbankId: s2, sources: ["main"] });
  for (const n of [1, 2, 3]) out.push({ key: `step2-sa${n}`, label: `Step 2 SA ${n}`, qbankId: s2, sources: [`SA${n}`] });
  for (const n of STEP2_NBMES) out.push({ key: `step2-nbme${n}`, label: `Step 2 NBME ${n}`, qbankId: s2, sources: [`NBME${n}`] });
  for (const cms of STEP2_CMS) out.push({ key: `step2-cms-${cms.tag}`, label: `CMS ${cms.specialty}`, qbankId: s2, sources: cms.forms.map((n) => `CMS_${cms.tag}${n}`) });
  const s3 = qbId("step3");
  out.push({ key: "step3-uw", label: "UWorld Step 3", qbankId: s3, sources: ["main"] });
  for (const n of [1, 2, 3]) out.push({ key: `step3-sa${n}`, label: `Step 3 SA ${n}`, qbankId: s3, sources: [`SA${n}`] });
  return out;
}
const OPTIONS = buildOptions();

function PeerRankingPage() {
  const peerFn = useServerFn(getPeerRanking);
  const catFn = useServerFn(getPeerCategoryBreakdown);
  const activeQbankId = useActiveQbankId();
  const activeQbank = QBANKS.find((q) => q.id === activeQbankId) ?? QBANKS[0];
  const activeSlug = activeQbank.slug ?? "step2";
  const filtered = useMemo(() => OPTIONS.filter((o) => o.key.startsWith(`${activeSlug}-`)), [activeSlug]);
  const [optKey, setOptKey] = useState(`${activeSlug}-uw`);
  useEffect(() => {
    if (!filtered.some((o) => o.key === optKey)) setOptKey(filtered[0]?.key ?? `${activeSlug}-uw`);
  }, [activeSlug, filtered, optKey]);
  const opt = filtered.find((o) => o.key === optKey) ?? filtered[0];

  const { data, isLoading, error } = useQuery({
    queryKey: ["peer-rank", opt.qbankId, opt.sources?.join(",") ?? "all"],
    queryFn: () => peerFn({ data: { qbankId: opt.qbankId, sources: opt.sources } }),
  });
  const { data: cat, isLoading: catLoading } = useQuery({
    queryKey: ["peer-cat", opt.qbankId, opt.sources?.join(",") ?? "all"],
    queryFn: () => catFn({ data: { qbankId: opt.qbankId, sources: opt.sources } }),
  });

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="sf-fluid-page space-y-5">
        {/* Clinical Studio Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b border-border">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Peer Ranking</h1>
              <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                {activeQbank.name}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Compare your percentile and category accuracy against other students
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="text-xs font-medium text-muted-foreground shrink-0">QBank</label>
            <select
              value={optKey}
              onChange={(e) => setOptKey(e.target.value)}
              className="h-9 min-w-0 flex-1 sm:flex-none sm:min-w-[240px] rounded-lg border border-border bg-card px-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {filtered.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{(error as Error).message}</div>
        ) : isLoading || !data ? (
          <div className="h-64 rounded-xl border border-border animate-pulse bg-card" />
        ) : data.totalPeers <= 1 ? (
          <div className="rounded-xl bg-card border border-border p-10 text-center">
            <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <div className="font-semibold text-sm">Not enough peers yet</div>
            <div className="text-xs text-muted-foreground mt-1">Peer ranking activates once at least 2 students have attempted this QBank.</div>
          </div>
        ) : (
          <>
            <PercentileCard
              yourPct={data.you.accuracy}
              medianPct={data.peers.medianAccuracy}
              percentile={data.percentile.accuracy}
              totalPeers={data.totalPeers}
            />

            <SubjectsPerformanceCard subjects={cat?.subjects ?? []} />

            <CategoryRankingCard subjects={cat?.subjects ?? []} systems={cat?.systems ?? []} loading={catLoading} />
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- Percentile bell curve ---------- */
function PercentileCard({ yourPct, medianPct, percentile, totalPeers }: { yourPct: number; medianPct: number; percentile: number; totalPeers: number }) {
  const W = 520, H = 190, cx = W / 2, base = H - 20;
  const bell = (x: number) => {
    const t = (x - cx) / (W / 5);
    return base - Math.exp(-t * t) * (H - 42);
  };
  const path = Array.from({ length: 100 }, (_, i) => {
    const x = (i / 99) * W;
    return `${i === 0 ? "M" : "L"}${x},${bell(x)}`;
  }).join(" ");
  const youX = (Math.max(0, Math.min(100, percentile)) / 100) * W;
  const medianX = W / 2;

  return (
    <div className="rounded-xl bg-card border border-border overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-blue-500/12 text-blue-600 dark:text-blue-400 grid place-items-center">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div>
            <div className="font-semibold text-sm">Percentile Rank</div>
            <div className="text-xs text-muted-foreground">Your position across {totalPeers.toLocaleString()} peers</div>
          </div>
        </div>
        <span className="inline-flex items-center rounded-md bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 text-xs font-bold tabular-nums">
          {percentile}th Percentile
        </span>
      </div>
      <div className="p-5 grid gap-6 md:grid-cols-[1fr_250px] items-center">
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
            <path d={path} fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} opacity={0.45} />
            <line x1={medianX} y1={20} x2={medianX} y2={base} stroke="hsl(217 91% 60%)" strokeWidth={1.2} strokeDasharray="3 3" />
            <text x={medianX} y={14} textAnchor="middle" className="fill-blue-500" fontSize={12} fontWeight={600}>50th</text>
            <circle cx={youX} cy={bell(youX)} r={6.5} fill="hsl(142 71% 45%)" stroke="hsl(var(--card))" strokeWidth={2} />
            <text x={youX} y={bell(youX) - 12} textAnchor="middle" className="fill-emerald-600 dark:fill-emerald-400" fontSize={12} fontWeight={700}>
              {percentile}th
            </text>
          </svg>
        </div>
        <div className="space-y-3">
          <div className="rounded-lg bg-muted/40 p-3 flex items-center justify-between text-xs font-semibold">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Your Score ({percentile}th)
            </span>
            <span className="rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 tabular-nums">{yourPct}%</span>
          </div>
          <div className="rounded-lg bg-muted/40 p-3 flex items-center justify-between text-xs font-semibold">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
              Median Score (50th)
            </span>
            <span className="rounded-md bg-blue-500/15 text-blue-700 dark:text-blue-300 px-2 py-0.5 tabular-nums">{medianPct}%</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed pt-1">
            You scored higher than <span className="font-semibold text-foreground">{percentile}%</span> of course subscribers.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------- Best/worst subject ---------- */
type CatRow = { id: number; name: string; you: number | null; peer: number; peerCount: number };

function SubjectsPerformanceCard({ subjects }: { subjects: CatRow[] }) {
  const attempted = subjects.filter((s) => s.you != null);
  const best = attempted.slice().sort((a, b) => (b.you! - a.you!))[0];
  const worst = attempted.slice().sort((a, b) => (a.you! - b.you!))[0];
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-xl bg-card border border-border p-4 flex items-center gap-3.5">
        <div className="h-10 w-10 rounded-lg bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 grid place-items-center shrink-0">
          <ThumbsUp className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Strongest Subject</div>
          <div className="font-semibold text-sm truncate mt-0.5">{best?.name ?? "—"}</div>
        </div>
        {best?.you != null && (
          <span className="rounded-md bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 text-xs font-bold tabular-nums">
            {best.you.toFixed(0)}%
          </span>
        )}
      </div>

      <div className="rounded-xl bg-card border border-border p-4 flex items-center gap-3.5">
        <div className="h-10 w-10 rounded-lg bg-rose-500/12 text-rose-600 dark:text-rose-400 grid place-items-center shrink-0">
          <ThumbsDown className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Weakest Subject</div>
          <div className="font-semibold text-sm truncate mt-0.5">{worst?.name ?? "—"}</div>
        </div>
        {worst?.you != null && (
          <span className="rounded-md bg-rose-500/12 text-rose-600 dark:text-rose-400 px-2.5 py-1 text-xs font-bold tabular-nums">
            {worst.you.toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  );
}

/* ---------- Peer ranking by category ---------- */
function CategoryRankingCard({ subjects, systems, loading }: { subjects: CatRow[]; systems: CatRow[]; loading: boolean }) {
  const [tab, setTab] = useState<"subjects" | "systems">("subjects");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PER_PAGE = 10;

  const source = tab === "subjects" ? subjects : systems;
  const filtered = useMemo(
    () => source.filter((r) => r.name.toLowerCase().includes(search.toLowerCase())),
    [source, search],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const p = Math.min(page, totalPages);
  const rows = filtered.slice((p - 1) * PER_PAGE, p * PER_PAGE);

  useEffect(() => { setPage(1); }, [tab, search]);

  return (
    <div className="rounded-xl bg-card border border-border overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-violet-500/12 text-violet-600 dark:text-violet-400 grid place-items-center">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div>
            <div className="font-semibold text-sm">Peer Comparison by Category</div>
            <div className="text-xs text-muted-foreground">Compare your accuracy against peers per subject or system</div>
          </div>
        </div>
        <div className="inline-flex rounded-lg bg-muted/80 p-1 gap-1">
          <TabBtn active={tab === "subjects"} onClick={() => setTab("subjects")} icon={<BookOpen className="h-3.5 w-3.5" />} label="Subjects" />
          <TabBtn active={tab === "systems"} onClick={() => setTab("systems")} icon={<Layers className="h-3.5 w-3.5" />} label="Systems" />
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-blue-500" /> You</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Peer Average</span>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${tab === "subjects" ? "subjects" : "systems"}…`}
              className="h-8 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        {loading ? (
          <div className="h-72 rounded-lg bg-muted animate-pulse" />
        ) : rows.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-xs text-muted-foreground">No categories to show.</div>
        ) : (
          <BarsChart rows={rows} />
        )}

        <Pagination page={p} totalPages={totalPages} onChange={setPage} />
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors",
        active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon} {label}
    </button>
  );
}

function BarsChart({ rows }: { rows: CatRow[] }) {
  const H = 250;
  const chartH = 210;
  const [hover, setHover] = useState<{ i: number; kind: "you" | "peer" } | null>(null);

  return (
    <div className="relative rounded-lg bg-muted/30 p-4 pt-2 overflow-x-auto">
      <div className="flex" style={{ minWidth: rows.length * 86 }}>
        <div className="flex flex-col justify-between text-[10px] text-muted-foreground pr-2 tabular-nums" style={{ height: chartH }}>
          {[100, 80, 60, 40, 20, 0].map((n) => <div key={n}>{n}%</div>)}
        </div>
        <div className="flex-1 relative" style={{ height: H }}>
          <div className="absolute inset-0 flex flex-col justify-between" style={{ height: chartH }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="border-t border-border/60" />
            ))}
          </div>
          <div className="relative flex items-end gap-4 pt-2" style={{ height: chartH }}>
            {rows.map((r, i) => {
              const youH = ((r.you ?? 0) / 100) * (chartH - 10);
              const peerH = ((r.peer ?? 0) / 100) * (chartH - 10);
              return (
                <div key={r.id} className="flex-1 min-w-[58px] flex items-end justify-center gap-1 relative">
                  {r.you != null && (
                    <div
                      onMouseEnter={() => setHover({ i, kind: "you" })}
                      onMouseLeave={() => setHover(null)}
                      className="w-4 rounded-t-sm bg-blue-500 hover:bg-blue-600 transition-colors relative"
                      style={{ height: youH }}
                    >
                      {hover?.i === i && hover.kind === "you" && <Tip title={r.name} label="You" value={r.you} color="bg-blue-500" />}
                    </div>
                  )}
                  <div
                    onMouseEnter={() => setHover({ i, kind: "peer" })}
                    onMouseLeave={() => setHover(null)}
                    className="w-4 rounded-t-sm bg-emerald-500 hover:bg-emerald-600 transition-colors relative"
                    style={{ height: peerH }}
                  >
                    {hover?.i === i && hover.kind === "peer" && <Tip title={r.name} label="Peers" value={r.peer} color="bg-emerald-500" />}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 mt-2">
            {rows.map((r) => (
              <div key={r.id} className="flex-1 min-w-[58px] text-center">
                <div className="text-[10px] text-muted-foreground truncate rotate-[-15deg] origin-top-left inline-block" title={r.name}>
                  {r.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Tip({ title, label, value, color }: { title: string; label: string; value: number; color: string }) {
  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-10 whitespace-nowrap">
      <div className="bg-foreground text-background text-[11px] rounded-md px-2 py-1 shadow-lg">
        <div className="font-semibold">{title}</div>
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-sm ${color}`} />
          <span>{label}: {value.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).slice(
    Math.max(0, page - 3),
    Math.max(0, page - 3) + 5,
  );
  const btn = "h-8 w-8 rounded-md flex items-center justify-center text-xs hover:bg-muted disabled:opacity-40";
  return (
    <div className="flex items-center justify-center gap-1 pt-1">
      <button className={btn} onClick={() => onChange(1)} disabled={page === 1}><ChevronsLeft className="h-3.5 w-3.5" /></button>
      <button className={btn} onClick={() => onChange(Math.max(1, page - 1))} disabled={page === 1}><ChevronLeft className="h-3.5 w-3.5" /></button>
      {pages.map((n) => (
        <button
          key={n}
          onClick={() => onChange(n)}
          className={cn(btn, n === page && "bg-primary/12 text-primary font-semibold")}
        >
          {n}
        </button>
      ))}
      <button className={btn} onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page === totalPages}><ChevronRight className="h-3.5 w-3.5" /></button>
      <button className={btn} onClick={() => onChange(totalPages)} disabled={page === totalPages}><ChevronsRight className="h-3.5 w-3.5" /></button>
    </div>
  );
}
