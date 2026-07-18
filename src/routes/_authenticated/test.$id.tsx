import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { getTest, submitAnswer, toggleBookmark, finishTest } from "@/lib/qbank.functions";
import { rewriteMedia } from "@/lib/media";
import { Button } from "@/components/ui/button";
import { Bookmark, BookmarkCheck, ChevronLeft, ChevronRight, Check, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/test/$id")({
  component: TestRunner,
});

function TestRunner() {
  const { id } = Route.useParams();
  const testId = Number(id);
  const getFn = useServerFn(getTest);
  const subFn = useServerFn(submitAnswer);
  const bmFn = useServerFn(toggleBookmark);
  const finFn = useServerFn(finishTest);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["test", testId],
    queryFn: () => getFn({ data: { id: testId } }),
  });

  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [startedAt, setStartedAt] = useState(Date.now());

  const question = data?.questions[idx];
  const answers = question ? data!.answersByQ[question.id] ?? [] : [];
  const priorAttempt = question ? data!.attemptsByQ[question.id] : undefined;
  const isPractice = data?.test.mode === "practice";
  const total = data?.questions.length ?? 0;

  useEffect(() => {
    setSelected(priorAttempt?.selected_answer ?? null);
    setSubmitted(!!priorAttempt);
    setStartedAt(Date.now());
  }, [idx, question?.id, priorAttempt?.selected_answer]);

  const submit = async () => {
    if (selected == null || !question) return;
    const secs = Math.round((Date.now() - startedAt) / 1000);
    try {
      await subFn({ data: { testId, questionId: question.id, selectedIndex: selected, timeSeconds: secs } });
      setSubmitted(true);
      qc.invalidateQueries({ queryKey: ["test", testId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to submit");
    }
  };

  const bookmark = async () => {
    if (!question) return;
    await bmFn({ data: { questionId: question.id } });
    qc.invalidateQueries({ queryKey: ["test", testId] });
  };

  const finish = async () => {
    await finFn({ data: { testId } });
    qc.invalidateQueries({ queryKey: ["test", testId] });
    toast.success("Test finished");
  };

  const correctIdx = question?.correct_answer;
  const showAnswers = submitted && isPractice;
  const isBookmarked = question ? data!.bookmarkedIds.has(question.id) : false;

  if (isLoading || !data || !question) return <div className="p-8">Loading…</div>;

  if (data.test.done) return <Navigate to="/test-results/$id" params={{ id }} replace />;

  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-border p-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 text-sm flex-wrap">
            <span className="font-semibold">Question {idx + 1} <span className="text-muted-foreground font-normal">of {total}</span></span>
            <span className="text-muted-foreground">•</span>
            <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono">ID {question.id}</span>
            {question.subject_id != null && data.subjectMap[question.subject_id] && (
              <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">{data.subjectMap[question.subject_id]}</span>
            )}
            {question.system_id != null && data.systemMap[question.system_id] && (
              <span className="text-xs px-2 py-0.5 rounded bg-accent text-accent-foreground">{data.systemMap[question.system_id]}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={bookmark}>
              {isBookmarked ? <BookmarkCheck className="h-4 w-4 text-primary" /> : <Bookmark className="h-4 w-4" />}
            </Button>
            <Button size="sm" variant="outline" onClick={finish}>End Test</Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-8">
          <div className="max-w-3xl mx-auto">
            {question.title && <div className="text-xs uppercase text-muted-foreground mb-2">{question.title}</div>}
            <div className="prose prose-invert max-w-none qbank-html" dangerouslySetInnerHTML={{ __html: rewriteMedia(question.question) }} />


            <div className="mt-6 space-y-2">
              {answers.map((a, i) => {
                const isCorrect = showAnswers && i === correctIdx;
                const isWrong = showAnswers && selected === i && i !== correctIdx;
                return (
                  <button
                    key={a.id}
                    disabled={submitted}
                    onClick={() => setSelected(i)}
                    className={`w-full text-left rounded-lg border p-4 transition-colors flex items-start gap-3 ${
                      isCorrect ? "border-green-500 bg-green-500/10" :
                      isWrong ? "border-red-500 bg-red-500/10" :
                      selected === i ? "border-primary bg-primary/10" : "border-border hover:bg-accent"
                    }`}
                  >
                    <div className={`h-6 w-6 shrink-0 rounded-full border flex items-center justify-center text-xs font-semibold ${
                      isCorrect ? "bg-green-500 border-green-500 text-white" :
                      isWrong ? "bg-red-500 border-red-500 text-white" :
                      selected === i ? "border-primary text-primary" : "border-border"
                    }`}>
                      {isCorrect ? <Check className="h-3.5 w-3.5" /> : isWrong ? <X className="h-3.5 w-3.5" /> : String.fromCharCode(65 + i)}
                    </div>
                    <div className="flex-1 qbank-html" dangerouslySetInnerHTML={{ __html: rewriteMedia(a.answer_text) }} />
                  </button>
                );
              })}
            </div>

            {showAnswers && question.explanation && (
              <div className="mt-8 rounded-lg border border-border p-5 bg-card">
                <h3 className="font-semibold mb-3">Explanation</h3>
                <div className="qbank-html prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: rewriteMedia(question.explanation) }} />
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border p-4 flex items-center justify-between">
          <Button variant="outline" onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
          </Button>
          {!submitted ? (
            <Button onClick={submit} disabled={selected == null}>Submit</Button>
          ) : (
            <Button onClick={() => setIdx(Math.min(total - 1, idx + 1))} disabled={idx === total - 1}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </div>

      <aside className="w-56 border-l border-border p-4 overflow-auto">
        <div className="text-xs uppercase text-muted-foreground mb-2">Questions</div>
        <div className="grid grid-cols-5 gap-1.5">
          {data.questions.map((q, i) => {
            const att = data.attemptsByQ[q.id];
            const cls = att ? (att.is_correct ? "bg-green-500/20 border-green-500 text-green-500" : "bg-red-500/20 border-red-500 text-red-500")
              : i === idx ? "bg-primary text-primary-foreground border-primary" : "border-border";
            return (
              <button key={q.id} onClick={() => setIdx(i)} className={`h-8 rounded border text-xs font-medium ${cls}`}>
                {i + 1}
              </button>
            );
          })}
        </div>
        <div className="mt-4 text-xs text-muted-foreground space-y-1">
          <div>Right: {data.test.right_count}</div>
          <div>Wrong: {data.test.wrong_count}</div>
        </div>
      </aside>
    </div>
  );
}

function ResultsView({ data }: { data: any; onReview: () => void }) {
  const total = data.questions.length;
  const right = data.test.right_count;
  const pct = total ? Math.round((right / total) * 100) : 0;
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold">Test Complete</h1>
      <div className="mt-6 rounded-lg border border-border p-8 text-center">
        <div className="text-6xl font-bold text-primary">{pct}%</div>
        <div className="text-muted-foreground mt-2">{right} of {total} correct</div>
      </div>
      <div className="mt-6 flex gap-3">
        <Button asChild><Link to="/tests">Back to tests</Link></Button>
        <Button variant="outline" asChild><Link to="/new-test">New test</Link></Button>
      </div>
    </div>
  );
}
