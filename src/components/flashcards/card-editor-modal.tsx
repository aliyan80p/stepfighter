import { useEffect, useState } from "react";
import { X, Maximize2, Minimize2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { RichEditor, stripHtml } from "./rich-editor";

type Deck = { id: string; name: string; color: string };

export type CardValue = {
  id?: string;
  deckId?: string | null;
  frontHtml: string;
  backHtml: string;
  tags: string[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  decks: Deck[];
  initial?: CardValue;
  onSave: (v: CardValue & { front: string; back: string }) => Promise<void> | void;
};

export function CardEditorModal({ open, onClose, decks, initial, onSave }: Props) {
  const [deckId, setDeckId] = useState<string | undefined>(initial?.deckId ?? decks[0]?.id);
  const [frontHtml, setFrontHtml] = useState(initial?.frontHtml ?? "");
  const [backHtml, setBackHtml] = useState(initial?.backHtml ?? "");
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [maximized, setMaximized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deckMenu, setDeckMenu] = useState(false);

  useEffect(() => {
    if (open) {
      setDeckId(initial?.deckId ?? decks[0]?.id);
      setFrontHtml(initial?.frontHtml ?? "");
      setBackHtml(initial?.backHtml ?? "");
      setTags((initial?.tags ?? []).join(", "));
      setMaximized(false);
    }
  }, [open, initial, decks]);

  if (!open) return null;
  const activeDeck = decks.find(d => d.id === deckId);

  const frontLen = stripHtml(frontHtml).length;
  const backLen = stripHtml(backHtml).length;

  const submit = async () => {
    if (!frontLen) { toast.error("Front cannot be empty"); return; }
    setBusy(true);
    try {
      await onSave({
        id: initial?.id,
        deckId: deckId ?? null,
        frontHtml,
        backHtml,
        front: stripHtml(frontHtml),
        back: stripHtml(backHtml),
        tags: tags.split(",").map(t => t.trim()).filter(Boolean),
      });
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className={`bg-slate-50 rounded-lg shadow-2xl flex flex-col overflow-hidden ${maximized ? "w-full h-full" : "w-full max-w-5xl max-h-[92vh]"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-2 border-b bg-white">
          <div className="flex items-center gap-2">
            <span className="text-blue-600 font-bold text-xs tracking-widest">
              {initial?.id ? "EDIT FLASHCARD" : "CREATE FLASHCARD"}
            </span>
            {activeDeck && <span className="text-xs text-slate-500">{activeDeck.name}</span>}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setMaximized(v => !v)} className="p-1.5 hover:bg-slate-100 rounded" title="Maximize">
              {maximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded"><X className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="px-4 pt-3 relative">
          <button
            onClick={() => setDeckMenu(v => !v)}
            className="inline-flex items-center gap-2 px-2 py-1 border border-slate-200 rounded-md bg-white hover:bg-slate-50 text-sm"
          >
            {activeDeck && <span className="w-4 h-4 rounded" style={{ backgroundColor: activeDeck.color }} />}
            <span className="font-medium">{activeDeck?.name ?? "Choose deck"}</span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
          </button>
          {deckMenu && (
            <div className="absolute z-10 mt-1 bg-white border rounded shadow-lg max-h-64 overflow-y-auto min-w-48">
              {decks.map(d => (
                <button
                  key={d.id}
                  onClick={() => { setDeckId(d.id); setDeckMenu(false); }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-slate-100 text-left"
                >
                  <span className="w-3 h-3 rounded" style={{ backgroundColor: d.color }} />
                  {d.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Panel title="Front" hint="Question side" length={frontLen}>
            <RichEditor value={frontHtml} onChange={setFrontHtml} placeholder="Front of the card…" minHeight={maximized ? 400 : 260} />
          </Panel>
          <Panel title="Back" hint="Answer side" length={backLen}>
            <RichEditor value={backHtml} onChange={setBackHtml} placeholder="Back of the card…" minHeight={maximized ? 400 : 260} />
          </Panel>
        </div>

        <div className="px-4 pb-3">
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Tag name, comma separated"
            className="w-full border rounded-md px-3 py-2 text-sm bg-white"
          />
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t bg-white">
          <div className="text-xs text-slate-500">
            {initial?.id ? "Edit this card." : "Create a card in the selected deck."}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-1.5 text-sm border rounded-full">Cancel</button>
            <button onClick={submit} disabled={busy || !frontLen} className="px-6 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-full disabled:opacity-50">
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, hint, length, children }: { title: string; hint: string; length: number; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-1">
        <div className="font-semibold text-slate-800 text-sm">{title}</div>
        <div className="text-[11px] text-slate-500">{hint}</div>
      </div>
      {children}
      <div className="text-right text-[11px] text-slate-500 mt-1">{length} / 3000 characters</div>
    </div>
  );
}
