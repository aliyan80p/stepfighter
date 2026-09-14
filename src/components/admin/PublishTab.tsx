import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Rocket } from "lucide-react";
import {
  listPendingChanges,
  publishChanges,
  discardChanges,
  publishTargetStatus,
} from "@/lib/publish-live.functions";

const ENTITY_LABELS: Record<string, string> = {
  question: "Question",
  library: "Library article",
  media: "Image",
  subject: "Subject",
  system: "System",
  topic: "Topic",
  course: "Course",
};

export function PublishTab() {
  const listFn = useServerFn(listPendingChanges);
  const publishFn = useServerFn(publishChanges);
  const discardFn = useServerFn(discardChanges);
  const statusFn = useServerFn(publishTargetStatus);

  const statusQ = useQuery({ queryKey: ["publish-target"], queryFn: () => statusFn() });
  const pendingQ = useQuery({ queryKey: ["publish-pending"], queryFn: () => listFn({ data: {} }) });

  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

  const rows = pendingQ.data?.rows ?? [];
  const allSelected = useMemo(
    () => rows.length > 0 && selected.length === rows.length,
    [rows, selected],
  );

  const toggle = (id: number) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const run = async (kind: "publish" | "discard") => {
    if (!selected.length) return;
    setBusy(true);
    try {
      if (kind === "publish") {
        const res = await publishFn({ data: { ids: selected } });
        if (res.failed.length) {
          toast.error(`${res.published} sent, ${res.failed.length} failed: ${res.failed[0].message}`);
        } else {
          toast.success(`${res.published} change${res.published === 1 ? "" : "s"} sent to the live site`);
        }
      } else {
        await discardFn({ data: { ids: selected } });
        toast.success("Removed from the list");
      }
      setSelected([]);
      pendingQ.refetch();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rocket className="h-5 w-5" /> Publish to live site
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {statusQ.data && !statusQ.data.configured ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            No live site is connected yet, so changes can be reviewed here but not sent. Once the
            live site is set up, publishing becomes available.
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Edits made here are listed below. Tick the ones you are happy with and send them to the
            live site{statusQ.data?.host ? ` (${statusQ.data.host})` : ""}.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSelected(allSelected ? [] : rows.map((r) => r.id))}
            disabled={!rows.length}
          >
            {allSelected ? "Clear selection" : "Select all"}
          </Button>
          <Button
            size="sm"
            onClick={() => run("publish")}
            disabled={busy || !selected.length || statusQ.data?.configured === false}
          >
            Publish {selected.length || ""} to live
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => run("discard")}
            disabled={busy || !selected.length}
          >
            Remove from list
          </Button>
          <span className="text-xs text-muted-foreground ml-auto">
            {rows.length} waiting
          </span>
        </div>

        {pendingQ.isLoading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>
        ) : (
          <div className="divide-y border rounded-md max-h-[60vh] overflow-y-auto">
            {rows.map((r) => (
              <label key={r.id} className="flex items-center gap-3 p-2 cursor-pointer">
                <Checkbox checked={selected.includes(r.id)} onCheckedChange={() => toggle(r.id)} />
                <span className="text-sm flex-1">
                  <span className="font-medium">{ENTITY_LABELS[r.entity] ?? r.entity}</span>
                  {r.label ? ` — ${r.label}` : ""}
                  {r.action === "delete" ? " (removed)" : ""}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(r.changed_at).toLocaleString()}
                </span>
              </label>
            ))}
            {!rows.length && (
              <div className="p-6 text-sm text-muted-foreground text-center">
                Nothing waiting — every edit has been published.
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
