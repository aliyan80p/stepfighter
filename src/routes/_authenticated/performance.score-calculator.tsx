import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceDot, ResponsiveContainer,
} from "recharts";
import { Calculator, TrendingUp, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { SCORE_FORMULAS, predictScore, type ScoreFormula } from "@/data/score-formulas";

export const Route = createFileRoute("/_authenticated/performance/score-calculator")({
  head: () => ({
    meta: [
      { title: "Score Calculator — Predict your USMLE 3-digit score" },
      { name: "description", content: "Convert NBME and UWSA question performance into a predicted 3-digit USMLE score using linear regression formulas." },
      { property: "og:title", content: "USMLE Score Calculator" },
      { property: "og:description", content: "Predicted 3-digit score for every NBME and UWSA self-assessment." },
    ],
  }),
  component: ScoreCalculator,
});

function ScoreCalculator() {
  const [formulaId, setFormulaId] = useState<string>(SCORE_FORMULAS[0].id);
  const [input, setInput] = useState<number>(20);

  const formula = SCORE_FORMULAS.find((f) => f.id === formulaId) ?? SCORE_FORMULAS[0];
  const isPercentMode = formula.inputMode === "correctPercent";
  const predicted = predictScore(formula, input);
  const pointsPerQ = isPercentMode
    ? ((Math.abs(formula.slope) * 100) / formula.totalQuestions).toFixed(2)
    : Math.abs(formula.slope).toFixed(4);

  const curve = useMemo(() => {
    const rows: { x: number; score: number }[] = [];
    const step = Math.max(1, Math.round(formula.totalQuestions / 40));
    for (let x = 0; x <= formula.totalQuestions; x += step) {
      rows.push({ x, score: predictScore(formula, x) });
    }
    if (rows[rows.length - 1].x !== formula.totalQuestions) {
      rows.push({ x: formula.totalQuestions, score: predictScore(formula, formula.totalQuestions) });
    }
    return rows;
  }, [formula]);

  const setFormula = (id: string) => {
    const next = SCORE_FORMULAS.find((f) => f.id === id) ?? SCORE_FORMULAS[0];
    setFormulaId(id);
    setInput((prev) => Math.min(prev, next.totalQuestions));
  };

  const step1 = SCORE_FORMULAS.filter((f) => f.step === "step1");
  const step2 = SCORE_FORMULAS.filter((f) => f.step === "step2ck");

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-5 md:p-6">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-primary/15 text-primary grid place-items-center">
            <Calculator className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Score Calculator</h1>
            <p className="text-sm text-muted-foreground max-w-2xl mt-1">
              Convert your NBME or UWSA raw performance into a predicted USMLE 3-digit score
              using the exam-specific linear regression.
            </p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-4">
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Assessment
            </label>
            <Select value={formulaId} onValueChange={setFormula}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-[60vh]">
                <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">Step 1</div>
                {step1.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                ))}
                <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Step 2 CK</div>
                {step2.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {isPercentMode
                ? `Number wrong (out of ${formula.totalQuestions})`
                : `Number wrong (out of ${formula.totalQuestions})`}
            </label>
            <div className="mt-1.5 flex items-center gap-3">
              <Input
                type="number"
                min={0}
                max={formula.totalQuestions}
                value={input}
                onChange={(e) => {
                  const n = Math.max(0, Math.min(formula.totalQuestions, Number(e.target.value) || 0));
                  setInput(n);
                }}
                className="w-32"
              />
              <input
                type="range"
                min={0}
                max={formula.totalQuestions}
                value={input}
                onChange={(e) => setInput(Number(e.target.value))}
                className="flex-1 accent-primary"
              />
              <div className="text-xs text-muted-foreground w-24 text-right">
                {formula.totalQuestions - input} correct
              </div>
            </div>
          </div>

          <div className="text-[11px] text-muted-foreground flex items-start gap-2 pt-2 border-t">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              Each question on {formula.label.split(" · ")[1]} is worth{" "}
              <strong className="text-foreground">{pointsPerQ} points</strong>.
              {isPercentMode && " Input is number wrong (converted to % correct internally)."}
            </span>
          </div>
        </div>


        {/* Predicted score card */}
        <div className="relative overflow-hidden rounded-2xl p-6 text-white shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-[#1a4b7c] via-[#264c8f] to-[#0ea5e9]" />
          <div className="absolute -bottom-10 -right-10 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <div className="relative">
            <div className="text-[11px] uppercase tracking-[0.15em] font-semibold opacity-85">Predicted 3-Digit Score</div>
            <div className="mt-2 flex items-baseline gap-2">
              <div className="text-6xl font-black">{predicted}</div>
              <div className="text-sm opacity-80">points</div>
            </div>
            <div className="mt-3 text-xs opacity-90">
              Each question on {formula.label.split(" · ")[1]} is worth{" "}
              <strong>{pointsPerQ}</strong> points.
            </div>
            <div className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-semibold bg-white/15 rounded-full px-3 py-1.5 border border-white/25">
              <TrendingUp className="h-3.5 w-3.5" />
              {formula.label}
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-semibold">Score Conversion Formula</div>
            <div className="text-xs text-muted-foreground">
              y = {formula.slope.toFixed(4)}x {formula.intercept >= 0 ? "+" : "-"}{" "}
              {Math.abs(formula.intercept).toFixed(2)}
              {isPercentMode && "   (x = % correct)"}
            </div>
          </div>
          <div className="text-[11px] text-muted-foreground">
            {isPercentMode ? "wrong → predicted score" : "wrong → predicted score"}
          </div>
        </div>
        <div className="w-full h-[320px]">
          <ResponsiveContainer>
            <LineChart data={curve} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis
                dataKey="x"
                tick={{ fontSize: 12 }}
                label={{ value: isPercentMode ? "Number wrong" : "Number wrong", position: "insideBottom", offset: -5, style: { fontSize: 11, fill: "#64748b" } }}
              />
              <YAxis
                domain={[Math.min(...curve.map((c) => c.score)) - 10, Math.max(...curve.map((c) => c.score)) + 5]}
                tick={{ fontSize: 12 }}
                label={{ value: "Predicted score", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: "#64748b" } }}
              />
              <Tooltip
                formatter={(v: number) => [`${v}`, "Predicted"]}
                labelFormatter={(l) => (isPercentMode ? `${l} wrong` : `${l} wrong`)}
                contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
              />
              <Line type="monotone" dataKey="score" stroke="#1a4b7c" strokeWidth={2.5} dot={false} />
              <ReferenceDot x={input} y={predicted} r={6} fill="#0ea5e9" stroke="#fff" strokeWidth={2} />

            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Formula grid */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="text-sm font-semibold mb-3">All formulas</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
          {SCORE_FORMULAS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFormulaId(f.id)}
              className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                f.id === formulaId
                  ? "border-primary bg-primary/10"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <div className="font-semibold">{f.label}</div>
              <div className="text-muted-foreground mt-0.5">
                y = {f.slope.toFixed(3)}x + {f.intercept.toFixed(2)}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
