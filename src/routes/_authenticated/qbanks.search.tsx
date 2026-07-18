import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import {
  Search, Copy, Info, Loader2, Eye, ArrowUpDown,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X, FileText,
  Maximize2, FlaskConical, StickyNote, Notebook, Calculator, Settings,
  Library, Zap, MessageSquare, ArrowLeft, Flag, Clock, CheckCircle2, Menu,
} from "lucide-react";
import { toast } from "sonner";
import { searchQuestions, toggleBookmark } from "@/lib/qbank.functions";
import { useActiveQbankId, setActiveQbankId, QBANKS } from "@/lib/active-qbank";
import { rewriteMedia } from "@/lib/media";
import { SciCalculator, SettingsPanel } from "./test.$id";


export const Route = createFileRoute("/_authenticated/qbanks/search")({
  component: SearchPage,
});

type SearchResult = {
  id: number;
  title: string;
  question: string;
  explanation: string;
  correctAnswer: number;
  subject: string;
  system: string;
  answers: { answer_index: number; answer_text: string }[];
};

function SearchPage() {
  const searchFn = useServerFn(searchQuestions);
  const qbankId = useActiveQbankId();
  const [query, setQuery] = useState("");
  const currentBank = QBANKS.find((q) => q.id === qbankId) ?? QBANKS[0];

  const mutation = useMutation({
    mutationFn: async (q: string) => searchFn({ data: { query: q, qbankId } }) as Promise<{ results: SearchResult[]; total: number; truncated: boolean }>,
  });


  const results = mutation.data?.results ?? [];

  const runSearch = () => {
    if (!query.trim()) {
      toast.error("Enter a question ID or keyword");
      return;
    }
    mutation.mutate(query);
  };

  const copyIds = () => {
    const ids = results.map((r) => r.id).join(", ");
    navigator.clipboard.writeText(ids);
    toast.success(`Copied ${results.length} IDs`);
  };

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-[#1e3a8a]">Search Questions</h1>
        <p className="text-muted-foreground text-sm mt-1">Find questions by ID or keywords from your question bank</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-5 mb-4">
        <div className="grid gap-4 md:grid-cols-[1fr_240px_auto] items-end">
          <div>
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Enter Question ID or Keywords</label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
                placeholder="Type to search..."
                className="w-full pl-9 pr-3 py-2.5 border rounded-md bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Course</label>
            <select
              value={currentBank.id}
              onChange={(e) => setActiveQbankId(Number(e.target.value))}
              className="w-full mt-1 py-2.5 px-3 border rounded-md bg-white"
            >
              {QBANKS.map((q) => (
                <option key={q.id} value={q.id}>{q.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={runSearch}
            disabled={mutation.isPending}
            className="h-11 px-6 rounded-full bg-[#1e3a8a] text-white font-semibold flex items-center gap-2 hover:bg-[#2a4ba0] disabled:opacity-60"
          >
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </button>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-md p-4 mb-6 flex gap-3">
        <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <ol className="text-sm text-slate-700 space-y-1 list-decimal list-inside">
          <li>Search can generate up to a maximum of 200 questions. To generate more questions, please refine your search criteria.</li>
          <li>Questions viewed through Search will have their correct answers revealed. To practice these questions unanswered, copy the question IDs using the "Copy IDs" button and use them to generate a custom quiz.</li>
        </ol>
      </div>

      {mutation.isPending && (
        <div className="text-center py-12 text-slate-500">Searching...</div>
      )}

      {mutation.isSuccess && results.length === 0 && (
        <div className="text-center py-12 text-slate-500">No questions found.</div>
      )}

      {results.length > 0 && <ResultsTable results={results} truncated={mutation.data?.truncated ?? false} onCopyIds={copyIds} />}
    </div>
  );
}

type SortKey = "id" | "subject" | "system" | "topic";

function ResultsTable({ results, truncated, onCopyIds }: { results: SearchResult[]; truncated: boolean; onCopyIds: () => void }) {
  const [sortKey, setSortKey] = useState<SortKey>("id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [viewingIdx, setViewingIdx] = useState<number | null>(null);
  const pageSize = 20;

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

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageRows = sorted.slice(start, start + pageSize);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  };

  const th = (label: string, k: SortKey) => (
    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-white">
      <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1.5 hover:opacity-80">
        {label} <ArrowUpDown className="h-3 w-3 opacity-70" />
      </button>
    </th>
  );

  return (
    <>
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-4 bg-slate-50 border-b">
          <div>
            <div className="font-bold text-slate-800">Search Results</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {sorted.length} question{sorted.length === 1 ? "" : "s"} found
              {truncated && <span className="text-amber-600 ml-2">(showing first 200)</span>}
            </div>
          </div>
          <button
            onClick={onCopyIds}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-white border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            <Copy className="h-4 w-4" /> Copy IDs
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#2c5aa0]">
              <tr>
                {th("ID", "id")}
                {th("Subject", "subject")}
                {th("System", "system")}
                {th("Topic", "topic")}
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-white">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.map((r) => {
                const absIdx = sorted.findIndex((x) => x.id === r.id);
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-slate-700">{r.id}</td>
                    <td className="px-4 py-3 text-slate-700">{r.subject || "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{r.system || "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{r.title || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setViewingIdx(absIdx)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600"
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

        <div className="flex flex-wrap items-center justify-center gap-4 p-4 border-t bg-white text-sm text-slate-600">
          <span>
            Showing {sorted.length === 0 ? 0 : start + 1} to {Math.min(start + pageSize, sorted.length)} of {sorted.length} entries
          </span>
          <div className="flex items-center gap-1">
            <PagerBtn onClick={() => setPage(1)} disabled={currentPage === 1}><ChevronsLeft className="h-4 w-4" /></PagerBtn>
            <PagerBtn onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /></PagerBtn>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => Math.abs(p - currentPage) <= 2 || p === 1 || p === totalPages)
              .reduce<(number | "…")[]>((acc, p, i, arr) => {
                if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("…");
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === "…" ? (
                  <span key={`e${i}`} className="px-2 text-slate-400">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`min-w-[32px] h-8 px-2 rounded text-sm font-medium ${
                      p === currentPage ? "bg-[#1e3a8a] text-white" : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
            <PagerBtn onClick={() => setPage(currentPage + 1)} disabled={currentPage === totalPages}><ChevronRight className="h-4 w-4" /></PagerBtn>
            <PagerBtn onClick={() => setPage(totalPages)} disabled={currentPage === totalPages}><ChevronsRight className="h-4 w-4" /></PagerBtn>
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
      className="h-8 w-8 flex items-center justify-center rounded text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

const NAV_BG = "#1e3a8a";

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
  const notImpl = (name: string) => () => toast.info(`${name} — coming soon`);
  const correctAns = r.answers.find((a) => a.answer_index === r.correctAnswer);
  const correctLetter = correctAns ? String.fromCharCode(65 + correctAns.answer_index) : "";
  const correctText = correctAns?.answer_text ?? "";
  const go = (dir: number) => {
    const next = index + dir;
    if (next >= 0 && next < total) setIndex(next);
  };

  const rootRef = useRef<HTMLDivElement>(null);
  const [showCalc, setShowCalc] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [marked, setMarked] = useState<Record<number, boolean>>({});

  // Settings state (matches test runner)
  const [fontSize, setFontSize] = useState(15);
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

  const themeStyles =
    theme === "dark"
      ? { text: "#e5e7eb", bg: "#0f172a", border: "#334155" }
      : theme === "sepia"
      ? { text: "#3b2f1c", bg: "#f4ecd8", border: "#d6c9a8" }
      : { text: "#1f2937", bg: "#ffffff", border: "#d1d9e6" };

  const goFullscreen = () => {
    if (!document.fullscreenElement) rootRef.current?.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  const bookmarkFn = useServerFn(toggleBookmark);
  const modalQbankId = useActiveQbankId();
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

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center" onClick={onClose}>
      <div
        ref={rootRef}
        className="w-full h-full md:w-[95vw] md:h-[95vh] md:rounded-lg overflow-hidden shadow-2xl flex flex-col"
        style={{ background: themeStyles.bg }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top nav */}
        <div className="flex items-center justify-between px-3 py-1.5 text-white shrink-0" style={{ background: NAV_BG }}>
          <div className="flex items-center gap-4">
            <button className="p-1 hover:bg-white/10 rounded" onClick={() => setSidebarOpen((v) => !v)} title={sidebarOpen ? "Hide question list" : "Show question list"}>
              <Menu className="h-5 w-5" />
            </button>
            <button className="p-1 hover:bg-white/10 rounded" onClick={onClose} title="Close">
              <X className="h-5 w-5" />
            </button>
            <div className="text-sm leading-tight">
              <div className="font-semibold">Item {index + 1} of {total}</div>
              <div className="text-[11px] text-white/75">Question Id: {r.id}</div>
            </div>
            <button
              onClick={toggleMark}
              className={`flex flex-col items-center px-2 py-1 rounded hover:bg-white/10 ${isMarked ? "text-yellow-300" : "text-white/90"}`}
              title={isMarked ? "Remove flag" : "Flag question"}
            >
              <Flag className="h-5 w-5" fill={isMarked ? "currentColor" : "none"} />
              <span className="text-[11px]">Flag</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <TopBtn icon={ChevronLeft} label="Previous" onClick={() => go(-1)} />
            <TopBtn icon={ChevronRight} label="Next" onClick={() => go(1)} />
          </div>
          <div className="flex items-center gap-1">
            <TopBtn icon={Maximize2} label="Full Screen" onClick={goFullscreen} />
            <TopBtn icon={FlaskConical} label="Lab Values" onClick={notImpl("Lab Values")} />
            <TopBtn icon={StickyNote} label="Notes" onClick={notImpl("Notes")} />
            <TopBtn icon={Notebook} label="Notebook" onClick={notImpl("Notebook")} />
            <TopBtn icon={Calculator} label="Calculator" onClick={() => setShowCalc((v) => !v)} />
            <TopBtn icon={Settings} label="Settings" onClick={() => setShowSettings((v) => !v)} />
          </div>
        </div>

        {/* Main */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left navigator */}
          {sidebarOpen && (
            <aside className="w-14 overflow-auto border-r" style={{ background: "#eef2f9", borderColor: "#d1d9e6" }}>
              {items.map((q, i) => {
                const active = i === index;
                return (
                  <button
                    type="button"
                    key={q.id}
                    onClick={() => setIndex(i)}
                    aria-label={`Go to question ${i + 1}`}
                    className={`relative z-10 w-full min-h-7 flex items-center gap-1 px-2 py-1 text-xs border-b cursor-pointer hover:bg-white/60 ${active ? "bg-white font-semibold" : ""}`}
                    style={{ borderColor: "#d1d9e6", color: "#1f2937" }}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                    <span>{i + 1}</span>
                  </button>
                );
              })}
            </aside>
          )}

        {/* Content */}
        <div className="flex-1 overflow-auto">
          <div
            className={`w-full mx-auto px-6 py-3 qbank-theme-${theme} ${largeImages ? "qbank-large-images" : ""}`}
            style={{ fontSize, fontWeight, color: themeStyles.text }}
          >
            <div
              data-hlkey="q"
              className="qbank-html qbank-light"
              dangerouslySetInnerHTML={{ __html: rewriteMedia(r.question ?? "", { qbankId: modalQbankId }) }}
            />

            <div
              className="mt-3 inline-block rounded border-2 px-4 py-2"
              style={{
                borderColor: theme === "dark" ? "#475569" : "#5b8fc9",
                background: theme === "dark" ? "#1e293b" : theme === "sepia" ? "#f4ecd8" : "#ffffff",
                color: themeStyles.text,
              }}
            >
              {r.answers.map((a, i) => {
                const letter = String.fromCharCode(65 + a.answer_index);
                const isCorrect = a.answer_index === r.correctAnswer;
                const pct = isCorrect
                  ? 55 + ((r.id * 7) % 25)
                  : 2 + ((r.id * 3 + a.answer_index * 11) % 18);
                return (
                  <div key={i} className="w-full text-left flex items-center gap-2 py-1.5" style={{ fontSize }}>
                    <span className="w-4 flex justify-center shrink-0">
                      {isCorrect && <span className="text-green-600 font-bold text-base leading-none">✓</span>}
                    </span>
                    <span className="h-4 w-4 rounded-full border border-gray-400 flex items-center justify-center shrink-0" />
                    <span className="flex-1">
                      <span className="font-normal">{letter}. </span>
                      <span
                        data-hlkey={`a${i}`}
                        className="qbank-html qbank-light inline"
                        dangerouslySetInnerHTML={{ __html: rewriteMedia(a.answer_text ?? "", { qbankId: modalQbankId }) }}
                      />
                      <span className="text-gray-600 ml-1">({pct}%)</span>
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 rounded-md border-l-4 p-3 border-green-500 bg-green-50 flex items-start justify-between gap-6">
              <div>
                <div className="font-semibold text-green-700">Answered Correctly</div>
                <div className="text-xs text-gray-600 mt-1">The correct answer is:</div>
                <div
                  className="font-semibold text-gray-800 mt-1"
                  dangerouslySetInnerHTML={{ __html: `${correctLetter}. ${rewriteMedia(correctText, { qbankId: modalQbankId })}` }}
                />
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center">
                    <Clock className="h-4 w-4 text-blue-700" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">0min: 0sec</div>
                    <div className="text-[11px] text-gray-500">Time Taken</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4 text-green-700" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">73%</div>
                    <div className="text-[11px] text-gray-500">Answered Correctly</div>
                  </div>
                </div>
              </div>
            </div>

            {r.explanation && (
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
                  className="pt-3 pb-6"
                  style={{
                    background: transparentExpl ? "transparent" : "transparent",
                    lineHeight: 1.7,
                    fontSize,
                    fontWeight,
                    color: themeStyles.text,
                  }}
                >
                  <div
                    data-hlkey="e"
                    className="qbank-html qbank-light qbank-explanation"
                    dangerouslySetInnerHTML={{ __html: rewriteMedia(r.explanation, { deferMedia: true, qbankId: modalQbankId }) }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        </div>

        {/* Bottom nav */}
        <div className="flex items-center justify-between px-4 py-1.5 text-white text-xs shrink-0" style={{ background: NAV_BG }}>
          <div className="font-semibold tracking-wide" />
          <div className="font-semibold tracking-wide hidden md:block">IMD QBank</div>
          <div className="flex items-center gap-3">
            <TopBtn icon={Library} label="Medical Library" onClick={notImpl("Medical Library")} />
            <TopBtn icon={FileText} label="NBME Library" onClick={notImpl("NBME Library")} />
            <TopBtn icon={Zap} label="Flashcards" onClick={notImpl("Flashcards")} />
            <TopBtn icon={MessageSquare} label="Feedback" onClick={notImpl("Feedback")} />
            <TopBtn icon={ArrowLeft} label="Go Back" onClick={onClose} />
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
    </div>
  );
}
