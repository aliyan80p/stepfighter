import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Tags, Search } from "lucide-react";
import { listQbanks, listTopics, renameTopic } from "@/lib/admin-content.functions";

export function TopicsTab() {
  const qbanksFn = useServerFn(listQbanks);
  const listFn = useServerFn(listTopics);
  const renameFn = useServerFn(renameTopic);

  const qbanksQ = useQuery({ queryKey: ["admin-qbanks"], queryFn: () => qbanksFn() });
  const [qbankId, setQbankId] = useState<number | null>(null);
  const [term, setTerm] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [editing, setEditing] = useState<{ from: string; to: string } | null>(null);

  useEffect(() => {
    if (qbankId === null && qbanksQ.data?.rows.length) setQbankId(qbanksQ.data.rows[0].id);
  }, [qbanksQ.data, qbankId]);

  const topicsQ = useQuery({
    queryKey: ["admin-topics", qbankId, submitted],
    queryFn: () => listFn({ data: { qbank_id: qbankId!, search: submitted } }),
    enabled: qbankId !== null,
  });

  const save = async () => {
    if (!editing || qbankId === null) return;
    try {
      await renameFn({ data: { qbank_id: qbankId, from: editing.from, to: editing.to } });
      setEditing(null);
      topicsQ.refetch();
      toast.success("Topic renamed on every question that used it");
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Tags className="h-5 w-5" /> Topics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          onSubmit={(e) => { e.preventDefault(); setSubmitted(term); }}
          className="flex flex-wrap gap-2 items-end"
        >
          <div>
            <Label className="text-xs">Course</Label>
            <select
              value={qbankId ?? ""}
              onChange={(e) => setQbankId(Number(e.target.value))}
              className="border rounded h-9 px-2 text-sm block bg-background"
            >
              {(qbanksQ.data?.rows ?? []).map((q) => (
                <option key={q.id} value={q.id}>{q.name}</option>
              ))}
            </select>
          </div>
          <div className="relative flex-1 min-w-[220px]">
            <Label className="text-xs">Search topics</Label>
            <Search className="absolute left-3 bottom-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={term} onChange={(e) => setTerm(e.target.value)} className="pl-9" placeholder="e.g. anemia" />
          </div>
          <Button type="submit" variant="secondary">Search</Button>
        </form>

        <p className="text-xs text-muted-foreground">
          Renaming a topic updates every question that carries it.
        </p>

        {topicsQ.isLoading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>
        ) : (
          <div className="divide-y border rounded-md max-h-[60vh] overflow-y-auto">
            {(topicsQ.data?.rows ?? []).map((t) => (
              <div key={t.name} className="flex items-center gap-2 p-2">
                {editing?.from === t.name ? (
                  <>
                    <Input
                      value={editing.to}
                      onChange={(e) => setEditing({ from: t.name, to: e.target.value })}
                      className="h-8"
                    />
                    <Button size="sm" onClick={save}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                  </>
                ) : (
                  <>
                    <button
                      className="flex-1 text-left text-sm hover:underline"
                      onClick={() => setEditing({ from: t.name, to: t.name })}
                    >
                      {t.name}
                    </button>
                    <span className="text-xs text-muted-foreground">{t.count} questions</span>
                  </>
                )}
              </div>
            ))}
            {!topicsQ.data?.rows.length && (
              <div className="p-6 text-sm text-muted-foreground text-center">No topics found.</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
