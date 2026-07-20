import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, X, Trash2, Maximize2 } from "lucide-react";
import { toast } from "sonner";
import { listFlashcards, createFlashcard, deleteFlashcard } from "@/lib/flashcards.functions";
import { listDecks, createDeck } from "@/lib/decks.functions";
import { RichEditor } from "@/components/flashcards/rich-editor";

const DEFAULT_DECK_KEY = "flashcards.defaultDeckId";
const MAX_CHARS = 3000;

const stripHtml = (html: string) => {
  if (typeof window === "undefined") return html.replace(/<[^>]+>/g, "");
  const el = document.createElement("div");
  el.innerHTML = html;
  return el.textContent || el.innerText || "";
};


type Props = {
  open: boolean;
  onClose: () => void;
  qbankId?: number;
  questionId?: number;
};

export function FlashcardsModal({ open, onClose, qbankId, questionId }: Props) {
  const qc = useQueryClient();
  const listFn = useServerFn(listFlashcards);
  const createFn = useServerFn(createFlashcard);
  const delFn = useServerFn(deleteFlashcard);
  const decksFn = useServerFn(listDecks);
  const createDeckFn = useServerFn(createDeck);

  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [frontHtml, setFrontHtml] = useState("");
  const [backHtml, setBackHtml] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [maximized, setMaximized] = useState(false);
  const [deckId, setDeckId] = useState<string>("");
  const [newDeckName, setNewDeckName] = useState("");
  const [showNewDeck, setShowNewDeck] = useState(false);


  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["flashcards", qbankId ?? null],
    queryFn: () => listFn({ data: { qbankId } }),
    enabled: open,
  });

  const { data: decksData } = useQuery({
    queryKey: ["decks"],
    queryFn: () => decksFn(),
    enabled: open,
  });
  const decks = decksData?.decks ?? [];

  useEffect(() => {
    if (!open) return;
    const saved = typeof window !== "undefined" ? localStorage.getItem(DEFAULT_DECK_KEY) : null;
    if (saved && decks.some((d: any) => d.id === saved)) setDeckId(saved);
    else if (decks[0]) setDeckId(decks[0].id);
  }, [open, decks.length]);

  if (!open) return null;

  const thisQ = cards.filter((c: any) => questionId && c.question_id === questionId);
  const other = cards.filter((c: any) => !questionId || c.question_id !== questionId);
  const filtered = (arr: any[]) => query.trim() ? arr.filter(c => (c.front + " " + c.back).toLowerCase().includes(query.toLowerCase())) : arr;

  const frontText = stripHtml(frontHtml);
  const backText = stripHtml(backHtml);
  const frontLen = frontText.length;
  const backLen = backText.length;

  const submit = async () => {
    if (!frontText.trim() && !/<img/i.test(frontHtml)) { toast.error("Add front text or an image"); return; }
    if (frontLen > MAX_CHARS || backLen > MAX_CHARS) { toast.error(`Max ${MAX_CHARS} characters`); return; }
    try {
      let targetDeckId: string | null = deckId || null;
      if (showNewDeck && newDeckName.trim()) {
        const created: any = await createDeckFn({ data: { name: newDeckName.trim(), color: "#3b82f6" } });
        targetDeckId = created.id;
        qc.invalidateQueries({ queryKey: ["decks"] });
      }
      if (targetDeckId && typeof window !== "undefined") {
        localStorage.setItem(DEFAULT_DECK_KEY, targetDeckId);
      }
      const tags = tagsInput.split(",").map(t => t.trim()).filter(Boolean).slice(0, 30);
      await createFn({ data: {
        qbankId, questionId, deckId: targetDeckId,
        front: frontText.trim().slice(0, 6000),
        back: backText.trim().slice(0, 6000),
        frontHtml, backHtml, tags,
      } });
      setFrontHtml(""); setBackHtml(""); setTagsInput(""); setCreating(false);
      setShowNewDeck(false); setNewDeckName("");
      qc.invalidateQueries({ queryKey: ["flashcards"] });
      toast.success("Flashcard saved");
    } catch (e: any) { toast.error(e?.message ?? "Failed to save"); }
  };


  const remove = async (id: string) => {
    try {
      await delFn({ data: { id } });
      qc.invalidateQueries({ queryKey: ["flashcards"] });
    } catch (e: any) { toast.error(e?.message ?? "Failed to delete"); }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className={`bg-white rounded-lg shadow-xl flex flex-col overflow-hidden ${maximized ? "w-full h-full" : "w-full max-w-5xl max-h-[85vh]"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-50">
          <div className="flex items-center gap-2 font-semibold text-slate-800">
            <span className="text-blue-600">⚡</span> Flashcards
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setMaximized(v => !v)} className="p-1.5 hover:bg-slate-200 rounded" title="Maximize">
              <Maximize2 className="h-4 w-4 text-slate-600" />
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded" title="Close">
              <X className="h-4 w-4 text-slate-600" />
            </button>
          </div>
        </div>

        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search flashcards"
              className="w-full pl-9 pr-3 py-2 border rounded-md text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {questionId && (
            <section>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">This Question</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-3">
                <button
                  onClick={() => setCreating(true)}
                  className="h-24 border border-dashed border-slate-300 rounded-md flex flex-col items-center justify-center text-slate-500 hover:border-blue-400 hover:text-blue-600"
                >
                  <Plus className="h-5 w-5" />
                  <span className="text-xs mt-1">New Card</span>
                </button>
                {filtered(thisQ).map((c: any) => (
                  <CardTile key={c.id} card={c} onClick={() => setExpanded(c.id)} onDelete={() => remove(c.id)} />
                ))}
              </div>
            </section>
          )}

          <section>
            <h3 className="text-sm font-semibold text-slate-700 mb-2">{questionId ? "Other" : "All Flashcards"}</h3>
            {isLoading ? (
              <div className="text-sm text-slate-500">Loading…</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-3">
                {!questionId && (
                  <button
                    onClick={() => setCreating(true)}
                    className="h-24 border border-dashed border-slate-300 rounded-md flex flex-col items-center justify-center text-slate-500 hover:border-blue-400 hover:text-blue-600"
                  >
                    <Plus className="h-5 w-5" />
                    <span className="text-xs mt-1">New Card</span>
                  </button>
                )}
                {filtered(other).map((c: any) => (
                  <CardTile key={c.id} card={c} onClick={() => setExpanded(c.id)} onDelete={() => remove(c.id)} />
                ))}
                {filtered(other).length === 0 && !questionId === false && (
                  <div className="text-sm text-slate-500 col-span-full">No flashcards yet.</div>
                )}
              </div>
            )}
          </section>
        </div>

        {creating && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 p-4" onClick={() => setCreating(false)}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="font-semibold text-slate-800 mb-3">New Flashcard</div>

              <div className="mb-3">
                <label className="text-xs font-semibold text-slate-600 block mb-1">Deck</label>
                {showNewDeck ? (
                  <div className="flex gap-2">
                    <input
                      value={newDeckName}
                      onChange={(e) => setNewDeckName(e.target.value)}
                      placeholder="New deck name"
                      autoFocus
                      className="flex-1 border rounded px-2 py-1.5 text-sm"
                    />
                    <button onClick={() => { setShowNewDeck(false); setNewDeckName(""); }} className="text-xs text-slate-500 px-2">Cancel</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <select
                      value={deckId}
                      onChange={(e) => {
                        setDeckId(e.target.value);
                        if (typeof window !== "undefined" && e.target.value) {
                          localStorage.setItem(DEFAULT_DECK_KEY, e.target.value);
                        }
                      }}
                      className="flex-1 border rounded px-2 py-1.5 text-sm"
                    >
                      {decks.length === 0 && <option value="">— No decks yet —</option>}
                      {decks.map((d: any) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                    <button onClick={() => setShowNewDeck(true)} className="text-xs px-2 py-1 border rounded text-blue-600 hover:bg-blue-50 whitespace-nowrap">+ New deck</button>
                  </div>
                )}
                <p className="text-[11px] text-slate-500 mt-1">All new cards you create will be saved to this deck.</p>
              </div>


              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* FRONT */}
                <div>
                  <div className="text-xs font-semibold text-slate-600 mb-1 text-right">Front</div>
                  <RichEditor value={frontHtml} onChange={setFrontHtml} placeholder="Front…" minHeight={160} />
                  <div className={`text-[11px] mt-1 text-right ${frontLen > MAX_CHARS ? "text-red-500" : "text-slate-500"}`}>
                    {frontLen} / {MAX_CHARS} characters
                  </div>
                </div>

                {/* BACK */}
                <div>
                  <div className="text-xs font-semibold text-slate-600 mb-1 text-right">Back</div>
                  <RichEditor value={backHtml} onChange={setBackHtml} placeholder="Back…" minHeight={160} />
                  <div className={`text-[11px] mt-1 text-right ${backLen > MAX_CHARS ? "text-red-500" : "text-slate-500"}`}>
                    {backLen} / {MAX_CHARS} characters
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <input
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="tag name, comma separated"
                  className="w-full border-0 border-b border-slate-200 focus:border-blue-400 focus:outline-none px-1 py-1.5 text-sm bg-transparent"
                />
              </div>

              <div className="flex justify-between items-center gap-2 mt-4">
                <button onClick={() => setCreating(false)} className="px-4 py-1.5 text-sm border rounded">Cancel</button>
                <button onClick={submit} className="px-6 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
              </div>

            </div>
          </div>
        )}

        {expanded && (() => {
          const c = cards.find((x: any) => x.id === expanded);
          if (!c) return null;
          return (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 p-4" onClick={() => setExpanded(null)}>
              <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-start mb-3">
                  <div className="font-semibold text-slate-800">Flashcard</div>
                  <button onClick={() => setExpanded(null)}><X className="h-4 w-4 text-slate-500" /></button>
                </div>
                <div className="text-xs text-slate-500 mb-1">Front</div>
                <div className="border rounded p-2 text-sm mb-3 whitespace-pre-wrap">{c.front || <span className="text-slate-400">—</span>}</div>
                {c.front_image && <img src={c.front_image} alt="Front" className="max-h-56 rounded border mb-3" />}
                <div className="text-xs text-slate-500 mb-1">Back</div>
                <div className="border rounded p-2 text-sm whitespace-pre-wrap min-h-16">{c.back || <span className="text-slate-400">—</span>}</div>
                {c.back_image && <img src={c.back_image} alt="Back" className="max-h-56 rounded border mt-2" />}
                <div className="flex justify-end mt-3">
                  <button onClick={() => { remove(c.id); setExpanded(null); }} className="px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded flex items-center gap-1">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

function CardTile({ card, onClick, onDelete }: { card: any; onClick: () => void; onDelete: () => void }) {
  return (
    <div className="relative group h-24 border border-slate-200 rounded-md p-2 text-xs text-slate-700 hover:border-blue-400 cursor-pointer overflow-hidden bg-white" onClick={onClick}>
      {card.front_image && <img src={card.front_image} alt="" className="absolute inset-0 w-full h-full object-cover opacity-70" />}
      <div className="relative line-clamp-5">{card.front}</div>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-0.5 bg-white/80 rounded hover:bg-red-50"
        title="Delete"
      >
        <Trash2 className="h-3 w-3 text-red-500" />
      </button>
    </div>
  );
}
