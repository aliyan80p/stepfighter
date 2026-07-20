import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { getPerformanceGraphs, getPerformanceCharts } from "@/lib/performance.functions";
import { QBANKS, useActiveQbankId } from "@/lib/active-qbank";
import { TrendingUp, BarChart3, Layers, Activity, Calendar } from "lucide-react";

export const Route = createFileRoute("/_authenticated/performance/graphs")({
  component: GraphsPage,
});

type Opt = { key: string; label: string; qbankId: number; sources?: string[] };
const STEP1_NBMES = [25, 26, 27, 28, 30, 31, 32, 33];
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
  const activeSlug = QBANKS.find((q) => q.id === activeQbankId)?.slug ?? "step2";
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

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Performance Graphs</h1>
          <p className="text-sm text-muted-foreground">Trends, subject and system breakdowns, and study activity</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-muted-foreground">QBank</label>
          <select value={optKey} onChange={(e) => setOptKey(e.target.value)} className="rounded-md border border-border bg-background px-3 py-2 text-sm min-w-[260px]">
            {filtered.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          <div className="inline-flex rounded-md border border-border ml-2 overflow-hidden">
            {([30, 60, 90] as const).map((d) => (
              <button key={d} onClick={() => setDays(d)} className={`px-3 py-1.5 text-sm ${days === d ? "bg-primary text-primary-foreground" : "bg-background"}`}>{d}d</button>
            ))}
          </div>
        </div>

        {isLoading || !data ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[0,1,2,3].map((i) => <div key={i} className="h-64 rounded-2xl border border-border animate-pulse bg-card" />)}
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <Stat icon={Activity} label="Attempts" value={data.totalAttempts.toLocaleString()} />
              <Stat icon={TrendingUp} label="Avg. Time / Q" value={`${data.avgTimeSec}s`} />
              <Stat icon={BarChart3} label="Subjects" value={String(data.subjectBreakdown.length)} />
              <Stat icon={Layers} label="Systems" value={String(data.systemBreakdown.length)} />
            </div>

            <Card title="Accuracy over time" subtitle={`Daily correct % (last ${days} days)`}>
              <LineChart data={data.daily.map((d) => ({ x: d.date.slice(5), y: d.pct }))} color="hsl(142 71% 45%)" yMax={100} suffix="%" />
            </Card>

            <Card title="Cumulative questions answered" subtitle="Unique questions completed">
              <LineChart data={data.cumulative.map((d) => ({ x: d.date.slice(5), y: d.answered }))} color="hsl(217 91% 60%)" />
            </Card>

            <Card title="Daily activity" subtitle="Attempts per day">
              <BarChart data={data.daily.map((d) => ({ x: d.date.slice(5), y: d.total }))} color="hsl(217 91% 60%)" />
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card title="By Subject" subtitle="Accuracy per subject">
                <BreakdownList rows={data.subjectBreakdown} />
              </Card>
              <Card title="By System" subtitle="Accuracy per system">
                <BreakdownList rows={data.systemBreakdown} />
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card border border-border p-4 flex items-center gap-3 shadow-sm">
      <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary grid place-items-center"><Icon className="h-5 w-5" /></div>
      <div>
        <div className="text-2xl font-bold leading-tight">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-card border border-border p-5 shadow-sm">
      <div className="font-semibold">{title}</div>
      {subtitle && <div className="text-xs text-muted-foreground mb-3">{subtitle}</div>}
      {children}
    </div>
  );
}

function BreakdownList({ rows }: { rows: { name: string; correct: number; total: number; pct: number }[] }) {
  if (!rows.length) return <div className="text-sm text-muted-foreground py-8 text-center">No attempts yet</div>;
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.name} className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="font-medium truncate">{r.name}</span>
            <span className="text-muted-foreground">{r.correct}/{r.total} · <span className="font-semibold text-foreground">{r.pct}%</span></span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${r.pct}%`, background: r.pct >= 70 ? "hsl(142 71% 45%)" : r.pct >= 50 ? "hsl(38 92% 50%)" : "hsl(0 84% 60%)" }} />
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
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-56">
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
          <g key={i}>
            <line x1={pad} x2={w - pad} y1={h - pad - t * (h - pad * 2)} y2={h - pad - t * (h - pad * 2)} stroke="hsl(0 0% 90%)" strokeDasharray="3 3" />
            <text x={4} y={h - pad - t * (h - pad * 2) + 4} fontSize="10" fill="hsl(0 0% 45%)">{Math.round(max * t)}{suffix}</text>
          </g>
        ))}
        <polyline points={pts} fill="none" stroke={color} strokeWidth="2" />
        {data.map((d, i) => (
          <circle key={i} cx={pad + i * stepX} cy={h - pad - (d.y / max) * (h - pad * 2)} r="2.5" fill={color} />
        ))}
        {data.filter((_, i) => i % Math.max(1, Math.floor(data.length / 8)) === 0).map((d, i, arr) => {
          const originalIdx = data.indexOf(d);
          return <text key={i} x={pad + originalIdx * stepX} y={h - 8} fontSize="9" textAnchor="middle" fill="hsl(0 0% 45%)">{d.x}</text>;
        })}
      </svg>
    </div>
  );
}

function BarChart({ data, color }: { data: { x: string; y: number }[]; color: string }) {
  const w = 800, h = 200, pad = 28;
  const max = Math.max(1, ...data.map((d) => d.y));
  const bw = data.length ? (w - pad * 2) / data.length - 2 : 0;
  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-48">
        {data.map((d, i) => {
          const bh = (d.y / max) * (h - pad * 2);
          return <rect key={i} x={pad + i * (bw + 2)} y={h - pad - bh} width={bw} height={bh} fill={color} opacity={0.85} rx={1} />;
        })}
        <line x1={pad} x2={w - pad} y1={h - pad} y2={h - pad} stroke="hsl(0 0% 80%)" />
      </svg>
    </div>
  );
}
