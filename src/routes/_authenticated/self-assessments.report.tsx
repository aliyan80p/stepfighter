import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { getAssessmentReport } from "@/lib/performance.functions";
import { QBANKS, useActiveQbankId } from "@/lib/active-qbank";
import { getMyEntitlement, QBANK_ID_TO_SLUG } from "@/lib/entitlements.functions";
import {
  Check, X, RotateCcw, TrendingUp, CheckCircle2, XCircle, MinusCircle,
  ClipboardCheck, Search, Award,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/self-assessments/report")({
  component: ReportPage,
});

type Opt = { key: string; label: string; qbankId: number; sources: string[]; group: string };
const STEP1_NBMES = [25, 26, 27, 28, 29, 30, 31, 32, 33];
const STEP2_NBMES = [8, 9, 10, 11, 12, 13, 14, 15, 16];
const STEP2_CMS_FORMS: Array<{ specialty: string; tag: string; forms: number[] }> = [
  { specialty: "Emergency Medicine", tag: "EM",   forms: [1, 2, 3] },
  { specialty: "Family Medicine",    tag: "FM",   forms: [2, 3, 5] },
  { specialty: "Internal Medicine",  tag: "IM",   forms: [5, 6, 7, 8, 9, 10] },
  { specialty: "Neurology",          tag: "NEU",  forms: [5, 6, 7, 8, 9] },
  { specialty: "Ob/Gyn",             tag: "OBG",  forms: [5, 6, 7, 8, 9, 10] },
  { specialty: "Pediatrics",         tag: "PEDS", forms: [5, 6, 7, 8, 9] },
  { specialty: "Psychiatry",         tag: "PSY",  forms: [5, 6, 7, 8] },
  { specialty: "Surgery",            tag: "SUR",  forms: [5, 6, 7, 8, 9] },
];
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
  for (const cms of STEP2_CMS_FORMS) {
    for (const n of cms.forms) {
      out.push({ key: `step2-cms-${cms.tag}${n}`, label: `CMS ${cms.specialty} Form ${n}`, group: "USMLE Step 2 CK", qbankId: s2, sources: [`CMS_${cms.tag}${n}`] });
    }
  }
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
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });

  const entFn = useServerFn(getMyEntitlement);
  const entQ = useQuery({ queryKey: ["my-entitlement"], queryFn: () => entFn(), staleTime: 60_000 });
  const entitledGroupNames = useMemo(() => {
    const allowed = new Set(entQ.data?.effective_access ?? []);
    return new Set(QBANKS.filter((q) => allowed.has(QBANK_ID_TO_SLUG[q.id])).map((q) => q.name));
  }, [entQ.data]);
  const groups = entitledGroupNames.size && entitledGroupNames.has(activeGroup) ? [activeGroup] : [activeGroup];

  useEffect(() => {
    if (groups.length && !groups.includes(group)) setGroup(groups[0]);
  }, [groups, group]);

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="sf-fluid-page space-y-5">
        {/* Clinical Studio Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b border-border">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Assessment Report</h1>
              <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                {activeGroup}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Detailed breakdown of your NBME and Self-Assessment performance
            </p>
          </div>
          <Link
            to="/self-assessments/assessments"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card text-xs font-medium text-foreground hover:bg-muted/60 transition-colors"
          >
            <ClipboardCheck className="h-3.5 w-3.5 text-muted-foreground" />
            Assessment Blocks
          </Link>
        </div>

        {/* Control Bar: Tabs + Assessment selector */}
        <div className="rounded-xl bg-card border border-border p-3 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-lg bg-muted/60 p-1">
            {(["overall", "analysis"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "px-4 py-1.5 text-xs font-semibold rounded-md transition-colors capitalize",
                  tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t === "overall" ? "Overview" : "Subject & System Analysis"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="text-xs font-medium text-muted-foreground shrink-0">Assessment</label>
            <select
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="h-9 min-w-0 flex-1 sm:flex-none sm:min-w-[230px] rounded-lg border border-border bg-background px-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {filtered.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {isLoading || !data ? (
          <div className="grid gap-3 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-card border border-border animate-pulse" />)}
          </div>
        ) : data.totalQuestions === 0 ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center">
            <div className="font-semibold text-sm">Assessment not available</div>
            <div className="text-xs text-muted-foreground mt-1">This assessment has no questions imported yet.</div>
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
    <div className="space-y-4">
      {/* KPI Totals */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <KpiCard icon={Award} tone="blue" label="Overall Score" value={`${data.scorePct}%`} />
        <KpiCard icon={CheckCircle2} tone="green" label="Total Correct" value={String(data.totalCorrect)} />
        <KpiCard icon={XCircle} tone="rose" label="Total Incorrect" value={String(data.totalIncorrect)} />
        <KpiCard icon={MinusCircle} tone="slate" label="Total Omitted" value={String(data.totalOmitted)} />
      </div>

      {/* Percentile */}
      <PercentileCard percentile={data.percentile} scorePct={data.scorePct} passingPct={data.passingPct} peerCount={data.peerCount} />

      {/* Row: Answer Changes + Chance of passing */}
      <div className="grid gap-4 md:grid-cols-2">
        <AnswerChangesCard changes={data.answerChanges} />
        <ChanceOfPassingCard chance={data.chance} />
      </div>
    </div>
  );
}

function AnalysisTab({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      <AnalysisTable title="Subject Analysis" headerLabel="Subject" placeholder="Search subjects…" rows={data.subjectBreakdown} />
      <AnalysisTable title="System Analysis" headerLabel="System" placeholder="Search systems…" rows={data.systemBreakdown} />
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
    <div className="rounded-xl bg-card border border-border overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-border bg-muted/30">
        <div className="font-semibold text-sm">{title}</div>
        <div className="relative w-full sm:w-60">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder}
            className="h-8 w-full pl-8 pr-3 rounded-lg bg-background border border-border text-xs outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs sm:text-sm">
          <thead>
            <tr className="bg-muted/40 border-b border-border text-muted-foreground">
              <th className="text-left font-semibold uppercase tracking-wide text-[11px] px-4 py-2.5">{headerLabel}</th>
              <th className="text-left font-semibold uppercase tracking-wide text-[11px] px-4 py-2.5">Total Q</th>
              <th className="text-left font-semibold uppercase tracking-wide text-[11px] px-4 py-2.5">Correct</th>
              <th className="text-left font-semibold uppercase tracking-wide text-[11px] px-4 py-2.5">Incorrect</th>
              <th className="text-left font-semibold uppercase tracking-wide text-[11px] px-4 py-2.5">Omitted</th>
              <th className="text-right font-semibold uppercase tracking-wide text-[11px] px-4 py-2.5">Accuracy</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-muted-foreground py-8 text-xs">No data</td></tr>
            ) : filtered.map((r) => {
              const pct = r.total ? Math.round((r.correct / r.total) * 100) : 0;
              return (
                <tr key={r.name} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2.5 font-medium">{r.name}</td>
                  <td className="px-4 py-2.5 tabular-nums">{r.total}</td>
                  <td className="px-4 py-2.5 text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">{r.correct}</td>
                  <td className="px-4 py-2.5 text-rose-600 dark:text-rose-400 font-semibold tabular-nums">{r.incorrect}</td>
                  <td className="px-4 py-2.5 text-muted-foreground tabular-nums">{r.omitted}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    <span className={cn(
                      "inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold",
                      pct >= 70
                        ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
                        : pct >= 50
                          ? "bg-amber-500/12 text-amber-600 dark:text-amber-400"
                          : "bg-rose-500/12 text-rose-600 dark:text-rose-400",
                    )}>
                      {pct}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const KPI_TONES = {
  blue:  "bg-blue-500/12 text-blue-600 dark:text-blue-400",
  green: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
  rose:  "bg-rose-500/12 text-rose-600 dark:text-rose-400",
  slate: "bg-muted text-muted-foreground",
};

function KpiCard({ icon: Icon, tone, label, value }: { icon: any; tone: keyof typeof KPI_TONES; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card border border-border p-4 flex items-center gap-3">
      <div className={cn("h-10 w-10 rounded-lg grid place-items-center shrink-0", KPI_TONES[tone])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-xl font-bold leading-tight tabular-nums mt-0.5">{value}</div>
      </div>
    </div>
  );
}

function PercentileCard({ percentile, scorePct, passingPct, peerCount }: any) {
  const W = 700, H = 200;
  const mean = 0.5, sigma = 0.15;
  const bell = (x: number) => Math.exp(-((x - mean) ** 2) / (2 * sigma ** 2));
  const points: string[] = [];
  const maxY = bell(mean);
  for (let i = 0; i <= 100; i++) {
    const x = i / 100;
    const y = bell(x) / maxY;
    points.push(`${20 + x * (W - 40)},${22 + (1 - y) * (H - 54)}`);
  }
  const meX = 20 + (percentile / 100) * (W - 40);
  const meY = 22 + (1 - bell(percentile / 100) / maxY) * (H - 54);
  const passX = 20 + (passingPct / 100) * (W - 40);
  const below = scorePct < passingPct;

  return (
    <div className="rounded-xl bg-card border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-blue-500/12 text-blue-600 dark:text-blue-400 grid place-items-center">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div>
            <div className="font-semibold text-sm">Percentile Rank</div>
            <div className="text-xs text-muted-foreground">Compare your score against peers and passing threshold</div>
          </div>
        </div>
        <span className="inline-flex rounded-md bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 text-xs font-bold tabular-nums">
          {percentile.toFixed(1)}th
        </span>
      </div>
      <div className="grid gap-5 md:grid-cols-[1fr_260px] p-5 items-center">
        <div className="w-full overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-48">
            <polyline points={points.join(" ")} fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} opacity={0.5} />
            <line x1={passX} x2={passX} y1={20} y2={H - 32} stroke="hsl(217 91% 55%)" strokeWidth={1.5} strokeDasharray="3 3" />
            <text x={passX} y={15} fontSize={11} textAnchor="middle" fill="hsl(217 91% 55%)" fontWeight={600}>Pass {passingPct}%</text>
            <line x1={20} x2={W - 20} y1={H - 32} y2={H - 32} stroke="hsl(var(--border))" />
            <circle cx={meX} cy={meY} r={6} fill="hsl(142 71% 45%)" stroke="hsl(var(--card))" strokeWidth={2} />
            <text x={meX} y={meY - 12} fontSize={11} textAnchor="middle" fill="hsl(142 71% 45%)" fontWeight={700}>{percentile.toFixed(1)}th</text>
          </svg>
        </div>
        <div className="space-y-3 text-xs">
          <div className="rounded-lg bg-muted/40 p-3 flex items-center justify-between font-semibold">
            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Your Score</span>
            <span className="rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 tabular-nums">{scorePct}%</span>
          </div>
          <div className="rounded-lg bg-muted/40 p-3 flex items-center justify-between font-semibold">
            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" />Passing Score</span>
            <span className="rounded-md bg-blue-500/15 text-blue-700 dark:text-blue-300 px-2 py-0.5 tabular-nums">{passingPct}%</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {peerCount ? (
              below
                ? <>Your score (<span className="text-rose-600 dark:text-rose-400 font-semibold">{scorePct}%</span>) is below the passing threshold of {passingPct}%.</>
                : <>Your score (<span className="text-emerald-600 dark:text-emerald-400 font-semibold">{scorePct}%</span>) meets the passing threshold of {passingPct}%.</>
            ) : "No peer data yet — percentile will populate as more students complete this assessment."}
          </p>
        </div>
      </div>
    </div>
  );
}

function AnswerChangesCard({ changes }: { changes: any }) {
  const rows = [
    { label: "Correct → Correct", value: changes.correctToCorrect, tone: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400", icon: <Check className="h-3.5 w-3.5" /> },
    { label: "Correct → Incorrect", value: changes.correctToIncorrect, tone: "bg-rose-500/12 text-rose-600 dark:text-rose-400", icon: <X className="h-3.5 w-3.5" /> },
    { label: "Incorrect → Correct", value: changes.incorrectToCorrect, tone: "bg-blue-500/12 text-blue-600 dark:text-blue-400", icon: <RotateCcw className="h-3.5 w-3.5" /> },
    { label: "Incorrect → Incorrect", value: changes.incorrectToIncorrect, tone: "bg-violet-500/12 text-violet-600 dark:text-violet-400", icon: <RotateCcw className="h-3.5 w-3.5" /> },
  ];
  return (
    <div className="rounded-xl bg-card border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <div className="font-semibold text-sm">Answer Changes</div>
        <div className="text-xs text-muted-foreground">Track how answer changes impacted your score</div>
      </div>
      <div className="p-4 space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3 rounded-lg bg-muted/30 px-3 py-2">
            <div className={cn("h-7 w-7 rounded-md grid place-items-center shrink-0", r.tone)}>{r.icon}</div>
            <div className="flex-1 text-xs sm:text-sm font-medium">{r.label}</div>
            <div className={cn("px-2.5 py-0.5 rounded-md text-xs font-bold tabular-nums", r.tone)}>{r.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChanceOfPassingCard({ chance }: { chance: "low" | "borderline" | "high" | "very-high" }) {
  const labels: Array<{ key: typeof chance; label: string; activeBg: string }> = [
    { key: "low", label: "LOW", activeBg: "bg-rose-500 text-white" },
    { key: "borderline", label: "BORDERLINE", activeBg: "bg-amber-500 text-white" },
    { key: "high", label: "HIGH", activeBg: "bg-emerald-500 text-white" },
    { key: "very-high", label: "VERY HIGH", activeBg: "bg-emerald-600 text-white" },
  ];
  const textColor = chance === "low" ? "text-rose-600 dark:text-rose-400" : chance === "borderline" ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400";
  return (
    <div className="rounded-xl bg-card border border-border overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
        <div>
          <div className="font-semibold text-sm">Chance of Passing</div>
          <div className="text-xs text-muted-foreground">Estimated readiness band</div>
        </div>
        <span className={cn("text-xs font-bold uppercase tracking-wide", textColor)}>
          {chance.replace("-", " ")}
        </span>
      </div>
      <div className="p-6 flex-1 flex items-center justify-center">
        <div className="grid grid-cols-4 gap-1.5 w-full max-w-md">
          {labels.map((l) => {
            const active = l.key === chance;
            return (
              <div
                key={l.key}
                className={cn(
                  "py-2.5 px-2 rounded-lg text-center text-[11px] font-bold transition-all border",
                  active
                    ? cn(l.activeBg, "border-transparent shadow-sm scale-[1.03]")
                    : "bg-muted/40 text-muted-foreground border-border opacity-70",
                )}
              >
                {l.label}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
