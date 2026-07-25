import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listTests, getTest } from "@/lib/qbank.functions";
import { getAiTestAnalysis } from "@/lib/performance.functions";
import { useActiveQbankId, QBANKS } from "@/lib/active-qbank";

const QBANK_NAME: Record<number, string> = Object.fromEntries(QBANKS.map((q) => [q.id, q.name]));
import { Sparkles, Loader2, FileText, ChevronRight, ArrowUpDown, HelpCircle, XCircle, CheckCircle2, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/performance/ai-test-analysis")({
  component: AiTestAnalysisPage,
});

function AiTestAnalysisPage() {
  const listFn = useServerFn(listTests);
  const qbankId = useActiveQbankId();
  const { data: tests, isLoading } = useQuery({
    queryKey: ["tests", qbankId],
    queryFn: () => listFn({ data: { qbankId } }),
  });
  const [selected, setSelected] = useState<number | null>(null);
  const completed = ((tests as any)?.tests ?? tests ?? []).filter((t: any) => t.done);

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white grid place-items-center">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Test Analysis</h1>
            <p className="text-sm text-muted-foreground">Per-test breakdown for <span className="font-semibold text-foreground">{QBANK_NAME[qbankId] ?? `QBank #${qbankId}`}</span></p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-[320px_1fr]">
          <div className="rounded-2xl bg-card border border-border p-3 shadow-sm max-h-[80vh] overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-sm text-muted-foreground">Loading tests…</div>
            ) : !completed.length ? (
              <div className="p-6 text-sm text-muted-foreground text-center">No completed tests yet.</div>
            ) : (
              <div className="space-y-1">
                {completed.map((t: any) => {
                  const pct = t.total ? Math.round((t.right_count / t.total) * 100) : 0;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelected(t.id)}
                      className={cn(
                        "w-full text-left rounded-lg p-3 border transition-colors",
                        selected === t.id ? "bg-primary/10 border-primary" : "bg-background border-border hover:bg-muted",
                      )}
                    >
                      <div className="text-sm font-medium truncate">{t.name || `Test #${t.id}`}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1 flex-wrap">
                        <span className="inline-flex items-center rounded border border-primary/30 bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                          {QBANK_NAME[t.qbank_id] ?? `QB#${t.qbank_id}`}
                        </span>
                        <span>{t.right_count}/{t.total}</span>
                        <span className={cn(
                          "px-1.5 py-0.5 rounded",
                          pct >= 70 ? "bg-emerald-100 text-emerald-700" : pct >= 50 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700",
                        )}>{pct}%</span>
                        <span>· {new Date(t.created_at).toLocaleDateString()}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="min-h-[400px]">
            {!selected ? (
              <div className="rounded-2xl bg-card border border-border p-10 h-full flex flex-col items-center justify-center text-center text-muted-foreground">
                <FileText className="h-10 w-10 mb-2 opacity-50" />
                <div>Select a completed test</div>
              </div>
            ) : (
              <TestAnalysisPane testId={selected} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TestAnalysisPane({ testId }: { testId: number }) {
  const [tab, setTab] = useState<"results" | "analysis">("analysis");
  const getFn = useServerFn(getTest);
  const { data, isLoading } = useQuery({
    queryKey: ["test-analysis", testId],
    queryFn: () => getFn({ data: { id: testId } }),
  });

  if (isLoading || !data) return <div className="rounded-2xl bg-card border border-border p-10 text-center text-muted-foreground">Loading…</div>;

  const test = data.test as any;
  const questions = data.questions as any[];
  const attemptsByQ = data.attemptsByQ as Record<number, any>;
  const subjectMap = data.subjectMap as Record<number, string>;
  const systemMap = data.systemMap as Record<number, string>;
  const ac = data.answerChanges as any;

  let correct = 0, incorrect = 0, omitted = 0;
  for (const q of questions) {
    const a = attemptsByQ[q.id];
    if (!a || a.selected_answer == null) omitted++;
    else if (a.is_correct) correct++;
    else incorrect++;
  }
  const total = questions.length;
  const scorePct = total ? Math.round((correct / total) * 1000) / 10 : 0;

  const cc = Math.max(0, correct - (ac.incorrectToCorrect ?? 0));
  const changes = {
    cc, ci: ac.correctToIncorrect ?? 0, ic: ac.incorrectToCorrect ?? 0, ii: ac.incorrectToIncorrect ?? 0,
  };
  const totalChanges = changes.cc + changes.ci + changes.ic + changes.ii;

  return (
    <div className="space-y-5">
      {/* Header card */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30 border border-border p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex bg-background rounded-full p-1 shadow-sm">
            {(["results", "analysis"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "px-4 py-1.5 text-sm font-medium rounded-full capitalize transition",
                  tab === t ? "bg-blue-600 text-white shadow" : "text-muted-foreground hover:text-foreground",
                )}
              >Test {t}</button>
            ))}
          </div>
          <div className="rounded-lg bg-background/70 px-3 py-1.5 text-xs text-muted-foreground">
            <span className="mr-2">Test Name <span className="font-semibold text-foreground">{test.name || `Test #${test.id}`}</span></span>
            <span>ID <span className="font-semibold text-foreground">{test.id}</span></span>
          </div>
        </div>
      </div>

      {tab === "results" ? (
        <ResultsBlock scorePct={scorePct} correct={correct} incorrect={incorrect} omitted={omitted} total={total} changes={changes} totalChanges={totalChanges} />
      ) : (
        <>
          <ResultsBlock scorePct={scorePct} correct={correct} incorrect={incorrect} omitted={omitted} total={total} changes={changes} totalChanges={totalChanges} />
          <CrossTable
            primaryKey="subject"
            questions={questions}
            attemptsByQ={attemptsByQ}
            subjectMap={subjectMap}
            systemMap={systemMap}
          />
          <CrossTable
            primaryKey="system"
            questions={questions}
            attemptsByQ={attemptsByQ}
            subjectMap={subjectMap}
            systemMap={systemMap}
          />
        </>
      )}
    </div>
  );
}

function ResultsBlock({ scorePct, correct, incorrect, omitted, total, changes, totalChanges }: any) {
  const scoreSlices = [
    { value: correct, color: "hsl(142 71% 45%)" },
    { value: incorrect, color: "hsl(0 84% 60%)" },
    { value: omitted, color: "hsl(220 15% 55%)" },
  ];
  const changeSlices = totalChanges === 0
    ? [{ value: 1, color: "hsl(25 95% 55%)" }]
    : [
        { value: changes.cc, color: "hsl(142 71% 45%)" },
        { value: changes.ci, color: "hsl(0 84% 60%)" },
        { value: changes.ic, color: "hsl(217 91% 55%)" },
        { value: changes.ii, color: "hsl(25 95% 55%)" },
      ];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="Your Score" subtitle="Snapshot of your performance">
        <div className="flex items-center gap-6 p-4">
          <Donut slices={scoreSlices} label={`${scorePct}%`} sub="Correct" />
          <div className="flex-1 space-y-2 text-sm">
            <Row icon={<HelpCircle className="h-4 w-4" />} tone="blue" label="Total Questions" value={total} />
            <Row icon={<XCircle className="h-4 w-4" />} tone="rose" label="Incorrect Questions" value={incorrect} />
            <Row icon={<CheckCircle2 className="h-4 w-4" />} tone="emerald" label="Correct Questions" value={correct} />
            <Row icon={<Ban className="h-4 w-4" />} tone="slate" label="Omitted Questions" value={omitted} />
          </div>
        </div>
      </Card>
      <Card title="Answer Changes" subtitle="Impact of changes on your score">
        <div className="flex items-center gap-6 p-4">
          <Donut slices={changeSlices} label={totalChanges === 0 ? "0" : String(totalChanges)} sub="Changes" />
          <div className="flex-1 space-y-2 text-sm">
            <Row icon={<CheckCircle2 className="h-4 w-4" />} tone="emerald" label="Correct to Correct" value={changes.cc} />
            <Row icon={<XCircle className="h-4 w-4" />} tone="rose" label="Correct to Incorrect" value={changes.ci} />
            <Row icon={<CheckCircle2 className="h-4 w-4" />} tone="blue" label="Incorrect to Correct" value={changes.ic} />
            <Row icon={<XCircle className="h-4 w-4" />} tone="orange" label="Incorrect to Incorrect" value={changes.ii} />
          </div>
        </div>
      </Card>
    </div>
  );
}

function Card({ title, subtitle, children }: any) {
  return (
    <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
      <div className="p-4 border-b border-border">
        <div className="text-xs font-bold tracking-wide text-muted-foreground uppercase">{title}</div>
        <div className="text-xs text-muted-foreground/80 mt-0.5">{subtitle}</div>
      </div>
      {children}
    </div>
  );
}

function Donut({ slices, label, sub }: { slices: { value: number; color: string }[]; label: string; sub: string }) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const R = 42, C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="relative h-36 w-36 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx={50} cy={50} r={R} fill="none" stroke="hsl(var(--muted))" strokeWidth={14} />
        {slices.map((s, i) => {
          const frac = s.value / total;
          const dash = frac * C;
          const el = (
            <circle
              key={i}
              cx={50} cy={50} r={R}
              fill="none" stroke={s.color} strokeWidth={14}
              strokeDasharray={`${dash} ${C - dash}`}
              strokeDashoffset={-offset}
            />
          );
          offset += dash;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-lg font-bold leading-none">{label}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>
        </div>
      </div>
    </div>
  );
}

function Row({ icon, tone, label, value }: any) {
  const tones: Record<string, string> = {
    emerald: "bg-emerald-500", rose: "bg-rose-500", blue: "bg-blue-500", slate: "bg-slate-500", orange: "bg-orange-500",
  };
  const softs: Record<string, string> = {
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    rose: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    slate: "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200",
    orange: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
  };
  return (
    <div className="flex items-center gap-3">
      <div className={cn("h-7 w-7 rounded-full grid place-items-center", softs[tone])}>{icon}</div>
      <div className="flex-1">{label}</div>
      <div className={cn("min-w-[36px] px-2 h-6 rounded-full text-white text-xs font-semibold grid place-items-center", tones[tone])}>{value}</div>
    </div>
  );
}

type SortKey = "name" | "total" | "correct" | "incorrect" | "omitted";

function CrossTable({
  primaryKey, questions, attemptsByQ, subjectMap, systemMap,
}: {
  primaryKey: "subject" | "system";
  questions: any[];
  attemptsByQ: Record<number, any>;
  subjectMap: Record<number, string>;
  systemMap: Record<number, string>;
}) {
  const primaryLabel = primaryKey === "subject" ? "SUBJECTS" : "SYSTEMS";
  const primaryField = primaryKey === "subject" ? "subject_id" : "system_id";
  const primaryNames = primaryKey === "subject" ? subjectMap : systemMap;
  // Under Subjects → show Systems as children. Under Systems → show Topics.
  const childKeyOf = (q: any): string => {
    if (primaryKey === "subject") {
      return q.system_id != null ? `s:${q.system_id}` : "s:none";
    }
    const t = (q.title ?? "").toString().trim();
    return t ? `t:${t.toLowerCase()}` : "t:none";
  };
  const childNameOf = (key: string, sampleQ: any): string => {
    if (primaryKey === "subject") {
      if (key === "s:none") return "—";
      const id = Number(key.slice(2));
      return systemMap[id] ?? `#${id}`;
    }
    if (key === "t:none") return "—";
    return (sampleQ.title ?? "—").toString();
  };

  const grouped = useMemo(() => {
    const out = new Map<number, { children: Map<string, any[]>; all: any[] }>();
    for (const q of questions) {
      const p = q[primaryField];
      if (p == null) continue;
      let g = out.get(p);
      if (!g) { g = { children: new Map(), all: [] }; out.set(p, g); }
      g.all.push(q);
      const c = childKeyOf(q);
      if (!g.children.has(c)) g.children.set(c, []);
      g.children.get(c)!.push(q);
    }
    return out;
  }, [questions, primaryField, primaryKey]);

  const stats = (qs: any[]) => {
    let c = 0, i = 0, o = 0;
    for (const q of qs) {
      const a = attemptsByQ[q.id];
      if (!a || a.selected_answer == null) o++;
      else if (a.is_correct) c++;
      else i++;
    }
    return { correct: c, incorrect: i, omitted: o, total: qs.length };
  };

  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });
  const toggle = (k: SortKey) => setSort((s) => ({ key: k, dir: s.key === k ? (s.dir === 1 ? -1 : 1) : 1 }));

  const rows = useMemo(() => {
    const arr = Array.from(grouped.entries()).map(([id, g]) => {
      const s = stats(g.all);
      return { id, name: primaryNames[id] ?? `#${id}`, ...s, children: g.children };
    });
    arr.sort((a, b) => {
      if (sort.key === "name") return a.name.localeCompare(b.name) * sort.dir;
      return ((a as any)[sort.key] - (b as any)[sort.key]) * sort.dir;
    });
    return arr;
  }, [grouped, primaryNames, sort]);

  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  return (
    <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-sky-500 text-white">
              {(["name", "total", "correct", "incorrect", "omitted"] as SortKey[]).map((k) => (
                <th key={k} onClick={() => toggle(k)} className="text-left font-semibold uppercase tracking-wide text-xs px-4 py-3 border-l first:border-l-0 border-sky-400/40 cursor-pointer select-none">
                  <span className="inline-flex items-center gap-1">
                    {k === "name" ? primaryLabel : k === "total" ? "Total Q" : k}
                    <ArrowUpDown className="h-3 w-3 opacity-70" />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="text-center text-muted-foreground py-8">No data</td></tr>
            ) : rows.map((r) => {
              const open = expanded.has(r.id);
              const childRows = Array.from(r.children.entries()).map(([cid, qs]) => ({ id: cid, name: childNameOf(cid, qs[0]), ...stats(qs) }))
                .sort((a, b) => a.name.localeCompare(b.name));
              return (
                <FragmentRows
                  key={r.id}
                  row={r}
                  open={open}
                  childRows={childRows}
                  onToggle={() => setExpanded((s) => { const n = new Set(s); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n; })}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FragmentRows({ row: r, open, childRows, onToggle }: any) {
  return (
    <>
      <tr className="border-b border-border last:border-0 hover:bg-muted/40">
        <td className="px-4 py-3">
          <button onClick={onToggle} className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium">
            <ChevronRight className={cn("h-4 w-4 transition-transform", open && "rotate-90")} />
            {r.name}
          </button>
        </td>
        <td className="px-4 py-3">{r.total}</td>
        <td className="px-4 py-3 text-emerald-600 font-semibold">{r.correct}</td>
        <td className="px-4 py-3 text-rose-600 font-semibold">{r.incorrect}</td>
        <td className="px-4 py-3 text-blue-600 font-semibold">{r.omitted}</td>
      </tr>
      {open && childRows.map((c: any) => (
        <tr key={c.id} className="border-b border-border last:border-0 bg-muted/20">
          <td className="px-4 py-2.5 pl-12 text-blue-600 dark:text-blue-400">{c.name}</td>
          <td className="px-4 py-2.5">{c.total}</td>
          <td className="px-4 py-2.5 text-emerald-600">{c.correct}</td>
          <td className="px-4 py-2.5 text-rose-600">{c.incorrect}</td>
          <td className="px-4 py-2.5 text-blue-600">{c.omitted}</td>
        </tr>
      ))}
    </>
  );
}


// keep import used
void Loader2; void getAiTestAnalysis; void Button; void useMutation;
