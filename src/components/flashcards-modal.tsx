import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, X, Trash2, Maximize2, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { listFlashcards, createFlashcard, deleteFlashcard } from "@/lib/flashcards.functions";

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

  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [maximized, setMaximized] = useState(false);
  const frontFileRef = useRef<HTMLInputElement>(null);
  const backFileRef = useRef<HTMLInputElement>(null);

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["flashcards", qbankId ?? null],
    queryFn: () => listFn({ data: { qbankId } }),
    enabled: open,
  });

  if (!open) return null;

  const thisQ = cards.filter((c: any) => questionId && c.question_id === questionId);
  const other = cards.filter((c: any) => !questionId || c.question_id !== questionId);
  const filtered = (arr: any[]) => query.trim() ? arr.filter(c => (c.front + " " + c.back).toLowerCase().includes(query.toLowerCase())) : arr;

  const submit = async () => {
    if (!front.trim() && !frontImage) { toast.error("Add front text or an image"); return; }
    try {
      await createFn({ data: { qbankId, questionId, front: front.trim(), back: back.trim(), frontImage, backImage } });
      setFront(""); setBack(""); setFrontImage(null); setBackImage(null); setCreating(false);
      qc.invalidateQueries({ queryKey: ["flashcards"] });
      toast.success("Flashcard saved");
    } catch (e: any) { toast.error(e?.message ?? "Failed to save"); }
  };

  const pickImage = async (file: File | undefined, setter: (v: string | null) => void) => {
    if (!file) return;
    if (file.size > 2_000_000) { toast.error("Image must be under 2MB"); return; }
    const reader = new FileReader();
    reader.onload = () => setter(String(reader.result));
    reader.readAsDataURL(file);
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
            ) : filtered(other).length === 0 ? (
              <div className="text-sm text-slate-500">No flashcards yet.</div>
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
              </div>
            )}
          </section>
        </div>

        {creating && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 p-4" onClick={() => setCreating(false)}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="font-semibold text-slate-800 mb-3">New Flashcard</div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* FRONT */}
                <div className="border rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-slate-600">Front</label>
                    <button
                      onClick={() => frontFileRef.current?.click()}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                      title="Attach image"
                    >
                      <ImagePlus className="h-3.5 w-3.5" /> Image
                    </button>
                    <input ref={frontFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(e.target.files?.[0], setFrontImage)} />
                  </div>
                  <textarea value={front} onChange={(e) => setFront(e.target.value)} rows={4} className="w-full border rounded p-2 text-sm" placeholder="Front text…" />
                  {frontImage && (
                    <div className="relative mt-2">
                      <img src={frontImage} alt="Front attachment" className="max-h-40 rounded border" />
                      <button onClick={() => setFrontImage(null)} className="absolute top-1 right-1 p-0.5 bg-white/90 rounded shadow" title="Remove image">
                        <X className="h-3.5 w-3.5 text-red-500" />
                      </button>
                    </div>
                  )}
                </div>

                {/* BACK */}
                <div className="border rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-slate-600">Back</label>
                    <button
                      onClick={() => backFileRef.current?.click()}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                      title="Attach image"
                    >
                      <ImagePlus className="h-3.5 w-3.5" /> Image
                    </button>
                    <input ref={backFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(e.target.files?.[0], setBackImage)} />
                  </div>
                  <textarea value={back} onChange={(e) => setBack(e.target.value)} rows={4} className="w-full border rounded p-2 text-sm" placeholder="Back text…" />
                  {backImage && (
                    <div className="relative mt-2">
                      <img src={backImage} alt="Back attachment" className="max-h-40 rounded border" />
                      <button onClick={() => setBackImage(null)} className="absolute top-1 right-1 p-0.5 bg-white/90 rounded shadow" title="Remove image">
                        <X className="h-3.5 w-3.5 text-red-500" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setCreating(false)} className="px-3 py-1.5 text-sm border rounded">Cancel</button>
                <button onClick={submit} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
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
      <div className="line-clamp-5">{card.front}</div>
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
