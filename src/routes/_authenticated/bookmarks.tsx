import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listBookmarks, createTest } from "@/lib/qbank.functions";
import { useActiveQbankId } from "@/lib/active-qbank";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/bookmarks")({
  component: Bookmarks,
});

function Bookmarks() {
  const listFn = useServerFn(listBookmarks);
  const createFn = useServerFn(createTest);
  const navigate = useNavigate();
  const qbankId = useActiveQbankId();
  const { data, isLoading } = useQuery({ queryKey: ["bookmarks", qbankId], queryFn: () => listFn({ data: { qbankId } }) });

  const startReview = async () => {
    try {
      const r = await createFn({ data: { qbankId, count: Math.min(data?.length ?? 20, 40), mode: "practice", scope: "marked" } });
      navigate({ to: "/test/$id", params: { id: String(r.id) } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };


  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Flagged Questions</h1>
        {(data?.length ?? 0) > 0 && <Button onClick={startReview}>Review as Test</Button>}
      </div>

      <div className="mt-6 space-y-2">
        {isLoading && <div className="text-muted-foreground">Loading…</div>}
        {data?.length === 0 && <div className="text-muted-foreground">No flagged questions yet. Tap the flag icon on any question.</div>}
        {(data ?? []).map((b) => (
          <div key={b.question_id} className="rounded-lg border border-border p-4">
            <div className="font-medium">Question #{b.question_id}{b.question?.title ? ` — ${b.question.title}` : ""}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Saved {new Date(b.created_at).toLocaleDateString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
