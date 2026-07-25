import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef, useLayoutEffect, useMemo } from "react";
import { getTest, submitAnswer, toggleBookmark, finishTest } from "@/lib/qbank.functions";
import { rewriteMedia, withMediaToken } from "@/lib/media";
import { useMediaToken } from "@/lib/use-media-token";
import {
  Flag, ChevronLeft, ChevronRight, Maximize2, FlaskConical, StickyNote,
  Notebook, Calculator, Settings, BookOpen, Library, Zap, MessageSquare,
  ArrowLeft, Clock, CheckCircle2, FileText, Eraser, Copy, ImageIcon, Lock as LockIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirm-dialog";
import reverseColorIcon from "@/assets/icons/reverse-color.png.asset.json";
import lockIconImg from "@/assets/icons/lock.png.asset.json";
import endBlockIcon from "@/assets/icons/end-block.png.asset.json";
import calculatorIcon from "@/assets/icons/calculator-icon.png.asset.json";
import notesIcon from "@/assets/icons/notes.png.asset.json";
import medicalLibraryIcon from "@/assets/icons/medical-library.svg.asset.json";
import flashcardIcon from "@/assets/flashcard-icon.png.asset.json";
import suspendIcon from "@/assets/suspend-icon.png.asset.json";
import goBackIcon from "@/assets/icons/go-back.png.asset.json";
import navArrowIcon from "@/assets/icons/nav-arrow.png.asset.json";
import markFlagIcon from "@/assets/icons/mark-flag.png.asset.json";
import labValuesIcon from "@/assets/icons/lab-values.png.asset.json";
import textZoomIcon from "@/assets/icons/text-zoom.png.asset.json";
import { DEFAULT_SETTINGS, useHydratedSettings, setUserSettings, TOOLBAR_ITEMS } from "@/lib/user-settings";
import { FlashcardsModal } from "@/components/flashcards-modal";
import { FeedbackModal } from "@/components/feedback-modal";
import { NotesModal } from "@/components/notes-modal";
import { highlightRange, unwrapHighlightsInRange } from "@/lib/highlighter";
import { ExhibitModal as MediaExhibitModal, type ExhibitContent } from "@/components/exhibit-modal";
import { LabValuesPanel } from "@/components/lab-values-panel";
import { attachMediaAnchorHandlers } from "@/lib/media-anchors";
import { Loader } from "@/components/loader";

export const Route = createFileRoute("/_authenticated/test/$id")({
  component: TestRunner,
});

/**
 * Renders arbitrary HTML into a div imperatively, only reseeding innerHTML
 * when `seedKey` changes. This preserves in-place DOM mutations from the
 * highlighter across parent re-renders (timer ticks, selection state, etc.)
 * so that <img>/<video> inside the HTML never remount and never flash.
 */
function attachImageAutoRetry(root: HTMLElement) {
  const imgs = root.querySelectorAll<HTMLImageElement>("img");
  imgs.forEach((img) => {
    if ((img as any).__sfRetryBound) return;
    (img as any).__sfRetryBound = true;
    let tries = 0;
    const original = img.getAttribute("src") || "";
    const retry = () => {
      if (tries >= 3 || !original) return;
      tries += 1;
      const sep = original.includes("?") ? "&" : "?";
      const bust = `${sep}r=${Date.now()}-${tries}`;
      setTimeout(() => { img.src = original + bust; }, 200 * tries);
    };
    img.addEventListener("error", retry);
    // If already broken by the time we bind (cached failure), kick a retry.
    if (img.complete && img.naturalWidth === 0 && original) retry();
  });
}

function HighlightableHtml({
  html,
  seedKey,
  ...rest
}: { html: string; seedKey: string | number } & React.HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);
  const lastSeed = useRef<string | number | null>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    if (lastSeed.current !== seedKey) {
      ref.current.innerHTML = html;
      lastSeed.current = seedKey;
      attachImageAutoRetry(ref.current);
    }
  });
  return <div ref={ref} {...rest} />;
}


// USMLE-Fighter palette
const NAV_BG = "#1a4b7c";       // USMLE Fighter navy top/bottom bars
const NAV_ACCENT = "#2a4ba0";
const PAGE_BG = "#f5f7fa";
const SIDE_BG = "#eef1f5";
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

const MEDIA_QBANK_SLUG: Record<number, string> = { 1: "", 2: "step1", 3: "step3" };

function mediaUrl(name: string, qbankId = 1) {
  const slug = MEDIA_QBANK_SLUG[qbankId] ?? "";
  const prefix = slug ? `/api/media/${slug}/` : "/api/media/";
  return `${prefix}${encodeURIComponent(name.trim())}`;
}

function getQuestionMedia(question: { media_name?: string | null; other_medias?: string | null } | null | undefined, qbankId = 1): MediaItem[] {
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
    .map((item) => ({ ...item, url: mediaUrl(item.name, qbankId) }));
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

function TopBtn({ icon: Icon, imgSrc, imgFlip, imgClass, label, onClick }: { icon?: any; imgSrc?: string; imgFlip?: boolean; imgClass?: string; label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="shrink-0 flex flex-col items-center justify-center px-1 sm:px-3 py-0 text-white/90 hover:text-white hover:bg-white/10 rounded transition-colors min-w-[36px] sm:min-w-[64px] leading-tight"
    >
      {imgSrc ? (
        <img src={imgSrc} alt="" className={imgClass ?? "h-5 w-5 object-contain"} style={imgFlip ? { transform: "scaleX(-1)" } : undefined} />
      ) : Icon ? (
        <Icon className="h-5 w-5" />
      ) : null}
      <span className="hidden sm:block text-[11px] mt-0.5">{label}</span>
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

  const { data, isLoading, error } = useQuery({
    queryKey: ["test", testId],
    queryFn: () => getFn({ data: { id: testId } }),
    retry: false,
  });

  useEffect(() => {
    if (error && String((error as Error).message).includes("ACCESS_DENIED")) {
      nav({ to: "/upgrade" });
    }
  }, [error, nav]);


  const [idx, setIdx] = useState(() => {
    if (typeof window === "undefined") return 0;
    const saved = window.localStorage.getItem(`test:${id}:idx`);
    const n = saved ? parseInt(saved, 10) : 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  });
  const [selected, setSelected] = useState<number | null>(null);
  const [struck, setStruck] = useState<Set<number>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [startedAt, setStartedAt] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);
  // Frozen seconds captured at submit — used for the "Time Taken" display so it
  // never falls back to 0 if the query cache is briefly missing time_seconds.
  const [submittedSecs, setSubmittedSecs] = useState<number | null>(null);
  const [blockStartedAt] = useState(() => {
    if (typeof window === "undefined") return Date.now();
    const key = `blockStartedAt:${id}`;
    const raw = window.localStorage.getItem(key);
    const n = raw ? Number(raw) : NaN;
    if (Number.isFinite(n) && n > 0) return n;
    const now = Date.now();
    window.localStorage.setItem(key, String(now));
    return now;
  });
  const [blockElapsed, setBlockElapsed] = useState(0);
  const [showCalc, setShowCalc] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showFlashcards, setShowFlashcards] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(min-width: 768px)").matches;
  });
  const [timedMode, setTimedMode] = useState(true);
  // Persisted timed-mode base: allows toggling Timed on mid-block to countdown
  // from (unsolved * 90s) instead of restarting the full block allotment.
  const [timedBase, setTimedBase] = useState<{ startedAt: number; allowed: number } | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(`timedBase:${id}`);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
  const [tutorMode, setTutorMode] = useState(true);
  const [exhibitSrc, setExhibitSrc] = useState<string | null>(null);
  const [exhibitZoom, setExhibitZoom] = useState(1);
  const [mediaModalIndex, setMediaModalIndex] = useState<number | null>(null);
  const [breakModal, setBreakModal] = useState<null | "suspend" | "end">(null);
  const [modeInitFor, setModeInitFor] = useState<number | null>(null);
  const [showLabValues, setShowLabValues] = useState(false);
  const [anchorExhibit, setAnchorExhibit] = useState<ExhibitContent | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();


  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Settings — seeded from user's saved defaults
  const userSettings = useHydratedSettings();
  const [fontSize, setFontSize] = useState(DEFAULT_SETTINGS.fontSize + 1);
  const [fontWeight, setFontWeight] = useState(400);
  const [theme, setTheme] = useState<"light" | "dark" | "sepia">("light");
  const [transparentExpl, setTransparentExpl] = useState(DEFAULT_SETTINGS.transparentExplanations);
  const [largeImages, setLargeImages] = useState(DEFAULT_SETTINGS.largeImages);
  const [highlightOnly, setHighlightOnly] = useState(DEFAULT_SETTINGS.highlightOnly);
  const [multicolor, setMulticolor] = useState(DEFAULT_SETTINGS.multiHighlight);
  const [activeHighlight, setActiveHighlight] = useState<string>("#ffeb3b");
  const [enabledHighlights, setEnabledHighlights] = useState<Record<string, boolean>>(DEFAULT_SETTINGS.enabledHighlights);
  const [settingsApplied, setSettingsApplied] = useState(false);

  // Apply user's saved defaults once hydrated
  useEffect(() => {
    if (settingsApplied) return;
    setFontSize(Math.max(10, userSettings.fontSize + 1));
    setFontWeight(400 + userSettings.fontWeight * 100);
    setTheme(userSettings.defaultTheme === "dark" ? "dark" : "light");
    setTransparentExpl(userSettings.transparentExplanations);
    setLargeImages(userSettings.largeImages);
    setHighlightOnly(userSettings.highlightOnly);
    setMulticolor(userSettings.multiHighlight);
    setEnabledHighlights(userSettings.enabledHighlights);
    setSettingsApplied(true);
  }, [userSettings, settingsApplied]);

  // Highlight toolbar state (hooks must live above early returns)
  const [hlBar, setHlBar] = useState<{ x: number; y: number; placement: "above" | "below" } | null>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const savedSelectionRef = useRef<{ key: string; start: number; end: number } | null>(null);
  const savedTextRef = useRef("");
  const selectionTimerRef = useRef<number | null>(null);
  const handleSelectionRef = useRef<(opts?: { isTouch?: boolean; target?: EventTarget | null; keepEmpty?: boolean; suppressToolbar?: boolean }) => void>(() => {});

  // Cross-device selection: native-only, one code path.
  // Desktop uses pointerup + selectionchange. iOS/iPadOS/Android long-press
  // creates a native selection which fires the same events. We hide the native
  // callout via CSS (-webkit-touch-callout:none) and render our own toolbar.
  useEffect(() => {
    const isCoarse = typeof window !== "undefined" && window.matchMedia?.("(hover: none) and (pointer: coarse)").matches;

    const schedule = (isTouch: boolean, suppressToolbar = false) => {
      if (selectionTimerRef.current != null) window.clearTimeout(selectionTimerRef.current);
      selectionTimerRef.current = window.setTimeout(() => {
        handleSelectionRef.current({ isTouch, keepEmpty: true, suppressToolbar });
      }, isTouch ? 120 : 30);
    };

    const onPointerUp = (e: PointerEvent) => {
      const isTouch = e.pointerType === "touch" || e.pointerType === "pen";
      // Slight delay lets the browser finalize the selection first.
      schedule(isTouch);
    };

    const onSelectionChange = () => {
      schedule(isCoarse, true);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.shiftKey || e.key === "Shift" || e.key.startsWith("Arrow")) {
        handleSelectionRef.current({ isTouch: false, target: e.target });
      }
    };

    const onScroll = () => {
      // Re-anchor the toolbar to the (possibly moved) selection rect.
      handleSelectionRef.current({ isTouch: isCoarse, keepEmpty: true });
    };

    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("keyup", onKeyUp);
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => {
      if (selectionTimerRef.current != null) window.clearTimeout(selectionTimerRef.current);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, []);

  const themeStyles = theme === "dark"
    ? { pageBg: "#0f172a", sideBg: "#1e293b", text: "#e5e7eb", cardBg: "#1e293b", border: "#334155" }
    : theme === "sepia"
    ? { pageBg: "#f4ecd8", sideBg: "#ebe0c4", text: "#3b2f1e", cardBg: "#faf3e0", border: "#d6c9a8" }
    : { pageBg: PAGE_BG, sideBg: SIDE_BG, text: TEXT, cardBg: "#ffffff", border: "#d1d5db" };

  const question = data?.questions[idx];
  const mediaToken = useMediaToken(data?.qbankId);
  const allMediaItems = getQuestionMedia(question, data?.qbankId ?? 1)
    .map((item) => ({ ...item, url: withMediaToken(item.url, mediaToken) }));
  const answers = question ? data!.answersByQ[question.id] ?? [] : [];
  const priorAttempt = question ? data!.attemptsByQ[question.id] : undefined;
  const isPractice = data?.test.mode === "practice";
  const isRealExam = data?.test.mode === "test";
  const isReview = !!data?.test.done;
  const total = data?.questions.length ?? 0;

  // Clamp restored idx once data loads (in case it exceeds range)
  useEffect(() => {
    if (total > 0 && idx > total - 1) setIdx(total - 1);
  }, [total]);

  useEffect(() => {
    setSelected(priorAttempt?.selected_answer ?? null);
    setSubmitted(!!priorAttempt);
    // Persist per-question start time so refresh doesn't reset the timer
    let start = Date.now();
    const qid = question?.id;
    if (typeof window !== "undefined" && qid != null && !priorAttempt) {
      const key = `qStartedAt:${id}:${qid}`;
      const raw = window.localStorage.getItem(key);
      const n = raw ? Number(raw) : NaN;
      if (Number.isFinite(n) && n > 0) start = n;
      else window.localStorage.setItem(key, String(start));
    }
    setStartedAt(start);
    setElapsed(Math.max(0, Math.round((Date.now() - start) / 1000)));
    setSubmittedSecs(typeof (priorAttempt as any)?.time_seconds === "number" ? (priorAttempt as any).time_seconds : null);
    setMediaModalIndex(null);
    setStruck(new Set());
  }, [idx, question?.id, priorAttempt?.selected_answer, id]);

  useEffect(() => {
    if (submitted) return;
    const t = setInterval(() => {
      if (userSettings.stopTimerOnBlur && typeof document !== "undefined" && document.hidden) return;
      setElapsed(Math.round((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [submitted, startedAt, userSettings.stopTimerOnBlur]);

  useEffect(() => {
    const t = setInterval(() => {
      if (userSettings.stopTimerOnBlur && typeof document !== "undefined" && document.hidden) return;
      setBlockElapsed(Math.round((Date.now() - blockStartedAt) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [blockStartedAt, userSettings.stopTimerOnBlur]);

  // Initialize / persist timedBase whenever timedMode turns on without one.
  // Base is anchored to blockStartedAt with the full allotment on first setup,
  // so a fresh test behaves identically to before.
  useEffect(() => {
    if (!timedMode || total <= 0) return;
    if (timedBase) return;
    const base = { startedAt: blockStartedAt, allowed: total * 90 };
    setTimedBase(base);
    try { window.localStorage.setItem(`timedBase:${id}`, JSON.stringify(base)); } catch {}
  }, [timedMode, total, timedBase, blockStartedAt, id]);

  const handleToggleTimed = (next: boolean) => {
    setTimedMode(next);
    if (!next) return;
    // Turning Timed ON mid-block: recompute remaining as (unsolved * 90s)
    // starting from now, so the countdown reflects work left — not the
    // original full-block allotment.
    const answeredCount = data
      ? data.questions.reduce((n, q) => n + (data.attemptsByQ[q.id] ? 1 : 0), 0)
      : 0;
    const unsolved = Math.max(0, total - answeredCount);
    const base = { startedAt: Date.now(), allowed: unsolved * 90 };
    setTimedBase(base);
    try { window.localStorage.setItem(`timedBase:${id}`, JSON.stringify(base)); } catch {}
  };

  // Auto night mode — switch to dark theme within the user's scheduled window
  useEffect(() => {
    if (!userSettings.autoNightMode) return;
    const h = new Date().getHours();
    const s = userSettings.nightStart, e = userSettings.nightEnd;
    const inWindow = s === e ? false : s < e ? (h >= s && h < e) : (h >= s || h < e);
    if (inWindow) setTheme("dark");
  }, [userSettings.autoNightMode, userSettings.nightStart, userSettings.nightEnd, question?.id]);


  // Initialize tutor/exam + timed toggles from the test record once per test
  useEffect(() => {
    if (!data?.test) return;
    if (modeInitFor === data.test.id) return;
    setTutorMode(data.test.mode === "practice");
    setTimedMode(!!(data.test as { timed?: boolean }).timed);
    setModeInitFor(data.test.id);
  }, [data?.test?.id, data?.test?.mode, modeInitFor]);




  // Compute saved highlights synchronously per question so the very first
  // render after navigation already has the correct HTML — otherwise the
  // previous question's highlighted snapshot leaks into the next question
  // because HighlightableHtml's layout effect reseeds innerHTML BEFORE any
  // parent effect can reset state.
  const savedHighlights = useMemo<Record<string, string>>(() => {
    if (!question) return {};
    try {
      const raw = localStorage.getItem(`qbank-hl-${question.id}`);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch { return {}; }
  }, [question?.id, submitted]);

  // Click-to-open exhibit modal for any image in the question/explanation.
  // Also decorates inline .mp4/.mp3/.wav anchors and opens them in the
  // Fighter-style Exhibit Display modal.
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
    const detachAnchors = attachMediaAnchorHandlers(root, (hit) => {
      setAnchorExhibit({ kind: hit.kind, src: hit.src });
    });
    return () => {
      root.removeEventListener("click", onClick);
      detachAnchors();
    };
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
    if (!question) return;
    const secs = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
    setSubmitted(true);
    setSubmittedSecs(secs);
    try { window.localStorage.removeItem(`qStartedAt:${id}:${question.id}`); } catch {}
    if (selected == null) return;
    const isCorrect = question.correct_answer === selected;
    // Optimistic: mark submitted immediately, update cache, fire-and-forget the server call
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
      try { window.localStorage.removeItem(`qStartedAt:${id}:${question.id}`); } catch {}
      // Fire-and-forget so navigation is instant
      subFn({ data: { testId, questionId: question.id, selectedIndex: selected, timeSeconds: secs } })
        .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to submit"));
    }
    if (idx === total - 1) {
      const ok = await confirm({
        title: "End this block?",
        description: "Your answers will be submitted and the block will be scored. This cannot be undone.",
        confirmLabel: "End Block",
        tone: "danger",
      });
      if (ok) await finish();
    } else {
      goToQuestion(idx + 1);
    }
  };


  const bookmark = async () => {
    if (!question) return;
    try {
      const result = await bmFn({ data: { questionId: question.id, qbankId: data?.qbankId ?? 1 } });
      toast(result.bookmarked ? "Question flagged" : "Flag removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update flag");
      return;
    }
    qc.invalidateQueries({ queryKey: ["test", testId] });
  };

  const finish = async () => {
    if (userSettings.confirmOmission && !isReview && data) {
      const answeredCount = data.questions.reduce((n, q) => n + (data.attemptsByQ[q.id] ? 1 : 0), 0);
      const omitted = total - answeredCount;
      if (omitted > 0) {
        const ok = await confirm({
          title: `${omitted} question${omitted === 1 ? "" : "s"} omitted`,
          description: `You have not answered ${omitted} of ${total} question${total === 1 ? "" : "s"}. End the block anyway?`,
          confirmLabel: "End Block",
          tone: "danger",
        });
        if (!ok) return;
      }
    }
    await finFn({ data: { testId } });
    try {
      window.localStorage.removeItem(`test:${id}:idx`);
      window.localStorage.removeItem(`blockStartedAt:${id}`);
      window.localStorage.removeItem(`timedBase:${id}`);
    } catch {}
    qc.invalidateQueries({ queryKey: ["test", testId] });
    nav({ to: "/test-results/$id", params: { id } });
  };

  // Timed-mode remaining seconds, based on the persisted timedBase.
  const timedRemaining = timedBase
    ? Math.max(0, timedBase.allowed - Math.round((Date.now() - timedBase.startedAt) / 1000))
    : total * 90;

  // Auto-end the block when timed countdown hits zero — applies to real exam
  // mode AND to practice/tutor blocks running with the Timed toggle on (e.g.
  // pseudo-exam). The user shouldn't have to click Submit manually.
  const autoEndedRef = useRef(false);
  const autoWarnedRef = useRef(false);
  const WARN_SECONDS = 10;
  // Reset guards if the user switches timed mode off or the base changes.
  useEffect(() => {
    if (!timedMode) {
      autoEndedRef.current = false;
      autoWarnedRef.current = false;
    }
  }, [timedMode, timedBase?.startedAt, timedBase?.allowed]);

  // Schedule the "time's up in 10s" warning and the auto-submit at absolute
  // moments derived from timedBase, so a throttled tab or a skipped interval
  // tick can never miss the warning window.
  useEffect(() => {
    if (isReview || !timedMode || !data || total <= 0 || !timedBase) return;
    const endsAt = timedBase.startedAt + timedBase.allowed * 1000;
    const now = Date.now();
    const warnDelay = endsAt - WARN_SECONDS * 1000 - now;
    const endDelay = endsAt - now;

    const timers: ReturnType<typeof setTimeout>[] = [];
    const showWarn = () => {
      if (autoWarnedRef.current || autoEndedRef.current) return;
      autoWarnedRef.current = true;
      toast.warning(`Time's up in ${WARN_SECONDS} seconds — your block will auto-submit.`, {
        duration: WARN_SECONDS * 1000,
      });
    };
    const doEnd = () => {
      if (autoEndedRef.current) return;
      autoEndedRef.current = true;
      toast.message("Time's up — submitting your block.");
      finish();
    };

    if (warnDelay <= 0 && endDelay > 0) showWarn();
    else if (warnDelay > 0) timers.push(setTimeout(showWarn, warnDelay));

    if (endDelay <= 0) doEnd();
    else timers.push(setTimeout(doEnd, endDelay));

    return () => { timers.forEach(clearTimeout); };
  }, [timedMode, isReview, data, total, timedBase?.startedAt, timedBase?.allowed]);


  const goToQuestion = (nextIndex: number) => {
    const bounded = Math.max(0, Math.min(total - 1, nextIndex));
    setIdx(bounded);
    try { window.localStorage.setItem(`test:${id}:idx`, String(bounded)); } catch {}
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

  if (isLoading || !data || !question) return <div className="p-8"><Loader label="Loading question…" /></div>;
  if (data.test.done && !isReview) return <Navigate to="/test-results/$id" params={{ id }} replace />;

  const correctIdx = question.correct_answer;
  const answered = submitted || selected != null;
  const showAnswers = isReview || (submitted && isPractice && tutorMode);
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

  const HL_COLORS = ["#ffeb3b", "#4ade80", "#38bdf8", "#f472b6", "#fb923c", "#c084fc", ...(userSettings.customHighlights ?? [])];

  const persistHighlights = () => {
    if (!question || !contentRef.current) return;
    const snap: Record<string, string> = {};
    contentRef.current.querySelectorAll<HTMLElement>("[data-hlkey]").forEach(el => {
      if (el.querySelector("mark.qbank-hl")) snap[el.dataset.hlkey!] = el.innerHTML;
    });
    try { localStorage.setItem(`qbank-hl-${question.id}`, JSON.stringify(snap)); } catch {}
    // Intentionally do NOT setHighlightHtml here — the DOM is already mutated
    // in place by the highlighter. Updating state would change the __html seed,
    // which would cause HighlightableHtml to reseed and remount inline media
    // (causing an image blink) and would also fight ongoing highlight actions.
    // State is re-hydrated from localStorage on question change.
  };

  const htmlFor = (key: string, html: string, deferMedia = false) => rewriteMedia(savedHighlights[key] ?? html, { deferMedia, qbankId: data?.qbankId ?? 1, mediaToken });
  const answerHtmlFor = (key: string, letter: string, html: string) => (
    rewriteMedia(savedHighlights[key] ?? `<span class="font-normal">${letter}. </span>${html}`, { qbankId: data?.qbankId ?? 1, mediaToken })
  );

  const getHighlightRoot = (node: Node) => {
    const el = (node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement) as Element | null;
    return el?.closest<HTMLElement>("[data-hlkey]") ?? null;
  };

  const getRangeBox = (range: Range) => {
    const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
    if (rects.length === 0) {
      const rect = range.getBoundingClientRect();
      return rect.width > 0 || rect.height > 0 ? rect : null;
    }
    const top = Math.min(...rects.map((rect) => rect.top));
    const left = Math.min(...rects.map((rect) => rect.left));
    const right = Math.max(...rects.map((rect) => rect.right));
    const bottom = Math.max(...rects.map((rect) => rect.bottom));
    return { top, left, right, bottom, width: right - left, height: bottom - top };
  };

  const selectionInsideAnswer = (el: HTMLElement) => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return false;
    const range = sel.getRangeAt(0);
    return el.contains(range.commonAncestorContainer) || el.contains(range.startContainer) || el.contains(range.endContainer);
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
    const liveSel = window.getSelection();
    const liveRange = liveSel && liveSel.rangeCount > 0 && !liveSel.isCollapsed ? liveSel.getRangeAt(0) : null;
    if (!snap || !contentRef.current) return savedRangeRef.current ?? liveRange;
    const root = contentRef.current.querySelector<HTMLElement>(`[data-hlkey="${CSS.escape(snap.key)}"]`);
    if (!root) return savedRangeRef.current ?? liveRange;
    return rangeFromOffsets(root, snap.start, snap.end) ?? savedRangeRef.current ?? liveRange;
  };

  const handleSelection = (opts?: { isTouch?: boolean; target?: EventTarget | null; keepEmpty?: boolean; suppressToolbar?: boolean }) => {
    const target = opts?.target instanceof Element ? opts.target : null;
    if (target?.closest("[data-hl-toolbar]")) return;
    const isTouch = !!opts?.isTouch;
    const run = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        if (!opts?.keepEmpty) {
          setHlBar(null);
          savedTextRef.current = "";
          savedSelectionRef.current = null;
          savedRangeRef.current = null;
        }
        return;
      }
      const range = sel.getRangeAt(0);
      const startRoot = getHighlightRoot(range.startContainer);
      const endRoot = getHighlightRoot(range.endContainer);
      if (!startRoot || !endRoot || !contentRef.current?.contains(startRoot) || !contentRef.current?.contains(endRoot)) {
        if (!opts?.keepEmpty) {
          setHlBar(null);
          savedSelectionRef.current = null;
          savedTextRef.current = "";
          savedRangeRef.current = null;
        }
        return;
      }
      if (startRoot === endRoot) {
        const key = startRoot.dataset.hlkey;
        if (key) {
          const offsets = getSelectionOffsets(startRoot, range);
          savedSelectionRef.current = { key, ...offsets };
        }
      } else {
        savedSelectionRef.current = null;
      }
      savedRangeRef.current = range.cloneRange();
      savedTextRef.current = range.toString();
      if (opts?.suppressToolbar) return;
      // Multi-highlight OFF: auto-apply the default yellow highlight on release,
      // skipping the color picker entirely.
      if (!multicolor) {
        wrapSelection(HL_COLORS[0]);
        return;
      }
      const rect = getRangeBox(range);
      if (!rect) { setHlBar(null); return; }
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const barHalfWidth = Math.min(180, (vw - 16) / 2);
      const barHeight = 48;
      // iOS/iPadOS shows a native selection edit menu (Copy/Look Up/Translate)
      // that we cannot suppress. It anchors above the selection by default, so
      // on iOS we prefer BELOW the selection and add extra padding to clear
      // the native callout (~48px). On other platforms, prefer above as before.
      const ua = navigator.userAgent || "";
      const isIOS = /iPad|iPhone|iPod/.test(ua) || (/(Macintosh)/.test(ua) && "ontouchend" in document);
      const nativeCalloutGap = isIOS ? 52 : 0;
      const spaceAbove = rect.top;
      const spaceBelow = vh - rect.bottom;
      let placement: "above" | "below";
      if (isIOS) {
        placement = spaceBelow >= barHeight + nativeCalloutGap + 12 ? "below" : "above";
      } else {
        placement = spaceAbove >= barHeight + 12 ? "above" : "below";
      }
      const x = Math.max(barHalfWidth + 8, Math.min(vw - barHalfWidth - 8, rect.left + rect.width / 2));
      const y = placement === "above"
        ? Math.max(barHeight + 8, rect.top - 6 - nativeCalloutGap)
        : Math.min(vh - 12, rect.bottom + 6 + nativeCalloutGap);
      setHlBar({ x, y, placement });
    };
    if (isTouch) window.setTimeout(run, 80); else run();
  };

  // Keep the ref pointing at the latest handleSelection so listeners registered
  // above the early return always call the current closure.
  handleSelectionRef.current = handleSelection;



  const textOffsetIn = (root: HTMLElement, container: Node, offset: number) => {
    try {
      const before = document.createRange();
      before.selectNodeContents(root);
      before.setEnd(container, offset);
      return before.toString().length;
    } catch {
      return null;
    }
  };

  const wrapOffsetsWithin = (root: HTMLElement, start: number, end: number, styler: (m: HTMLElement) => void) => {
    const from = Math.max(0, Math.min(start, end));
    const to = Math.max(from, Math.max(start, end));
    if (to <= from) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const slices: Array<{ node: Text; start: number; end: number }> = [];
    let pos = 0;
    let n = walker.nextNode() as Text | null;

    while (n) {
      const len = n.textContent?.length ?? 0;
      const next = pos + len;
      const localStart = Math.max(0, from - pos);
      const localEnd = Math.min(len, to - pos);
      if (len > 0 && next > from && pos < to && localEnd > localStart) {
        slices.push({ node: n, start: localStart, end: localEnd });
      }
      pos = next;
      n = walker.nextNode() as Text | null;
    }

    // Apply from the end backward so splitting/wrapping one text node cannot
    // shift the offsets of text nodes that are still waiting to be wrapped.
    for (const sliceInfo of slices.reverse()) {
      const slice = document.createRange();
      slice.setStart(sliceInfo.node, sliceInfo.start);
      slice.setEnd(sliceInfo.node, sliceInfo.end);
      const mark = document.createElement("mark");
      mark.className = "qbank-hl";
      mark.style.color = "inherit";
      mark.style.backgroundColor = "transparent";
      styler(mark);
      try { slice.surroundContents(mark); } catch { /* skip */ }
    }
  };

  const wrapSelection = (color: string, opts?: { strike?: boolean }) => {
    const range = restoreSavedRange();
    if (!range || range.collapsed) return;
    const startRoot = getHighlightRoot(range.startContainer);
    const container = contentRef.current;
    if (!startRoot || !container) return;
    try {
      highlightRange(startRoot, range, { color, strike: !!opts?.strike });
    } catch (err) {
      console.warn("highlight failed", err);
    }
    window.getSelection()?.removeAllRanges();
    savedRangeRef.current = null;
    savedSelectionRef.current = null;
    savedTextRef.current = "";
    setHlBar(null);
    persistHighlights();
  };


  const applyColor = (c: string) => {
    wrapSelection(c);
    setActiveHighlight(c);
  };
  const applyStrike = () => wrapSelection("#ef4444", { strike: true });
  const eraseHighlight = () => {
    const range = restoreSavedRange();
    if (!range) return;
    const anchor = range.commonAncestorContainer;
    const el = (anchor.nodeType === 1 ? anchor as Element : anchor.parentElement) as Element | null;
    const root = el?.closest<HTMLElement>("[data-hlkey]");
    if (root) unwrapHighlightsInRange(root, range);
    window.getSelection()?.removeAllRanges();
    savedRangeRef.current = null;
    savedSelectionRef.current = null;
    savedTextRef.current = "";
    setHlBar(null);
    persistHighlights();
  };

  const copySel = async () => {
    const liveSel = window.getSelection()?.toString() ?? "";
    const range = savedRangeRef.current;
    const text = (liveSel || savedTextRef.current || range?.toString() || "").trim();
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
    <div ref={rootRef} className="flex flex-col h-screen" style={{ background: themeStyles.pageBg, color: themeStyles.text }}>
      {hlBar && (
        <div
          data-hl-toolbar
          data-placement={hlBar.placement}
          className="qbank-hl-toolbar"
          style={{ left: hlBar.x, top: hlBar.y }}
          onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onPointerUp={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onTouchStart={(e) => { e.stopPropagation(); }}
        >
          {(multicolor ? HL_COLORS.filter(c => enabledHighlights[c]) : [HL_COLORS[0]]).map(c => (
            <button
              key={c}
              type="button"
              onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); applyColor(c); }}
              title="Highlight"
              aria-label={`Highlight ${c}`}
            >
              <span className="swatch" style={{ background: c }} />
            </button>
          ))}
          <button
            type="button"
            onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); applyStrike(); }}
            title="Strikethrough"
            aria-label="Strikethrough"
          >
            <span style={{ textDecoration: "line-through", textDecorationColor: "#ef4444", fontWeight: 700 }}>S</span>
          </button>
          <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.2)", margin: "0 4px" }} />
          <button
            type="button"
            onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); eraseHighlight(); }}
            title="Remove highlight"
            aria-label="Remove highlight"
          >
            <Eraser className="h-4 w-4" />
          </button>
          <button
            type="button"
            onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); copySel(); }}
            title="Copy"
            aria-label="Copy"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>
      )}
      {/* Top nav */}
      <div className={`qbank-nav-scroll flex items-center justify-between gap-2 px-2 sm:px-3 text-white ${isRealExam && !isReview ? "py-0.5" : "py-1.5"}`} style={{ background: NAV_BG }}>
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {!(isRealExam && !isReview) && (
            <button className="p-1 hover:bg-white/10 rounded shrink-0" onClick={() => setSidebarOpen(v => !v)} title={sidebarOpen ? "Hide question list" : "Show question list"}>
              <span className="block w-5 h-0.5 bg-white mb-1" />
              <span className="block w-5 h-0.5 bg-white mb-1" />
              <span className="block w-5 h-0.5 bg-white" />
            </button>
          )}
          <div className="text-[11px] sm:text-[12px] leading-tight shrink-0">
            <div><span className="text-white/70">Item</span> <span className="font-semibold">{idx + 1} of {total}</span></div>
            {(isRealExam && !isReview)
              ? <div><span className="text-white/70">Block</span> <span className="font-semibold">1 of 1</span></div>
              : <div className="hidden sm:block text-[11px] text-white/75">Question Id: {question.id}</div>}
          </div>
          <button
            onClick={bookmark}
            className="inline-flex items-center gap-1.5 p-1 rounded hover:bg-white/10 shrink-0"
            title={isBookmarked ? "Remove flag" : "Flag question"}
          >
            {(isRealExam && !isReview) && (
              <span className={`inline-flex items-center justify-center w-2.5 h-2.5 border border-white/80 ${isBookmarked ? "bg-red-600" : "bg-transparent"}`}>
                {isBookmarked && (
                  <svg viewBox="0 0 16 16" className="w-2 h-2 text-white" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 8.5 6.5 12 13 4.5" />
                  </svg>
                )}
              </span>
            )}
            <img src={markFlagIcon.url} alt="Flag" className={`h-5 w-5 object-contain ${isBookmarked ? "" : "opacity-90"}`} />
            <span className="hidden sm:inline text-[11px] font-semibold text-white">Mark</span>
          </button>



        </div>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <TopBtn imgSrc={navArrowIcon.url} imgFlip label="Previous" onClick={() => goToQuestion(idx - 1)} />
          <TopBtn imgSrc={navArrowIcon.url} label="Next" onClick={() => goToQuestion(idx + 1)} />
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {(!isRealExam || isReview) && <TopBtn icon={Maximize2} label="Full Screen" onClick={goFullscreen} />}
          {mediaItems.length > 0 && (!isRealExam || isReview) && <TopBtn icon={ImageIcon} label="Media" onClick={() => setMediaModalIndex(0)} />}
          <TopBtn imgSrc={labValuesIcon.url} label="Lab Values" onClick={() => setShowLabValues(true)} />
          <TopBtn imgSrc={notesIcon.url} label="Notes" onClick={() => setShowNotes(true)} />
          {false && <TopBtn icon={Notebook} label="Notebook" onClick={notImpl("Notebook")} />}
          
          <TopBtn imgSrc={calculatorIcon.url} label="Calculator" onClick={() => setShowCalc(v => !v)} />
          {isRealExam && !isReview && <TopBtn imgSrc={reverseColorIcon.url} label="Reverse Color" onClick={() => setTheme(t => t === "dark" ? "light" : "dark")} />}
          {isRealExam && !isReview && (
            <TopBtn imgSrc={textZoomIcon.url} imgClass="h-10 w-10 object-contain" label="Text Zoom" onClick={() => setFontSize(s => s >= 20 ? 14 : s + 2)} />
          )}
          {(!isRealExam || isReview) && <TopBtn icon={Settings} label="Settings" onClick={() => setShowSettings(v => !v)} />}
        </div>
      </div>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left navigator */}
        {sidebarOpen && (
        <aside
          className="w-14 md:w-24 shrink-0 overflow-auto border-r"
          style={{ background: themeStyles.sideBg, borderColor: themeStyles.border }}
        >

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
                  if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
                    setSidebarOpen(false);
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  goToQuestion(i);
                }}
                onMouseUp={(e) => e.stopPropagation()}
                aria-label={`Go to question ${i + 1}`}
                className={`relative z-10 w-full min-h-7 flex items-center gap-1 px-2 py-1 text-xs border-b cursor-pointer hover:bg-black/10 ${active ? "font-semibold" : ""}`}
                style={{ borderColor: themeStyles.border, color: themeStyles.text, background: active ? themeStyles.cardBg : "transparent" }}
              >
                {status === "correct" && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
                {status === "wrong" && <span className="text-red-600 font-bold">✕</span>}
                {status === "attempted" && <span className="w-3.5" />}
                {status === "none" && <span className="inline-block h-2 w-2 rounded-full bg-slate-700/60 scale-[0.7]" />}
                <span>{i + 1}</span>
                {data.bookmarkedIds.has(q.id) && <img src={markFlagIcon.url} alt="Flagged" className="h-3.5 w-3.5 ml-auto object-contain" />}
              </button>
            );
          })}
        </aside>
        )}


        {/* Content */}
        <div className="flex-1 overflow-auto" ref={contentRef}>
          <div className={`w-full mx-0 px-3 sm:px-6 py-3 qbank-theme-${theme} ${largeImages ? "qbank-large-images" : ""} ${(userSettings.splitExplanations && showAnswers && !!question.explanation) ? "qbank-split-mode" : ""} ${(isRealExam && !isReview) ? "qbank-exam-stem" : ""}`} style={{ fontSize, fontWeight, color: themeStyles.text }}>
            {(() => null)()}
            {(() => null)()}


            
            <HighlightableHtml seedKey={`q-${question.id}`} data-hlkey="q" className="qbank-html qbank-light" html={htmlFor("q", question.question, true)} />

            {mediaItems.length > 0 && (
              <div className="mt-3 flex flex-wrap items-start justify-center gap-3">
                {mediaItems.map((item, mediaIndex) => {
                  const src = item.url;
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

            <div className="mt-3 inline-block rounded border px-4 py-2" style={{ borderColor: (isRealExam && !isReview && !showAnswers) ? (theme === "dark" ? "#475569" : "#c9c9c9") : (theme === "dark" ? "#475569" : "#5b8fc9"), borderWidth: (isRealExam && !isReview && !showAnswers) ? 1 : 2, background: theme === "dark" ? "#1e293b" : theme === "sepia" ? "#f4ecd8" : "#ffffff", color: themeStyles.text }}>
              {answers.map((a, i) => {
                const letter = String.fromCharCode(65 + i);
                const isThisCorrect = showAnswers && i === correctIdx;
                const isThisWrong = showAnswers && selected === i && i !== correctIdx;
                // deterministic pseudo peer % per answer
                const pct: number | null = submitted
                  ? (i === correctIdx ? 55 + ((question.id * 7) % 25) : 2 + ((question.id * 3 + i * 11) % 18))
                  : null;
                const isSelected = selected === i;
                const isStruck = struck.has(i);
                const toggleStruck = () => {
                  setStruck(prev => {
                    const next = new Set(prev);
                    if (next.has(i)) next.delete(i); else next.add(i);
                    return next;
                  });
                  if (selected === i) setSelected(null);
                };
                return (
                  <div
                    role="radio"
                    tabIndex={isReview || (submitted && showAnswers) ? -1 : 0}
                    aria-checked={isSelected}
                    aria-disabled={isReview || (submitted && showAnswers)}
                    key={a.id}
                    onClick={(e) => {
                      if (isReview || (submitted && showAnswers) || selectionInsideAnswer(e.currentTarget)) return;
                      if (isStruck) { toggleStruck(); return; }
                      setSelected(i);
                    }}
                    onKeyDown={(e) => {
                      if (isReview || (submitted && showAnswers)) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        if (isStruck) toggleStruck(); else setSelected(i);
                      }
                    }}
                    onContextMenu={(e) => {
                      if (window.matchMedia("(hover: none) and (pointer: coarse)").matches || selectionInsideAnswer(e.currentTarget)) return;
                      e.preventDefault();
                      if (isReview || (submitted && showAnswers)) return;
                      toggleStruck();
                    }}
                    className={`qbank-answer-choice w-full text-left flex items-center gap-2 py-1.5 text-[15px] ${isReview || (submitted && showAnswers) ? "cursor-text" : "cursor-pointer"}`}
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
                    <span className="flex-1 min-w-0">
                      <span
                        data-hlkey={`a${i}`}
                        className="qbank-html qbank-light inline"
                        style={isStruck ? { textDecoration: "line-through", textDecorationThickness: "2px", opacity: 0.55 } : undefined}
                        dangerouslySetInnerHTML={{ __html: answerHtmlFor(`a${i}`, letter, a.answer_text) }}
                      />
                      {submitted && pct != null && !userSettings.hidePercentages && <span className="text-gray-600 ml-1">({pct}%)</span>}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Primary action button — directly below answer choices */}
            {!isReview && (
              <div className={`mt-4 ${isRealExam ? "flex justify-center max-w-[520px]" : ""}`}>
                {!tutorMode ? (
                  <button
                    onClick={proceedExam}
                    className="px-4 py-1.5 rounded-sm text-white text-[12px] font-semibold disabled:opacity-40"
                    style={{ background: NAV_BG }}
                  >
                    {idx === total - 1 ? "End Block" : "Proceed to Next Item"}
                  </button>
                ) : !submitted ? (
                  <button
                    onClick={submit}
                    className="px-6 py-2 rounded text-white text-sm font-semibold uppercase tracking-wide"
                    style={{ background: NAV_BG }}
                  >
                    Submit
                  </button>
                ) : null}
              </div>
            )}



            {/* Answered banner — placed just above the explanation */}
            {submitted && showAnswers && (
              <div
                className={`mt-4 rounded-md border-l-4 p-3 flex items-start justify-between gap-6 ${isCorrect ? "border-green-500" : "border-red-500"}`}
                style={{
                  background: theme === "dark"
                    ? (isCorrect ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)")
                    : (isCorrect ? "#f0fdf4" : "#fef2f2"),
                  color: themeStyles.text,
                }}
              >
                <div>
                  <div className={`font-semibold ${isCorrect ? "text-green-500" : "text-red-500"}`}>
                    {isCorrect ? "Answered Correctly" : "Answered Incorrectly"}
                  </div>
                  <div className="text-xs mt-1 opacity-70">The correct answer is:</div>
                  <div className="font-semibold mt-1" style={{ color: themeStyles.text }} dangerouslySetInnerHTML={{ __html: `${correctLetter}. ${rewriteMedia(correctText, { qbankId: data?.qbankId ?? 1, mediaToken })}` }} />
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-full flex items-center justify-center" style={{ background: theme === "dark" ? "rgba(59,130,246,0.2)" : "#dbeafe" }}>
                      <Clock className="h-4 w-4" style={{ color: theme === "dark" ? "#60a5fa" : "#1d4ed8" }} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{(() => {
                        const t = (priorAttempt as any)?.time_seconds;
                        const s = typeof t === "number" ? t : (submittedSecs ?? elapsed);
                        return `${Math.floor(s / 60)}min: ${s % 60}sec`;
                      })()}</div>
                      <div className="text-[11px] opacity-60">Time Taken</div>
                    </div>
                  </div>
                  {!userSettings.hidePercentages && (
                    <div className="flex items-center gap-2">
                      <div className="h-9 w-9 rounded-full flex items-center justify-center" style={{ background: theme === "dark" ? "rgba(34,197,94,0.2)" : "#dcfce7" }}>
                        <CheckCircle2 className="h-4 w-4" style={{ color: theme === "dark" ? "#4ade80" : "#15803d" }} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{peerPct}%</div>
                        <div className="text-[11px] opacity-60">Answered Correctly</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            )}

            {showAnswers && question.explanation && (
              <div className="mt-4 qbank-split-expl">
              <div className="border-b" style={{ borderColor: themeStyles.border }}>
                  <div
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-t-md font-semibold text-sm relative -mb-px"
                    style={{ background: themeStyles.cardBg, color: theme === "dark" ? "#60a5fa" : "#1e3a8a", boxShadow: `inset 0 -3px 0 ${theme === "dark" ? "#60a5fa" : "#1e3a8a"}` }}
                  >
                    <FileText className="h-4 w-4" /> Explanation
                  </div>
                </div>
                <div
                  className="pt-3 pb-2"
                  style={{
                    background: transparentExpl ? "transparent" : themeStyles.cardBg,
                    border: transparentExpl ? "none" : `1px solid ${themeStyles.border}`,
                    borderRadius: transparentExpl ? 0 : 8,
                    padding: transparentExpl ? "12px 0" : "16px 18px",
                    fontSize: `${fontSize}px`,
                    fontWeight,
                    lineHeight: 1.7,
                    color: themeStyles.text,
                    WebkitFontSmoothing: "antialiased",
                    MozOsxFontSmoothing: "grayscale",
                    textRendering: "optimizeLegibility",
                  }}
                >
                  <HighlightableHtml
                    seedKey={`e-${question.id}`}
                    data-hlkey="e"
                    className="qbank-html qbank-light qbank-explanation"
                    html={htmlFor("e", question.explanation, true)}
                  />
                </div>

              </div>
            )}

            <div className="mt-6 flex justify-end items-center">
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
                  onClick={async () => {
                    if (idx === total - 1) {
                      const ok = await confirm({
                        title: "End this test?",
                        description: "Your answers will be submitted and the test will be scored. This cannot be undone.",
                        confirmLabel: "End Test",
                        tone: "danger",
                      });
                      if (ok) finish();
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
        const blockSec = timedMode ? timedRemaining : blockElapsed;
        const bh = String(Math.floor(blockSec / 3600)).padStart(2, "0");
        const bm = String(Math.floor((blockSec % 3600) / 60)).padStart(2, "0");
        const bs = String(blockSec % 60).padStart(2, "0");

        const examUI = isRealExam && !isReview;
        if (examUI) {
          return (
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 sm:px-4 py-1.5 text-white text-xs" style={{ background: NAV_BG }}>
              <div className="font-semibold tracking-wide tabular-nums">
                {`Block Time Remaining:  ${bh}:${bm}:${bs}`}
              </div>
              <button
                type="button"
                onClick={() => setBreakModal("suspend")}
                title="Unauthorized Break"
                className="flex flex-col items-center leading-none text-white"
              >
                <span className="flex items-center justify-center h-6 w-6">
                  <img src={lockIconImg.url} alt="" className="h-6 w-6 object-contain" />
                </span>
                <span className="text-[10px] font-semibold mt-0.5">Lock</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  const ok = await confirm({
                    title: "End this block?",
                    description: "Your answers will be submitted and the block will be scored. This cannot be undone.",
                    confirmLabel: "End Block",
                    tone: "danger",
                  });
                  if (ok) finish();
                }}
                className="inline-flex items-center gap-2 rounded-sm hover:bg-white/10 px-2 py-1 text-white text-xs font-semibold"
              >
                <img src={endBlockIcon.url} alt="" className="h-6 w-6 object-contain" />
                End Block
              </button>
            </div>
          );
        }
        return (
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-1 sm:px-4 py-1 text-white text-xs leading-tight" style={{ background: NAV_BG }}>
            <div className="shrink-0 font-semibold tracking-wide tabular-nums">
              {isReview || !userSettings.showTimer ? "" : `Block Time: ${bh}:${bm}:${bs}`}
            </div>
            <div className="shrink-0 font-semibold tracking-wide hidden md:flex items-center gap-3">
              <span>StepFighter</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {!isReview && (
                <>
                  <ToggleSwitch label="Timed" checked={timedMode} onChange={handleToggleTimed} />
                  <ToggleSwitch label="Tutor" rightLabel="Exam" checked={!tutorMode} onChange={(v) => setTutorMode(!v)} />
                  <div className="w-px h-6 bg-white/20 mx-1 hidden sm:block" />
                </>
              )}


              
              <TopBtn imgSrc={medicalLibraryIcon.url} label="Medical Library" onClick={notImpl("Medical Library")} />
              <TopBtn imgSrc={flashcardIcon.url} label="Flashcards" onClick={() => setShowFlashcards(true)} />
              <TopBtn icon={MessageSquare} label="Feedback" onClick={() => setShowFeedback(true)} />
              {isReview ? (
                <TopBtn imgSrc={goBackIcon.url} imgClass="h-9 w-9 object-contain" label="Go Back" onClick={() => nav({ to: "/test-results/$id", params: { id } })} />
              ) : (
                <>
                  <TopBtn imgSrc={suspendIcon.url} label="Suspend" onClick={async () => {
                    const ok = await confirm({
                      title: "Suspend this test?",
                      description: "Your progress is saved and you can resume the test later from the Tests page.",
                      confirmLabel: "Suspend",
                      tone: "warning",
                    });
                    if (ok) nav({ to: "/tests" });
                  }} />
                  <TopBtn imgSrc={endBlockIcon.url} label="End Block" onClick={async () => {
                    const ok = await confirm({
                      title: "End this block?",
                      description: "Your answers will be submitted and the block will be scored. This cannot be undone.",
                      confirmLabel: "End Block",
                      tone: "danger",
                    });
                    if (ok) finish();
                  }} />
                </>
              )}
            </div>
          </div>
        );
      })()}

      {breakModal && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={() => setBreakModal(null)}>
          <div className="w-full max-w-md rounded shadow-lg overflow-hidden bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-3 text-white font-semibold text-center" style={{ background: "#a94442" }}>
              Unauthorized Break Warning
            </div>
            <div className="px-6 py-5 text-center text-sm text-gray-700 space-y-1">
              <div>You are about to lock the exam and take an Unauthorized Break.</div>
              <div>An Unauthorized Break may be reported as an irregularity for the exam.</div>
            </div>
            <div className="flex items-center justify-center gap-6 pb-5">
              <button
                onClick={() => {
                  const action = breakModal;
                  setBreakModal(null);
                  if (action === "suspend") nav({ to: "/tests" });
                  else finish();
                }}
                className="px-5 py-2 rounded text-white text-sm font-semibold"
                style={{ background: "#a94442" }}
              >
                Unauthorized Break
              </button>
              <button
                onClick={() => setBreakModal(null)}
                className="px-5 py-2 rounded text-white text-sm font-semibold"
                style={{ background: "#d4a017" }}
              >
                Return to Exam
              </button>
            </div>
          </div>
        </div>
      )}



      {showCalc && <SciCalculator onClose={() => setShowCalc(false)} />}
      <FlashcardsModal
        open={showFlashcards}
        onClose={() => setShowFlashcards(false)}
        qbankId={data?.qbankId}
        questionId={question?.id}
      />
      <FeedbackModal
        open={showFeedback}
        onClose={() => setShowFeedback(false)}
        qbankId={data?.qbankId}
        questionId={question?.id}
      />
      <NotesModal
        open={showNotes}
        onClose={() => setShowNotes(false)}
        qbankId={data?.qbankId}
        questionId={question?.id}
      />
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
          userSettings={userSettings}
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
      <LabValuesPanel open={showLabValues} onClose={() => setShowLabValues(false)} />

      <MediaExhibitModal content={anchorExhibit} onClose={() => setAnchorExhibit(null)} />

      {confirmDialog}
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

export function SettingsPanel(props: any) {
  const {
    onClose, fontSize, setFontSize, fontWeight, setFontWeight, theme, setTheme,
    transparentExpl, setTransparentExpl, largeImages, setLargeImages,
    multicolor, setMulticolor,
    activeHighlight, setActiveHighlight, enabledHighlights, setEnabledHighlights,
    userSettings,
  } = props;
  const us = userSettings ?? DEFAULT_SETTINGS;
  const customColors: string[] = us.customHighlights ?? [];
  const allHL = [...HIGHLIGHTS, ...customColors.map((c: string, i: number) => ({ color: c, label: `Custom ${i + 1}` }))];

  const hourStr = (h: number) => {
    const hr = ((h + 11) % 12) + 1;
    const ap = h < 12 ? "AM" : "PM";
    return `${String(hr).padStart(2, "0")}:00 ${ap}`;
  };

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
        {allHL.map(h => (
          <div key={h.color} className="flex items-center justify-between py-1.5">
            <button
              onClick={() => setActiveHighlight(h.color)}
              className={`flex items-center gap-2 ${activeHighlight === h.color ? "font-semibold" : ""}`}
            >
              <span className="h-4 w-4 rounded-full border" style={{ background: h.color }} />
              <span className="text-sm">{h.label}</span>
              {activeHighlight === h.color && <span className="text-[10px] text-blue-600">(active)</span>}
            </button>
            <Toggle on={!!enabledHighlights[h.color]} onChange={v => setEnabledHighlights({ ...enabledHighlights, [h.color]: v })} />
          </div>
        ))}
      </div>

      <div className="p-4 border-b">
        <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Quiz Toolbar Icons</div>
        {TOOLBAR_ITEMS.map(item => (
          <Row key={item.key} label={item.label}>
            <Toggle
              on={us.toolbar[item.key] !== false}
              onChange={(v) => setUserSettings((cur) => ({ ...cur, toolbar: { ...cur.toolbar, [item.key]: v } }))}
            />
          </Row>
        ))}
      </div>

      <div className="p-4 border-b">
        <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Content</div>
        <Row label="Hide Percentages">
          <Toggle on={us.hidePercentages} onChange={(v) => setUserSettings({ hidePercentages: v })} />
        </Row>
        <Row label="Split Screen Explanations">
          <Toggle on={us.splitExplanations} onChange={(v) => setUserSettings({ splitExplanations: v })} />
        </Row>
        <Row label="Transparent Background in Explanations">
          <Toggle on={transparentExpl} onChange={(v) => { setTransparentExpl(v); setUserSettings({ transparentExplanations: v }); }} />
        </Row>
        <Row label="Large Image Size">
          <Toggle on={largeImages} onChange={(v) => { setLargeImages(v); setUserSettings({ largeImages: v }); }} />
        </Row>
      </div>

      <div className="p-4 border-b">
        <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">More Features</div>
        <Row label="Confirm Answer Omission">
          <Toggle on={us.confirmOmission} onChange={(v) => setUserSettings({ confirmOmission: v })} />
        </Row>
        <Row label="Show Timer">
          <Toggle on={us.showTimer} onChange={(v) => setUserSettings({ showTimer: v })} />
        </Row>
        <Row label="Stop Timer on Blur">
          <Toggle on={us.stopTimerOnBlur} onChange={(v) => setUserSettings({ stopTimerOnBlur: v })} />
        </Row>
      </div>

      <div className="p-4">
        <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Night Mode</div>
        <div className="text-[11px] text-gray-500 mb-2">If on, auto changes to dark mode based on scheduled time.</div>
        <Row label="Automatic">
          <Toggle on={us.autoNightMode} onChange={(v) => setUserSettings({ autoNightMode: v })} />
        </Row>
        <Row label="Start">
          <select
            value={us.nightStart}
            onChange={(e) => setUserSettings({ nightStart: Number(e.target.value) })}
            className="text-sm border border-gray-300 rounded px-2 py-1 bg-white"
          >
            {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{hourStr(i)}</option>)}
          </select>
        </Row>
        <Row label="End">
          <select
            value={us.nightEnd}
            onChange={(e) => setUserSettings({ nightEnd: Number(e.target.value) })}
            className="text-sm border border-gray-300 rounded px-2 py-1 bg-white"
          >
            {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{hourStr(i)}</option>)}
          </select>
        </Row>
      </div>
    </div>
  );
}


/* ---------------- Scientific Calculator ---------------- */

export function SciCalculator({ onClose }: { onClose: () => void }) {
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
