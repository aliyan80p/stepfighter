import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { getAssessmentReport } from "@/lib/performance.functions";
import { QBANKS, useActiveQbankId } from "@/lib/active-qbank";
import { getMyEntitlement, QBANK_ID_TO_SLUG } from "@/lib/entitlements.functions";
import { Check, X, RotateCcw, Info, TrendingUp, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/self-assessments/report")({
  component: ReportPage,
});

type Opt = { key: string; label: string; qbankId: number; sources: string[]; group: string };
const STEP1_NBMES = [25, 26, 27, 28, 30, 31, 32, 33];
const STEP2_NBMES = [8, 9, 10, 11, 12, 13, 14, 15, 16];
const qbId = (slug: string) => QBANKS.find((q) => q.slug === slug)?.id ?? 1;

function buildOptions(): Opt[] {
  const out: Opt[] = [];
  for (const [slug, label] of [["step1", "USMLE Step 1"], ["step2", "USMLE Step 2 CK"], ["step3", "USMLE Step 3"]] as const) {
    const id = qbId(slug);
    for (const n of [1, 2, 3]) out.push({ key: `${slug}-sa${n}`, label: `Self Assessment ${n}`, group: label, qbankId: id, sources: [`SA${n}`] });
  }
  const s1 = qbId("step1");
  for (const n of STEP1_NBMES) out.push({ key: `step1-nbme${n}`, label: `NBME ${n}`, group: "USMLE Step 1", qbankId: s1, sources: [`NBME${n}`] });
  const s2 = qbId("step2");
  for (const n of STEP2_NBMES) out.push({ key: `step2-nbme${n}`, label: `NBME ${n}`, group: "USMLE Step 2 CK", qbankId: s2, sources: [`NBME${n}`] });
  return out;
}
const OPTIONS = buildOptions();

function ReportPage() {
  const activeQbankId = useActiveQbankId();
  const activeGroup = QBANKS.find((q) => q.id === activeQbankId)?.name ?? "USMLE Step 2 CK";
  const [group, setGroup] = useState(activeGroup);
  const filtered = useMemo(() => OPTIONS.filter((o) => o.group === group), [group]);
  const [key, setKey] = useState(filtered[0]?.key ?? "");
  useEffect(() => {
    if (!filtered.some((o) => o.key === key)) setKey(filtered[0]?.key ?? "");
  }, [filtered, key]);
  const opt = filtered.find((o) => o.key === key) ?? filtered[0];

  const [tab, setTab] = useState<"overall" | "analysis">("overall");

  const fn = useServerFn(getAssessmentReport);
  const { data, isLoading } = useQuery({
    queryKey: ["assessment-report", opt?.qbankId, opt?.sources.join(",")],
    queryFn: () => fn({ data: { qbankId: opt!.qbankId, sources: opt!.sources } }),
    enabled: !!opt,
  });

  const entFn = useServerFn(getMyEntitlement);
  const entQ = useQuery({ queryKey: ["my-entitlement"], queryFn: () => entFn(), staleTime: 60_000 });
  const entitledGroupNames = useMemo(() => {
    const allowed = new Set(entQ.data?.effective_access ?? []);
    return new Set(QBANKS.filter((q) => allowed.has(QBANK_ID_TO_SLUG[q.id])).map((q) => q.name));
  }, [entQ.data]);
  const allGroups = Array.from(new Set(OPTIONS.map((o) => o.group)));
  const groups = entitledGroupNames.size ? allGroups.filter((g) => entitledGroupNames.has(g)) : [activeGroup];
  useEffect(() => {
    if (groups.length && !groups.includes(group)) setGroup(groups[0]);
  }, [groups, group]);

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Assessment Report</h1>
          <p className="text-sm text-muted-foreground">Detailed breakdown of your NBME and Self Assessment performance</p>
        </div>

        {/* Tabs */}
        <div className="flex justify-center">
          <div className="inline-flex bg-muted rounded-full p-1">
            {(["overall", "analysis"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "px-6 py-2 text-sm font-medium rounded-full transition-colors capitalize",
                  tab === t ? "bg-blue-600 text-white shadow" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Course / Assessment selectors */}
        <div className="grid gap-4 md:grid-cols-2 max-w-3xl mx-auto">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Course</label>
            <select value={group} onChange={(e) => setGroup(e.target.value)} className="mt-1 w-full h-11 rounded-md border border-input bg-background px-3 text-sm">
              {groups.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Assessment</label>
            <select value={key} onChange={(e) => setKey(e.target.value)} className="mt-1 w-full h-11 rounded-md border border-input bg-background px-3 text-sm">
              {filtered.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {isLoading || !data ? (
          <div className="grid gap-4 md:grid-cols-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-28 rounded-2xl bg-card border border-border animate-pulse" />)}
          </div>
        ) : data.totalQuestions === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center">
            <div className="font-semibold">Assessment not available</div>
            <div className="text-sm text-muted-foreground mt-1">This assessment has no questions imported yet.</div>
          </div>
        ) : tab === "overall" ? (
          <OverallTab data={data} />
        ) : (
          <AnalysisTab data={data} />
        )}
      </div>
    </div>
  );
}

function OverallTab({ data }: { data: any }) {
  return (
    <>
      {/* Totals */}
      <div className="grid gap-4 md:grid-cols-3">
        <TotalCard bg="from-emerald-500 to-emerald-600" label="Total Correct" value={data.totalCorrect} icon={<Check className="h-4 w-4" />} />
        <TotalCard bg="from-rose-500 to-rose-600" label="Total Incorrect" value={data.totalIncorrect} icon={<X className="h-4 w-4" />} />
        <TotalCard bg="from-blue-500 to-blue-600" label="Total Omitted" value={data.totalOmitted} icon={<Check className="h-4 w-4" />} />
      </div>

      {/* Percentile */}
      <PercentileCard percentile={data.percentile} scorePct={data.scorePct} passingPct={data.passingPct} peerCount={data.peerCount} />

      {/* Row: Answer Changes + Chance of passing */}
      <div className="grid gap-4 md:grid-cols-2">
        <AnswerChangesCard changes={data.answerChanges} />
        <ChanceOfPassingCard chance={data.chance} />
      </div>
    </>
  );
}

function AnalysisTab({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      <AnalysisTable title="Subject Analysis" headerLabel="Subjects" placeholder="Search By Subjects" rows={data.subjectBreakdown} />
      <AnalysisTable title="System Analysis" headerLabel="Systems" placeholder="Search By System" rows={data.systemBreakdown} />
    </div>
  );
}

function AnalysisTable({
  title, headerLabel, placeholder, rows,
}: {
  title: string; headerLabel: string; placeholder: string;
  rows: { name: string; correct: number; incorrect: number; omitted: number; total: number }[];
}) {
  const [q, setQ] = useState("");
  const filtered = rows.filter((r) => r.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-4 p-4 md:p-5">
        <div className="text-blue-600 dark:text-blue-400 font-semibold">{title}</div>
        <div className="relative w-64 max-w-full">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder}
            className="w-full h-9 pl-9 pr-3 rounded-full bg-muted/60 border border-transparent focus:border-input focus:bg-background text-sm outline-none"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-blue-500 text-white">
              <th className="text-left font-semibold uppercase tracking-wide text-xs px-4 py-3">{headerLabel}</th>
              <th className="text-left font-semibold uppercase tracking-wide text-xs px-4 py-3 border-l border-blue-400/40">Total Q</th>
              <th className="text-left font-semibold uppercase tracking-wide text-xs px-4 py-3 border-l border-blue-400/40">Correct</th>
              <th className="text-left font-semibold uppercase tracking-wide text-xs px-4 py-3 border-l border-blue-400/40">Incorrect</th>
              <th className="text-left font-semibold uppercase tracking-wide text-xs px-4 py-3 border-l border-blue-400/40">Omitted</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="text-center text-muted-foreground py-8">No data</td></tr>
            ) : filtered.map((r) => (
              <tr key={r.name} className="border-b border-border last:border-0 hover:bg-muted/40">
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="px-4 py-3">{r.total}</td>
                <td className="px-4 py-3 text-emerald-600 font-semibold">{r.correct}</td>
                <td className="px-4 py-3 text-rose-600 font-semibold">{r.incorrect}</td>
                <td className="px-4 py-3 text-blue-600 font-semibold">{r.omitted}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


function TotalCard({ bg, label, value, icon }: any) {
  return (
    <div className={cn("rounded-2xl bg-gradient-to-br text-white p-6 shadow-md relative overflow-hidden", bg)}>
      <div className="text-4xl font-bold text-center">{value}</div>
      <div className="text-center text-sm font-medium mt-1 opacity-95">{label}</div>
      <div className="absolute bottom-2 right-3 opacity-30">{icon}</div>
    </div>
  );
}

function PercentileCard({ percentile, scorePct, passingPct, peerCount }: any) {
  const W = 700, H = 220;
  // bell curve
  const mean = 0.5, sigma = 0.15;
  const bell = (x: number) => Math.exp(-((x - mean) ** 2) / (2 * sigma ** 2));
  const points: string[] = [];
  const maxY = bell(mean);
  for (let i = 0; i <= 100; i++) {
    const x = i / 100;
    const y = bell(x) / maxY;
    points.push(`${20 + x * (W - 40)},${20 + (1 - y) * (H - 60)}`);
  }
  const meX = 20 + (percentile / 100) * (W - 40);
  const meY = 20 + (1 - bell(percentile / 100) / maxY) * (H - 60);
  const passX = 20 + (passingPct / 100) * (W - 40);
  const below = scorePct < passingPct;

  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden shadow-sm">
      <div className="p-4 border-b border-border bg-muted/40 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-blue-600 grid place-items-center text-white"><TrendingUp className="h-5 w-5" /></div>
          <div>
            <div className="font-semibold">Percentile Rank</div>
            <div className="text-xs text-muted-foreground">Compare your performance with peers</div>
          </div>
        </div>
        <Info className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="grid gap-4 md:grid-cols-[1fr_240px] p-5 items-center">
        <div className="w-full overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-56">
            <polyline points={points.join(" ")} fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} />
            {/* passing marker */}
            <line x1={passX} x2={passX} y1={20} y2={H - 40} stroke="hsl(217 91% 55%)" strokeWidth={1.5} />
            <text x={passX} y={16} fontSize={11} textAnchor="middle" fill="hsl(217 91% 55%)" fontWeight={600}>{passingPct.toFixed(2)}th</text>
            <line x1={20} x2={W - 20} y1={H - 40} y2={H - 40} stroke="hsl(0 0% 80%)" />
            {/* you marker */}
            <circle cx={meX} cy={meY} r={6} fill="hsl(142 71% 45%)" stroke="white" strokeWidth={2} />
            <text x={meX} y={meY - 12} fontSize={11} textAnchor="middle" fill="hsl(142 71% 45%)" fontWeight={600}>{percentile.toFixed(2)}th</text>
          </svg>
        </div>
        <div className="space-y-3 text-sm">
          <div className="font-semibold">Percentile Rank</div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-emerald-500" />Your Score ({percentile.toFixed(2)}th)</span>
            <span className="rounded-md bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-xs font-semibold">{scorePct}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-blue-500" />Passing Score ({passingPct.toFixed(2)}th)</span>
            <span className="rounded-md bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 text-xs font-semibold">{passingPct}%</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {peerCount ? (
              below
                ? <>You got a score <span className="text-rose-600 font-medium">{scorePct}%</span> which is lower than the passing score {passingPct}%.</>
                : <>You got a score <span className="text-emerald-600 font-medium">{scorePct}%</span> which meets the passing score of {passingPct}%.</>
            ) : "No peer data yet — percentile will populate as more users complete this assessment."}
          </p>
        </div>
      </div>
    </div>
  );
}

function AnswerChangesCard({ changes }: { changes: any }) {
  const rows = [
    { label: "Correct to Correct", value: changes.correctToCorrect, bg: "bg-emerald-500", icon: <Check className="h-4 w-4 text-white" />, chip: "bg-emerald-500", strip: "bg-emerald-50 dark:bg-emerald-950/20" },
    { label: "Correct to Incorrect", value: changes.correctToIncorrect, bg: "bg-rose-500", icon: <X className="h-4 w-4 text-white" />, chip: "bg-rose-500", strip: "bg-rose-50 dark:bg-rose-950/20" },
    { label: "Incorrect to Correct", value: changes.incorrectToCorrect, bg: "bg-blue-500", icon: <RotateCcw className="h-4 w-4 text-white" />, chip: "bg-blue-500", strip: "bg-blue-50 dark:bg-blue-950/20" },
    { label: "Incorrect to Incorrect", value: changes.incorrectToIncorrect, bg: "bg-violet-500", icon: <RotateCcw className="h-4 w-4 text-white" />, chip: "bg-violet-500", strip: "bg-violet-50 dark:bg-violet-950/20" },
  ];
  return (
    <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
      <div className="p-4 border-b border-border bg-muted/40">
        <div className="font-semibold">Answer Changes</div>
        <div className="text-xs text-muted-foreground">Track how your answers evolved</div>
      </div>
      <div className="p-4 space-y-2">
        {rows.map((r) => (
          <div key={r.label} className={cn("flex items-center gap-3 rounded-lg px-3 py-2", r.strip)}>
            <div className={cn("h-8 w-8 rounded-md grid place-items-center", r.bg)}>{r.icon}</div>
            <div className="flex-1 text-sm font-medium">{r.label}</div>
            <div className={cn("h-7 min-w-[36px] px-2 rounded-md text-white text-sm font-semibold grid place-items-center", r.chip)}>{r.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChanceOfPassingCard({ chance }: { chance: "low" | "borderline" | "high" | "very-high" }) {
  const labels: Array<{ key: typeof chance; label: string; bg: string }> = [
    { key: "low", label: "LOW", bg: "bg-rose-500" },
    { key: "borderline", label: "BORDERLINE", bg: "bg-amber-500" },
    { key: "high", label: "HIGH", bg: "bg-emerald-500" },
    { key: "very-high", label: "VERY HIGH", bg: "bg-emerald-600" },
  ];
  const label = labels.find((l) => l.key === chance)!;
  const textColor = chance === "low" ? "text-rose-600" : chance === "borderline" ? "text-amber-600" : "text-emerald-600";
  return (
    <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
      <div className="p-4 border-b border-border bg-muted/40 flex items-start justify-between">
        <div>
          <div className="font-semibold">Chance of Passing</div>
          <div className={cn("text-sm font-semibold capitalize mt-0.5", textColor)}>{chance.replace("-", " ")}</div>
        </div>
        <Info className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="p-6 flex items-center justify-center min-h-[180px]">
        <div className="flex rounded-lg overflow-hidden shadow-md">
          {labels.map((l) => (
            <div
              key={l.key}
              className={cn(
                "px-4 py-2 text-xs font-bold text-white transition-all",
                l.bg,
                l.key === chance ? "scale-110 shadow-lg z-10" : "opacity-60",
              )}
            >
              {l.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Breakdown({ rows }: { rows: { name: string; correct: number; total: number; pct: number }[] }) {
  if (!rows.length) return <div className="text-sm text-muted-foreground py-6 text-center">No attempts yet.</div>;
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
