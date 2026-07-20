import { useState } from "react";
import { X } from "lucide-react";

type Settings = {
  new_cards_per_day: number;
  reviews_per_day: number;
  new_card_order: "added" | "random";
};

type Props = {
  open: boolean;
  onClose: () => void;
  deckName: string;
  initial: Settings;
  onSave: (v: Settings) => Promise<void> | void;
};

export function DeckSettingsModal({ open, onClose, deckName, initial, onSave }: Props) {
  const [tab, setTab] = useState<"new" | "reviews" | "general">("new");
  const [s, setS] = useState<Settings>(initial);
  const [busy, setBusy] = useState(false);
  if (!open) return null;

  const submit = async () => {
    setBusy(true);
    try { await onSave(s); onClose(); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="font-semibold text-slate-800">Settings <span className="text-xs text-slate-500 ml-2">{deckName}</span></div>
          <button onClick={onClose}><X className="h-4 w-4 text-slate-500" /></button>
        </div>
        <div className="flex gap-6 px-4 pt-3 text-sm border-b">
          {(["new", "reviews", "general"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-2 -mb-px ${tab === t ? "text-blue-600 border-b-2 border-blue-600 font-medium" : "text-slate-500"}`}
            >
              {t === "new" ? "New Cards" : t === "reviews" ? "Reviews" : "General"}
            </button>
          ))}
        </div>
        <div className="p-4 min-h-40">
          {tab === "new" && (
            <div className="space-y-3">
              <Field label="Maximum cards a day">
                <input type="number" value={s.new_cards_per_day} onChange={(e) => setS({ ...s, new_cards_per_day: Number(e.target.value) })}
                  className="w-24 border-b border-slate-300 focus:border-blue-500 outline-none text-sm py-0.5" />
              </Field>
              <Field label="Order">
                <select value={s.new_card_order} onChange={(e) => setS({ ...s, new_card_order: e.target.value as "added" | "random" })}
                  className="border rounded px-2 py-1 text-sm">
                  <option value="added">Show new cards in order added</option>
                  <option value="random">Show new cards in random order</option>
                </select>
              </Field>
            </div>
          )}
          {tab === "reviews" && (
            <Field label="Maximum cards a day">
              <input type="number" value={s.reviews_per_day} onChange={(e) => setS({ ...s, reviews_per_day: Number(e.target.value) })}
                className="w-24 border-b border-slate-300 focus:border-blue-500 outline-none text-sm py-0.5" />
            </Field>
          )}
          {tab === "general" && (
            <div className="text-sm text-slate-500">No general options yet.</div>
          )}
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t text-sm">
          <button onClick={onClose} className="text-blue-600 hover:underline">Cancel</button>
          <button onClick={submit} disabled={busy} className="text-blue-600 font-semibold hover:underline disabled:opacity-50">Apply</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <div className="text-sm text-slate-700 flex-1">{label}</div>
      {children}
    </div>
  );
}
