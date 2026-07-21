import { useState } from "react";
import { createPortal } from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import { X } from "lucide-react";
import { toast } from "sonner";
import { submitFeedback } from "@/lib/feedback.functions";

type Props = {
  open: boolean;
  onClose: () => void;
  qbankId?: number;
  questionId?: number;
};

export function FeedbackModal({ open, onClose, qbankId, questionId }: Props) {
  const submitFn = useServerFn(submitFeedback);
  const [message, setMessage] = useState("");
  const [isTechnical, setIsTechnical] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!open) return null;

  const canSubmit = message.trim().length >= 10 && !busy && !submitted;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      await submitFn({ data: { qbankId, questionId, message: message.trim(), isTechnical } });
      toast.success("Feedback submitted. Thank you!");
      setSubmitted(true);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to submit feedback");
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setMessage(""); setIsTechnical(false); setSubmitted(false);
    onClose();
  };

  return (
  const content = (
    <div className="fixed inset-0 z-[2147483000] flex items-center justify-center bg-black/50 p-4" onClick={close}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <div className="font-semibold text-slate-800">Feedback</div>
          <button onClick={close} className="p-1 hover:bg-slate-100 rounded"><X className="h-4 w-4 text-slate-500" /></button>
        </div>
        <div className="p-4">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={8}
            disabled={submitted}
            placeholder="We appreciate your feedback. However, please provide as much detail as possible in the permitted space avoiding simplistic feedback like Good question, hard question etc."
            className="w-full border rounded p-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-slate-100"
          />
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t bg-slate-50">
          <label className="flex items-center gap-2 text-xs text-slate-700">
            <input type="checkbox" checked={isTechnical} disabled={submitted} onChange={(e) => setIsTechnical(e.target.checked)} />
            Check here if concern is for software/technical issue.
          </label>
          <button
            onClick={onSubmit}
            disabled={!canSubmit}
            className={`px-4 py-1.5 text-sm rounded text-white transition-colors ${
              submitted
                ? "bg-slate-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
            }`}
          >
            {submitted ? "Submitted ✓" : busy ? "Submitting…" : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
