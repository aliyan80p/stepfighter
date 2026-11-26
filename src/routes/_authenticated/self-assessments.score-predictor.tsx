import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getScorePredictorData } from "@/lib/performance.functions";
import { SCORE_FORMULAS, predictScore } from "@/data/score-formulas";
import { QBANKS, useActiveQbankId } from "@/lib/active-qbank";
import {
  TrendingUp, Award, Calculator, ClipboardCheck, CheckCircle2, AlertCircle,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from "recharts";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/self-assessments/score-predictor")({
  component: ScorePredictorPage,
});

function matchFormula(qbankId: number, source: string) {
  const stepPrefix = qbankId === 2 ? "step1" : "step2ck";
  const upper = source.toUpperCase();
  if (upper.startsWith("NBME")) {
    const num = upper.replace("NBME", "");
    return SCORE_FORMULAS.find((f) => f.id === `${stepPrefix}-nbme${num}`)
      ?? SCORE_FORMULAS.find((f) => f.step === stepPrefix && f.id.includes("nbme"));
  }
  if (upper.startsWith("SA")) {
    const num = upper.replace("SA", "");
    return SCORE_FORMULAS.find((f) => f.id === `${stepPrefix}-uwsa${num}`)
      ?? SCORE_FORMULAS.find((f) => f.step === stepPrefix && f.id.includes("uwsa"));
  }
  return undefined;
}

function ScorePredictorPage() {
  const fn = useServerFn(getScorePredictorData);
  const qbankId = useActiveQbankId();
  const activeBank = QBANKS.find((q) => q.id === qbankId) ?? QBANKS[0];
  const passingScore = qbankId === 2 ? 196 : qbankId === 1 ? 214 : 200;

  const { data, isLoading } = useQuery({
    queryKey: ["score-predictor", qbankId],
    queryFn: () => fn({ data: { qbankId } }),
  });

  const rows = useMemo(() => {
    if (!data?.assessments?.length) return [];
    return data.assessments
      .map((a) => {
        const formula = matchFormula(qbankId, a.source);
        if (!formula) return null;
        // Scale wrong count to formula's full question count if partially completed
        const wrongRate = a.attempted > 0 ? (a.attempted - a.correct) / a.attempted : 0;
        const scaledWrong = Math.round(wrongRate * formula.totalQuestions);
        const predicted = predictScore(formula, scaledWrong);
        return {
          ...a,
          label: formula.label.split(" · ")[1] ?? a.source,
          predicted,
          pct: a.attempted > 0 ? Math.round((a.correct / a.attempted) * 100) : 0,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);
  }, [data, qbankId]);

  const overallPredicted = useMemo(() => {
    if (rows.length > 0) {
      // Weight recent exams more heavily
      let weightedSum = 0;
      let weightTotal = 0;
      rows.forEach((r, idx) => {
        const w = idx + 1;
        weightedSum += r.predicted * w;
        weightTotal += w;
      });
      return Math.round(weightedSum / weightTotal);
    }
    // Fallback estimate from main UWorld accuracy if ≥40 questions answered
    if (data && data.mainAttempted >= 40) {
      const pct = data.mainAccuracy;
      return Math.max(150, Math.min(285, Math.round(145 + pct * 1.45)));
    }
    return null;
  }, [rows, data]);

  const margin = rows.length >= 3 ? 6 : rows.length >= 1 ? 10 : 14;
  const readiness =
    overallPredicted == null
      ? null
      : overallPredicted >= passingScore + 25
        ? { label: "Very High Readiness", tone: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400" }
        : overallPredicted >= passingScore + 10
          ? { label: "High Readiness", tone: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400" }
          : overallPredicted >= passingScore
            ? { label: "Borderline Pass", tone: "bg-amber-500/12 text-amber-600 dark:text-amber-400" }
            : { label: "Below Passing", tone: "bg-rose-500/12 text-rose-600 dark:text-rose-400" };

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="sf-fluid-page space-y-5">
        {/* Clinical Studio Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b border-border">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Automatic Score Predictor</h1>
              <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                {activeBank.name}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Live 3-digit USMLE score prediction calculated automatically from your NBME, UWSA, and QBank performance
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/performance/score-calculator"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card text-xs font-medium text-foreground hover:bg-muted/60 transition-colors"
            >
              <Calculator className="h-3.5 w-3.5 text-muted-foreground" />
              Manual Calculator
            </Link>
            <Link
              to="/self-assessments/assessments"
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
            >
              <ClipboardCheck className="h-3.5 w-3.5" />
              Take Self-Assessment
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-32 rounded-xl bg-card border border-border animate-pulse" />)}
          </div>
        ) : overallPredicted == null ? (
          <div className="rounded-xl bg-card border border-border p-10 text-center space-y-3">
            <AlertCircle className="h-9 w-9 mx-auto text-muted-foreground opacity-50" />
            <div className="text-base font-semibold">Not enough data to predict your score yet</div>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
              Complete at least one NBME / UWSA self-assessment block (or 40+ main QBank questions) to unlock your automatic 3-digit score prediction.
            </p>
            <div className="pt-2">
              <Link
                to="/self-assessments/assessments"
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90"
              >
                Start a Self-Assessment
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Hero Prediction Row */}
            <div className="grid gap-4 md:grid-cols-[1.2fr_1fr_1fr]">
              <div className="rounded-xl bg-card border border-border p-5 flex items-center justify-between gap-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Predicted 3-Digit Score
                  </div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-4xl font-extrabold tabular-nums text-primary">{overallPredicted}</span>
                    <span className="text-xs font-medium text-muted-foreground tabular-nums">
                      ± {margin} ({overallPredicted - margin}–{overallPredicted + margin})
                    </span>
                  </div>
                  {readiness && (
                    <span className={cn("mt-2.5 inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-xs font-semibold", readiness.tone)}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> {readiness.label}
                    </span>
                  )}
                </div>
                <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                  <Award className="h-6 w-6" />
                </div>
              </div>

              <div className="rounded-xl bg-card border border-border p-5 flex flex-col justify-center">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Assessments Included
                </div>
                <div className="text-2xl font-bold tabular-nums mt-1">{rows.length}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Passing threshold: <span className="font-semibold text-foreground">{passingScore}</span>
                </div>
              </div>

              <div className="rounded-xl bg-card border border-border p-5 flex flex-col justify-center">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  UWorld Main Accuracy
                </div>
                <div className="text-2xl font-bold tabular-nums mt-1">{data?.mainAccuracy ?? 0}%</div>
                <div className="text-xs text-muted-foreground mt-1 tabular-nums">
                  {(data?.mainAttempted ?? 0).toLocaleString()} questions answered
                </div>
              </div>
            </div>

            {/* Trend Chart */}
            {rows.length > 0 && (
              <div className="rounded-xl bg-card border border-border overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold text-sm">
                    <TrendingUp className="h-4 w-4 text-primary" /> Predicted Score Trajectory
                  </div>
                  <span className="text-xs text-muted-foreground">Dashed line = passing ({passingScore})</span>
                </div>
                <div className="p-4 h-[270px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={rows} margin={{ top: 12, right: 24, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis domain={[150, 285]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip
                        formatter={(v: any) => [`${v}`, "Predicted 3-Digit"]}
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          borderColor: "hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <ReferenceLine y={passingScore} stroke="hsl(0 84% 60%)" strokeDasharray="4 4" />
                      <Line type="monotone" dataKey="predicted" stroke="hsl(217 91% 60%)" strokeWidth={2.5} dot={{ r: 4, fill: "hsl(217 91% 60%)" }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Breakdown Table */}
            {rows.length > 0 && (
              <div className="rounded-xl bg-card border border-border overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-muted/30 font-semibold text-sm">
                  Completed Self-Assessments Breakdown
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border text-muted-foreground">
                        <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide">Assessment</th>
                        <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide">Attempted</th>
                        <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide">Accuracy</th>
                        <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide">Predicted 3-Digit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rows.map((r) => (
                        <tr key={r.source} className="hover:bg-muted/30">
                          <td className="px-4 py-2.5 font-semibold">{r.label}</td>
                          <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{r.correct}/{r.attempted}</td>
                          <td className="px-4 py-2.5 tabular-nums font-medium">{r.pct}%</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            <span className={cn(
                              "inline-flex rounded-md px-2.5 py-0.5 text-xs font-bold",
                              r.predicted >= passingScore + 15
                                ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
                                : r.predicted >= passingScore
                                  ? "bg-amber-500/12 text-amber-600 dark:text-amber-400"
                                  : "bg-rose-500/12 text-rose-600 dark:text-rose-400",
                            )}>
                              {r.predicted}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
