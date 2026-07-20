import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useActiveQbankId, setActiveQbankId, QBANKS } from "@/lib/active-qbank";
import {
  getImprovementsOverview,
  generatePerformancePrediction,
  getStudyPlan,
} from "@/lib/performance.functions";
import { createCustomTest } from "@/lib/qbank.functions";
import { Button } from "@/components/ui/button";
import {
  Info, Flag, LineChart as LineChartIcon, Star, FileText,
  ChevronDown, Loader2, Lock, HelpCircle, Sparkles,
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
  const navigate = useNavigate();
  const overviewFn = useServerFn(getImprovementsOverview);
  const planFn = useServerFn(getStudyPlan);
  const predictFn = useServerFn(generatePerformancePrediction);
  const createFn = useServerFn(createCustomTest);

  const [statsOpen, setStatsOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(true);

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
    <div className="min-h-screen bg-muted/30">
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-blue-800 dark:text-blue-300">Improvements Required</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Here is an AI-Generated <span className="text-primary font-medium">study plan</span> to boost your scores.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={qbankId}
              onChange={(e) => setActiveQbankId(Number(e.target.value))}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              {QBANKS.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
            </select>
            <Button className="bg-blue-700 hover:bg-blue-800 text-white" onClick={() => setStatsOpen(true)}>
              <Sparkles className="h-4 w-4 mr-2" />
              Statistics by Category
            </Button>
          </div>
        </div>

        {/* How does this page work? */}
        <div className="rounded-xl bg-card border-l-4 border-blue-500 border-y border-r border-border shadow-sm overflow-hidden">
          <button
            onClick={() => setHowOpen((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/50"
          >
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-medium">
              <Info className="h-4 w-4" />
              How does this page work?
            </div>
            <ChevronDown className={cn("h-4 w-4 transition-transform", howOpen && "rotate-180")} />
          </button>
          {howOpen && (
            <div className="grid gap-4 md:grid-cols-3 px-5 pb-5">
              <ExplainCard icon={FileText} title="Your Score" text="Your overall score across all questions in your weak subjects — correct answers divided by total questions (omitted questions count as wrong, UWorld-style)." />
              <ExplainCard icon={Flag} title="Weak Areas" text="Up to 3 subjects where your score is lowest. If any subjects are below 40%, those are shown first. If all subjects are above 40%, the lowest-scoring ones (up to 90%) are shown instead." />
              <ExplainCard icon={LineChartIcon} title="Performance Over Time" text="A graph of your quiz scores in chronological order, showing how your performance has changed across each quiz you have taken." />
              <ExplainCard icon={LineChartIcon} title="Performance Trend" text="Compares the average score of your most recent quizzes against your earlier quizzes. A positive number means you are improving; a negative number means your scores have declined recently." />
              <ExplainCard icon={Star} title="Performance Prediction" text="Estimates your overall score if you answer 70% of the study plan questions correctly. This is a prediction — your actual improvement depends on how well you perform on the study plan quizzes." />
              <ExplainCard icon={FileText} title="Study Plan" text="A set of quizzes built from questions you previously answered incorrectly, ordered from your weakest knowledge first. Quizzes unlock one at a time — complete each one to unlock the next. After completion, you can review each quiz from Previous Tests." />
            </div>
          )}
        </div>

        {/* Row: Score donut + Weak Areas */}
        <div className="grid gap-6 md:grid-cols-[280px_1fr]">
          <ScoreCard pct={overview.data?.overallPct ?? 0} loading={overview.isLoading} />
          <WeakAreasCard weakAreas={overview.data?.weakAreas ?? []} loading={overview.isLoading} />
        </div>

        {/* Row: Perf over time + Trend */}
        <div className="grid gap-6 md:grid-cols-[1fr_320px]">
          <div className="rounded-xl bg-card border border-border shadow-sm">
            <div className="px-5 py-3 border-b border-border font-semibold">Performance Over Time</div>
            <div className="p-4 h-[260px]">
              {overview.isLoading ? (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
              ) : !chartData.length ? (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Complete a test to see your trend.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="x" tick={{ fontSize: 11 }} label={{ value: "Performance Trends Across Quizzes", position: "insideBottom", offset: -10, style: { fontSize: 12, fill: "hsl(var(--muted-foreground))" } }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any) => `${v}%`} labelFormatter={(l) => `Quiz #${l}`} />
                    <Line type="monotone" dataKey="pct" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: "#3b82f6" }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          <TrendCard delta={overview.data?.trendDelta ?? null} loading={overview.isLoading} />
        </div>

        {/* Performance Prediction */}
        <div className="rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 p-5">
          <div className="text-blue-800 dark:text-blue-300 font-semibold mb-2">Performance Prediction</div>
          {prediction.isLoading || overview.isLoading || plan.isLoading ? (
            <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Generating prediction…</div>
          ) : (plan.data?.totalQuestions ?? 0) === 0 ? (
            <div className="text-sm text-muted-foreground">Answer more questions to unlock a personalized prediction.</div>
          ) : (
            <div
              className="text-sm text-foreground/90 leading-relaxed [&_strong]:text-blue-700 dark:[&_strong]:text-blue-300 [&_strong]:font-semibold"
              dangerouslySetInnerHTML={{ __html: renderMd(prediction.data?.text ?? "") }}
            />
          )}
        </div>

        {/* Study Plan */}
        <div>
          <div className="text-sm text-muted-foreground mb-2">Study Plan</div>
          {plan.isLoading ? (
            <div className="rounded-xl bg-card border border-border p-6 text-sm text-muted-foreground">Loading study plan…</div>
          ) : !plan.data?.quizzes.length ? (
            <div className="rounded-xl bg-card border border-border p-6 text-sm text-muted-foreground">
              You have no incorrect questions yet. Complete a few tests to generate a personalized study plan.
            </div>
          ) : (
            <div className="space-y-3">
              {plan.data.quizzes.map((q) => (
                <div key={q.index} className="rounded-xl bg-card border border-border shadow-sm px-5 py-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-muted grid place-items-center text-muted-foreground shrink-0">
                    <HelpCircle className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={cn("font-semibold", !q.unlocked && "text-muted-foreground")}>Quiz #{q.index}</div>
                    <div className="text-xs md:text-sm flex flex-wrap gap-x-4 gap-y-1 mt-0.5">
                      <span><span className="text-primary font-medium">Questions:</span> {q.questionIds.length}</span>
                      <span className="min-w-0"><span className="text-primary font-medium">Subjects:</span> <span className="text-muted-foreground">{q.subjects.join(", ")}</span></span>
                      {q.score != null && (
                        <span className={cn("font-medium", q.score >= 70 ? "text-emerald-600" : "text-amber-600")}>Score: {q.score}%</span>
                      )}
                    </div>
                  </div>
                  {q.completedTestId ? (
                    <Button
                      variant="outline"
                      onClick={() => navigate({ to: "/test/$id/results", params: { id: String(q.completedTestId) } })}
                    >
                      Review
                    </Button>
                  ) : q.unlocked ? (
                    <Button
                      className="bg-blue-700 hover:bg-blue-800 text-white"
                      disabled={startQuiz.isPending}
                      onClick={() => startQuiz.mutate({ questionIds: q.questionIds, index: q.index })}
                    >
                      {startQuiz.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                      Start Quiz
                    </Button>
                  ) : (
                    <Button variant="outline" disabled className="opacity-60">
                      <Lock className="h-4 w-4 mr-2" /> Locked
                    </Button>
                  )}
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
    <div>
      <div className="flex items-center gap-2 font-semibold text-sm mb-1">
        <Icon className="h-4 w-4 text-muted-foreground" /> {title}
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
    </div>
  );
}

function ScoreCard({ pct, loading }: { pct: number; loading: boolean }) {
  const size = 140, stroke = 14, r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (pct / 100) * c;
  return (
    <div className="rounded-xl bg-card border border-border shadow-sm p-5 flex flex-col items-center justify-center">
      {loading ? (
        <div className="h-[180px] flex items-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin mr-2" />Loading…</div>
      ) : (
        <>
          <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
              <circle cx={size / 2} cy={size / 2} r={r} stroke="hsl(var(--muted))" strokeWidth={stroke} fill="none" />
              <circle cx={size / 2} cy={size / 2} r={r} stroke="#3b82f6" strokeWidth={stroke} fill="none"
                strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 grid place-items-center">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{pct}%</div>
                <div className="text-[11px] text-muted-foreground">Your Score</div>
              </div>
            </div>
          </div>
          <div className="mt-3 flex gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-blue-500" />Obtained Score</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-muted-foreground/40" />Total Score</span>
          </div>
        </>
      )}
    </div>
  );
}

function WeakAreasCard({ weakAreas, loading }: { weakAreas: any[]; loading: boolean }) {
  return (
    <div className="rounded-xl bg-card border border-border shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-border font-semibold">Weak Areas</div>
      <div className="p-4">
        {loading ? (
          <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : !weakAreas.length ? (
          <div className="text-sm text-muted-foreground text-center py-6">No weak areas — answer more questions to identify gaps.</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {weakAreas.map((w) => (
              <div key={w.subjectId} className="rounded-lg border border-border bg-background p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Flag className="h-4 w-4 text-rose-500 shrink-0" />
                    <div className="font-semibold text-sm truncate">{w.subject}</div>
                  </div>
                  <span className="text-rose-600 font-bold text-sm">{w.pct}%</span>
                </div>
                <div className="mt-2 text-xs text-muted-foreground truncate">{w.weakestSystem}</div>
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
    <div className="rounded-xl bg-card border border-border shadow-sm p-5 flex flex-col items-center justify-center text-center">
      {loading ? (
        <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : delta == null ? (
        <>
          <Star className="h-8 w-8 text-muted-foreground mb-2" />
          <div className="text-sm text-muted-foreground">Complete at least 4 tests to see your performance trend.</div>
        </>
      ) : (
        <>
          <Star className="h-8 w-8 text-blue-600 mb-2" />
          <div className="text-xs text-muted-foreground max-w-[220px]">Comparing your recent quizzes to your earlier ones, your average</div>
          <div className={cn("text-lg mt-1", positive ? "text-emerald-600" : "text-rose-600")}>
            score has {positive ? "improved" : "declined"} by{" "}
            <span className="text-2xl font-bold">{positive ? "+" : ""}{delta}</span>
          </div>
          <div className={cn("text-sm font-semibold", positive ? "text-emerald-600" : "text-rose-600")}>points</div>
          <div className="text-[11px] text-muted-foreground mt-1 max-w-[240px]">on average between your first and second half of quizzes.</div>
        </>
      )}
    </div>
  );
}

function renderMd(md: string): string {
  // Very small markdown: **bold** and newlines.
  const escaped = md.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" } as any)[c]);
  return escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br/>");
}
