import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { getDeckStats } from "@/lib/flashcards.functions";

export function StatsPanel({ open, onClose, deckId }: { open: boolean; onClose: () => void; deckId?: string }) {
  const fn = useServerFn(getDeckStats);
  const { data } = useQuery({
    queryKey: ["deck-stats", deckId ?? "all"],
    queryFn: () => fn({ data: { deckId } }),
    enabled: open,
  });
  if (!open) return null;

  const s = data;
  const fmtMin = (ms: number) => Math.round(ms / 60000);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="font-semibold text-slate-800">Statistics</div>
          <button onClick={onClose}><X className="h-4 w-4 text-slate-500" /></button>
        </div>
        <div className="p-6 space-y-4 text-sm">
          <Row label="Today">
            {s ? `You have studied ${s.today.count} cards in ${fmtMin(s.today.timeMs)} mins today (${s.today.count ? Math.round(s.today.timeMs / s.today.count / 1000) : 0} secs/card)` : "…"}
          </Row>
          <Row label="Forecast">{s ? `Due tomorrow: ${s.forecast.dueTomorrow} cards` : "…"}</Row>
          <Row label="Review Count">
            {s ? (<>
              <div>Total: {s.totalReviews} reviews</div>
              <div>Average for days studied: {s.avgReviewsPerDay} reviews/day</div>
            </>) : "…"}
          </Row>
          <Row label="Time Spent">
            {s ? (<>
              <div>Total: {Math.round(s.totalMs / 1000)} sec</div>
              <div>Average for days studied: {fmtMin(s.avgMsPerDay)} mins/day</div>
              <div>Average answer time: {Math.round((s.avgAnswerMs) / 1000)} secs ({s.avgAnswerMs ? Math.round(60000 / s.avgAnswerMs) : 0} card/min)</div>
            </>) : "…"}
          </Row>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-4 border-b last:border-0 py-2">
      <div className="font-semibold text-slate-700">{label}</div>
      <div className="text-slate-600">{children}</div>
    </div>
  );
}
