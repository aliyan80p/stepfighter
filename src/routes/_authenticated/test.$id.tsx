import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { getTest, submitAnswer, toggleBookmark, finishTest } from "@/lib/qbank.functions";
import { rewriteMedia } from "@/lib/media";
import {
  Flag, ChevronLeft, ChevronRight, Maximize2, FlaskConical, StickyNote,
  Notebook, Calculator, Settings, BookOpen, Library, Zap, MessageSquare,
  ArrowLeft, Clock, CheckCircle2, FileText, Strikethrough, Eraser, Copy, Sparkles,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/test/$id")({
  component: TestRunner,
});

// USMLE-Fighter palette
const NAV_BG = "#1e3a8a";       // deep blue top/bottom bars
const NAV_ACCENT = "#2a4ba0";
const PAGE_BG = "#f3f4f6";
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
  const contentRef = useRef<HTMLDivElement>(null);

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

  // Highlight toolbar state (hooks must live above early returns)
  const [hlBar, setHlBar] = useState<{ x: number; y: number } | null>(null);
  const savedRangeRef = useRef<Range | null>(null);

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

  // Floating highlight toolbar state
  const [hlBar, setHlBar] = useState<{ x: number; y: number } | null>(null);
  const savedRangeRef = useRef<Range | null>(null);

  const HL_COLORS = ["#fff59d", "#a5d6a7", "#81d4fa", "#f8bbd0", "#ffcc80", "#ce93d8"];

  const hlStorageKey = question ? `qbank-hl-${question.id}` : "";

  // Restore saved highlights per question
  useEffect(() => {
    if (!question || !contentRef.current) return;
    const saved = (() => { try { return JSON.parse(localStorage.getItem(`qbank-hl-${question.id}`) || "{}"); } catch { return {}; } })();
    contentRef.current.querySelectorAll<HTMLElement>("[data-hlkey]").forEach(el => {
      const k = el.dataset.hlkey!;
      if (typeof saved[k] === "string") el.innerHTML = saved[k];
    });
  }, [question?.id, submitted]);

  const persistHighlights = () => {
    if (!question || !contentRef.current) return;
    const snap: Record<string, string> = {};
    contentRef.current.querySelectorAll<HTMLElement>("[data-hlkey]").forEach(el => {
      if (el.querySelector("mark.qbank-hl")) snap[el.dataset.hlkey!] = el.innerHTML;
    });
    try { localStorage.setItem(`qbank-hl-${question.id}`, JSON.stringify(snap)); } catch {}
  };
    const range = sel.getRangeAt(0);
    const container = range.commonAncestorContainer.parentElement;
    if (!container?.closest(".qbank-html")) { setHlBar(null); return; }
    savedRangeRef.current = range.cloneRange();
    const rect = range.getBoundingClientRect();
    setHlBar({ x: rect.left + rect.width / 2, y: rect.top - 8 });
  };

  const wrapSelection = (styler: (m: HTMLElement) => void) => {
    const range = savedRangeRef.current;
    if (!range) return;
    const mark = document.createElement("mark");
    mark.className = "qbank-hl";
    mark.style.color = "inherit";
    mark.style.backgroundColor = "transparent";
    styler(mark);
    try { range.surroundContents(mark); } catch { /* cross-node */ }
    window.getSelection()?.removeAllRanges();
    setHlBar(null);
  };

  const applyColor = (c: string) => {
    setActiveHighlight(c);
    wrapSelection(m => { m.style.backgroundColor = c; });
  };
  const applyStrike = () => wrapSelection(m => { m.style.textDecoration = "line-through"; m.style.textDecorationColor = "#ef4444"; });
  const eraseHighlight = () => {
    const range = savedRangeRef.current;
    if (!range) return;
    const container = range.commonAncestorContainer.parentElement;
    container?.closest(".qbank-html")?.querySelectorAll("mark.qbank-hl").forEach(m => {
      if (range.intersectsNode(m)) {
        const parent = m.parentNode!;
        while (m.firstChild) parent.insertBefore(m.firstChild, m);
        parent.removeChild(m);
      }
    });
    window.getSelection()?.removeAllRanges();
    setHlBar(null);
  };
  const copySel = async () => {
    const range = savedRangeRef.current;
    if (!range) return;
    try { await navigator.clipboard.writeText(range.toString()); toast("Copied"); } catch {}
    setHlBar(null);
  };

  return (
    <div ref={rootRef} className="flex flex-col h-screen" style={{ background: themeStyles.pageBg, color: themeStyles.text }} onMouseUp={handleSelection}>
      {hlBar && (multicolor || highlightOnly) && (
        <div
          className="fixed z-50 flex items-center gap-1 bg-gray-900 text-white rounded-full shadow-xl px-2 py-1.5 -translate-x-1/2 -translate-y-full"
          style={{ left: hlBar.x, top: hlBar.y }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {HL_COLORS.filter(c => enabledHighlights[c]).map(c => (
            <button
              key={c}
              onClick={() => applyColor(c)}
              className="h-5 w-5 rounded-full border border-white/20 hover:scale-110 transition-transform"
              style={{ background: c }}
              title="Highlight"
            />
          ))}
          <div className="w-px h-5 bg-white/20 mx-1" />
          <button onClick={applyStrike} className="p-1 hover:bg-white/10 rounded" title="Strike-through">
            <Strikethrough className="h-4 w-4" />
          </button>
          <button onClick={eraseHighlight} className="p-1 hover:bg-white/10 rounded" title="Remove highlight">
            <Eraser className="h-4 w-4" />
          </button>
          <button onClick={() => toast("AI note — coming soon")} className="p-1 hover:bg-white/10 rounded" title="AI">
            <Sparkles className="h-4 w-4" />
          </button>
          <button onClick={copySel} className="p-1 hover:bg-white/10 rounded" title="Copy">
            <Copy className="h-4 w-4" />
          </button>
        </div>
      )}
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
            {(() => null)()}


            
            <div className="qbank-html qbank-light" dangerouslySetInnerHTML={{ __html: rewriteMedia(question.question) }} />

            <div className="mt-6 rounded border bg-white px-4 py-3" style={{ borderColor: "#b8c6de" }}>
              {answers.map((a, i) => {
                const letter = String.fromCharCode(65 + i);
                const isThisCorrect = showAnswers && i === correctIdx;
                const isThisWrong = showAnswers && selected === i && i !== correctIdx;
                // deterministic pseudo peer % per answer
                const pct: number | null = submitted
                  ? (i === correctIdx ? 55 + ((question.id * 7) % 25) : 2 + ((question.id * 3 + i * 11) % 18))
                  : null;
                const isSelected = selected === i;
                return (
                  <button
                    key={a.id}
                    disabled={submitted}
                    onClick={() => setSelected(i)}
                    className="w-full text-left flex items-center gap-2 py-1.5 text-[15px]"
                    style={{ color: "#1f2937" }}
                  >
                    <span className="w-4 flex justify-center shrink-0">
                      {isThisCorrect && <span className="text-green-600 font-bold text-base leading-none">✓</span>}
                      {isThisWrong && <span className="text-red-600 font-bold text-base leading-none">✕</span>}
                    </span>
                    <span
                      className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${
                        isSelected ? "border-gray-600" : "border-gray-400"
                      }`}
                    >
                      {isSelected && <span className="h-2 w-2 rounded-full bg-gray-700" />}
                    </span>
                    <span className="flex-1">
                      <span className="font-normal">{letter}. </span>
                      <span className="qbank-html qbank-light inline" dangerouslySetInnerHTML={{ __html: rewriteMedia(a.answer_text) }} />
                      {submitted && pct != null && <span className="text-gray-600 ml-1">({pct}%)</span>}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Answered banner — placed just above the explanation */}
            {submitted && (
              <div className={`mt-8 rounded-md border-l-4 p-4 flex items-start justify-between gap-6 ${isCorrect ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"}`}>
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

            {showAnswers && question.explanation && (
              <div className="mt-8">
                <div className="border-b" style={{ borderColor: "#d1d9e6" }}>
                  <div
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-t-md bg-white font-semibold text-sm relative -mb-px"
                    style={{ color: "#1e3a8a", boxShadow: "inset 0 -3px 0 #1e3a8a" }}
                  >
                    <FileText className="h-4 w-4" /> Explanation
                  </div>
                </div>
                <div
                  className="pt-6 pb-4"
                  style={{
                    background: transparentExpl ? "transparent" : "transparent",
                    fontSize: `${fontSize}px`,
                    fontWeight,
                    lineHeight: 1.7,
                    color: theme === "light" ? "#1f2937" : themeStyles.text,
                    WebkitFontSmoothing: "antialiased",
                    MozOsxFontSmoothing: "grayscale",
                    textRendering: "optimizeLegibility",
                  }}
                >
                  <div
                    className="qbank-html qbank-light qbank-explanation"
                    dangerouslySetInnerHTML={{ __html: rewriteMedia(question.explanation) }}
                  />
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

      {showCalc && <SciCalculator onClose={() => setShowCalc(false)} />}
      {showSettings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
          fontSize={fontSize} setFontSize={setFontSize}
          fontWeight={fontWeight} setFontWeight={setFontWeight}
          theme={theme} setTheme={setTheme}
          transparentExpl={transparentExpl} setTransparentExpl={setTransparentExpl}
          largeImages={largeImages} setLargeImages={setLargeImages}
          highlightOnly={highlightOnly} setHighlightOnly={setHighlightOnly}
          multicolor={multicolor} setMulticolor={setMulticolor}
          activeHighlight={activeHighlight} setActiveHighlight={setActiveHighlight}
          enabledHighlights={enabledHighlights} setEnabledHighlights={setEnabledHighlights}
        />
      )}
    </div>
  );
}

/* ---------------- Settings Panel ---------------- */

const HIGHLIGHTS = [
  { color: "#fff59d", label: "Yellow" },
  { color: "#a5d6a7", label: "Green" },
  { color: "#81d4fa", label: "Cyan" },
  { color: "#f8bbd0", label: "Pink" },
  { color: "#ffcc80", label: "Orange" },
  { color: "#ce93d8", label: "Purple" },
];

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`relative w-10 h-6 rounded-full transition-colors ${on ? "bg-blue-600" : "bg-gray-300"}`}
    >
      <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-4" : ""}`} />
    </button>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-700">{label}</span>
      {children}
    </div>
  );
}

function SettingsPanel(props: any) {
  const {
    onClose, fontSize, setFontSize, fontWeight, setFontWeight, theme, setTheme,
    transparentExpl, setTransparentExpl, largeImages, setLargeImages,
    highlightOnly, setHighlightOnly, multicolor, setMulticolor,
    activeHighlight, setActiveHighlight, enabledHighlights, setEnabledHighlights,
  } = props;
  return (
    <div className="fixed top-16 right-4 w-80 bg-white border border-gray-300 rounded-lg shadow-2xl z-50 text-gray-800 max-h-[80vh] overflow-auto">
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-gray-100 sticky top-0">
        <span className="font-semibold">Settings</span>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-800">✕</button>
      </div>

      <div className="p-4 border-b">
        <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Appearance</div>
        <Row label="Font Size">
          <div className="flex items-center gap-2">
            <button onClick={() => setFontSize(Math.max(12, fontSize - 1))} className="h-7 w-7 rounded border hover:bg-gray-50">−</button>
            <span className="w-6 text-center font-semibold">A</span>
            <button onClick={() => setFontSize(Math.min(28, fontSize + 1))} className="h-7 w-7 rounded border hover:bg-gray-50">+</button>
          </div>
        </Row>
        <Row label="Font Weight">
          <input type="range" min={300} max={700} step={100} value={fontWeight}
            onChange={e => setFontWeight(Number(e.target.value))} className="w-32" />
        </Row>
        <Row label="Color Theme">
          <div className="flex items-center gap-2">
            {[
              { k: "light", bg: "#ffffff", border: "#d1d5db" },
              { k: "dark", bg: "#0f172a", border: "#0f172a" },
              { k: "sepia", bg: "#f4ecd8", border: "#d6c9a8" },
            ].map(t => (
              <button key={t.k} onClick={() => setTheme(t.k as any)}
                className={`h-7 w-7 rounded-full border-2 ${theme === t.k ? "ring-2 ring-blue-500" : ""}`}
                style={{ background: t.bg, borderColor: t.border }} />
            ))}
          </div>
        </Row>
      </div>

      <div className="p-4 border-b">
        <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Highlight Features</div>
        <Row label="Highlight-Only Mode"><Toggle on={highlightOnly} onChange={setHighlightOnly} /></Row>
        <Row label="Multicolor Highlighting"><Toggle on={multicolor} onChange={setMulticolor} /></Row>
      </div>

      <div className="p-4 border-b">
        <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Customize Highlight</div>
        {HIGHLIGHTS.map(h => (
          <div key={h.color} className="flex items-center justify-between py-1.5">
            <button
              onClick={() => setActiveHighlight(h.color)}
              className={`flex items-center gap-2 ${activeHighlight === h.color ? "font-semibold" : ""}`}
            >
              <span className="h-4 w-4 rounded-full border" style={{ background: h.color }} />
              <span className="text-sm">{h.label} Highlight</span>
              {activeHighlight === h.color && <span className="text-[10px] text-blue-600">(active)</span>}
            </button>
            <Toggle on={!!enabledHighlights[h.color]} onChange={v => setEnabledHighlights({ ...enabledHighlights, [h.color]: v })} />
          </div>
        ))}
      </div>

      <div className="p-4">
        <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Content</div>
        <Row label="Transparent Background in Explanations">
          <Toggle on={transparentExpl} onChange={setTransparentExpl} />
        </Row>
        <Row label="Large Image Size"><Toggle on={largeImages} onChange={setLargeImages} /></Row>
      </div>
    </div>
  );
}

/* ---------------- Scientific Calculator ---------------- */

function SciCalculator({ onClose }: { onClose: () => void }) {
  const [expr, setExpr] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const push = (t: string) => setExpr(e => e + t);

  const evalIt = () => {
    try {
      const js = expr
        .replace(/π/g, "Math.PI")
        .replace(/(?<![a-zA-Z])e(?![a-zA-Z])/g, "Math.E")
        .replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-")
        .replace(/(\d+(?:\.\d+)?|\))\^(\d+(?:\.\d+)?|\()/g, "Math.pow($1,$2)")
        .replace(/√\(/g, "Math.sqrt(")
        .replace(/√(\d+(?:\.\d+)?)/g, "Math.sqrt($1)")
        .replace(/ln\(/g, "Math.log(")
        .replace(/log\(/g, "Math.log10(")
        .replace(/sin\(/g, "Math.sin(")
        .replace(/cos\(/g, "Math.cos(")
        .replace(/tan\(/g, "Math.tan(")
        .replace(/(\d+(?:\.\d+)?|\))!/g, "fact($1)")
        .replace(/%/g, "/100");
      const fn = new Function("fact", `"use strict";return (${js})`);
      const fact = (n: number): number => n <= 1 ? 1 : n * fact(n - 1);
      const result = String(fn(fact));
      setHistory(h => [`${expr} = ${result}`, ...h].slice(0, 5));
      setExpr(result);
    } catch { setExpr("Error"); }
  };

  const onKey = (k: string) => {
    if (k === "C") setExpr("");
    else if (k === "⌫") setExpr(expr.slice(0, -1));
    else if (k === "=") evalIt();
    else push(k);
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (/^[0-9.+\-*/()%]$/.test(e.key)) push(e.key);
      else if (e.key === "Enter") { e.preventDefault(); evalIt(); }
      else if (e.key === "Backspace") setExpr(x => x.slice(0, -1));
      else if (e.key === "Escape") setExpr("");
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [expr]);

  const rows: { k: string; c?: string }[][] = [
    [{ k: "C", c: "bg-pink-100" }, { k: "⌫", c: "bg-pink-100" }, { k: "(", c: "bg-pink-100" }, { k: ")", c: "bg-pink-100" }, { k: "π", c: "bg-yellow-100" }, { k: "%", c: "bg-gray-100" }],
    [{ k: "7", c: "bg-sky-100" }, { k: "8", c: "bg-sky-100" }, { k: "9", c: "bg-sky-100" }, { k: "^", c: "bg-yellow-100" }, { k: "√(", c: "bg-yellow-100" }, { k: "÷", c: "bg-gray-100" }],
    [{ k: "4", c: "bg-sky-100" }, { k: "5", c: "bg-sky-100" }, { k: "6", c: "bg-sky-100" }, { k: "ln(", c: "bg-yellow-100" }, { k: "log(", c: "bg-yellow-100" }, { k: "×", c: "bg-gray-100" }],
    [{ k: "1", c: "bg-sky-100" }, { k: "2", c: "bg-sky-100" }, { k: "3", c: "bg-sky-100" }, { k: "sin(", c: "bg-yellow-100" }, { k: "cos(", c: "bg-yellow-100" }, { k: "−", c: "bg-gray-100" }],
    [{ k: "0", c: "bg-sky-100" }, { k: ".", c: "bg-sky-100" }, { k: "!", c: "bg-yellow-100" }, { k: "tan(", c: "bg-yellow-100" }, { k: "=", c: "bg-blue-600 text-white" }, { k: "+", c: "bg-gray-100" }],
  ];

  return (
    <div className="fixed top-20 right-4 bg-white border border-gray-300 rounded-lg shadow-2xl z-50 w-[300px] text-gray-800">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-100">
        <span className="font-semibold text-sm">Calculator</span>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-800">✕</button>
      </div>
      <div className="p-3">
        {history.length > 0 && (
          <div className="text-[11px] text-gray-400 mb-1 max-h-12 overflow-auto text-right font-mono">
            {history.map((h, i) => <div key={i}>{h}</div>)}
          </div>
        )}
        <input
          value={expr}
          onChange={e => setExpr(e.target.value)}
          onKeyDown={e => e.key === "Enter" && evalIt()}
          placeholder="0"
          className="w-full border border-gray-300 rounded px-2 py-2.5 text-right text-lg mb-2 bg-gray-50 font-mono"
        />
        <div className="grid grid-cols-6 gap-1">
          {rows.flat().map((k, i) => (
            <button
              key={i}
              onClick={() => onKey(k.k)}
              className={`h-9 rounded text-sm font-medium hover:brightness-95 active:scale-95 transition ${k.c ?? "bg-gray-100"}`}
            >{k.k}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
