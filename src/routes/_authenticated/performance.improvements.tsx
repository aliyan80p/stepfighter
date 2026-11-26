import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useActiveQbankId, QBANKS } from "@/lib/active-qbank";
import {
  getImprovementsOverview,
  generatePerformancePrediction,
  getStudyPlan,
} from "@/lib/performance.functions";
import { createCustomTest } from "@/lib/qbank.functions";
import { Button } from "@/components/ui/button";
import {
  Info, Flag, LineChart as LineChartIcon, Star, FileText,
  ChevronDown, Loader2, Lock, HelpCircle, Sparkles, CheckCircle2, Play,
} from "lucide-react";
import { StatisticsByCategoryModal } from "@/components/performance/statistics-by-category-modal";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/performance/improvements")({
  component: ImprovementsPage,
});

function ImprovementsPage() {
  const qbankId = useActiveQbankId();
  const activeQbank = QBANKS.find((q) => q.id === qbankId) ?? QBANKS[0];
  const navigate = useNavigate();
  const overviewFn = useServerFn(getImprovementsOverview);
  const planFn = useServerFn(getStudyPlan);
  const predictFn = useServerFn(generatePerformancePrediction);
  const createFn = useServerFn(createCustomTest);

  const [statsOpen, setStatsOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);

  const overview = useQuery({
    queryKey: ["improvements-overview", qbankId],
    queryFn: () => overviewFn({ data: { qbankId } }),
  });
  const plan = useQuery({
    queryKey: ["study-plan", qbankId],
    queryFn: () => planFn({ data: { qbankId } }),
  });
  const prediction = useQuery({
    queryKey: ["prediction", qbankId, overview.data?.overallPct, plan.data?.totalQuestions],
    queryFn: () => predictFn({
      data: {
        qbankId,
        overallPct: overview.data!.overallPct,
        studyPlanTotal: plan.data!.totalQuestions,
      },
    }),
    enabled: !!overview.data && !!plan.data && (plan.data?.totalQuestions ?? 0) > 0,
  });

  const startQuiz = useMutation({
    mutationFn: async ({ questionIds, index }: { questionIds: number[]; index: number }) => {
      return createFn({
        data: {
          qbankId,
          questionIds,
          mode: "practice",
          timed: false,
          name: `Study Plan Quiz #${index}`,
          studyPlanIndex: index,
        },
      });
    },
    onSuccess: (r) => navigate({ to: "/test/$id", params: { id: String(r.id) } }),
  });

  const chartData = useMemo(
    () => (overview.data?.perfOverTime ?? []).map((t: any, i: number) => ({ x: i + 1, pct: t.pct, name: t.name })),
    [overview.data],
  );

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="sf-fluid-page space-y-5">
        {/* Clinical Studio Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b border-border">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Improvements &amp; Study Plan</h1>
              <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                {activeQbank.name}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Targeted weak-area diagnostics and sequential study plan quizzes
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setHowOpen((v) => !v)} className="h-9 text-xs">
              <Info className="h-3.5 w-3.5 mr-1.5" />
              How it works
              <ChevronDown className={cn("h-3.5 w-3.5 ml-1 transition-transform", howOpen && "rotate-180")} />
            </Button>
            <Button size="sm" className="h-9 text-xs" onClick={() => setStatsOpen(true)}>
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Statistics by Category
            </Button>
          </div>
        </div>

        {/* Collapsible Guide */}
        {howOpen && (
          <div className="rounded-xl bg-card border border-border p-4">
            <div className="grid gap-4 md:grid-cols-3">
              <ExplainCard icon={FileText} title="Your Score" text="Your overall score across all questions in your weak subjects — correct answers divided by total questions (omitted questions count as wrong, UWorld-style)." />
              <ExplainCard icon={Flag} title="Weak Areas" text="Up to 3 subjects where your score is lowest. Subjects below 40% are prioritized first; otherwise the lowest-scoring ones (up to 90%) are shown." />
              <ExplainCard icon={LineChartIcon} title="Performance Over Time" text="Chronological quiz scores showing how your performance has evolved across completed quizzes." />
              <ExplainCard icon={LineChartIcon} title="Performance Trend" text="Compares your most recent quizzes against earlier quizzes. Positive means improving; negative means recent decline." />
              <ExplainCard icon={Star} title="Performance Prediction" text="Estimates your overall score if you answer 70% of the study plan questions correctly." />
              <ExplainCard icon={FileText} title="Study Plan" text="Sequential quizzes built from previously missed questions, ordered weakest first. Complete each quiz to unlock the next." />
            </div>
          </div>
        )}

        {/* Row: Score donut + Weak Areas */}
        <div className="grid gap-4 md:grid-cols-[260px_1fr]">
          <ScoreCard pct={overview.data?.overallPct ?? 0} loading={overview.isLoading} />
          <WeakAreasCard weakAreas={overview.data?.weakAreas ?? []} loading={overview.isLoading} />
        </div>

        {/* Row: Perf over time + Trend */}
        <div className="grid gap-4 md:grid-cols-[1fr_300px]">
          <div className="rounded-xl bg-card border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
              <span className="font-semibold text-sm">Performance Over Time</span>
              <span className="text-[11px] text-muted-foreground tabular-nums">{chartData.length} quizzes</span>
            </div>
            <div className="p-4 h-[250px]">
              {overview.isLoading ? (
                <div className="h-full flex items-center justify-center text-muted-foreground text-xs">Loading…</div>
              ) : !chartData.length ? (
                <div className="h-full flex items-center justify-center text-muted-foreground text-xs">Complete a test to see your trend.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="x" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip
                      formatter={(v: any) => [`${v}%`, "Score"]}
                      labelFormatter={(l) => `Quiz #${l}`}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Line type="monotone" dataKey="pct" stroke="hsl(217 91% 60%)" strokeWidth={2.2} dot={{ r: 3, fill: "hsl(217 91% 60%)" }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          <TrendCard delta={overview.data?.trendDelta ?? null} loading={overview.isLoading} />
        </div>

        {/* Performance Prediction */}
        <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 sm:p-5">
          <div className="flex items-center gap-2 text-primary font-semibold text-sm mb-2">
            <Sparkles className="h-4 w-4" />
            Performance Prediction
          </div>
          {prediction.isLoading || overview.isLoading || plan.isLoading ? (
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Generating prediction…
            </div>
          ) : (plan.data?.totalQuestions ?? 0) === 0 ? (
            <div className="text-xs text-muted-foreground">Answer more questions to unlock a personalized prediction.</div>
          ) : (
            <div
              className="text-xs sm:text-sm text-foreground/90 leading-relaxed [&_strong]:text-primary [&_strong]:font-semibold"
              dangerouslySetInnerHTML={{ __html: renderMd(prediction.data?.text ?? "") }}
            />
          )}
        </div>

        {/* Study Plan */}
        <div className="rounded-xl bg-card border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-sm">Personalized Study Plan</h2>
              <p className="text-xs text-muted-foreground">Sequential quizzes targeting your missed questions</p>
            </div>
            {plan.data && (
              <span className="text-xs font-medium text-muted-foreground tabular-nums">
                {plan.data.quizzes.length} quizzes · {plan.data.totalQuestions} Qs
              </span>
            )}
          </div>

          {plan.isLoading ? (
            <div className="p-6 text-xs text-muted-foreground">Loading study plan…</div>
          ) : !plan.data?.quizzes.length ? (
            <div className="p-8 text-xs text-muted-foreground text-center">
              You have no incorrect questions yet. Complete a few tests to generate a personalized study plan.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {plan.data.quizzes.map((q) => (
                <div key={q.index} className="px-4 py-3.5 flex flex-wrap sm:flex-nowrap items-center gap-3.5 hover:bg-muted/30 transition-colors">
                  <div className={cn(
                    "h-9 w-9 rounded-lg grid place-items-center shrink-0",
                    q.completedTestId
                      ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
                      : q.unlocked
                        ? "bg-primary/12 text-primary"
                        : "bg-muted text-muted-foreground",
                  )}>
                    {q.completedTestId ? <CheckCircle2 className="h-4 w-4" /> : q.unlocked ? <HelpCircle className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={cn("font-semibold text-sm", !q.unlocked && !q.completedTestId && "text-muted-foreground")}>
                        Quiz #{q.index}
                      </span>
                      <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
                        {q.questionIds.length} Qs
                      </span>
                      {q.score != null && (
                        <span className={cn(
                          "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                          q.score >= 70 ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/12 text-amber-600 dark:text-amber-400",
                        )}>
                          {q.score}%
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {q.subjects.join(", ")}
                    </div>
                  </div>

                  <div className="shrink-0">
                    {q.completedTestId ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => navigate({ to: "/test-results/$id", params: { id: String(q.completedTestId) } })}
                      >
                        Results
                      </Button>
                    ) : q.unlocked ? (
                      <Button
                        size="sm"
                        className="h-8 text-xs"
                        disabled={startQuiz.isPending}
                        onClick={() => startQuiz.mutate({ questionIds: q.questionIds, index: q.index })}
                      >
                        {startQuiz.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
                        Start Quiz
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" disabled className="h-8 text-xs opacity-60">
                        <Lock className="h-3.5 w-3.5 mr-1.5" /> Locked
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <StatisticsByCategoryModal open={statsOpen} onOpenChange={setStatsOpen} qbankId={qbankId} />
    </div>
  );
}

function ExplainCard({ icon: Icon, title, text }: { icon: any; title: string; text: string }) {
  return (
    <div className="rounded-lg bg-muted/30 p-3">
      <div className="flex items-center gap-1.5 font-semibold text-xs mb-1">
        <Icon className="h-3.5 w-3.5 text-primary" /> {title}
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">{text}</p>
    </div>
  );
}

function ScoreCard({ pct, loading }: { pct: number; loading: boolean }) {
  const size = 136, stroke = 13, r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (pct / 100) * c;
  return (
    <div className="rounded-xl bg-card border border-border p-5 flex flex-col items-center justify-center">
      {loading ? (
        <div className="h-[160px] flex items-center text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />Loading…
        </div>
      ) : (
        <>
          <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
              <circle cx={size / 2} cy={size / 2} r={r} stroke="hsl(var(--muted))" strokeWidth={stroke} fill="none" />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke="hsl(217 91% 60%)"
                strokeWidth={stroke}
                fill="none"
                strokeDasharray={c}
                strokeDashoffset={off}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center">
              <div className="text-center">
                <div className="text-2xl font-bold tabular-nums">{pct}%</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Weak Area Avg</div>
              </div>
            </div>
          </div>
          <div className="mt-3 flex gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" />Obtained</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-muted-foreground/30" />Remaining</span>
          </div>
        </>
      )}
    </div>
  );
}

function WeakAreasCard({ weakAreas, loading }: { weakAreas: any[]; loading: boolean }) {
  return (
    <div className="rounded-xl bg-card border border-border overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
        <span className="font-semibold text-sm">Priority Weak Areas</span>
        <span className="text-[11px] text-muted-foreground">Lowest scoring subjects</span>
      </div>
      <div className="p-4 flex-1 flex items-center">
        {loading ? (
          <div className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : !weakAreas.length ? (
          <div className="text-xs text-muted-foreground text-center w-full py-6">No weak areas — answer more questions to identify gaps.</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-3 w-full">
            {weakAreas.map((w) => (
              <div key={w.subjectId} className="rounded-lg border border-border bg-muted/20 p-3.5 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-7 w-7 rounded-md bg-rose-500/12 text-rose-600 dark:text-rose-400 grid place-items-center shrink-0">
                      <Flag className="h-3.5 w-3.5" />
                    </div>
                    <div className="font-semibold text-xs sm:text-sm truncate">{w.subject}</div>
                  </div>
                  <span className="inline-flex rounded-md bg-rose-500/12 text-rose-600 dark:text-rose-400 px-2 py-0.5 text-xs font-bold tabular-nums shrink-0">
                    {w.pct}%
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  Weakest system: <span className="text-foreground/80 font-medium">{w.weakestSystem}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TrendCard({ delta, loading }: { delta: number | null; loading: boolean }) {
  const positive = (delta ?? 0) >= 0;
  return (
    <div className="rounded-xl bg-card border border-border p-5 flex flex-col items-center justify-center text-center">
      {loading ? (
        <div className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : delta == null ? (
        <>
          <div className="h-10 w-10 rounded-lg bg-muted text-muted-foreground grid place-items-center mb-2.5">
            <Star className="h-5 w-5" />
          </div>
          <div className="text-xs text-muted-foreground max-w-[210px]">
            Complete at least 4 tests to see your performance trend.
          </div>
        </>
      ) : (
        <>
          <div className={cn(
            "h-10 w-10 rounded-lg grid place-items-center mb-2.5",
            positive ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/12 text-rose-600 dark:text-rose-400",
          )}>
            <Star className="h-5 w-5" />
          </div>
          <div className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">Performance Trend</div>
          <div className={cn("text-3xl font-bold tabular-nums mt-1", positive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
            {positive ? "+" : ""}{delta} pts
          </div>
          <div className="text-xs text-muted-foreground mt-1.5 max-w-[230px]">
            Average score {positive ? "improvement" : "decline"} between your earlier and recent quizzes.
          </div>
        </>
      )}
    </div>
  );
}

function renderMd(md: string): string {
  const escaped = md.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" } as any)[c]);
  return escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br/>");
}
