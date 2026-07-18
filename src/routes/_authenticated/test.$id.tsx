import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { getTest, submitAnswer, toggleBookmark, finishTest } from "@/lib/qbank.functions";
import { rewriteMedia } from "@/lib/media";
import {
  Flag, ChevronLeft, ChevronRight, Maximize2, FlaskConical, StickyNote,
  Notebook, Calculator, Settings, BookOpen, Library, Zap, MessageSquare,
  ArrowLeft, Clock, CheckCircle2, FileText,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/test/$id")({
  component: TestRunner,
});

// USMLE-Fighter palette
const NAV_BG = "#1e3a8a";       // deep blue top/bottom bars
const NAV_ACCENT = "#2a4ba0";
const PAGE_BG = "#ffffff";
const SIDE_BG = "#eef2f9";
const TEXT = "#1f2937";

function TopBtn({ icon: Icon, label, onClick }: { icon: any; label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center px-3 py-1 text-white/90 hover:text-white hover:bg-white/10 rounded transition-colors min-w-[64px]"
    >
      <Icon className="h-5 w-5" />
      <span className="text-[11px] mt-0.5">{label}</span>
    </button>
  );
}

function TestRunner() {
  const { id } = Route.useParams();
  const testId = Number(id);
  const nav = useNavigate();
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
  const [elapsed, setElapsed] = useState(0);
  const [showCalc, setShowCalc] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Settings
  const [fontSize, setFontSize] = useState(16);
  const [fontWeight, setFontWeight] = useState(400);
  const [theme, setTheme] = useState<"light" | "dark" | "sepia">("light");
  const [transparentExpl, setTransparentExpl] = useState(false);
  const [largeImages, setLargeImages] = useState(false);
  const [highlightOnly, setHighlightOnly] = useState(false);
  const [multicolor, setMulticolor] = useState(true);
  const [activeHighlight, setActiveHighlight] = useState<string>("#fff59d");
  const [enabledHighlights, setEnabledHighlights] = useState<Record<string, boolean>>({
    "#fff59d": true, "#a5d6a7": true, "#81d4fa": true,
    "#f8bbd0": true, "#ffcc80": true, "#ce93d8": true,
  });

  const themeStyles = theme === "dark"
    ? { pageBg: "#0f172a", sideBg: "#1e293b", text: "#e5e7eb", cardBg: "#1e293b", border: "#334155" }
    : theme === "sepia"
    ? { pageBg: "#f4ecd8", sideBg: "#ebe0c4", text: "#3b2f1e", cardBg: "#faf3e0", border: "#d6c9a8" }
    : { pageBg: PAGE_BG, sideBg: SIDE_BG, text: TEXT, cardBg: "#ffffff", border: "#d1d5db" };

  const question = data?.questions[idx];
  const answers = question ? data!.answersByQ[question.id] ?? [] : [];
  const priorAttempt = question ? data!.attemptsByQ[question.id] : undefined;
  const isPractice = data?.test.mode === "practice";
  const total = data?.questions.length ?? 0;

  useEffect(() => {
    setSelected(priorAttempt?.selected_answer ?? null);
    setSubmitted(!!priorAttempt);
    setStartedAt(Date.now());
    setElapsed(0);
  }, [idx, question?.id, priorAttempt?.selected_answer]);

  useEffect(() => {
    if (submitted) return;
    const t = setInterval(() => setElapsed(Math.round((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [submitted, startedAt]);

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
    nav({ to: "/test-results/$id", params: { id } });
  };

  const goFullscreen = () => {
    if (!document.fullscreenElement) rootRef.current?.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  if (isLoading || !data || !question) return <div className="p-8">Loading…</div>;
  if (data.test.done) return <Navigate to="/test-results/$id" params={{ id }} replace />;

  const correctIdx = question.correct_answer;
  const showAnswers = submitted && isPractice;
  const isBookmarked = data.bookmarkedIds.has(question.id);
  const isCorrect = submitted && selected === correctIdx;
  const correctLetter = correctIdx != null ? String.fromCharCode(65 + correctIdx) : "";
  const correctText = correctIdx != null ? answers[correctIdx]?.answer_text ?? "" : "";
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timeLabel = `${mins}min: ${secs}sec`;

  // stub peer % (would come from analytics)
  const peerPct = 73;

  const notImpl = (n: string) => () => toast(`${n} — coming soon`);

  // Apply highlight to current selection
  const applyHighlight = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    const container = range.commonAncestorContainer.parentElement;
    if (!container?.closest(".qbank-html")) return;
    const mark = document.createElement("mark");
    mark.style.backgroundColor = activeHighlight;
    mark.style.color = "inherit";
    mark.className = "qbank-hl";
    try { range.surroundContents(mark); sel.removeAllRanges(); } catch { /* cross-node */ }
  };

  return (
    <div ref={rootRef} className="flex flex-col h-screen" style={{ background: themeStyles.pageBg, color: themeStyles.text }} onMouseUp={multicolor || highlightOnly ? applyHighlight : undefined}>
      {/* Top nav */}
      <div className="flex items-center justify-between px-3 py-1.5 text-white" style={{ background: NAV_BG }}>
        <div className="flex items-center gap-4">
          <button className="p-1 hover:bg-white/10 rounded" onClick={notImpl("Menu")}>
            <span className="block w-5 h-0.5 bg-white mb-1" />
            <span className="block w-5 h-0.5 bg-white mb-1" />
            <span className="block w-5 h-0.5 bg-white" />
          </button>
          <div className="text-sm leading-tight">
            <div className="font-semibold">Item {idx + 1} of {total}</div>
            <div className="text-[11px] text-white/75">Question Id: {question.id}</div>
          </div>
          <button
            onClick={bookmark}
            className={`flex flex-col items-center px-2 py-1 rounded hover:bg-white/10 ${isBookmarked ? "text-yellow-300" : "text-white/90"}`}
          >
            <Flag className="h-5 w-5" fill={isBookmarked ? "currentColor" : "none"} />
            <span className="text-[11px]">Mark</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <TopBtn icon={ChevronLeft} label="Previous" onClick={() => setIdx(Math.max(0, idx - 1))} />
          <TopBtn icon={ChevronRight} label="Next" onClick={() => setIdx(Math.min(total - 1, idx + 1))} />
        </div>

        <div className="flex items-center gap-1">
          <TopBtn icon={Maximize2} label="Full Screen" onClick={goFullscreen} />
          <TopBtn icon={FlaskConical} label="Lab Values" onClick={notImpl("Lab Values")} />
          <TopBtn icon={StickyNote} label="Notes" onClick={notImpl("Notes")} />
          <TopBtn icon={Notebook} label="Notebook" onClick={notImpl("Notebook")} />
          <TopBtn icon={Calculator} label="Calculator" onClick={() => setShowCalc(v => !v)} />
          <TopBtn icon={Settings} label="Settings" onClick={() => setShowSettings(v => !v)} />
        </div>
      </div>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left navigator */}
        <aside className="w-14 overflow-auto border-r" style={{ background: themeStyles.sideBg, borderColor: themeStyles.border }}>
          {data.questions.map((q, i) => {
            const att = data.attemptsByQ[q.id];
            const status = att ? (att.is_correct ? "correct" : "wrong") : "none";
            const active = i === idx;
            return (
              <button
                key={q.id}
                onClick={() => setIdx(i)}
                className={`w-full flex items-center gap-1 px-2 py-1 text-xs border-b hover:bg-white/60 ${active ? "bg-white font-semibold" : ""}`}
                style={{ borderColor: "#d1d9e6", color: TEXT }}
              >
                {status === "correct" && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
                {status === "wrong" && <span className="text-red-600 font-bold">✕</span>}
                {status === "none" && <span className="w-3.5" />}
                <span>{i + 1}</span>
                {data.bookmarkedIds.has(q.id) && <Flag className="h-3 w-3 ml-auto text-red-500" fill="currentColor" />}
              </button>
            );
          })}
        </aside>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          <div className={`max-w-4xl mx-auto px-8 py-6 ${largeImages ? "qbank-large-images" : ""}`} style={{ fontSize, fontWeight }}>
            {/* Answered banner */}
            {submitted && (
              <div className={`rounded-md border-l-4 p-4 mb-6 flex items-start justify-between gap-6 ${isCorrect ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"}`}>
                <div>
                  <div className={`font-semibold ${isCorrect ? "text-green-700" : "text-red-700"}`}>
                    {isCorrect ? "Answered Correctly" : "Answered Incorrectly"}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">The correct answer is:</div>
                  <div className="font-semibold text-gray-800 mt-1" dangerouslySetInnerHTML={{ __html: `${correctLetter}. ${rewriteMedia(correctText)}` }} />
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center">
                      <Clock className="h-4 w-4 text-blue-700" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{timeLabel}</div>
                      <div className="text-[11px] text-gray-500">Time Taken</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle2 className="h-4 w-4 text-green-700" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{peerPct}%</div>
                      <div className="text-[11px] text-gray-500">Answered Correctly</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            
            <div className="qbank-html qbank-light" dangerouslySetInnerHTML={{ __html: rewriteMedia(question.question) }} />

            <div className="mt-6 space-y-2">
              {answers.map((a, i) => {
                const letter = String.fromCharCode(65 + i);
                const isThisCorrect = showAnswers && i === correctIdx;
                const isThisWrong = showAnswers && selected === i && i !== correctIdx;
                const pct: number | null = null;
                return (
                  <button
                    key={a.id}
                    disabled={submitted}
                    onClick={() => setSelected(i)}
                    className={`w-full text-left rounded border px-3 py-2 flex items-start gap-3 transition-colors ${
                      isThisCorrect ? "border-green-500 bg-green-50" :
                      isThisWrong ? "border-red-500 bg-red-50" :
                      selected === i ? "border-blue-600 bg-blue-50" : "border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-2 mt-0.5">
                      {isThisCorrect && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                      {isThisWrong && <span className="text-red-600 font-bold">✕</span>}
                      <div className={`h-4 w-4 rounded-full border ${selected === i ? "border-blue-600 bg-blue-600" : "border-gray-400"}`} />
                    </div>
                    <div className="flex-1 flex items-baseline gap-2">
                      <span className="font-medium">{letter}.</span>
                      <span className="flex-1 qbank-html qbank-light" dangerouslySetInnerHTML={{ __html: rewriteMedia(a.answer_text) }} />
                      {submitted && pct != null && <span className="text-xs text-gray-500">({pct}%)</span>}
                    </div>
                  </button>
                );
              })}
            </div>

            {showAnswers && question.explanation && (
              <div className="mt-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-t-md border border-b-0 border-gray-300 bg-white font-medium">
                  <FileText className="h-4 w-4 text-blue-700" /> Explanation
                </div>
                <div className="border border-gray-300 rounded-b-md rounded-tr-md p-5 bg-white">
                  <div className="qbank-html qbank-light" dangerouslySetInnerHTML={{ __html: rewriteMedia(question.explanation) }} />
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-between items-center">
              <button
                onClick={() => setIdx(Math.max(0, idx - 1))}
                disabled={idx === 0}
                className="px-4 py-2 rounded border border-gray-300 text-sm disabled:opacity-40 hover:bg-gray-50"
              >
                <ChevronLeft className="h-4 w-4 inline -mt-0.5" /> Previous
              </button>
              {!submitted ? (
                <button
                  onClick={submit}
                  disabled={selected == null}
                  className="px-6 py-2 rounded text-white text-sm font-semibold disabled:opacity-40"
                  style={{ background: NAV_BG }}
                >
                  Submit
                </button>
              ) : (
                <button
                  onClick={() => idx === total - 1 ? finish() : setIdx(idx + 1)}
                  className="px-6 py-2 rounded text-white text-sm font-semibold"
                  style={{ background: NAV_BG }}
                >
                  {idx === total - 1 ? "End Test" : <>Next <ChevronRight className="h-4 w-4 inline -mt-0.5" /></>}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom nav */}
      <div className="flex items-center justify-between px-4 py-1.5 text-white text-xs" style={{ background: NAV_BG }}>
        <div className="font-semibold tracking-wide">IMD QBank</div>
        <div className="flex items-center gap-1">
          <TopBtn icon={Library} label="Medical Library" onClick={notImpl("Medical Library")} />
          <TopBtn icon={BookOpen} label="NBME Library" onClick={notImpl("NBME Library")} />
          <TopBtn icon={Zap} label="Flashcards" onClick={notImpl("Flashcards")} />
          <TopBtn icon={MessageSquare} label="Feedback" onClick={notImpl("Feedback")} />
          <TopBtn icon={ArrowLeft} label="Go Back" onClick={() => nav({ to: "/tests" })} />
        </div>
      </div>

      {showCalc && <MiniCalculator onClose={() => setShowCalc(false)} />}
    </div>
  );
}

function MiniCalculator({ onClose }: { onClose: () => void }) {
  const [expr, setExpr] = useState("");
  const push = (t: string) => setExpr(e => e + t);
  const evalIt = () => {
    try {
      // eslint-disable-next-line no-new-func
      setExpr(String(Function(`"use strict";return (${expr.replace(/x/g, "*").replace(/÷/g, "/")})`)()));
    } catch { setExpr("Error"); }
  };
  const keys = [["C","⌫","(",")"],["7","8","9","÷"],["4","5","6","x"],["1","2","3","-"],["0",".","=","+"]];
  return (
    <div className="fixed top-24 right-8 bg-white border border-gray-300 rounded-md shadow-xl z-50 w-64 text-gray-800">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50">
        <span className="font-semibold text-sm">Calculator</span>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-800">✕</button>
      </div>
      <div className="p-3">
        <input value={expr} readOnly className="w-full border border-gray-300 rounded px-2 py-2 text-right text-sm mb-2 bg-gray-50" />
        <div className="grid grid-cols-4 gap-1">
          {keys.flat().map(k => (
            <button
              key={k}
              onClick={() => k === "C" ? setExpr("") : k === "⌫" ? setExpr(expr.slice(0, -1)) : k === "=" ? evalIt() : push(k)}
              className="h-9 rounded bg-blue-50 hover:bg-blue-100 text-sm font-medium"
            >{k}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
