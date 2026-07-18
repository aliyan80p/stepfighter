import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { getTest, submitAnswer, toggleBookmark, finishTest } from "@/lib/qbank.functions";
import { rewriteMedia } from "@/lib/media";
import {
  Flag, ChevronLeft, ChevronRight, Maximize2, FlaskConical, StickyNote,
  Notebook, Calculator, Settings, BookOpen, Library, Zap, MessageSquare,
  ArrowLeft, Clock, CheckCircle2, FileText, Eraser, Copy, ImageIcon,
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

type MediaKind = "image" | "video" | "audio";
type MediaItem = { name: string; url: string; kind: MediaKind };

function mediaKind(name: string): MediaKind | null {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(ext)) return "image";
  if (["mp4", "webm", "mov", "m4v"].includes(ext)) return "video";
  if (["mp3", "wav", "ogg"].includes(ext)) return "audio";
  return null;
}

function mediaUrl(name: string) {
  return `/api/media/${encodeURIComponent(name.trim())}`;
}

function getQuestionMedia(question: { media_name?: string | null; other_medias?: string | null } | null | undefined): MediaItem[] {
  if (!question) return [];
  const seen = new Set<string>();
  return [question.media_name, question.other_medias]
    .filter(Boolean)
    .flatMap((value) => String(value).split(/[;,|\n\r\t ]+/))
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({ name, kind: mediaKind(name) }))
    .filter((item): item is { name: string; kind: MediaKind } => !!item.kind)
    .filter((item) => {
      const key = item.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((item) => ({ ...item, url: mediaUrl(item.name) }));
}

function mediaKeys(name: string): string[] {
  const base = (name.split("/").pop() ?? name).trim().toLowerCase();
  const stripped = base.replace(/^(highresdefault_|hqdefault_|mqdefault_|sddefault_|default_)/, "");
  return Array.from(new Set([base, stripped]));
}

function getEmbeddedMediaKeys(html: string | null | undefined): Set<string> {
  const keys = new Set<string>();
  if (!html) return keys;
  const matches = html.matchAll(/(?:src|href)=["']([^"']+\.(?:png|jpe?g|gif|webp|bmp|svg|mp4|webm|mov|m4v|mp3|wav|ogg))["']/gi);
  for (const match of matches) {
    for (const key of mediaKeys(match[1])) keys.add(key);
  }
  return keys;
}

function isEmbeddedMedia(item: MediaItem, embeddedKeys: Set<string>) {
  return mediaKeys(item.name).some((key) => embeddedKeys.has(key));
}

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

function ToggleSwitch({
  label, rightLabel, checked, onChange,
}: { label: string; rightLabel?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-2 text-white/90">
      <span className="text-[11px] font-medium">{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? "bg-sky-400" : "bg-white/30"}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? "translate-x-4" : "translate-x-1"}`}
        />
      </button>
      {rightLabel && <span className="text-[11px] font-medium">{rightLabel}</span>}
    </div>
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
  const [blockStartedAt] = useState(Date.now());
  const [blockElapsed, setBlockElapsed] = useState(0);
  const [showCalc, setShowCalc] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [timedMode, setTimedMode] = useState(true);
  const [tutorMode, setTutorMode] = useState(true);
  const [exhibitSrc, setExhibitSrc] = useState<string | null>(null);
  const [exhibitZoom, setExhibitZoom] = useState(1);
  const [mediaModalIndex, setMediaModalIndex] = useState<number | null>(null);


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
  const [activeHighlight, setActiveHighlight] = useState<string>("#ffeb3b");
  const [enabledHighlights, setEnabledHighlights] = useState<Record<string, boolean>>({
    "#ffeb3b": true, "#4ade80": true, "#38bdf8": true,
    "#f472b6": true, "#fb923c": true, "#c084fc": true,
  });

  // Highlight toolbar state (hooks must live above early returns)
  const [hlBar, setHlBar] = useState<{ x: number; y: number } | null>(null);
  const [highlightHtml, setHighlightHtml] = useState<Record<string, string>>({});
  const savedRangeRef = useRef<Range | null>(null);
  const savedSelectionRef = useRef<{ key: string; start: number; end: number } | null>(null);
  const savedTextRef = useRef("");

  const themeStyles = theme === "dark"
    ? { pageBg: "#0f172a", sideBg: "#1e293b", text: "#e5e7eb", cardBg: "#1e293b", border: "#334155" }
    : theme === "sepia"
    ? { pageBg: "#f4ecd8", sideBg: "#ebe0c4", text: "#3b2f1e", cardBg: "#faf3e0", border: "#d6c9a8" }
    : { pageBg: PAGE_BG, sideBg: SIDE_BG, text: TEXT, cardBg: "#ffffff", border: "#d1d5db" };

  const question = data?.questions[idx];
  const allMediaItems = getQuestionMedia(question);
  const answers = question ? data!.answersByQ[question.id] ?? [] : [];
  const priorAttempt = question ? data!.attemptsByQ[question.id] : undefined;
  const isPractice = data?.test.mode === "practice";
  const isReview = !!data?.test.done;
  const total = data?.questions.length ?? 0;

  useEffect(() => {
    setSelected(priorAttempt?.selected_answer ?? null);
    setSubmitted(!!priorAttempt);
    setStartedAt(Date.now());
    setElapsed(0);
    setMediaModalIndex(null);
  }, [idx, question?.id, priorAttempt?.selected_answer]);

  useEffect(() => {
    if (submitted) return;
    const t = setInterval(() => setElapsed(Math.round((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [submitted, startedAt]);

  useEffect(() => {
    const t = setInterval(() => setBlockElapsed(Math.round((Date.now() - blockStartedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [blockStartedAt]);


  // Restore saved highlights per question (must run before early returns to keep hook order stable)
  useEffect(() => {
    if (!question) return;
    const saved = (() => {
      try { return JSON.parse(localStorage.getItem(`qbank-hl-${question.id}`) || "{}"); }
      catch { return {}; }
    })();
    setHighlightHtml(saved && typeof saved === "object" ? saved : {});
  }, [question?.id, submitted]);

  // Click-to-open exhibit modal for any image in the question/explanation
  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const img = target.closest?.("img") as HTMLImageElement | null;
      if (!img || !root.contains(img)) return;
      e.preventDefault();
      e.stopPropagation();
      setExhibitSrc(img.currentSrc || img.src);
      setExhibitZoom(1);
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [question?.id, submitted]);


  const optimisticAttempt = (questionId: number, selectedIndex: number, secs: number, isCorrect: boolean) => {
    qc.setQueryData(["test", testId], (old: any) => {
      if (!old) return old;
      return {
        ...old,
        attemptsByQ: {
          ...old.attemptsByQ,
          [questionId]: {
            ...(old.attemptsByQ?.[questionId] ?? {}),
            question_id: questionId,
            selected_answer: selectedIndex,
            is_correct: isCorrect,
            time_seconds: secs,
          },
        },
      };
    });
  };

  const submit = async () => {
    if (selected == null || !question) return;
    const secs = Math.round((Date.now() - startedAt) / 1000);
    const isCorrect = question.correct_answer === selected;
    // Optimistic: mark submitted immediately, update cache, fire-and-forget the server call
    setSubmitted(true);
    optimisticAttempt(question.id, selected, secs, isCorrect);
    subFn({ data: { testId, questionId: question.id, selectedIndex: selected, timeSeconds: secs } })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to submit"));
  };

  const proceedExam = async () => {
    if (!question) return;
    if (selected != null && !submitted) {
      const secs = Math.round((Date.now() - startedAt) / 1000);
      const isCorrect = question.correct_answer === selected;
      optimisticAttempt(question.id, selected, secs, isCorrect);
      // Fire-and-forget so navigation is instant
      subFn({ data: { testId, questionId: question.id, selectedIndex: selected, timeSeconds: secs } })
        .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to submit"));
    }
    if (idx === total - 1) {
      if (window.confirm("End the block and submit your answers? This cannot be undone.")) {
        await finish();
      }
    } else {
      goToQuestion(idx + 1);
    }
  };


  const bookmark = async () => {
    if (!question) return;
    try {
      const result = await bmFn({ data: { questionId: question.id } });
      toast(result.bookmarked ? "Question flagged" : "Flag removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update flag");
      return;
    }
    qc.invalidateQueries({ queryKey: ["test", testId] });
  };

  const finish = async () => {
    await finFn({ data: { testId } });
    qc.invalidateQueries({ queryKey: ["test", testId] });
    nav({ to: "/test-results/$id", params: { id } });
  };

  const goToQuestion = (nextIndex: number) => {
    const bounded = Math.max(0, Math.min(total - 1, nextIndex));
    setIdx(bounded);
    setHlBar(null);
    savedRangeRef.current = null;
    savedSelectionRef.current = null;
    savedTextRef.current = "";
    requestAnimationFrame(() => {
      contentRef.current?.scrollTo({ top: 0, behavior: "auto" });
    });
  };

  const goFullscreen = () => {
    if (!document.fullscreenElement) rootRef.current?.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  if (isLoading || !data || !question) return <div className="p-8">Loading…</div>;
  if (data.test.done && !isReview) return <Navigate to="/test-results/$id" params={{ id }} replace />;

  const correctIdx = question.correct_answer;
  const answered = submitted || selected != null;
  const showAnswers = isReview || (answered && isPractice && tutorMode);
  const isBookmarked = data.bookmarkedIds.has(question.id);
  const isCorrect = answered && selected === correctIdx;
  const correctLetter = correctIdx != null ? String.fromCharCode(65 + correctIdx) : "";
  const correctText = correctIdx != null ? answers[correctIdx]?.answer_text ?? "" : "";

  const embeddedMediaKeys = new Set<string>();
  getEmbeddedMediaKeys(question.question).forEach((key) => embeddedMediaKeys.add(key));
  answers.forEach((answer) => getEmbeddedMediaKeys(answer.answer_text).forEach((key) => embeddedMediaKeys.add(key)));
  // Always exclude explanation-embedded media from the top block so they only
  // appear inline within the explanation after the answer is revealed.
  getEmbeddedMediaKeys(question.explanation).forEach((key) => embeddedMediaKeys.add(key));
  getEmbeddedMediaKeys(correctText).forEach((key) => embeddedMediaKeys.add(key));
  const mediaItems = allMediaItems.filter((m) => !isEmbeddedMedia(m, embeddedMediaKeys));
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timeLabel = `${mins}min: ${secs}sec`;

  // stub peer % (would come from analytics)
  const peerPct = 73;

  const notImpl = (n: string) => () => toast(`${n} — coming soon`);

  const HL_COLORS = ["#ffeb3b", "#4ade80", "#38bdf8", "#f472b6", "#fb923c", "#c084fc"];

  const persistHighlights = () => {
    if (!question || !contentRef.current) return;
    const snap: Record<string, string> = {};
    contentRef.current.querySelectorAll<HTMLElement>("[data-hlkey]").forEach(el => {
      if (el.querySelector("mark.qbank-hl")) snap[el.dataset.hlkey!] = el.innerHTML;
    });
    try { localStorage.setItem(`qbank-hl-${question.id}`, JSON.stringify(snap)); } catch {}
    setHighlightHtml(snap);
  };

  const htmlFor = (key: string, html: string, deferMedia = false) => rewriteMedia(highlightHtml[key] ?? html, { deferMedia });

  const getHighlightRoot = (node: Node) => {
    const el = (node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement) as Element | null;
    return el?.closest<HTMLElement>("[data-hlkey]") ?? null;
  };

  const getSelectionOffsets = (root: HTMLElement, range: Range) => {
    const before = document.createRange();
    before.selectNodeContents(root);
    before.setEnd(range.startContainer, range.startOffset);
    const start = before.toString().length;
    return { start, end: start + range.toString().length };
  };

  const rangeFromOffsets = (root: HTMLElement, start: number, end: number) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let pos = 0;
    let didStart = false;
    let node = walker.nextNode();

    while (node) {
      const textLength = node.textContent?.length ?? 0;
      const next = pos + textLength;

      if (!didStart && start >= pos && start <= next) {
        range.setStart(node, Math.max(0, Math.min(textLength, start - pos)));
        didStart = true;
      }

      if (didStart && end >= pos && end <= next) {
        range.setEnd(node, Math.max(0, Math.min(textLength, end - pos)));
        return range;
      }

      pos = next;
      node = walker.nextNode();
    }

    return null;
  };

  const restoreSavedRange = () => {
    const snap = savedSelectionRef.current;
    if (!snap || !contentRef.current) return savedRangeRef.current;
    const root = contentRef.current.querySelector<HTMLElement>(`[data-hlkey="${CSS.escape(snap.key)}"]`);
    if (!root) return savedRangeRef.current;
    return rangeFromOffsets(root, snap.start, snap.end) ?? savedRangeRef.current;
  };

  const handleSelection = (event?: React.MouseEvent<HTMLDivElement>) => {
    const target = event?.target instanceof Element ? event.target : null;
    if (target?.closest("[data-hl-toolbar]")) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) { setHlBar(null); savedTextRef.current = ""; return; }
    const range = sel.getRangeAt(0);
    const startRoot = getHighlightRoot(range.startContainer);
    const endRoot = getHighlightRoot(range.endContainer);
    if (!startRoot || startRoot !== endRoot || !contentRef.current?.contains(startRoot)) {
      setHlBar(null);
      savedSelectionRef.current = null;
      savedTextRef.current = "";
      return;
    }
    const key = startRoot.dataset.hlkey;
    if (!key) return;
    const offsets = getSelectionOffsets(startRoot, range);
    savedRangeRef.current = range.cloneRange();
    savedSelectionRef.current = { key, ...offsets };
    savedTextRef.current = range.toString();
    const rect = range.getBoundingClientRect();
    setHlBar({ x: rect.left + rect.width / 2, y: rect.top - 8 });
  };

  const wrapSelection = (styler: (m: HTMLElement) => void) => {
    const range = restoreSavedRange();
    if (!range || range.collapsed) return;
    const mark = document.createElement("mark");
    mark.className = "qbank-hl";
    mark.style.color = "inherit";
    mark.style.backgroundColor = "transparent";
    styler(mark);
    try {
      range.surroundContents(mark);
    } catch {
      try {
        const frag = range.extractContents();
        mark.appendChild(frag);
        range.insertNode(mark);
      } catch { /* give up silently */ }
    }
    window.getSelection()?.removeAllRanges();
    savedRangeRef.current = null;
    savedSelectionRef.current = null;
    savedTextRef.current = "";
    setHlBar(null);
    persistHighlights();
  };

  const applyColor = (c: string) => {
    wrapSelection(m => { m.style.backgroundColor = c; });
    setActiveHighlight(c);
  };
  const applyStrike = () => wrapSelection(m => { m.style.textDecoration = "line-through"; m.style.textDecorationColor = "#ef4444"; });
  const eraseHighlight = () => {
    const range = restoreSavedRange();
    if (!range) return;
    const anchor = range.commonAncestorContainer;
    const el = (anchor.nodeType === 1 ? anchor as Element : anchor.parentElement) as Element | null;
    el?.closest("[data-hlkey]")?.querySelectorAll("mark.qbank-hl").forEach(m => {
      if (range.intersectsNode(m)) {
        const parent = m.parentNode!;
        while (m.firstChild) parent.insertBefore(m.firstChild, m);
        parent.removeChild(m);
      }
    });
    window.getSelection()?.removeAllRanges();
    savedRangeRef.current = null;
    savedSelectionRef.current = null;
    savedTextRef.current = "";
    setHlBar(null);
    persistHighlights();
  };

  const copySel = async () => {
    const range = savedRangeRef.current;
    const text = (savedTextRef.current || range?.toString() || "").trim();
    if (!text) {
      toast.error("Select text first");
      setHlBar(null);
      return;
    }
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch {}
    if (!ok) {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        ta.style.pointerEvents = "none";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {}
    }
    toast(ok ? "Copied to clipboard" : "Copy failed");
    setHlBar(null);
  };

  return (
    <div ref={rootRef} className="flex flex-col h-screen" style={{ background: themeStyles.pageBg, color: themeStyles.text }} onMouseUp={handleSelection}>
      {hlBar && (
        <div
          data-hl-toolbar
          className="fixed z-50 flex items-center gap-1 bg-gray-900 text-white rounded-full shadow-xl px-2 py-1.5 -translate-x-1/2 -translate-y-full"
          style={{ left: hlBar.x, top: hlBar.y }}
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onMouseUp={(e) => { e.preventDefault(); e.stopPropagation(); }}
        >
          {(multicolor ? HL_COLORS.filter(c => enabledHighlights[c]) : [HL_COLORS[0]]).map(c => (
            <button
              key={c}
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); applyColor(c); }}
              className="h-5 w-5 rounded-full border border-white/20 hover:scale-110 transition-transform"
              style={{ background: c }}
              title="Highlight"
            />
          ))}
          <div className="w-px h-5 bg-white/20 mx-1" />
          <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); eraseHighlight(); }} className="p-1 hover:bg-white/10 rounded" title="Remove highlight">
            <Eraser className="h-4 w-4" />
          </button>
          <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); copySel(); }} className="p-1 hover:bg-white/10 rounded" title="Copy">
            <Copy className="h-4 w-4" />
          </button>
        </div>
      )}
      {/* Top nav */}
      <div className="flex items-center justify-between px-3 py-1.5 text-white" style={{ background: NAV_BG }}>
        <div className="flex items-center gap-4">
          <button className="p-1 hover:bg-white/10 rounded" onClick={() => setSidebarOpen(v => !v)} title={sidebarOpen ? "Hide question list" : "Show question list"}>
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
            title={isBookmarked ? "Remove flag" : "Flag question"}
          >
            <Flag className="h-5 w-5" fill={isBookmarked ? "currentColor" : "none"} />
            <span className="text-[11px]">Flag</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <TopBtn icon={ChevronLeft} label="Previous" onClick={() => goToQuestion(idx - 1)} />
          <TopBtn icon={ChevronRight} label="Next" onClick={() => goToQuestion(idx + 1)} />
        </div>

        <div className="flex items-center gap-1">
          <TopBtn icon={Maximize2} label="Full Screen" onClick={goFullscreen} />
          {mediaItems.length > 0 && <TopBtn icon={ImageIcon} label="Media" onClick={() => setMediaModalIndex(0)} />}
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
        {sidebarOpen && (
        <aside className="w-14 overflow-auto border-r" style={{ background: themeStyles.sideBg, borderColor: themeStyles.border }}>
          {data.questions.map((q, i) => {
            const att = data.attemptsByQ[q.id];
            const hideResult = !isReview && !tutorMode;
            const status = att
              ? (hideResult ? "attempted" : att.is_correct ? "correct" : "wrong")
              : "none";
            const active = i === idx;
            return (
              <button
                type="button"
                key={q.id}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  goToQuestion(i);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  goToQuestion(i);
                }}
                onMouseUp={(e) => e.stopPropagation()}
                aria-label={`Go to question ${i + 1}`}
                className={`relative z-10 w-full min-h-7 flex items-center gap-1 px-2 py-1 text-xs border-b cursor-pointer hover:bg-white/60 ${active ? "bg-white font-semibold" : ""}`}
                style={{ borderColor: "#d1d9e6", color: TEXT }}
              >
                {status === "correct" && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
                {status === "wrong" && <span className="text-red-600 font-bold">✕</span>}
                {status === "attempted" && <span className="inline-block h-2 w-2 rounded-full bg-slate-700" />}
                {status === "none" && <span className="w-3.5" />}
                <span>{i + 1}</span>
                {data.bookmarkedIds.has(q.id) && <Flag className="h-3 w-3 ml-auto text-red-500" fill="currentColor" />}
              </button>
            );
          })}
        </aside>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto" ref={contentRef}>
          <div className={`w-full mx-auto px-6 py-3 qbank-theme-${theme} ${largeImages ? "qbank-large-images" : ""}`} style={{ fontSize, fontWeight, color: themeStyles.text }}>
            {(() => null)()}


            
            <div data-hlkey="q" className="qbank-html qbank-light" dangerouslySetInnerHTML={{ __html: htmlFor("q", question.question) }} />

            {mediaItems.length > 0 && (
              <div className="mt-3 flex flex-wrap items-start gap-3">
                {mediaItems.map((item, mediaIndex) => {
                  const src = `/api/media/${encodeURIComponent(item.name)}`;
                  if (item.kind === "image") {
                    return (
                      <img
                        key={`${item.name}-${mediaIndex}`}
                        src={src}
                        alt="Exhibit"
                        loading="lazy"
                        decoding="async"
                        onClick={() => { setExhibitSrc(src); setExhibitZoom(1); }}
                        className="max-w-full rounded border cursor-zoom-in bg-white"
                        style={{ borderColor: "#b8c6de", maxHeight: "70vh" }}
                      />
                    );
                  }
                  if (item.kind === "video") {
                    return (
                      <video
                        key={`${item.name}-${mediaIndex}`}
                        src={src}
                        controls
                        preload="metadata"
                        className="max-w-full rounded border bg-black"
                        style={{ borderColor: "#b8c6de", maxHeight: "70vh" }}
                      />
                    );
                  }
                  return (
                    <audio
                      key={`${item.name}-${mediaIndex}`}
                      src={src}
                      controls
                      preload="metadata"
                    />
                  );
                })}
              </div>
            )}

            <div className="mt-3 inline-block rounded border px-4 py-2" style={{ borderColor: theme === "dark" ? "#334155" : "#b8c6de", background: theme === "dark" ? "#1e293b" : theme === "sepia" ? "#f4ecd8" : "#ffffff", color: themeStyles.text }}>
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
                    style={{ color: themeStyles.text }}
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
                      <span data-hlkey={`a${i}`} className="qbank-html qbank-light inline" dangerouslySetInnerHTML={{ __html: htmlFor(`a${i}`, a.answer_text) }} />
                      {submitted && pct != null && <span className="text-gray-600 ml-1">({pct}%)</span>}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Primary action button — directly below answer choices */}
            {!isReview && (
              <div className="mt-4">
                {!tutorMode ? (
                  <button
                    onClick={proceedExam}
                    disabled={selected == null && !submitted}
                    className="px-6 py-2 rounded text-white text-sm font-semibold disabled:opacity-40 uppercase tracking-wide"
                    style={{ background: NAV_BG }}
                  >
                    {idx === total - 1 ? "End Block" : "Proceed to Next Item"}
                  </button>
                ) : !submitted ? (
                  <button
                    onClick={submit}
                    disabled={selected == null}
                    className="px-6 py-2 rounded text-white text-sm font-semibold disabled:opacity-40 uppercase tracking-wide"
                    style={{ background: NAV_BG }}
                  >
                    Submit
                  </button>
                ) : null}
              </div>
            )}



            {/* Answered banner — placed just above the explanation */}
            {submitted && showAnswers && (
              <div className={`mt-4 rounded-md border-l-4 p-3 flex items-start justify-between gap-6 ${isCorrect ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"}`}>
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
              <div className="mt-4">
                <div className="border-b" style={{ borderColor: "#d1d9e6" }}>
                  <div
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-t-md bg-white font-semibold text-sm relative -mb-px"
                    style={{ color: "#1e3a8a", boxShadow: "inset 0 -3px 0 #1e3a8a" }}
                  >
                    <FileText className="h-4 w-4" /> Explanation
                  </div>
                </div>
                <div
                  className="pt-3 pb-2"
                  style={{
                    background: transparentExpl ? "transparent" : "transparent",
                    fontSize: `${fontSize}px`,
                    fontWeight,
                    lineHeight: 1.7,
                    color: themeStyles.text,
                    WebkitFontSmoothing: "antialiased",
                    MozOsxFontSmoothing: "grayscale",
                    textRendering: "optimizeLegibility",
                  }}
                >
                  <div
                    data-hlkey="e"
                    className="qbank-html qbank-light qbank-explanation"
                    dangerouslySetInnerHTML={{ __html: htmlFor("e", question.explanation, true) }}
                  />
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-between items-center">
              <button
                onClick={() => goToQuestion(idx - 1)}
                disabled={idx === 0}
                className="px-4 py-2 rounded border border-gray-300 text-sm disabled:opacity-40 hover:bg-gray-50"
              >
                <ChevronLeft className="h-4 w-4 inline -mt-0.5" /> Previous
              </button>
              {isReview ? (
                <button
                  onClick={() => {
                    if (idx === total - 1) nav({ to: "/test-results/$id", params: { id } });
                    else goToQuestion(idx + 1);
                  }}
                  className="px-6 py-2 rounded text-white text-sm font-semibold"
                  style={{ background: NAV_BG }}
                >
                  {idx === total - 1 ? "Finish Review" : <>Next <ChevronRight className="h-4 w-4 inline -mt-0.5" /></>}
                </button>
              ) : !tutorMode ? null : !submitted ? null : (
                <button
                  onClick={() => {
                    if (idx === total - 1) {
                      if (window.confirm("End the test and submit your answers? This cannot be undone.")) finish();
                    } else {
                      goToQuestion(idx + 1);
                    }
                  }}
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
      {(() => {
        const allowed = total * 90;
        const blockSec = timedMode ? Math.max(0, allowed - blockElapsed) : blockElapsed;
        const bh = String(Math.floor(blockSec / 3600)).padStart(2, "0");
        const bm = String(Math.floor((blockSec % 3600) / 60)).padStart(2, "0");
        const bs = String(blockSec % 60).padStart(2, "0");

        return (
          <div className="flex items-center justify-between px-4 py-1.5 text-white text-xs" style={{ background: NAV_BG }}>
            <div className="font-semibold tracking-wide tabular-nums">
              {isReview ? "" : `Block Time: ${bh}:${bm}:${bs}`}
            </div>
            <div className="font-semibold tracking-wide hidden md:block">IMD QBank</div>
            <div className="flex items-center gap-3">
              {!isReview && (
                <>
                  <ToggleSwitch label="Timed" checked={timedMode} onChange={setTimedMode} />
                  <ToggleSwitch label="Tutor" rightLabel="Exam" checked={!tutorMode} onChange={(v) => setTutorMode(!v)} />
                  <div className="w-px h-6 bg-white/20 mx-1" />
                </>
              )}
              <TopBtn icon={Library} label="Medical Library" onClick={notImpl("Medical Library")} />
              <TopBtn icon={Zap} label="Flashcards" onClick={notImpl("Flashcards")} />
              <TopBtn icon={MessageSquare} label="Feedback" onClick={notImpl("Feedback")} />
              {isReview ? (
                <TopBtn icon={ArrowLeft} label="Go Back" onClick={() => nav({ to: "/test-results/$id", params: { id } })} />
              ) : (
                <>
                  <TopBtn icon={Clock} label="Suspend" onClick={() => { if (window.confirm("Suspend this test? Your progress is saved and you can resume later.")) nav({ to: "/tests" }); }} />
                  <TopBtn icon={ArrowLeft} label="End Block" onClick={() => { if (window.confirm("End this block and submit your answers? This cannot be undone.")) finish(); }} />
                </>
              )}
            </div>
          </div>
        );
      })()}


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

      {exhibitSrc && (
        <ExhibitModal
          src={exhibitSrc}
          zoom={exhibitZoom}
          setZoom={setExhibitZoom}
          onClose={() => setExhibitSrc(null)}
        />
      )}

      {mediaModalIndex != null && mediaItems[mediaModalIndex] && (
        <MediaModal
          items={mediaItems}
          index={mediaModalIndex}
          setIndex={setMediaModalIndex}
          onClose={() => setMediaModalIndex(null)}
        />
      )}
    </div>
  );
}

function MediaModal({
  items, index, setIndex, onClose,
}: { items: MediaItem[]; index: number; setIndex: (v: number) => void; onClose: () => void }) {
  const item = items[index];
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    setZoom(1);
  }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setIndex(Math.max(0, index - 1));
      if (e.key === "ArrowRight") setIndex(Math.min(items.length - 1, index + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, items.length, onClose, setIndex]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4" onClick={onClose}>
      <div className="flex h-[92vh] w-[92vw] max-w-5xl flex-col overflow-hidden rounded bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-3 py-1.5 text-white" style={{ background: NAV_BG }}>
          <span className="text-sm font-semibold">Media Display {items.length > 1 ? `${index + 1} of ${items.length}` : ""}</span>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded" title="Close">
            <span className="text-lg leading-none">✕</span>
          </button>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-white p-4">
          {item.kind === "image" && (
            <img
              src={item.url}
              alt="Question exhibit"
              className="max-h-full max-w-full object-contain"
              style={{ transform: `scale(${zoom})`, transformOrigin: "center", transition: "transform 0.15s" }}
            />
          )}
          {item.kind === "video" && (
            <video key={item.url} controls preload="metadata" className="max-h-full max-w-full">
              <source src={item.url} />
            </video>
          )}
          {item.kind === "audio" && (
            <audio key={item.url} controls preload="metadata" className="w-full max-w-xl">
              <source src={item.url} />
            </audio>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 border-t bg-gray-50 px-3 py-2">
          <button
            onClick={() => setIndex(Math.max(0, index - 1))}
            disabled={index === 0}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Previous
          </button>
          {item.kind === "image" && (
            <div className="flex items-center gap-2">
              <button onClick={() => setZoom(Math.max(0.5, zoom - 0.25))} className="h-7 w-7 rounded-full border border-gray-300 bg-white">−</button>
              <span className="w-12 text-center text-xs text-gray-600">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(Math.min(4, zoom + 0.25))} className="h-7 w-7 rounded-full border border-gray-300 bg-white">+</button>
            </div>
          )}
          <button
            onClick={() => setIndex(Math.min(items.length - 1, index + 1))}
            disabled={index === items.length - 1}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function ExhibitModal({
  src, zoom, setZoom, onClose,
}: { src: string; zoom: number; setZoom: (v: number) => void; onClose: () => void }) {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded shadow-2xl overflow-hidden flex flex-col ${expanded ? "w-[95vw] h-[95vh]" : "w-[520px] max-w-[95vw] max-h-[92vh]"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-3 py-1.5 bg-[#1e3a8a] text-white">
          <span className="text-sm font-semibold">Exhibit Display</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1 hover:bg-white/10 rounded"
              title={expanded ? "Restore" : "Expand"}
            >
              <Maximize2 className="h-4 w-4" />
            </button>
            <button onClick={onClose} className="p-1 hover:bg-white/10 rounded" title="Close">
              <span className="text-lg leading-none">✕</span>
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-white p-3 flex items-start justify-center">
          <img
            src={src}
            alt="Exhibit"
            style={{ transform: `scale(${zoom})`, transformOrigin: "top center", transition: "transform 0.15s" }}
            className="max-w-full h-auto"
          />
        </div>
        <div className="flex items-center justify-center gap-2 border-t bg-gray-50 py-1.5">
          <button
            onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
            className="h-7 w-7 rounded-full border border-gray-300 bg-white hover:bg-gray-100 flex items-center justify-center text-sm"
          >−</button>
          <span className="text-xs text-gray-600 w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(Math.min(4, zoom + 0.25))}
            className="h-7 w-7 rounded-full border border-gray-300 bg-white hover:bg-gray-100 flex items-center justify-center text-sm"
          >+</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Settings Panel ---------------- */

const HIGHLIGHTS = [
  { color: "#ffeb3b", label: "Yellow" },
  { color: "#4ade80", label: "Green" },
  { color: "#38bdf8", label: "Blue" },
  { color: "#f472b6", label: "Pink" },
  { color: "#fb923c", label: "Orange" },
  { color: "#c084fc", label: "Purple" },
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
