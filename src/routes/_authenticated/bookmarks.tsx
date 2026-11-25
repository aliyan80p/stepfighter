import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listBookmarks, createTest, toggleBookmark } from "@/lib/qbank.functions";
import { useActiveQbankId } from "@/lib/active-qbank";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Flag, Search, PlayCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { TableSkeleton } from "@/components/loader";

export const Route = createFileRoute("/_authenticated/bookmarks")({
  component: Bookmarks,
});

function Bookmarks() {
  const listFn = useServerFn(listBookmarks);
  const createFn = useServerFn(createTest);
  const toggleFn = useServerFn(toggleBookmark);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const qbankId = useActiveQbankId();
  const [search, setSearch] = useState("");
  const [starting, setStarting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["bookmarks", qbankId],
    queryFn: () => listFn({ data: { qbankId } }),
    staleTime: 30_000,
  });

  const items = useMemo(() => {
    const all = data ?? [];
    if (!search.trim()) return all;
    const q = search.toLowerCase();
    return all.filter(
      (b) =>
        String(b.question_id).includes(q) ||
        (b.question?.title ?? "").toLowerCase().includes(q),
    );
  }, [data, search]);

  const startReview = async () => {
    if (!(data?.length)) return;
    setStarting(true);
    try {
      const r = await createFn({
        data: { qbankId, count: Math.min(data.length, 50), mode: "practice", scope: "marked" },
      });
      navigate({ to: "/test/$id", params: { id: String(r.id) } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start review");
    } finally {
      setStarting(false);
    }
  };

  const removeFlag = (questionId: number) => {
    const prev = qc.getQueryData<typeof data>(["bookmarks", qbankId]);
    qc.setQueryData(["bookmarks", qbankId], (old: any) =>
      Array.isArray(old) ? old.filter((b: any) => b.question_id !== questionId) : old,
    );
    toggleFn({ data: { questionId, qbankId } })
      .then(() => toast.success("Flag removed"))
      .catch((e) => {
        qc.setQueryData(["bookmarks", qbankId], prev);
        toast.error(e instanceof Error ? e.message : "Failed to remove flag");
      });
  };

  return (
    <div className="sf-fluid-page space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Flagged Questions</h1>
            <span className="rounded-full bg-primary/12 text-primary px-2.5 py-0.5 text-xs font-semibold tabular-nums">
              {data?.length ?? 0}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Review high-yield or tricky questions you flagged during practice.
          </p>
        </div>

        {(data?.length ?? 0) > 0 && (
          <Button onClick={startReview} disabled={starting} className="gap-1.5">
            <PlayCircle className="h-4 w-4" />
            {starting ? "Creating…" : `Review as Test (${Math.min(data?.length ?? 0, 50)})`}
          </Button>
        )}
      </div>

      {/* Search bar */}
      {(data?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-border bg-card p-3 flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Question ID or topic…"
              className="pl-8 h-8 text-xs"
            />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            Showing {items.length} of {data?.length ?? 0}
          </span>
        </div>
      )}

      {/* List */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        {isLoading && <div className="p-4"><TableSkeleton rows={5} /></div>}
        {!isLoading && items.length === 0 && (
          <div className="p-10 text-center space-y-2">
            <div className="mx-auto h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <Flag className="h-5 w-5" />
            </div>
            <div className="text-sm font-medium">
              {search ? "No flagged questions match your search." : "No flagged questions yet."}
            </div>
            <p className="text-xs text-muted-foreground">
              {search ? "Try clearing the search box." : "Click Mark / Flag on any question during a test to save it here."}
            </p>
          </div>
        )}
        {!isLoading && items.length > 0 && (
          <div className="divide-y divide-border">
            {items.map((b) => (
              <div
                key={b.question_id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-muted/25 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="h-8 w-8 rounded-lg bg-amber-500/12 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Flag className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold rounded bg-muted px-1.5 py-0.5 tabular-nums">
                        ID #{b.question_id}
                      </span>
                      <span className="font-medium text-sm truncate">
                        {b.question?.title || `Question #${b.question_id}`}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      Flagged {new Date(b.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2.5 text-xs text-muted-foreground hover:text-destructive gap-1"
                  onClick={() => removeFlag(b.question_id)}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
