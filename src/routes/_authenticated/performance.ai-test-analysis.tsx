import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { listTests, getTest } from "@/lib/qbank.functions";
import { getAiTestAnalysis } from "@/lib/performance.functions";
import { QBANKS, useActiveQbankId } from "@/lib/active-qbank";
import {
  Loader2, FileText, ChevronRight, ArrowUpDown, HelpCircle,
  XCircle, CheckCircle2, Ban, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/performance/ai-test-analysis")({
  component: AiTestAnalysisPage,
});

function AiTestAnalysisPage() {
  const listFn = useServerFn(listTests);
  const qbankId = useActiveQbankId();
  const activeQbank = QBANKS.find((q) => q.id === qbankId) ?? QBANKS[0];
  const { data: tests, isLoading } = useQuery({
    queryKey: ["tests", qbankId],
    queryFn: () => listFn({ data: { qbankId } }),
  });
  const [selected, setSelected] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const completed = useMemo(
    () => ((tests as any)?.tests ?? tests ?? []).filter((t: any) => t.done),
    [tests],
  );

  // Auto-select the most recent completed test when available
  useEffect(() => {
    if (completed.length > 0 && (selected == null || !completed.some((t: any) => t.id === selected))) {
      setSelected(completed[0].id);
    }
  }, [completed, selected]);

  const filteredCompleted = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return completed;
    return completed.filter((t: any) =>
      String(t.id).includes(q) || (t.name ?? "").toLowerCase().includes(q),
    );
  }, [completed, search]);

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="sf-fluid-page space-y-5">
        {/* Clinical Studio Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b border-border">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Test Analysis</h1>
              <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                {activeQbank.name}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Per-test performance breakdown by subject, system, and answer changes
            </p>
          </div>
          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            {completed.length} completed {completed.length === 1 ? "test" : "tests"}
          </span>
        </div>

        <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
          {/* Left test selector */}
          <div className="rounded-xl bg-card border border-border overflow-hidden flex flex-col max-h-[78vh]">
            <div className="p-3 border-b border-border bg-muted/30">
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter completed tests…"
                  className="h-8 w-full rounded-lg border border-border bg-background pl-8 pr-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>

            <div className="p-2 overflow-y-auto flex-1">
              {isLoading ? (
                <div className="p-4 text-xs text-muted-foreground">Loading tests…</div>
              ) : !filteredCompleted.length ? (
                <div className="p-6 text-xs text-muted-foreground text-center">No completed tests found.</div>
              ) : (
                <div className="space-y-1">
                  {filteredCompleted.map((t: any) => {
                    const pct = t.total ? Math.round((t.right_count / t.total) * 100) : 0;
                    const active = selected === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setSelected(t.id)}
                        className={cn(
                          "w-full text-left rounded-lg px-3 py-2.5 border transition-colors",
                          active
                            ? "bg-primary/8 border-primary/50"
                            : "bg-transparent border-transparent hover:bg-muted/60",
                        )}
                      >
                        <div className="text-xs font-semibold truncate">{t.name || `Test #${t.id}`}</div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-1 tabular-nums">
                          <span>{t.right_count}/{t.total}</span>
                          <span className={cn(
                            "px-1.5 py-0.5 rounded font-semibold",
                            pct >= 70
                              ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
                              : pct >= 50
                                ? "bg-amber-500/12 text-amber-600 dark:text-amber-400"
                                : "bg-rose-500/12 text-rose-600 dark:text-rose-400",
                          )}>
                            {pct}%
                          </span>
                          <span className="ml-auto">{new Date(t.created_at).toLocaleDateString()}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right analysis pane */}
          <div className="min-h-[400px]">
            {!selected ? (
              <div className="rounded-xl bg-card border border-border p-10 h-full flex flex-col items-center justify-center text-center text-muted-foreground">
                <FileText className="h-9 w-9 mb-2 opacity-40" />
                <div className="text-sm font-medium">Select a completed test</div>
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

  if (isLoading || !data) {
    return <div className="rounded-xl bg-card border border-border p-10 text-center text-xs text-muted-foreground">Loading analysis…</div>;
  }

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
    <div className="space-y-4">
      {/* Header bar */}
      <div className="rounded-xl bg-card border border-border p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex bg-muted/60 rounded-lg p-1">
          {(["results", "analysis"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-3.5 py-1 text-xs font-semibold rounded-md capitalize transition-colors",
                tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              Test {t}
            </button>
          ))}
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-3">
          <span>
            Test: <span className="font-semibold text-foreground">{test.name || `Test #${test.id}`}</span>
          </span>
          <span className="font-mono text-[11px] bg-muted px-2 py-0.5 rounded">#{test.id}</span>
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
    ? [{ value: 1, color: "hsl(var(--muted))" }]
    : [
        { value: changes.cc, color: "hsl(142 71% 45%)" },
        { value: changes.ci, color: "hsl(0 84% 60%)" },
        { value: changes.ic, color: "hsl(217 91% 55%)" },
        { value: changes.ii, color: "hsl(25 95% 55%)" },
      ];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="Your Score" subtitle="Snapshot of your performance">
        <div className="flex flex-col sm:flex-row items-center gap-5 p-4">
          <Donut slices={scoreSlices} label={`${scorePct}%`} sub="Correct" />
          <div className="flex-1 w-full space-y-2 text-xs">
            <Row icon={<HelpCircle className="h-3.5 w-3.5" />} tone="blue" label="Total Questions" value={total} />
            <Row icon={<CheckCircle2 className="h-3.5 w-3.5" />} tone="emerald" label="Correct" value={correct} />
            <Row icon={<XCircle className="h-3.5 w-3.5" />} tone="rose" label="Incorrect" value={incorrect} />
            <Row icon={<Ban className="h-3.5 w-3.5" />} tone="slate" label="Omitted" value={omitted} />
          </div>
        </div>
      </Card>
      <Card title="Answer Changes" subtitle="Impact of changes on your score">
        <div className="flex flex-col sm:flex-row items-center gap-5 p-4">
          <Donut slices={changeSlices} label={String(totalChanges)} sub="Tracked" />
          <div className="flex-1 w-full space-y-2 text-xs">
            <Row icon={<CheckCircle2 className="h-3.5 w-3.5" />} tone="emerald" label="Correct → Correct" value={changes.cc} />
            <Row icon={<XCircle className="h-3.5 w-3.5" />} tone="rose" label="Correct → Incorrect" value={changes.ci} />
            <Row icon={<CheckCircle2 className="h-3.5 w-3.5" />} tone="blue" label="Incorrect → Correct" value={changes.ic} />
            <Row icon={<XCircle className="h-3.5 w-3.5" />} tone="orange" label="Incorrect → Incorrect" value={changes.ii} />
          </div>
        </div>
      </Card>
    </div>
  );
}

function Card({ title, subtitle, children }: any) {
  return (
    <div className="rounded-xl bg-card border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">{subtitle}</div>
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
    <div className="relative h-32 w-32 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx={50} cy={50} r={R} fill="none" stroke="hsl(var(--muted))" strokeWidth={13} />
        {slices.map((s, i) => {
          const frac = s.value / total;
          const dash = frac * C;
          const el = (
            <circle
              key={i}
              cx={50} cy={50} r={R}
              fill="none" stroke={s.color} strokeWidth={13}
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
          <div className="text-lg font-bold leading-none tabular-nums">{label}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">{sub}</div>
        </div>
      </div>
    </div>
  );
}

function Row({ icon, tone, label, value }: any) {
  const softs: Record<string, string> = {
    emerald: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
    rose:    "bg-rose-500/12 text-rose-600 dark:text-rose-400",
    blue:    "bg-blue-500/12 text-blue-600 dark:text-blue-400",
    slate:   "bg-muted text-muted-foreground",
    orange:  "bg-amber-500/12 text-amber-600 dark:text-amber-400",
  };
  return (
    <div className="flex items-center gap-2.5">
      <div className={cn("h-7 w-7 rounded-md grid place-items-center shrink-0", softs[tone])}>{icon}</div>
      <div className="flex-1 truncate font-medium">{label}</div>
      <div className={cn("px-2 py-0.5 rounded-md text-xs font-semibold tabular-nums", softs[tone])}>{value}</div>
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
  const primaryLabel = primaryKey === "subject" ? "Subjects" : "Systems";
  const primaryField = primaryKey === "subject" ? "subject_id" : "system_id";
  const primaryNames = primaryKey === "subject" ? subjectMap : systemMap;

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
    <div className="rounded-xl bg-card border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs sm:text-sm">
          <thead>
            <tr className="bg-muted/40 border-b border-border text-muted-foreground">
              {(["name", "total", "correct", "incorrect", "omitted"] as SortKey[]).map((k) => (
                <th
                  key={k}
                  onClick={() => toggle(k)}
                  className="text-left font-semibold uppercase tracking-wide text-[11px] px-4 py-2.5 cursor-pointer select-none hover:text-foreground transition-colors"
                >
                  <span className="inline-flex items-center gap-1">
                    {k === "name" ? primaryLabel : k === "total" ? "Total Q" : k}
                    <ArrowUpDown className="h-3 w-3 opacity-60" />
                  </span>
                </th>
              ))}
              <th className="text-right font-semibold uppercase tracking-wide text-[11px] px-4 py-2.5">Accuracy</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-muted-foreground py-8 text-xs">No data</td></tr>
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
  const pct = r.total ? Math.round((r.correct / r.total) * 100) : 0;
  return (
    <>
      <tr className="hover:bg-muted/30 transition-colors">
        <td className="px-4 py-2.5">
          <button onClick={onToggle} className="inline-flex items-center gap-1.5 text-foreground font-medium hover:text-primary transition-colors text-left">
            <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0", open && "rotate-90")} />
            <span>{r.name}</span>
          </button>
        </td>
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
      {open && childRows.map((c: any) => {
        const cpct = c.total ? Math.round((c.correct / c.total) * 100) : 0;
        return (
          <tr key={c.id} className="bg-muted/20">
            <td className="px-4 py-2 pl-10 text-muted-foreground">{c.name}</td>
            <td className="px-4 py-2 tabular-nums text-muted-foreground">{c.total}</td>
            <td className="px-4 py-2 text-emerald-600 dark:text-emerald-400 tabular-nums">{c.correct}</td>
            <td className="px-4 py-2 text-rose-600 dark:text-rose-400 tabular-nums">{c.incorrect}</td>
            <td className="px-4 py-2 text-muted-foreground tabular-nums">{c.omitted}</td>
            <td className="px-4 py-2 text-right tabular-nums text-xs text-muted-foreground">{cpct}%</td>
          </tr>
        );
      })}
    </>
  );
}

// keep import used
void Loader2; void getAiTestAnalysis; void Button; void useMutation;
