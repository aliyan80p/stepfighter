import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { toast } from "sonner";
import { getStudyQueue, reviewCard } from "@/lib/flashcards.functions";

type Props = { open: boolean; onClose: () => void; deckId: string; deckName: string };

export function StudySession({ open, onClose, deckId, deckName }: Props) {
  const qc = useQueryClient();
  const queueFn = useServerFn(getStudyQueue);
  const reviewFn = useServerFn(reviewCard);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const startRef = useRef<number>(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [showTimer, setShowTimer] = useState(false);

  useEffect(() => {
    if (!open) return;
    setShowTimer(typeof window !== "undefined" && localStorage.getItem("flashcards.showAnswerTimer") === "1");
    const id = setInterval(() => setElapsed(Date.now() - startRef.current), 200);
    return () => clearInterval(id);
  }, [open]);


  const { data, isLoading, refetch } = useQuery({
    queryKey: ["study-queue", deckId],
    queryFn: () => queueFn({ data: { deckId } }),
    enabled: open,
    staleTime: 0,
  });

  useEffect(() => { if (open) { setIndex(0); setFlipped(false); startRef.current = Date.now(); } }, [open, deckId]);
  const card = data?.queue[index];
  useEffect(() => { startRef.current = Date.now(); setFlipped(false); }, [card?.id]);

  const remaining = useMemo(() => (data?.queue.length ?? 0) - index, [data, index]);

  if (!open) return null;

  const rate = async (rating: "again" | "hard" | "good" | "easy") => {
    if (!card) return;
    const timeMs = Date.now() - startRef.current;
    try {
      await reviewFn({ data: { id: card.id, rating, timeMs } });
      if (index + 1 >= (data?.queue.length ?? 0)) {
        toast.success("Session complete!");
        qc.invalidateQueries({ queryKey: ["decks"] });
        onClose();
      } else {
        setIndex(i => i + 1);
      }
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-white flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-3">
          <div className="font-semibold text-slate-800">{deckName}</div>
          <div className="text-xs text-slate-500">
            {data ? `New ${data.counts.new} · Learning ${data.counts.learning} · Review ${data.counts.review}` : ""}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-500">{remaining} left</div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded"><X className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        {isLoading ? (
          <div className="text-slate-500">Loading…</div>
        ) : !card ? (
          <div className="text-center">
            <div className="text-xl font-semibold text-slate-800 mb-2">No cards to study right now.</div>
            <button onClick={() => refetch()} className="text-sm text-blue-600 hover:underline">Refresh</button>
          </div>
        ) : (
          <div className="w-full max-w-2xl">
            <div className="border rounded-xl p-8 min-h-[300px] shadow-sm">
              <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: card.front_html || escapeHtml(card.front || "") }} />
              {card.front_image && <img src={card.front_image} alt="" className="mt-4 max-h-64 rounded" />}
              {flipped && (
                <>
                  <hr className="my-6" />
                  <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: card.back_html || escapeHtml(card.back || "") }} />
                  {card.back_image && <img src={card.back_image} alt="" className="mt-4 max-h-64 rounded" />}
                </>
              )}
            </div>
            <div className="mt-6 flex justify-center">
              {!flipped ? (
                <button onClick={() => setFlipped(true)} className="px-8 py-2 bg-slate-800 text-white rounded-md hover:bg-slate-900">Show Answer</button>
              ) : (
                <div className="grid grid-cols-4 gap-2 w-full">
                  <RateBtn label="Again" color="bg-red-500 hover:bg-red-600" onClick={() => rate("again")} />
                  <RateBtn label="Hard" color="bg-orange-500 hover:bg-orange-600" onClick={() => rate("hard")} />
                  <RateBtn label="Good" color="bg-green-600 hover:bg-green-700" onClick={() => rate("good")} />
                  <RateBtn label="Easy" color="bg-blue-600 hover:bg-blue-700" onClick={() => rate("easy")} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RateBtn({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`text-white ${color} py-2 rounded-md text-sm font-medium`}>{label}</button>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
