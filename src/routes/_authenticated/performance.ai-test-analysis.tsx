import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { listTests } from "@/lib/qbank.functions";
import { getAiTestAnalysis } from "@/lib/performance.functions";
import { useActiveQbankId } from "@/lib/active-qbank";
import { Sparkles, Loader2, FileText, Target, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/performance/ai-test-analysis")({
  component: AiTestAnalysisPage,
});

function AiTestAnalysisPage() {
  const listFn = useServerFn(listTests);
  const aiFn = useServerFn(getAiTestAnalysis);
  const qbankId = useActiveQbankId();
  const { data: tests, isLoading } = useQuery({
    queryKey: ["tests", qbankId],
    queryFn: () => listFn({ data: { qbankId } }),
  });
  const [selected, setSelected] = useState<number | null>(null);

  const mut = useMutation({
    mutationFn: (id: number) => aiFn({ data: { testId: id } }),
  });

  const completed = (tests ?? []).filter((t: any) => t.done);

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white grid place-items-center">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">AI Test Analysis</h1>
            <p className="text-sm text-muted-foreground">Get a personalized AI review of any completed test</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-[320px_1fr]">
          {/* Test list */}
          <div className="rounded-2xl bg-card border border-border p-3 shadow-sm max-h-[70vh] overflow-y-auto">
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
                      onClick={() => { setSelected(t.id); mut.reset(); }}
                      className={`w-full text-left rounded-lg p-3 border transition-colors ${selected === t.id ? "bg-primary/10 border-primary" : "bg-background border-border hover:bg-muted"}`}
                    >
                      <div className="text-sm font-medium truncate">{t.name || `Test #${t.id}`}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                        <span>{t.right_count}/{t.total}</span>
                        <span className={`px-1.5 py-0.5 rounded ${pct >= 70 ? "bg-emerald-100 text-emerald-700" : pct >= 50 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>{pct}%</span>
                        <span>· {new Date(t.created_at).toLocaleDateString()}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Analysis pane */}
          <div className="rounded-2xl bg-card border border-border p-6 shadow-sm min-h-[400px]">
            {!selected ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
                <FileText className="h-10 w-10 mb-2 opacity-50" />
                <div>Select a completed test to analyze</div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="font-semibold">AI Analysis</div>
                  <Button onClick={() => mut.mutate(selected)} disabled={mut.isPending} size="sm">
                    {mut.isPending ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analyzing…</>) : mut.data ? "Re-analyze" : (<><Sparkles className="h-4 w-4 mr-2" />Analyze</>)}
                  </Button>
                </div>

                {mut.error && (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive mb-4">
                    {(mut.error as Error).message}
                  </div>
                )}

                {!mut.data && !mut.isPending && !mut.error && (
                  <div className="text-sm text-muted-foreground">Click "Analyze" to generate an AI-powered study plan for this test.</div>
                )}

                {mut.isPending && (
                  <div className="space-y-2">
                    <div className="h-4 rounded bg-muted animate-pulse w-3/4" />
                    <div className="h-4 rounded bg-muted animate-pulse w-full" />
                    <div className="h-4 rounded bg-muted animate-pulse w-5/6" />
                    <div className="h-4 rounded bg-muted animate-pulse w-2/3" />
                  </div>
                )}

                {mut.data && (
                  <>
                    <div className="grid gap-3 md:grid-cols-3 mb-5">
                      <SmallStat icon={Target} label="Accuracy" value={`${mut.data.summary.accuracy}%`} />
                      <SmallStat icon={FileText} label="Answered" value={`${mut.data.summary.answered}/${mut.data.summary.total}`} />
                      <SmallStat icon={Clock} label="Avg / Q" value={`${mut.data.summary.avgTimeSec}s`} />
                    </div>
                    <article className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap">
                      {mut.data.analysis}
                    </article>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SmallStat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/50 border border-border p-3 flex items-center gap-3">
      <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary grid place-items-center"><Icon className="h-4 w-4" /></div>
      <div>
        <div className="text-lg font-bold leading-tight">{value}</div>
        <div className="text-[11px] text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
