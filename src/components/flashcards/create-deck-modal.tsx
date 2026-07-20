import { useState } from "react";
import { X } from "lucide-react";

const COLORS = [
  "#3b82f6", "#ef4444", "#f97316", "#eab308",
  "#a855f7", "#8b5cf6", "#64748b", "#78350f",
  "#ec4899", "#14b8a6",
];

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, color: string) => Promise<void> | void;
  initialName?: string;
  initialColor?: string;
  title?: string;
};

export function CreateDeckModal({ open, onClose, onCreate, initialName = "", initialColor = COLORS[0], title = "Create Deck" }: Props) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);
  const [busy, setBusy] = useState(false);

  if (!open) return null;
  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await onCreate(name.trim(), color);
      setName(""); onClose();
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold text-slate-800">{title}</div>
          <button onClick={onClose}><X className="h-4 w-4 text-slate-500" /></button>
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Deck name"
          autoFocus
          className="w-full border-b border-slate-300 focus:border-blue-500 outline-none py-1 text-sm mb-4"
        />
        <div className="grid grid-cols-6 gap-3 mb-4">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className="w-8 h-8 rounded-full flex items-center justify-center border border-slate-200"
              style={{ backgroundColor: c }}
              title={c}
            >
              {color === c && <span className="text-white text-xs">✓</span>}
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-3 text-sm">
          <button onClick={onClose} className="text-blue-600 hover:underline">Cancel</button>
          <button onClick={submit} disabled={busy || !name.trim()} className="text-blue-600 font-semibold hover:underline disabled:opacity-50">
            {busy ? "Saving…" : title.startsWith("Edit") ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
