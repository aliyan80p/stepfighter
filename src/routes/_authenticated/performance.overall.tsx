import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { getDashboardStats } from "@/lib/qbank.functions";
import { getPerformanceGraphs } from "@/lib/performance.functions";
import { QBANKS, useActiveQbankId } from "@/lib/active-qbank";
import {
  CheckCircle2, XCircle, MinusCircle, HelpCircle, User, ArrowRightLeft,
  RefreshCw, Repeat, FilePlus2, FileCheck2, PauseCircle, ClipboardList,
  BarChart3, PlusCircle, Clock, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/performance/overall")({
  component: OverallPerformance,
});

// ---- QBank option catalogue (mirrors new-test.tsx) ----
type Opt = { key: string; label: string; qbankId: number; sources?: string[] };

const STEP1_NBMES = [25, 26, 27, 28, 29, 30, 31, 32, 33];
const STEP2_NBMES = [8, 9, 10, 11, 12, 13, 14, 15, 16];
const STEP2_CMS: Array<{ specialty: string; tag: string; forms: number[] }> = [
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

  const s1 = qbId("step1");
  out.push({ key: "step1-all", label: "All Step 1 QBanks", qbankId: s1 });
  out.push({ key: "step1-uw", label: "UWorld Step 1", qbankId: s1, sources: ["main"] });
  for (const n of [1, 2, 3]) out.push({ key: `step1-sa${n}`, label: `Step 1 Self Assessment ${n}`, qbankId: s1, sources: [`SA${n}`] });
  for (const n of STEP1_NBMES) out.push({ key: `step1-nbme${n}`, label: `Step 1 NBME ${n}`, qbankId: s1, sources: [`NBME${n}`] });

  const s2 = qbId("step2");
  out.push({ key: "step2-all", label: "All Step 2 CK QBanks", qbankId: s2 });
  out.push({ key: "step2-uw", label: "UWorld Step 2 CK", qbankId: s2, sources: ["main"] });
  for (const n of [1, 2, 3]) out.push({ key: `step2-sa${n}`, label: `Step 2 CK Self Assessment ${n}`, qbankId: s2, sources: [`SA${n}`] });
  for (const n of STEP2_NBMES) out.push({ key: `step2-nbme${n}`, label: `Step 2 CK NBME ${n}`, qbankId: s2, sources: [`NBME${n}`] });
  for (const cms of STEP2_CMS) {
    const forms = cms.forms;
    const label = `CMS ${cms.specialty} Forms (${forms.join(",")})`;
    out.push({ key: `step2-cms-${cms.tag}`, label, qbankId: s2, sources: forms.map((n) => `CMS_${cms.tag}${n}`) });
  }

  const s3 = qbId("step3");
  out.push({ key: "step3-all", label: "All Step 3 QBanks", qbankId: s3 });
  out.push({ key: "step3-uw", label: "UWorld Step 3", qbankId: s3, sources: ["main"] });
  for (const n of [1, 2, 3]) out.push({ key: `step3-sa${n}`, label: `Step 3 Self Assessment ${n}`, qbankId: s3, sources: [`SA${n}`] });

  return out;
}

const OPTIONS = buildOptions();

function OverallPerformance() {
  const fn = useServerFn(getDashboardStats);
  const graphsFn = useServerFn(getPerformanceGraphs);
  const activeQbankId = useActiveQbankId();
  const activeQbank = QBANKS.find((q) => q.id === activeQbankId) ?? QBANKS[0];
  const activeSlug = activeQbank.slug ?? "step2";
  const filteredOptions = useMemo(
    () => OPTIONS.filter((o) => o.key.startsWith(`${activeSlug}-`)),
    [activeSlug],
  );
  const [tab, setTab] = useState<"overall" | "analysis">("overall");
  const [optKey, setOptKey] = useState<string>(`${activeSlug}-all`);
  useEffect(() => {
    if (!filteredOptions.some((o) => o.key === optKey)) {
      setOptKey(filteredOptions[0]?.key ?? `${activeSlug}-all`);
    }
  }, [activeSlug, filteredOptions, optKey]);
  const opt = useMemo(() => filteredOptions.find((o) => o.key === optKey) ?? filteredOptions[0], [filteredOptions, optKey]);

  const { data, isLoading } = useQuery({
    queryKey: ["perf-overall", opt.qbankId, opt.sources?.join(",") ?? "all"],
    queryFn: () => fn({ data: { qbankId: opt.qbankId, sources: opt.sources } }),
  });

  const { data: analysis, isLoading: analysisLoading } = useQuery({
    queryKey: ["perf-overall-analysis", opt.qbankId, opt.sources?.join(",") ?? "all"],
    queryFn: () => graphsFn({ data: { qbankId: opt.qbankId, sources: opt.sources, days: 365 } }),
    enabled: tab === "analysis",
    staleTime: 60_000,
  });

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="sf-fluid-page space-y-5">
        {/* Clinical Studio Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b border-border">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Overall Performance</h1>
              <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                {activeQbank.name}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Accuracy, QBank completion, answer changes, and subject/system breakdowns
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/performance/graphs"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card text-xs font-medium text-foreground hover:bg-muted/60 transition-colors"
            >
              <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
              Graphs
            </Link>
            <Link
              to="/new-test"
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              New Quiz
            </Link>
          </div>
        </div>

        {/* Control Bar: Tabs + QBank Filter */}
        <div className="rounded-xl bg-card border border-border p-3 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-lg bg-muted/60 p-1">
            {(["overall", "analysis"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "px-4 py-1.5 text-xs font-semibold rounded-md transition-colors capitalize",
                  tab === t
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t === "overall" ? "Overview" : "Subject & System Analysis"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="text-xs font-medium text-muted-foreground shrink-0">QBank</label>
            <select
              value={optKey}
              onChange={(e) => setOptKey(e.target.value)}
              className="h-9 min-w-0 flex-1 sm:flex-none sm:min-w-[260px] max-w-full rounded-lg border border-border bg-background px-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {activeSlug === "step2" ? (
                <>
                  <optgroup label="USMLE Step 2 CK">
                    {filteredOptions.filter((o) => !o.key.startsWith("step2-cms")).map((o) => (
                      <option key={o.key} value={o.key}>{o.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="CMS Clinical Shelf Forms">
                    {filteredOptions.filter((o) => o.key.startsWith("step2-cms")).map((o) => (
                      <option key={o.key} value={o.key}>{o.label}</option>
                    ))}
                  </optgroup>
                </>
              ) : (
                <optgroup label={activeQbank.name}>
                  {filteredOptions.map((o) => (
                    <option key={o.key} value={o.key}>{o.label}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
        </div>

        {tab === "analysis" ? (
          analysisLoading || !analysis ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[0, 1].map((i) => <div key={i} className="h-64 rounded-xl border border-border animate-pulse bg-card" />)}
            </div>
          ) : analysis.totalAttempts === 0 ? (
            <div className="rounded-xl bg-card border border-border p-10 text-center text-sm text-muted-foreground">
              No attempts recorded in this filter yet. Answer a few questions to unlock subject &amp; system analysis.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <KpiCard icon={ClipboardList} tone="blue" label="Attempts (365d)" value={analysis.totalAttempts.toLocaleString()} />
                <KpiCard icon={Clock} tone="violet" label="Avg Time / Question" value={`${analysis.avgTimeSec}s`} />
                <KpiCard
                  icon={AlertTriangle}
                  tone="amber"
                  label="Weakest Subject"
                  value={[...analysis.subjectBreakdown].sort((a, b) => a.pct - b.pct)[0]?.name ?? "—"}
                  compactValue
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {[
                  { title: "By Subject", rows: analysis.subjectBreakdown },
                  { title: "By System", rows: analysis.systemBreakdown },
                ].map(({ title, rows }) => (
                  <div key={title} className="rounded-xl bg-card border border-border overflow-hidden">
                    <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
                      <span className="font-semibold text-sm">{title}</span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">{rows.length} categories</span>
                    </div>
                    {rows.length === 0 ? (
                      <div className="p-6 text-xs text-muted-foreground text-center">No data yet.</div>
                    ) : (
                      <div className="p-4 space-y-3 max-h-[460px] overflow-y-auto">
                        {rows.map((r) => (
                          <div key={r.id} className="space-y-1">
                            <div className="flex items-center justify-between text-xs gap-2">
                              <span className="font-medium truncate">{r.name}</span>
                              <span className="text-muted-foreground shrink-0 tabular-nums">
                                {r.correct}/{r.total} · <span className="font-semibold text-foreground">{r.pct}%</span>
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${r.pct}%`,
                                  background: r.pct >= 70 ? "hsl(142 71% 45%)" : r.pct >= 50 ? "hsl(38 92% 50%)" : "hsl(0 84% 60%)",
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        ) : (
          <>
            {/* Top KPI Strip */}
            {isLoading || !data ? (
              <div className="grid gap-3 sm:grid-cols-3">
                {[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-xl border border-border animate-pulse bg-card" />)}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                <KpiCard icon={ClipboardList} tone="blue" label="Total Tests" value={data.testCount.created.toLocaleString()} />
                <KpiCard icon={FileCheck2} tone="green" label="Tests Completed" value={data.testCount.completed.toLocaleString()} />
                <KpiCard icon={PauseCircle} tone="amber" label="Tests Suspended" value={data.testCount.suspended.toLocaleString()} />
              </div>
            )}

            {data && (
                <div className="grid gap-4 md:grid-cols-2">
                  {/* QBank Usage */}
                  <div className="rounded-xl bg-card border border-border p-5">
                    <div className="font-semibold text-sm">QBank Usage</div>
                    <div className="text-xs text-muted-foreground mb-4">Unique question IDs attempted at least once</div>
                    <div className="flex flex-col sm:flex-row items-center gap-5">
                      <Donut
                        size={156}
                        segments={[
                          { value: data.answered, color: "hsl(217 91% 60%)" },
                          { value: Math.max(data.unused, 0), color: "hsl(var(--muted))" },
                        ]}
                        center={<div className="text-center"><div className="text-2xl font-bold tabular-nums">{data.usedPct}%</div><div className="text-[10px] text-muted-foreground uppercase tracking-wide">Used</div></div>}
                      />
                      <div className="flex-1 min-w-0 w-full space-y-2.5">
                        <Row icon={HelpCircle} tone="blue" label="Total Questions" value={data.totalQuestions} />
                        <Row icon={User} tone="violet" label="Used Questions" value={data.answered} />
                        <Row icon={MinusCircle} tone="sky" label="Unused Questions" value={Math.max(data.unused, 0)} />
                      </div>
                    </div>
                  </div>

                  {/* Your Score */}
                  <div className="rounded-xl bg-card border border-border p-5">
                    <div className="font-semibold text-sm">Your Score</div>
                    <div className="text-xs text-muted-foreground mb-4">All attempts (omitted counted as wrong, UWorld-style)</div>
                    <div className="flex flex-col sm:flex-row items-center gap-5">
                      <Donut
                        size={156}
                        segments={[
                          { value: data.correctAttempts, color: "hsl(142 71% 45%)" },
                          { value: data.incorrectAttempts, color: "hsl(0 84% 60%)" },
                          { value: data.omittedAttempts, color: "hsl(220 15% 55%)" },
                        ]}
                        center={<div className="text-center"><div className="text-2xl font-bold tabular-nums">{data.correctPct}%</div><div className="text-[10px] text-muted-foreground uppercase tracking-wide">Correct</div></div>}
                      />
                      <div className="flex-1 min-w-0 w-full space-y-2.5">
                        <Row icon={CheckCircle2} tone="green" label="Total Correct" value={data.correctAttempts} />
                        <Row icon={XCircle} tone="rose" label="Total Incorrect" value={data.incorrectAttempts} />
                        <Row icon={MinusCircle} tone="sky" label="Total Omitted" value={data.omittedAttempts} />
                      </div>
                    </div>
                  </div>
                </div>
            )}

            {data && (
              <div className="grid gap-4 md:grid-cols-2">
                {/* Answer Changes */}
                <div className="rounded-xl bg-card border border-border p-5">
                  <div className="font-semibold text-sm">Answer Changes</div>
                  <div className="text-xs text-muted-foreground mb-4">How changing answers impacted your score</div>
                  <div className="space-y-2.5">
                    <Row icon={CheckCircle2} tone="green" label="Correct to Correct" value={data.answerChanges.correctToCorrect ?? 0} />
                    <Row icon={ArrowRightLeft} tone="rose" label="Correct to Incorrect" value={data.answerChanges.correctToIncorrect} />
                    <Row icon={RefreshCw} tone="sky" label="Incorrect to Correct" value={data.answerChanges.incorrectToCorrect} />
                    <Row icon={Repeat} tone="violet" label="Incorrect to Incorrect" value={data.answerChanges.incorrectToIncorrect} />
                  </div>
                </div>

                {/* Test Count */}
                <div className="rounded-xl bg-card border border-border p-5">
                  <div className="font-semibold text-sm">Test Activity</div>
                  <div className="text-xs text-muted-foreground mb-4">Your test sessions for this selection</div>
                  <div className="space-y-2.5">
                    <Row icon={FilePlus2} tone="blue" label="Tests Created" value={data.testCount.created} />
                    <Row icon={FileCheck2} tone="green" label="Tests Completed" value={data.testCount.completed} />
                    <Row icon={PauseCircle} tone="amber" label="Suspended Tests" value={data.testCount.suspended} />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const TONES: Record<string, { bg: string; text: string; pill: string }> = {
  blue:   { bg: "bg-blue-500/12",    text: "text-blue-600 dark:text-blue-400",       pill: "bg-blue-500/12 text-blue-700 dark:text-blue-300" },
  green:  { bg: "bg-emerald-500/12", text: "text-emerald-600 dark:text-emerald-400", pill: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300" },
  amber:  { bg: "bg-amber-500/12",   text: "text-amber-600 dark:text-amber-400",     pill: "bg-amber-500/12 text-amber-700 dark:text-amber-300" },
  violet: { bg: "bg-violet-500/12",  text: "text-violet-600 dark:text-violet-400",   pill: "bg-violet-500/12 text-violet-700 dark:text-violet-300" },
  rose:   { bg: "bg-rose-500/12",    text: "text-rose-600 dark:text-rose-400",       pill: "bg-rose-500/12 text-rose-700 dark:text-rose-300" },
  sky:    { bg: "bg-sky-500/12",     text: "text-sky-600 dark:text-sky-400",         pill: "bg-sky-500/12 text-sky-700 dark:text-sky-300" },
};

function KpiCard({ icon: Icon, tone, label, value, compactValue }: { icon: any; tone: keyof typeof TONES; label: string; value: string; compactValue?: boolean }) {
  const t = TONES[tone];
  return (
    <div className="rounded-xl bg-card border border-border p-4 flex items-center gap-3.5">
      <div className={cn("h-10 w-10 rounded-lg grid place-items-center shrink-0", t.bg, t.text)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={cn("font-bold tabular-nums leading-tight mt-0.5 truncate", compactValue ? "text-base" : "text-2xl")}>
          {value}
        </div>
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, sub, value, tone }: { icon: any; label: string; sub?: string; value: number; tone: keyof typeof TONES }) {
  const t = TONES[tone];
  return (
    <div className="flex items-center gap-3">
      <div className={cn("h-8 w-8 rounded-lg grid place-items-center shrink-0", t.bg, t.text)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs sm:text-sm font-medium truncate">{label}</div>
        {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
      </div>
      <div className={cn("px-2.5 py-0.5 rounded-md text-xs font-semibold tabular-nums", t.pill)}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function Donut({ size, segments, center }: { size: number; segments: { value: number; color: string }[]; center?: React.ReactNode }) {
  const stroke = 14;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let acc = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} />
        {segments.map((s, i) => {
          const len = (s.value / total) * circ;
          const el = (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={`${len} ${circ - len}`}
              strokeDashoffset={-acc}
              strokeLinecap="butt"
            />
          );
          acc += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center">{center}</div>
    </div>
  );
}
