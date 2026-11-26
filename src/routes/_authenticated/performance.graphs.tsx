import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { getPerformanceGraphs, getPerformanceCharts } from "@/lib/performance.functions";
import { QBANKS, useActiveQbankId } from "@/lib/active-qbank";
import { TrendingUp, BarChart3, Layers, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/performance/graphs")({
  component: GraphsPage,
});

type Opt = { key: string; label: string; qbankId: number; sources?: string[] };
const STEP1_NBMES = [25, 26, 27, 28, 29, 30, 31, 32, 33];
const STEP2_NBMES = [8, 9, 10, 11, 12, 13, 14, 15, 16];
const STEP2_CMS: Array<{ specialty: string; tag: string; forms: number[] }> = [
  { specialty: "Emergency Medicine", tag: "EM", forms: [1, 2, 3] },
  { specialty: "Family Medicine", tag: "FM", forms: [2, 3, 5] },
  { specialty: "Internal Medicine", tag: "IM", forms: [5, 6, 7, 8, 9, 10] },
  { specialty: "Neurology", tag: "NEU", forms: [5, 6, 7, 8, 9] },
  { specialty: "Ob/Gyn", tag: "OBG", forms: [5, 6, 7, 8, 9, 10] },
  { specialty: "Pediatrics", tag: "PEDS", forms: [5, 6, 7, 8, 9] },
  { specialty: "Psychiatry", tag: "PSY", forms: [5, 6, 7, 8] },
  { specialty: "Surgery", tag: "SUR", forms: [5, 6, 7, 8, 9] },
];
const qbId = (slug: string) => QBANKS.find((q) => q.slug === slug)?.id ?? 1;
function buildOptions(): Opt[] {
  const out: Opt[] = [];
  const s1 = qbId("step1");
  out.push({ key: "step1-uw", label: "UWorld Step 1", qbankId: s1, sources: ["main"] });
  for (const n of [1, 2, 3]) out.push({ key: `step1-sa${n}`, label: `Step 1 Self Assessment ${n}`, qbankId: s1, sources: [`SA${n}`] });
  for (const n of STEP1_NBMES) out.push({ key: `step1-nbme${n}`, label: `Step 1 NBME ${n}`, qbankId: s1, sources: [`NBME${n}`] });
  const s2 = qbId("step2");
  out.push({ key: "step2-uw", label: "UWorld Step 2 CK", qbankId: s2, sources: ["main"] });
  for (const n of [1, 2, 3]) out.push({ key: `step2-sa${n}`, label: `Step 2 CK Self Assessment ${n}`, qbankId: s2, sources: [`SA${n}`] });
  for (const n of STEP2_NBMES) out.push({ key: `step2-nbme${n}`, label: `Step 2 CK NBME ${n}`, qbankId: s2, sources: [`NBME${n}`] });
  for (const cms of STEP2_CMS) out.push({ key: `step2-cms-${cms.tag}`, label: `CMS ${cms.specialty} Forms (${cms.forms.join(",")})`, qbankId: s2, sources: cms.forms.map((n) => `CMS_${cms.tag}${n}`) });
  const s3 = qbId("step3");
  out.push({ key: "step3-uw", label: "UWorld Step 3", qbankId: s3, sources: ["main"] });
  for (const n of [1, 2, 3]) out.push({ key: `step3-sa${n}`, label: `Step 3 Self Assessment ${n}`, qbankId: s3, sources: [`SA${n}`] });
  return out;
}
const OPTIONS = buildOptions();

function GraphsPage() {
  const fn = useServerFn(getPerformanceGraphs);
  const activeQbankId = useActiveQbankId();
  const activeQbank = QBANKS.find((q) => q.id === activeQbankId) ?? QBANKS[0];
  const activeSlug = activeQbank.slug ?? "step2";
  const filtered = useMemo(() => OPTIONS.filter((o) => o.key.startsWith(`${activeSlug}-`)), [activeSlug]);
  const [optKey, setOptKey] = useState(`${activeSlug}-uw`);
  const [days, setDays] = useState<30 | 60 | 90>(30);
  useEffect(() => {
    if (!filtered.some((o) => o.key === optKey)) setOptKey(filtered[0]?.key ?? `${activeSlug}-uw`);
  }, [activeSlug, filtered, optKey]);
  const opt = filtered.find((o) => o.key === optKey) ?? filtered[0];

  const { data, isLoading } = useQuery({
    queryKey: ["perf-graphs", opt.qbankId, opt.sources?.join(",") ?? "all", days],
    queryFn: () => fn({ data: { qbankId: opt.qbankId, sources: opt.sources, days } }),
  });

  const chartsFn = useServerFn(getPerformanceCharts);
  const { data: chartsData } = useQuery({
    queryKey: ["perf-charts", opt.qbankId, opt.sources?.join(",") ?? "all"],
    queryFn: () => chartsFn({ data: { qbankId: opt.qbankId, sources: opt.sources } }),
  });
  const tests = chartsData?.tests ?? [];
  const byTest = tests.map((t: any) => ({ x: String(t.id), y: t.score, label: t.name }));
  const byDate = tests.map((t: any) => ({ x: t.date, y: t.score, label: `${t.name} · ${t.date}` }));

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="sf-fluid-page space-y-5">
        {/* Clinical Studio Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b border-border">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Performance Graphs</h1>
              <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                {activeQbank.name}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Daily score trends, cumulative completion, and subject/system breakdowns
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <select
              value={optKey}
              onChange={(e) => setOptKey(e.target.value)}
              className="h-9 min-w-0 flex-1 sm:flex-none sm:min-w-[240px] rounded-lg border border-border bg-card px-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {filtered.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
            <div className="inline-flex rounded-lg bg-muted/60 p-1 shrink-0">
              {([30, 60, 90] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={cn(
                    "px-3 py-1 text-xs font-semibold rounded-md transition-colors",
                    days === d ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
        </div>

        {isLoading || !data ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-64 rounded-xl border border-border animate-pulse bg-card" />)}
          </div>
        ) : (
          <>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
              <Stat icon={Activity} tone="blue" label="Attempts" value={data.totalAttempts.toLocaleString()} />
              <Stat icon={TrendingUp} tone="green" label="Avg Time / Q" value={`${data.avgTimeSec}s`} />
              <Stat icon={BarChart3} tone="violet" label="Subjects" value={String(data.subjectBreakdown.length)} />
              <Stat icon={Layers} tone="amber" label="Systems" value={String(data.systemBreakdown.length)} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card title="Score Over Time" subtitle={`Daily accuracy % (last ${days} days, omitted counted as wrong)`}>
                <LineChart data={data.daily.map((d) => ({ x: d.date.slice(5), y: d.pct }))} color="hsl(142 71% 45%)" yMax={100} suffix="%" />
              </Card>
              <Card title="Cumulative Questions Answered" subtitle="Unique questions completed over time">
                <LineChart data={data.cumulative.map((d) => ({ x: d.date.slice(5), y: d.answered }))} color="hsl(217 91% 60%)" />
              </Card>
            </div>

            <Card title="Daily Activity" subtitle={`Attempts per day over the last ${days} days`}>
              <BarChart data={data.daily.map((d) => ({ x: d.date.slice(5), y: d.total }))} color="hsl(217 91% 60%)" />
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card title="By Subject" subtitle="Score per subject (omitted = wrong)">
                <BreakdownList rows={data.subjectBreakdown} />
              </Card>
              <Card title="By System" subtitle="Score per system (omitted = wrong)">
                <BreakdownList rows={data.systemBreakdown} />
              </Card>
            </div>

            {tests.length > 0 && (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card title="Performance by Test" subtitle="Your score progression across completed tests">
                  <ScatterChart data={byTest} />
                </Card>
                <Card title="Performance by Date" subtitle="Your completed test score trend by date">
                  <ScatterChart data={byDate} />
                </Card>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const STAT_TONES = {
  blue:   "bg-blue-500/12 text-blue-600 dark:text-blue-400",
  green:  "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
  violet: "bg-violet-500/12 text-violet-600 dark:text-violet-400",
  amber:  "bg-amber-500/12 text-amber-600 dark:text-amber-400",
};

function Stat({ icon: Icon, tone, label, value }: { icon: any; tone: keyof typeof STAT_TONES; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card border border-border p-4 flex items-center gap-3">
      <div className={cn("h-10 w-10 rounded-lg grid place-items-center shrink-0", STAT_TONES[tone])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-xl font-bold leading-tight tabular-nums mt-0.5">{value}</div>
      </div>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-card border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <div className="font-semibold text-sm">{title}</div>
        {subtitle && <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function BreakdownList({ rows }: { rows: { name: string; correct: number; total: number; pct: number }[] }) {
  if (!rows.length) return <div className="text-xs text-muted-foreground py-8 text-center">No attempts yet</div>;
  return (
    <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
      {rows.map((r) => (
        <div key={r.name} className="space-y-1">
          <div className="flex justify-between text-xs gap-2">
            <span className="font-medium truncate">{r.name}</span>
            <span className="text-muted-foreground shrink-0 tabular-nums">
              {r.correct}/{r.total} · <span className="font-semibold text-foreground">{r.pct}%</span>
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${r.pct}%`, background: r.pct >= 70 ? "hsl(142 71% 45%)" : r.pct >= 50 ? "hsl(38 92% 50%)" : "hsl(0 84% 60%)" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function LineChart({ data, color, yMax, suffix = "" }: { data: { x: string; y: number }[]; color: string; yMax?: number; suffix?: string }) {
  const w = 800, h = 220, pad = 32;
  const max = yMax ?? Math.max(1, ...data.map((d) => d.y));
  const stepX = data.length > 1 ? (w - pad * 2) / (data.length - 1) : 0;
  const pts = data.map((d, i) => `${pad + i * stepX},${h - pad - (d.y / max) * (h - pad * 2)}`).join(" ");
  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-52">
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
          <g key={i}>
            <line x1={pad} x2={w - pad} y1={h - pad - t * (h - pad * 2)} y2={h - pad - t * (h - pad * 2)} stroke="hsl(var(--border))" strokeDasharray="3 3" />
            <text x={4} y={h - pad - t * (h - pad * 2) + 4} fontSize="10" fill="hsl(var(--muted-foreground))">{Math.round(max * t)}{suffix}</text>
          </g>
        ))}
        <polyline points={pts} fill="none" stroke={color} strokeWidth="2.2" />
        {data.map((d, i) => (
          <circle key={i} cx={pad + i * stepX} cy={h - pad - (d.y / max) * (h - pad * 2)} r="2.5" fill={color} />
        ))}
        {data.filter((_, i) => i % Math.max(1, Math.floor(data.length / 8)) === 0).map((d, i) => {
          const originalIdx = data.indexOf(d);
          return <text key={i} x={pad + originalIdx * stepX} y={h - 8} fontSize="9" textAnchor="middle" fill="hsl(var(--muted-foreground))">{d.x}</text>;
        })}
      </svg>
    </div>
  );
}

function BarChart({ data, color }: { data: { x: string; y: number }[]; color: string }) {
  const w = 800, h = 190, pad = 28;
  const max = Math.max(1, ...data.map((d) => d.y));
  const bw = data.length ? Math.max(2, (w - pad * 2) / data.length - 2) : 0;
  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-44">
        {data.map((d, i) => {
          const bh = (d.y / max) * (h - pad * 2);
          return <rect key={i} x={pad + i * (bw + 2)} y={h - pad - bh} width={bw} height={bh} fill={color} opacity={0.85} rx={2} />;
        })}
        <line x1={pad} x2={w - pad} y1={h - pad} y2={h - pad} stroke="hsl(var(--border))" />
      </svg>
    </div>
  );
}

function ScatterChart({ data }: { data: { x: string; y: number; label: string }[] }) {
  const W = 900, H = 300, padL = 36, padR = 12, padT = 24, padB = 56;
  const n = data.length;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const stepX = n > 1 ? innerW / (n - 1) : 0;
  const xAt = (i: number) => padL + i * stepX;
  const yAt = (v: number) => padT + innerH - (Math.max(0, Math.min(100, v)) / 100) * innerH;
  const [hover, setHover] = useState<number | null>(null);
  const labelEvery = Math.max(1, Math.ceil(n / 28));
  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: Math.max(520, n * 12) }}>
        {[0, 20, 40, 60, 80, 100].map((v) => (
          <g key={v}>
            <line x1={padL} x2={W - padR} y1={yAt(v)} y2={yAt(v)} stroke="hsl(var(--border))" strokeDasharray="2 3" />
            <text x={padL - 6} y={yAt(v) + 3} fontSize={10} textAnchor="end" fill="hsl(var(--muted-foreground))">{v}%</text>
          </g>
        ))}
        {n > 1 && (
          <polyline fill="none" stroke="hsl(217 91% 60%)" strokeWidth={1.5} opacity={0.5} points={data.map((d, i) => `${xAt(i)},${yAt(d.y)}`).join(" ")} />
        )}
        {data.map((d, i) => (
          <circle
            key={i}
            cx={xAt(i)}
            cy={yAt(d.y)}
            r={hover === i ? 5.5 : 3.5}
            fill="hsl(217 91% 55%)"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            style={{ cursor: "pointer" }}
          />
        ))}
        {data.map((d, i) =>
          i % labelEvery === 0 ? (
            <g key={`xl-${i}`} transform={`translate(${xAt(i)}, ${H - padB + 10})`}>
              <text fontSize={9} fill="hsl(var(--muted-foreground))" transform="rotate(-45)" textAnchor="end">{d.x}</text>
            </g>
          ) : null,
        )}
        {hover != null && (
          <g>
            <rect
              x={Math.min(W - 170, Math.max(0, xAt(hover) - 75))}
              y={Math.max(4, yAt(data[hover].y) - 42)}
              width={170}
              height={34}
              rx={6}
              fill="hsl(var(--foreground))"
              opacity={0.92}
            />
            <text
              x={Math.min(W - 170, Math.max(0, xAt(hover) - 75)) + 8}
              y={Math.max(4, yAt(data[hover].y) - 42) + 14}
              fontSize={11}
              fill="hsl(var(--background))"
              fontWeight={600}
            >
              {data[hover].label.slice(0, 26)}
            </text>
            <text
              x={Math.min(W - 170, Math.max(0, xAt(hover) - 75)) + 8}
              y={Math.max(4, yAt(data[hover].y) - 42) + 28}
              fontSize={11}
              fill="hsl(var(--background))"
            >
              Score: {data[hover].y}%
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
