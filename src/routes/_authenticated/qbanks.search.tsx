import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import {
  Search, Copy, Info, Loader2, Eye, ArrowUpDown, Play,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X, FileText,
  Maximize2, FlaskConical, StickyNote, Notebook, Calculator, Settings,
  Library, Zap, MessageSquare, ArrowLeft, Flag, Clock, CheckCircle2, Menu,
} from "lucide-react";
import { toast } from "sonner";
import { searchQuestions, toggleBookmark, createCustomTest } from "@/lib/qbank.functions";
import { useActiveQbankId, QBANKS } from "@/lib/active-qbank";
import { rewriteMedia } from "@/lib/media";
import { useMediaToken } from "@/lib/use-media-token";
import { SciCalculator, SettingsPanel } from "./test.$id";
import { NotesModal } from "@/components/notes-modal";
import { FlashcardsModal } from "@/components/flashcards-modal";
import { MedicalLibraryModal } from "@/components/medical-library-modal";
import { FeedbackModal } from "@/components/feedback-modal";
import { LabValuesPanel } from "@/components/lab-values-panel";
import { ExhibitModal, type ExhibitContent } from "@/components/exhibit-modal";
import { attachMediaAnchorHandlers } from "@/lib/media-anchors";
import { useHydratedSettings, getFontStack, resolveQuizTheme, getQuizPalette, type ResolvedQuizTheme } from "@/lib/user-settings";
import calculatorIcon from "@/assets/icons/calculator-icon.png.asset.json";
import notesIcon from "@/assets/icons/notes.png.asset.json";
import medicalLibraryIcon from "@/assets/icons/medical-library.svg.asset.json";
import flashcardIcon from "@/assets/flashcard-icon.png.asset.json";
import goBackIcon from "@/assets/icons/go-back.png.asset.json";
import navArrowIcon from "@/assets/icons/nav-arrow.png.asset.json";
import markFlagIcon from "@/assets/icons/mark-flag.png.asset.json";
import labValuesIcon from "@/assets/icons/lab-values.png.asset.json";


export const Route = createFileRoute("/_authenticated/qbanks/search")({
  validateSearch: zodValidator(z.object({
    q: fallback(z.string(), "").default(""),
    open: fallback(z.string(), "").default(""),
  })),
  component: SearchPage,
});

type SearchResult = {
  id: number;
  qbankId: number;
  title: string;
  question: string;
  explanation: string;
  correctAnswer: number;
  pplTaken: number | null;
  corrTaken: number | null;
  isBookmarked: boolean;
  subject: string;
  system: string;
  answers: { answer_index: number; answer_text: string; correct_percentage: number | null }[];
};

function SearchPage() {
  const nav = useNavigate();
  const searchFn = useServerFn(searchQuestions);
  const createTestFn = useServerFn(createCustomTest);
  const qbankId = useActiveQbankId();
  const urlSearch = Route.useSearch();
  const [query, setQuery] = useState(urlSearch.q ?? "");
  const [creatingTest, setCreatingTest] = useState(false);
  const currentBank = QBANKS.find((q) => q.id === qbankId) ?? QBANKS[0];

  const mutation = useMutation({
    mutationFn: async (q: string) => searchFn({ data: { query: q, qbankId } }) as Promise<{ results: SearchResult[]; total: number; truncated: boolean }>,
  });

  const results = mutation.data?.results ?? [];
  const autoOpenId = urlSearch.open ? Number(urlSearch.open) : null;

  const runSearch = () => {
    const trimmed = query.trim();
    if (!trimmed) {
      toast.error("Enter a question ID or keyword");
      return;
    }
    nav({ to: "/qbanks/search", search: { q: trimmed, open: "" }, replace: true });
    mutation.mutate(trimmed);
  };

  // Auto-run search when arriving with ?q=... (e.g. from Notes browser)
  useEffect(() => {
    if (urlSearch.q && urlSearch.q.trim()) {
      mutation.mutate(urlSearch.q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSearch.q, qbankId]);

  const copyIds = () => {
    const ids = results.map((r) => r.id).join(", ");
    navigator.clipboard.writeText(ids);
    toast.success(`Copied ${results.length} IDs`);
  };

  const practiceResults = async () => {
    if (!results.length || creatingTest) return;
    setCreatingTest(true);
    try {
      const ids = results.slice(0, 50).map((r) => r.id);
      const created = await createTestFn({
        data: {
          qbankId,
          questionIds: ids,
          mode: "practice",
          timed: false,
          name: `Search: ${query.trim().slice(0, 36)}`,
        },
      });
      nav({ to: "/test/$id", params: { id: String(created.id) } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create test");
    } finally {
      setCreatingTest(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="sf-fluid-page space-y-5">
        {/* Clinical Studio Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b border-border">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Search Questions</h1>
              <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                {currentBank.name}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Find questions by ID or clinical keywords, inspect explanations, or launch a custom quiz
            </p>
          </div>
        </div>

        {/* Search Card */}
        <div className="rounded-xl bg-card border border-border p-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
            <div className="flex-1 min-w-0">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                Question ID or Keywords
              </label>
              <div className="relative mt-1.5">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runSearch()}
                  placeholder="e.g. 14203, pheochromocytoma, diabetic ketoacidosis…"
                  className="h-10 w-full pl-9 pr-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
            <button
              onClick={runSearch}
              disabled={mutation.isPending}
              className="h-10 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-60 transition-colors shrink-0"
            >
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </button>
          </div>
        </div>

        {/* Tip banner */}
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 flex gap-3 items-start">
          <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground leading-relaxed space-y-0.5">
            <p>Search returns up to <span className="font-medium text-foreground">200 questions</span>. Refine your keywords for narrower results.</p>
            <p>Clicking <span className="font-medium text-foreground">View</span> reveals the answer immediately. Use <span className="font-medium text-foreground">Practice as Test</span> (up to 50) or <span className="font-medium text-foreground">Copy IDs</span> to practice unanswered.</p>
          </div>
        </div>

        {mutation.isPending && (
          <div className="rounded-xl bg-card border border-border py-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Searching question bank…
          </div>
        )}

        {mutation.isSuccess && results.length === 0 && (
          <div className="rounded-xl bg-card border border-border py-12 text-center text-sm text-muted-foreground">
            No matching questions found for "{query}".
          </div>
        )}

        {results.length > 0 && (
          <ResultsTable
            results={results}
            truncated={mutation.data?.truncated ?? false}
            onCopyIds={copyIds}
            onPractice={practiceResults}
            creatingTest={creatingTest}
            autoOpenId={autoOpenId}
          />
        )}
      </div>
    </div>
  );
}

type SortKey = "id" | "subject" | "system" | "topic";

function ResultsTable({
  results, truncated, onCopyIds, onPractice, creatingTest, autoOpenId,
}: {
  results: SearchResult[];
  truncated: boolean;
  onCopyIds: () => void;
  onPractice: () => void;
  creatingTest: boolean;
  autoOpenId?: number | null;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [viewingIdx, setViewingIdx] = useState<number | null>(null);
  const pageSize = 25;

  const sorted = useMemo(() => {
    const arr = [...results];
    arr.sort((a, b) => {
      const av = sortKey === "id" ? a.id : sortKey === "subject" ? a.subject : sortKey === "system" ? a.system : a.title;
      const bv = sortKey === "id" ? b.id : sortKey === "subject" ? b.subject : sortKey === "system" ? b.system : b.title;
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [results, sortKey, sortDir]);

  // Auto-open modal when arriving with ?open=<id>
  useEffect(() => {
    if (autoOpenId == null) return;
    const idx = sorted.findIndex((r) => r.id === autoOpenId);
    if (idx >= 0) setViewingIdx(idx);
  }, [autoOpenId, sorted]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageRows = sorted.slice(start, start + pageSize);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  };

  const th = (label: string, k: SortKey) => (
    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
        {label} <ArrowUpDown className="h-3 w-3 opacity-60" />
      </button>
    </th>
  );

  return (
    <>
      <div className="rounded-xl bg-card border border-border overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-muted/30 border-b border-border">
          <div>
            <div className="font-semibold text-sm">Search Results</div>
            <div className="text-xs text-muted-foreground mt-0.5 tabular-nums">
              {sorted.length} question{sorted.length === 1 ? "" : "s"} found
              {truncated && <span className="text-amber-600 dark:text-amber-400 ml-2">(showing first 200)</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCopyIds}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-background border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors"
            >
              <Copy className="h-3.5 w-3.5" /> Copy IDs
            </button>
            <button
              onClick={onPractice}
              disabled={creatingTest}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors"
            >
              {creatingTest ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              Practice as Test {sorted.length > 50 ? "(50)" : `(${sorted.length})`}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                {th("ID", "id")}
                {th("Subject", "subject")}
                {th("System", "system")}
                {th("Topic", "topic")}
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pageRows.map((r) => {
                const absIdx = sorted.findIndex((x) => x.id === r.id);
                return (
                  <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground tabular-nums">#{r.id}</td>
                    <td className="px-4 py-2.5 font-medium">{r.subject || "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.system || "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.title || "—"}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => setViewingIdx(absIdx)}
                        className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-500/20 transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" /> View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-border bg-muted/20 text-xs text-muted-foreground">
          <span className="tabular-nums">
            Showing {sorted.length === 0 ? 0 : start + 1}–{Math.min(start + pageSize, sorted.length)} of {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <PagerBtn onClick={() => setPage(1)} disabled={currentPage === 1}><ChevronsLeft className="h-3.5 w-3.5" /></PagerBtn>
            <PagerBtn onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1}><ChevronLeft className="h-3.5 w-3.5" /></PagerBtn>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => Math.abs(p - currentPage) <= 2 || p === 1 || p === totalPages)
              .reduce<(number | "…")[]>((acc, p, i, arr) => {
                if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("…");
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === "…" ? (
                  <span key={`e${i}`} className="px-1.5 text-muted-foreground">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`min-w-[28px] h-7 px-2 rounded-md text-xs font-semibold transition-colors ${
                      p === currentPage ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
            <PagerBtn onClick={() => setPage(currentPage + 1)} disabled={currentPage === totalPages}><ChevronRight className="h-3.5 w-3.5" /></PagerBtn>
            <PagerBtn onClick={() => setPage(totalPages)} disabled={currentPage === totalPages}><ChevronsRight className="h-3.5 w-3.5" /></PagerBtn>
          </div>
        </div>
      </div>

      {viewingIdx != null && sorted[viewingIdx] && (
        <QuestionModal
          items={sorted}
          index={viewingIdx}
          setIndex={setViewingIdx}
          onClose={() => setViewingIdx(null)}
        />
      )}
    </>
  );
}

function PagerBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
    >
      {children}
    </button>
  );
}

const UWORLD_BAR_BG = "#004a77";
const NBME_BAR_BG = "#004673";

function getAnswerCountSum(r: SearchResult): number {
  return r.answers.reduce((sum, a) => sum + Math.max(0, Number(a.correct_percentage ?? 0)), 0);
}

function getPeerAccuracy(r: SearchResult): number | null {
  const answerSum = getAnswerCountSum(r);
  const correctIdx = r.answers.findIndex((a) => a.answer_index === r.correctAnswer);
  if (answerSum > 0 && correctIdx >= 0) {
    const val = Math.max(0, Number(r.answers[correctIdx].correct_percentage ?? 0));
    return Math.max(0, Math.min(100, Math.round((val / answerSum) * 100)));
  }
  const ppl = r.pplTaken ?? 0;
  const corr = r.corrTaken ?? 0;
  if (ppl <= 0) return null;
  // Skip NBME/CMS placeholder rows (ppl_taken=100, corr_taken<=1)
  if (ppl === 100 && corr <= 1) return null;
  return Math.max(0, Math.min(100, Math.round((corr / ppl) * 100)));
}

function hasRealOptionStats(r: SearchResult): boolean {
  return getAnswerCountSum(r) > 0;
}

function TopBtn({ icon: Icon, imgSrc, imgFlip, imgClass, label, onClick }: { icon?: any; imgSrc?: string; imgFlip?: boolean; imgClass?: string; label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center px-2.5 py-1 text-white/90 hover:text-white hover:bg-white/10 rounded transition-colors min-w-[58px]"
    >
      {imgSrc ? (
        <img src={imgSrc} alt="" className={`${imgClass ?? "h-5 w-5 object-contain"} ${imgFlip ? "scale-x-[-1]" : ""}`} />
      ) : Icon ? (
        <Icon className="h-5 w-5" />
      ) : null}
      <span className="text-[11px] mt-0.5 leading-tight">{label}</span>
    </button>
  );
}

function QuestionModal({
  items, index, setIndex, onClose,
}: {
  items: SearchResult[];
  index: number;
  setIndex: (i: number) => void;
  onClose: () => void;
}) {
  const r = items[index];
  const total = items.length;
  const correctIdx = r.answers.findIndex((a) => a.answer_index === r.correctAnswer);
  const correctAns = correctIdx >= 0 ? r.answers[correctIdx] : undefined;
  const correctLetter = correctIdx >= 0 ? String.fromCharCode(65 + correctIdx) : "";
  const correctText = correctAns?.answer_text ?? "";
  const go = (dir: number) => {
    const next = index + dir;
    if (next >= 0 && next < total) setIndex(next);
  };

  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [showCalc, setShowCalc] = useState(false);
  const [showLabValues, setShowLabValues] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showFlashcards, setShowFlashcards] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [marked, setMarked] = useState<Record<number, boolean>>(() => {
    const init: Record<number, boolean> = {};
    for (const item of items) {
      if (item.isBookmarked) init[item.id] = true;
    }
    return init;
  });
  const [anchorExhibit, setAnchorExhibit] = useState<ExhibitContent | null>(null);
  const [accentOverride, setAccentOverride] = useState<string | null>(null);

  // Settings state (matches test runner — live UWorld / NBME switch)
  const userSettings = useHydratedSettings();
  const isNbme = userSettings.tutorInterface === "nbme-fred";
  const [fontSize, setFontSize] = useState(userSettings.fontSize + 1);
  const [fontWeight, setFontWeight] = useState(400 + userSettings.fontWeight * 100);
  const [theme, setTheme] = useState<ResolvedQuizTheme>(resolveQuizTheme(userSettings));
  const [transparentExpl, setTransparentExpl] = useState(userSettings.transparentExplanations);
  const [largeImages, setLargeImages] = useState(userSettings.largeImages);
  const [highlightOnly, setHighlightOnly] = useState(userSettings.highlightOnly);
  const [multicolor, setMulticolor] = useState(userSettings.multiHighlight);
  const [activeHighlight, setActiveHighlight] = useState<string>("#ffeb3b");
  const [enabledHighlights, setEnabledHighlights] = useState<Record<string, boolean>>(userSettings.enabledHighlights);

  const themeStyles = getQuizPalette(theme, userSettings.customTheme);
  const baseBarBg = isNbme ? NBME_BAR_BG : UWORLD_BAR_BG;
  const barBg = accentOverride
    ? accentOverride
    : theme === "dark"
      ? "#111317"
      : baseBarBg;

  const goFullscreen = () => {
    if (!document.fullscreenElement) rootRef.current?.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  const bookmarkFn = useServerFn(toggleBookmark);
  const activeQbankId = useActiveQbankId();
  const modalQbankId = r.qbankId ?? activeQbankId;
  const mediaToken = useMediaToken(modalQbankId);

  const toggleMark = async () => {
    const prev = !!marked[r.id];
    setMarked((m) => ({ ...m, [r.id]: !prev }));
    try {
      await bookmarkFn({ data: { questionId: r.id, qbankId: modalQbankId } });
    } catch {
      setMarked((m) => ({ ...m, [r.id]: prev }));
      toast.error("Failed to update flag");
    }
  };

  const isMarked = !!marked[r.id];
  const peerAcc = getPeerAccuracy(r);
  const showOptPct = hasRealOptionStats(r);

  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;
    return attachMediaAnchorHandlers(root, (hit) => {
      setAnchorExhibit({ kind: hit.kind, src: hit.src });
    });
  }, [r.id, modalQbankId]);

  const sidebarEl = (
    <aside
      className={isNbme ? "w-[88px] shrink-0 overflow-auto border-r flex flex-col" : "w-14 md:w-20 shrink-0 overflow-auto border-r"}
      style={{ background: themeStyles.sideBg, borderColor: themeStyles.border }}
    >
      {isNbme && (
        <div
          className="px-2 py-2 text-[11px] font-bold text-white text-center shrink-0 border-b border-white/15"
          style={{ background: barBg }}
        >
          Question Status
        </div>
      )}
      <div className="flex-1 overflow-auto">
        {items.map((q, i) => {
          const active = i === index;
          const qMarked = !!marked[q.id];
          return (
            <button
              type="button"
              key={q.id}
              onClick={() => setIndex(i)}
              aria-label={`Go to question ${i + 1}`}
              className={`relative z-10 w-full min-h-7 flex items-center justify-between px-2 py-1 text-xs border-b cursor-pointer hover:bg-black/10 ${active ? "font-bold" : ""}`}
              style={{
                borderColor: themeStyles.border,
                color: active && isNbme ? "#ffffff" : themeStyles.text,
                background: active ? (isNbme ? barBg : themeStyles.cardBg) : "transparent",
              }}
            >
              <span className="inline-flex items-center gap-1">
                {!isNbme && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />}
                <span>{i + 1}</span>
              </span>
              {qMarked && <Flag className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" />}
            </button>
          );
        })}
      </div>
    </aside>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center" onClick={onClose}>
      <div
        ref={rootRef}
        className="w-full h-full md:w-[96vw] md:h-[95vh] md:rounded-lg overflow-hidden shadow-2xl flex"
        style={{ background: themeStyles.pageBg, color: themeStyles.text }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* NBME full-height left sidebar */}
        {isNbme && sidebarOpen && sidebarEl}

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Top nav — Official UWorld or NBME */}
          <div className="flex items-center justify-between px-3 py-1.5 text-white shrink-0 border-b border-white/15" style={{ background: barBg }}>
            <div className="flex items-center gap-2.5 sm:gap-3">
              <button className="p-1.5 hover:bg-white/10 rounded" onClick={() => setSidebarOpen((v) => !v)} title={sidebarOpen ? "Hide question list" : "Show question list"}>
                <Menu className="h-5 w-5" />
              </button>
              <button className="p-1.5 hover:bg-white/10 rounded" onClick={onClose} title="Close">
                <X className="h-5 w-5" />
              </button>
              <div className={isNbme ? "text-xs sm:text-sm leading-tight" : "px-2.5 py-1 rounded border border-white/25 bg-white/10 text-xs leading-tight"}>
                <div className="font-semibold">Item {index + 1} of {total}</div>
                <div className="text-[11px] text-white/80">Question Id: {r.id}</div>
              </div>
              {!isNbme && (
                <button
                  onClick={toggleMark}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs font-medium transition-colors ${
                    isMarked
                      ? "bg-amber-400/20 border-amber-300/60 text-amber-200"
                      : "border-white/25 bg-white/5 text-white/90 hover:bg-white/15"
                  }`}
                  title={isMarked ? "Remove flag" : "Mark question"}
                >
                  <Flag className={`h-3.5 w-3.5 ${isMarked ? "fill-amber-300 text-amber-300" : ""}`} />
                  <span>Mark</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <TopBtn imgSrc={navArrowIcon.url} imgFlip label="Previous" onClick={() => go(-1)} />
              <TopBtn imgSrc={navArrowIcon.url} label="Next" onClick={() => go(1)} />
            </div>

            <div className="flex items-center gap-0.5 sm:gap-1">
              {!isNbme && <TopBtn icon={Maximize2} label="Full Screen" onClick={goFullscreen} />}
              <TopBtn imgSrc={labValuesIcon.url} label="Lab Values" onClick={() => setShowLabValues(true)} />
              <TopBtn imgSrc={notesIcon.url} label="Notes" onClick={() => setShowNotes(true)} />
              <TopBtn imgSrc={calculatorIcon.url} label="Calculator" onClick={() => setShowCalc((v) => !v)} />
              <TopBtn icon={Settings} label="Settings" onClick={() => setShowSettings((v) => !v)} />
            </div>
          </div>

          {/* Main content row */}
          <div className="flex flex-1 overflow-hidden">
            {/* UWorld left navigator */}
            {!isNbme && sidebarOpen && sidebarEl}

            {/* Question + Answers + Explanation */}
            <div className="flex-1 overflow-auto" ref={contentRef}>
              <div
                className={`w-full mx-0 px-4 sm:px-7 py-4 qbank-theme-${theme} ${largeImages ? "qbank-large-images" : ""}`}
                style={{
                  fontSize,
                  fontWeight,
                  fontFamily: getFontStack(userSettings.fontFamily),
                  lineHeight: userSettings.lineHeight,
                  color: themeStyles.text,
                }}
              >
                {/* NBME in-pane Mark Question checkbox */}
                {isNbme && (
                  <div className="mb-3 pb-2 border-b flex items-center justify-between" style={{ borderColor: themeStyles.border }}>
                    <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isMarked}
                        onChange={toggleMark}
                        className="h-4 w-4 accent-[#004673]"
                      />
                      <span>Mark Question</span>
                    </label>
                    <span className="text-xs opacity-60">Search Preview · ID {r.id}</span>
                  </div>
                )}

                <div
                  data-hlkey="q"
                  className="qbank-html qbank-light"
                  dangerouslySetInnerHTML={{ __html: rewriteMedia(r.question ?? "", { qbankId: modalQbankId, mediaToken }) }}
                />

                {/* Answer choices */}
                <div
                  className={isNbme ? "mt-4 space-y-1.5 max-w-3xl" : "mt-4 inline-block min-w-[320px] max-w-full rounded border-2 px-4 py-2.5"}
                  style={
                    isNbme
                      ? undefined
                      : {
                          borderColor: theme === "dark" ? "#475569" : "#4a7eb3",
                          background: themeStyles.cardBg,
                          color: themeStyles.text,
                        }
                  }
                >
                  {r.answers.map((a, i) => {
                    const letter = String.fromCharCode(65 + i);
                    const isCorrect = a.answer_index === r.correctAnswer;
                    const answerSum = getAnswerCountSum(r);
                    const optPct = showOptPct && answerSum > 0
                      ? Math.round((Math.max(0, Number(a.correct_percentage ?? 0)) / answerSum) * 100)
                      : null;
                    return (
                      <div
                        key={i}
                        className="qbank-answer-choice w-full text-left flex items-center gap-2 py-1.5 text-[15px]"
                        style={{ color: themeStyles.text }}
                      >
                        <span className="w-4 flex justify-center shrink-0">
                          {isCorrect && <span className="text-emerald-600 dark:text-emerald-400 font-bold text-base leading-none">✓</span>}
                        </span>
                        <span
                          className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${
                            isCorrect ? "border-emerald-600 bg-emerald-600/15" : "border-gray-400"
                          }`}
                        />
                        <span className="flex-1 min-w-0">
                          <span
                            data-hlkey={`a${i}`}
                            className="qbank-html qbank-light inline"
                            dangerouslySetInnerHTML={{ __html: `<b>${letter}.</b> ${rewriteMedia(a.answer_text ?? "", { qbankId: modalQbankId, mediaToken })}` }}
                          />
                          {optPct != null && (
                            <span className="opacity-65 ml-1.5 text-sm">({optPct}%)</span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Result summary card (real peer accuracy only — no fake 73% or 0min:0sec) */}
                <div
                  className="mt-4 rounded-md border-l-4 border-emerald-500 p-3.5 flex flex-wrap items-center justify-between gap-4"
                  style={{
                    background: theme === "dark" ? "rgba(34,197,94,0.12)" : "#f0fdf4",
                    color: themeStyles.text,
                  }}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Correct Answer</div>
                    <div
                      className="font-semibold mt-1"
                      style={{ color: themeStyles.text }}
                      dangerouslySetInnerHTML={{ __html: `${correctLetter}. ${rewriteMedia(correctText, { qbankId: modalQbankId, mediaToken })}` }}
                    />
                  </div>
                  {peerAcc != null && (
                    <div className="flex items-center gap-2.5 shrink-0">
                      <div
                        className="h-9 w-9 rounded-full flex items-center justify-center"
                        style={{ background: theme === "dark" ? "rgba(34,197,94,0.2)" : "#dcfce7" }}
                      >
                        <CheckCircle2 className="h-4 w-4" style={{ color: theme === "dark" ? "#4ade80" : "#15803d" }} />
                      </div>
                      <div>
                        <div className="text-sm font-bold tabular-nums">{peerAcc}%</div>
                        <div className="text-[11px] opacity-65">Answered Correctly</div>
                      </div>
                    </div>
                  )}
                </div>

                {r.explanation && (
                  <div className="mt-4">
                    <div className="border-b" style={{ borderColor: themeStyles.border }}>
                      <div
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-t-md font-semibold text-sm relative -mb-px"
                        style={{
                          background: themeStyles.cardBg,
                          color: theme === "dark" ? "#60a5fa" : barBg,
                          boxShadow: `inset 0 -3px 0 ${theme === "dark" ? "#60a5fa" : barBg}`,
                        }}
                      >
                        <FileText className="h-4 w-4" /> Explanation
                      </div>
                    </div>
                    <div
                      style={{
                        background: transparentExpl ? "transparent" : themeStyles.cardBg,
                        border: transparentExpl ? "none" : `1px solid ${themeStyles.border}`,
                        borderRadius: transparentExpl ? 0 : 8,
                        padding: transparentExpl ? "12px 0" : "16px 18px",
                        lineHeight: 1.7,
                        fontSize,
                        fontWeight,
                        color: themeStyles.text,
                      }}
                    >
                      <div
                        data-hlkey="e"
                        className="qbank-html qbank-light qbank-explanation"
                        dangerouslySetInnerHTML={{ __html: rewriteMedia(r.explanation, { deferMedia: true, qbankId: modalQbankId, mediaToken }) }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom nav */}
          <div className="flex items-center justify-between px-4 py-1.5 text-white text-xs shrink-0 border-t border-white/15" style={{ background: barBg }}>
            <div className="font-semibold tracking-wide opacity-80">
              {isNbme ? "NBME Interface" : "UWorld Interface"}
            </div>
            <div className="font-semibold tracking-wide hidden md:block">StepFighter</div>
            <div className="flex items-center gap-2">
              {!isNbme && (
                <>
                  <TopBtn imgSrc={medicalLibraryIcon.url} label="Medical Library" onClick={() => setShowLibrary(true)} />
                  <TopBtn imgSrc={flashcardIcon.url} label="Flashcards" onClick={() => setShowFlashcards(true)} />
                  <TopBtn icon={MessageSquare} label="Feedback" onClick={() => setShowFeedback(true)} />
                </>
              )}
              <TopBtn imgSrc={goBackIcon.url} imgClass="h-8 w-8 object-contain" label="Close" onClick={onClose} />
            </div>
          </div>
        </div>

        {showCalc && <SciCalculator onClose={() => setShowCalc(false)} />}
        <LabValuesPanel open={showLabValues} onClose={() => setShowLabValues(false)} />
        <NotesModal
          open={showNotes}
          onClose={() => setShowNotes(false)}
          qbankId={modalQbankId}
          questionId={r.id}
        />
        <MedicalLibraryModal open={showLibrary} onClose={() => setShowLibrary(false)} />
        <FlashcardsModal
          open={showFlashcards}
          onClose={() => setShowFlashcards(false)}
          qbankId={modalQbankId}
          questionId={r.id}
        />
        <FeedbackModal
          open={showFeedback}
          onClose={() => setShowFeedback(false)}
          qbankId={modalQbankId}
          questionId={r.id}
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
            onPickAccent={(c: string | null) => setAccentOverride(c)}
          />
        )}
        <ExhibitModal content={anchorExhibit} onClose={() => setAnchorExhibit(null)} />
      </div>
    </div>
  );
}
