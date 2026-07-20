import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { getPerformanceCharts } from "@/lib/performance.functions";
import { QBANKS, useActiveQbankId } from "@/lib/active-qbank";
import { BarChart3, Calendar } from "lucide-react";

export const Route = createFileRoute("/_authenticated/performance/charts")({
  component: ChartsPage,
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

function ChartsPage() {
  const fn = useServerFn(getPerformanceCharts);
  const activeQbankId = useActiveQbankId();
  const activeSlug = QBANKS.find((q) => q.id === activeQbankId)?.slug ?? "step2";
  const filtered = useMemo(() => OPTIONS.filter((o) => o.key.startsWith(`${activeSlug}-`)), [activeSlug]);
  const [optKey, setOptKey] = useState(`${activeSlug}-uw`);
  useEffect(() => {
    if (!filtered.some((o) => o.key === optKey)) setOptKey(filtered[0]?.key ?? `${activeSlug}-uw`);
  }, [activeSlug, filtered, optKey]);
  const opt = filtered.find((o) => o.key === optKey) ?? filtered[0];

  const { data, isLoading } = useQuery({
    queryKey: ["perf-charts", opt.qbankId, opt.sources?.join(",") ?? "all"],
    queryFn: () => fn({ data: { qbankId: opt.qbankId, sources: opt.sources } }),
  });

  const tests = data?.tests ?? [];
  const byTest = tests.map((t) => ({ x: String(t.id), y: t.score, label: t.name }));
  const byDate = tests.map((t) => ({ x: t.date, y: t.score, label: `${t.name} · ${t.date}` }));

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-primary">Performance Charts</h1>
          <p className="text-sm text-muted-foreground mt-1">Track your progress over time with visual analytics</p>
        </div>

        <div className="flex items-center gap-3 justify-center">
          <label className="text-sm text-muted-foreground">QBank</label>
          <select value={optKey} onChange={(e) => setOptKey(e.target.value)} className="rounded-md border border-border bg-background px-3 py-2 text-sm min-w-[260px]">
            {filtered.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </div>

        {isLoading ? (
          <>
            <div className="h-72 rounded-2xl border border-border animate-pulse bg-card" />
            <div className="h-72 rounded-2xl border border-border animate-pulse bg-card" />
          </>
        ) : tests.length === 0 ? (
          <div className="rounded-2xl bg-card border border-border p-10 text-center">
            <div className="font-semibold">No completed tests yet</div>
            <div className="text-sm text-muted-foreground">Finish a test to start tracking your score trends.</div>
          </div>
        ) : (
          <>
            <ChartCard
              icon={<BarChart3 className="h-5 w-5 text-white" />}
              iconBg="bg-blue-500"
              title="Performance by Test"
              subtitle="Your score progression across different tests"
            >
              <ScatterChart data={byTest} />
            </ChartCard>

            <ChartCard
              icon={<Calendar className="h-5 w-5 text-white" />}
              iconBg="bg-emerald-500"
              title="Performance by Date"
              subtitle="Your score trend over time"
            >
              <ScatterChart data={byDate} />
            </ChartCard>
          </>
        )}
      </div>
    </div>
  );
}

function ChartCard({ icon, iconBg, title, subtitle, children }: { icon: React.ReactNode; iconBg: string; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <div className={`h-10 w-10 rounded-lg ${iconBg} flex items-center justify-center`}>{icon}</div>
        <div>
          <div className="font-semibold">{title}</div>
          <div className="text-xs text-muted-foreground">{subtitle}</div>
        </div>
      </div>
      <div className="p-4 bg-muted/40">{children}</div>
    </div>
  );
}

function ScatterChart({ data }: { data: { x: string; y: number; label: string }[] }) {
  const W = 900, H = 320, padL = 36, padR = 12, padT = 24, padB = 60;
  const n = data.length;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const stepX = n > 1 ? innerW / (n - 1) : 0;
  const xAt = (i: number) => padL + i * stepX;
  const yAt = (v: number) => padT + innerH - (Math.max(0, Math.min(100, v)) / 100) * innerH;
  const [hover, setHover] = useState<number | null>(null);

  // Show ~30 x-axis labels max
  const labelEvery = Math.max(1, Math.ceil(n / 30));

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: Math.max(600, n * 12) }}>
        {/* Legend */}
        <g transform={`translate(${W / 2 - 30}, 8)`}>
          <rect x={0} y={0} width={12} height={12} fill="hsl(217 91% 75%)" rx={2} />
          <text x={18} y={10} fontSize={11} fill="hsl(var(--muted-foreground))">Score</text>
        </g>
        {/* Y grid + labels */}
        {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90].map((v) => (
          <g key={v}>
            <line x1={padL} x2={W - padR} y1={yAt(v)} y2={yAt(v)} stroke="hsl(0 0% 88%)" strokeDasharray="2 3" />
            <text x={padL - 6} y={yAt(v) + 3} fontSize={10} textAnchor="end" fill="hsl(var(--muted-foreground))">{v}</text>
          </g>
        ))}
        {/* Connecting line */}
        {n > 1 && (
          <polyline
            fill="none"
            stroke="hsl(217 91% 75%)"
            strokeWidth={1}
            points={data.map((d, i) => `${xAt(i)},${yAt(d.y)}`).join(" ")}
          />
        )}
        {/* Points */}
        {data.map((d, i) => (
          <g key={i}>
            <circle
              cx={xAt(i)}
              cy={yAt(d.y)}
              r={hover === i ? 5 : 3.2}
              fill="hsl(217 91% 55%)"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: "pointer" }}
            />
          </g>
        ))}
        {/* X labels (rotated) */}
        {data.map((d, i) =>
          i % labelEvery === 0 ? (
            <g key={`xl-${i}`} transform={`translate(${xAt(i)}, ${H - padB + 10})`}>
              <text
                fontSize={9}
                fill="hsl(var(--muted-foreground))"
                transform="rotate(-55)"
                textAnchor="end"
              >
                {d.x}
              </text>
            </g>
          ) : null,
        )}
        {/* Tooltip */}
        {hover != null && (
          <g>
            <rect
              x={Math.min(W - 160, Math.max(0, xAt(hover) - 70))}
              y={Math.max(4, yAt(data[hover].y) - 42)}
              width={160}
              height={34}
              rx={6}
              fill="hsl(var(--foreground))"
              opacity={0.92}
            />
            <text
              x={Math.min(W - 160, Math.max(0, xAt(hover) - 70)) + 8}
              y={Math.max(4, yAt(data[hover].y) - 42) + 14}
              fontSize={11}
              fill="hsl(var(--background))"
              fontWeight={600}
            >
              {data[hover].label.slice(0, 26)}
            </text>
            <text
              x={Math.min(W - 160, Math.max(0, xAt(hover) - 70)) + 8}
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
