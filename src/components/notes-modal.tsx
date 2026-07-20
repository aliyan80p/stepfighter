import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { toast } from "sonner";
import { getNote, saveNote } from "@/lib/notes.functions";

type Props = {
  open: boolean;
  onClose: () => void;
  qbankId?: number;
  questionId?: number;
};

const MAX = 10000;

export function NotesModal({ open, onClose, qbankId, questionId }: Props) {
  const qc = useQueryClient();
  const getFn = useServerFn(getNote);
  const saveFn = useServerFn(saveNote);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["question-note", questionId],
    queryFn: () => getFn({ data: { questionId: questionId! } }),
    enabled: open && !!questionId,
  });

  useEffect(() => {
    if (open) setContent(data?.content ?? "");
  }, [open, data?.content]);

  if (!open || !questionId) return null;

  const submit = async () => {
    setSaving(true);
    try {
      await saveFn({ data: { questionId, qbankId, content } });
      qc.invalidateQueries({ queryKey: ["question-note", questionId] });
      toast.success("Note saved");
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save note");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-2xl w-full max-w-xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3" style={{ background: "linear-gradient(90deg,#1e3a8a,#2a4ba0)" }}>
          <div className="text-white">
            <div className="text-[11px] tracking-wider uppercase text-white/70">Question Note</div>
            <div className="text-lg font-semibold">Edit Notes</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/80 bg-white/10 rounded-full px-3 py-1">{content.length} chars</span>
            <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded" title="Close">
              <X className="h-4 w-4 text-white" />
            </button>
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded px-3 py-2 mb-3">
            Capture a quick takeaway, memory hook, or question-specific pearl.
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, MAX))}
            rows={10}
            placeholder={isLoading ? "Loading…" : "Write your note here…"}
            disabled={isLoading}
            className="w-full resize-y border border-slate-300 rounded-md p-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 bg-slate-50 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded text-slate-700 hover:bg-slate-100">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving || isLoading}
            className="px-5 py-2 text-sm rounded text-white font-semibold disabled:opacity-60"
            style={{ background: "#1e3a8a" }}
          >
            {saving ? "Saving…" : "Save & Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
