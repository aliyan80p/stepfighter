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
  listDrafts,
  publishDrafts,
  discardDrafts,
} from "@/lib/publish-live.functions";

const ENTITY_LABELS: Record<string, string> = {
  question: "Question",
  question_import: "Imported questions",
  library: "Library article",
  library_upsert: "Library article",
  library_delete: "Library article",
  media: "Image",
  media_delete: "Image",
  subject: "Subject",
  system: "System",
  taxonomy_save: "Subject / system",
  taxonomy_delete: "Subject / system",
  topic: "Topic",
  topic_rename: "Topic",
  course: "Course",
  course_save: "Course",
};

type Row = { id: number; entity: string; label: string | null; when: string; removed?: boolean };

export function PublishTab() {
  const statusFn = useServerFn(publishTargetStatus);
  const listChangesFn = useServerFn(listPendingChanges);
  const publishChangesFn = useServerFn(publishChanges);
  const discardChangesFn = useServerFn(discardChanges);
  const listDraftsFn = useServerFn(listDrafts);
  const publishDraftsFn = useServerFn(publishDrafts);
  const discardDraftsFn = useServerFn(discardDrafts);

  const statusQ = useQuery({ queryKey: ["publish-target"], queryFn: () => statusFn() });
  const draftMode = statusQ.data?.draftSite ?? false;

  const listQ = useQuery({
    queryKey: ["publish-pending", draftMode],
    queryFn: async (): Promise<Row[]> => {
      if (draftMode) {
        const res = await listDraftsFn({ data: {} });
        return res.rows.map((r) => ({
          id: r.id,
          entity: r.entity,
          label: r.label,
          when: r.created_at,
        }));
      }
      const res = await listChangesFn({ data: {} });
      return res.rows.map((r) => ({
        id: r.id,
        entity: r.entity,
        label: r.label,
        when: r.changed_at,
        removed: r.action === "delete",
      }));
    },
    enabled: statusQ.isSuccess,
  });

  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

  const rows = listQ.data ?? [];
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
        const res = draftMode
          ? await publishDraftsFn({ data: { ids: selected } })
          : await publishChangesFn({ data: { ids: selected } });
        if (res.failed.length) {
          toast.error(
            `${res.published} published, ${res.failed.length} failed: ${res.failed[0].message}`,
          );
        } else {
          toast.success(
            `${res.published} change${res.published === 1 ? "" : "s"} are now live`,
          );
        }
      } else {
        if (draftMode) await discardDraftsFn({ data: { ids: selected } });
        else await discardChangesFn({ data: { ids: selected } });
        toast.success("Removed from the list");
      }
      setSelected([]);
      listQ.refetch();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const canPublish = draftMode || statusQ.data?.configured === true;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rocket className="h-5 w-5" /> Publish to live site
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {draftMode ? (
          <p className="text-sm text-muted-foreground">
            You are on the test address, so your edits are parked here as drafts and real users do
            not see them yet. Tick the ones you are happy with and press Publish to make them live.
          </p>
        ) : statusQ.data && !statusQ.data.configured ? (
          <p className="text-sm text-muted-foreground">
            You are on the live site, so edits you make here go out straight away. This list is a
            history of what has changed.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Tick the changes you are happy with and send them to the live site
            {statusQ.data?.host ? ` (${statusQ.data.host})` : ""}.
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
            disabled={busy || !selected.length || !canPublish}
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
          <span className="text-xs text-muted-foreground ml-auto">{rows.length} waiting</span>
        </div>

        {listQ.isLoading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>
        ) : (
          <div className="divide-y border rounded-md max-h-[60vh] overflow-y-auto">
            {rows.map((r) => (
              <label key={r.id} className="flex items-center gap-3 p-2 cursor-pointer">
                <Checkbox checked={selected.includes(r.id)} onCheckedChange={() => toggle(r.id)} />
                <span className="text-sm flex-1">
                  <span className="font-medium">{ENTITY_LABELS[r.entity] ?? r.entity}</span>
                  {r.label ? ` — ${r.label}` : ""}
                  {r.removed ? " (removed)" : ""}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(r.when).toLocaleString()}
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
