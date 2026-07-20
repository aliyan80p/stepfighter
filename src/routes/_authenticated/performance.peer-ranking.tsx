import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { getPeerRanking, getPeerCategoryBreakdown } from "@/lib/performance.functions";
import { QBANKS, useActiveQbankId } from "@/lib/active-qbank";
import { BarChart3, Users, TrendingUp, Star, ThumbsUp, ThumbsDown, BookOpen, Layers, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/performance/peer-ranking")({
  component: PeerRankingPage,
});

type Opt = { key: string; label: string; qbankId: number; sources?: string[] };
const STEP1_NBMES = [25, 26, 27, 28, 30, 31, 32, 33];
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
  const activeSlug = QBANKS.find((q) => q.id === activeQbankId)?.slug ?? "step2";
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
    <div className="min-h-screen bg-muted/30">
      <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-primary">Peer Ranking</h1>
          <p className="text-sm text-muted-foreground mt-1">Compare your performance with other students</p>
        </div>

        <div className="flex items-center gap-3 justify-center">
          <label className="text-sm text-muted-foreground">QBank</label>
          <select value={optKey} onChange={(e) => setOptKey(e.target.value)} className="rounded-md border border-border bg-background px-3 py-2 text-sm min-w-[260px]">
            {filtered.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </div>

        {error ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{(error as Error).message}</div>
        ) : isLoading || !data ? (
          <div className="h-64 rounded-2xl border border-border animate-pulse bg-card" />
        ) : data.totalPeers <= 1 ? (
          <div className="rounded-2xl bg-card border border-border p-10 text-center">
            <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <div className="font-semibold">Not enough peers yet</div>
            <div className="text-sm text-muted-foreground">Peer ranking activates once at least 2 users have attempted this QBank.</div>
          </div>
        ) : (
          <>
            <PercentileCard
              yourPct={data.you.accuracy}
              medianPct={data.peers.medianAccuracy}
              percentile={data.percentile.accuracy}
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
function PercentileCard({ yourPct, medianPct, percentile }: { yourPct: number; medianPct: number; percentile: number }) {
  // bell curve path
  const W = 520, H = 200, cx = W / 2, base = H - 20;
  const bell = (x: number) => {
    const t = (x - cx) / (W / 5);
    return base - Math.exp(-t * t) * (H - 40);
  };
  const path = Array.from({ length: 100 }, (_, i) => {
    const x = (i / 99) * W;
    return `${i === 0 ? "M" : "L"}${x},${bell(x)}`;
  }).join(" ");
  const youX = (Math.max(0, Math.min(100, percentile)) / 100) * W;
  const medianX = W / 2;

  return (
    <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <div className="h-10 w-10 rounded-lg bg-blue-500/15 flex items-center justify-center">
          <TrendingUp className="h-5 w-5 text-blue-500" />
        </div>
        <div>
          <div className="font-semibold">Percentile Rank</div>
          <div className="text-xs text-muted-foreground">Your position compared to other students</div>
        </div>
      </div>
      <div className="p-6 bg-muted/40 grid gap-6 md:grid-cols-[1fr_240px] items-center">
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
            <path d={path} fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} opacity={0.5} />
            {/* median vertical line */}
            <line x1={medianX} y1={20} x2={medianX} y2={base} stroke="hsl(217 91% 60%)" strokeWidth={1} />
            <text x={medianX} y={15} textAnchor="middle" className="fill-blue-500" fontSize={13} fontWeight={600}>50th</text>
            {/* your point */}
            <circle cx={youX} cy={bell(youX)} r={7} fill="hsl(142 71% 45%)" stroke="white" strokeWidth={2} />
            <text x={youX} y={bell(youX) - 12} textAnchor="middle" className="fill-emerald-600" fontSize={13} fontWeight={600}>
              {percentile}th
            </text>
          </svg>
        </div>
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className="h-3 w-3 rounded-full bg-emerald-500" />
              Your Score ({percentile}th)
              <span className="ml-auto bg-emerald-500 text-white text-xs px-2 py-0.5 rounded-md">{yourPct}%</span>
            </div>
          </div>
          <div className="border-t border-border pt-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className="h-3 w-3 rounded-full bg-blue-500" />
              Median Score (50th)
              <span className="ml-auto bg-blue-500 text-white text-xs px-2 py-0.5 rounded-md">{medianPct}%</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground border-t border-border pt-3">
            You got a score that is higher than {percentile}% of course subscribers and {100 - percentile}% of course subscribers got a score higher than yours.
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
    <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <div className="h-10 w-10 rounded-lg bg-amber-500 flex items-center justify-center">
          <Star className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="font-semibold">Subjects Performance</div>
          <div className="text-xs text-muted-foreground">Your strongest and weakest areas</div>
        </div>
      </div>
      <div className="p-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-emerald-500 flex items-center justify-center">
            <ThumbsUp className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Best Subject</div>
            <div className="font-semibold">{best?.name ?? "—"}</div>
          </div>
        </div>
        <div className="rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-rose-500 flex items-center justify-center">
            <ThumbsDown className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Worst Subject</div>
            <div className="font-semibold">{worst?.name ?? "—"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Peer ranking by category (tabs + bar chart + search + pagination) ---------- */
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
    <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <div className="h-10 w-10 rounded-lg bg-violet-500/15 flex items-center justify-center">
          <BarChart3 className="h-5 w-5 text-violet-500" />
        </div>
        <div>
          <div className="font-semibold">Peer Ranking By Categories</div>
          <div className="text-xs text-muted-foreground">Compare your performance across different categories</div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/50" /> Your Ranking</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Peer Ranking</span>
          </div>
          <div className="relative">
            <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${tab === "subjects" ? "Subject" : "System"}...`}
              className="rounded-full border border-border bg-background pl-9 pr-3 py-1.5 text-sm w-64"
            />
          </div>
        </div>

        <div className="flex justify-center">
          <div className="inline-flex rounded-full bg-muted p-1 gap-1">
            <TabBtn active={tab === "subjects"} onClick={() => setTab("subjects")} icon={<BookOpen className="h-4 w-4" />} label="Subjects" />
            <TabBtn active={tab === "systems"} onClick={() => setTab("systems")} icon={<Layers className="h-4 w-4" />} label="Systems" />
          </div>
        </div>

        {loading ? (
          <div className="h-72 rounded-xl bg-muted animate-pulse" />
        ) : rows.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">No categories to show.</div>
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
      className={`px-4 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5 transition-colors ${
        active ? "bg-emerald-500 text-white shadow-sm" : "text-foreground hover:bg-background"
      }`}
    >
      {icon} {label}
    </button>
  );
}

function BarsChart({ rows }: { rows: CatRow[] }) {
  const H = 260;
  const chartH = 220;
  const [hover, setHover] = useState<{ i: number; kind: "you" | "peer" } | null>(null);

  return (
    <div className="relative rounded-xl bg-muted/40 p-4 pt-2 overflow-x-auto">
      <div className="flex" style={{ minWidth: rows.length * 90 }}>
        {/* Y axis */}
        <div className="flex flex-col justify-between text-[10px] text-muted-foreground pr-2" style={{ height: chartH }}>
          {[100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 0].map((n) => <div key={n}>{n}</div>)}
        </div>
        <div className="flex-1 relative" style={{ height: H }}>
          {/* grid lines */}
          <div className="absolute inset-0 flex flex-col justify-between" style={{ height: chartH }}>
            {Array.from({ length: 11 }).map((_, i) => (
              <div key={i} className="border-t border-border/60" />
            ))}
          </div>
          <div className="relative flex items-end gap-4 pt-2" style={{ height: chartH }}>
            {rows.map((r, i) => {
              const youH = ((r.you ?? 0) / 100) * (chartH - 10);
              const peerH = ((r.peer ?? 0) / 100) * (chartH - 10);
              return (
                <div key={r.id} className="flex-1 min-w-[60px] flex items-end justify-center gap-1 relative">
                  {r.you != null && (
                    <div
                      onMouseEnter={() => setHover({ i, kind: "you" })}
                      onMouseLeave={() => setHover(null)}
                      className="w-4 rounded-t-sm bg-muted-foreground/50 hover:bg-muted-foreground transition-colors relative"
                      style={{ height: youH }}
                    >
                      {hover?.i === i && hover.kind === "you" && <Tip title={r.name} label="You" value={r.you} color="bg-muted-foreground" />}
                    </div>
                  )}
                  <div
                    onMouseEnter={() => setHover({ i, kind: "peer" })}
                    onMouseLeave={() => setHover(null)}
                    className="w-4 rounded-t-sm bg-emerald-500 hover:bg-emerald-600 transition-colors relative"
                    style={{ height: peerH }}
                  >
                    {hover?.i === i && hover.kind === "peer" && <Tip title={r.name} label="" value={r.peer} color="bg-emerald-500" />}
                  </div>
                </div>
              );
            })}
          </div>
          {/* X labels */}
          <div className="flex gap-4 mt-2">
            {rows.map((r) => (
              <div key={r.id} className="flex-1 min-w-[60px] text-center">
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
          {label && <span>{label}</span>}
          <span>{value.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).slice(
    Math.max(0, page - 3),
    Math.max(0, page - 3) + 5,
  );
  const btn = "h-8 w-8 rounded-md flex items-center justify-center text-sm hover:bg-muted";
  return (
    <div className="flex items-center justify-center gap-1 pt-2">
      <button className={btn} onClick={() => onChange(1)} disabled={page === 1}><ChevronsLeft className="h-4 w-4" /></button>
      <button className={btn} onClick={() => onChange(Math.max(1, page - 1))} disabled={page === 1}><ChevronLeft className="h-4 w-4" /></button>
      {pages.map((n) => (
        <button
          key={n}
          onClick={() => onChange(n)}
          className={`${btn} ${n === page ? "bg-primary/10 text-primary font-semibold" : ""}`}
        >
          {n}
        </button>
      ))}
      <button className={btn} onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page === totalPages}><ChevronRight className="h-4 w-4" /></button>
      <button className={btn} onClick={() => onChange(totalPages)} disabled={page === totalPages}><ChevronsRight className="h-4 w-4" /></button>
    </div>
  );
}
