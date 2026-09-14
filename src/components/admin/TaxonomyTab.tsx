import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Layers, Plus, Trash2 } from "lucide-react";
import { listQbanks, listTaxonomy, saveTaxonomy, deleteTaxonomy } from "@/lib/admin-content.functions";

type Kind = "subjects" | "systems";

export function TaxonomyTab() {
  const qbanksFn = useServerFn(listQbanks);
  const qbanksQ = useQuery({ queryKey: ["admin-qbanks"], queryFn: () => qbanksFn() });
  const [qbankId, setQbankId] = useState<number | null>(null);

  useEffect(() => {
    if (qbankId === null && qbanksQ.data?.rows.length) setQbankId(qbanksQ.data.rows[0].id);
  }, [qbanksQ.data, qbankId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5" /> Subjects &amp; systems
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
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

        {qbankId !== null && (
          <div className="grid gap-6 md:grid-cols-2">
            <TaxonomyList qbankId={qbankId} kind="subjects" heading="Subjects" />
            <TaxonomyList qbankId={qbankId} kind="systems" heading="Systems" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TaxonomyList({ qbankId, kind, heading }: { qbankId: number; kind: Kind; heading: string }) {
  const listFn = useServerFn(listTaxonomy);
  const saveFn = useServerFn(saveTaxonomy);
  const delFn = useServerFn(deleteTaxonomy);

  const q = useQuery({
    queryKey: ["admin-taxonomy", kind, qbankId],
    queryFn: () => listFn({ data: { qbank_id: qbankId, kind } }),
  });

  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);

  const add = async () => {
    if (!newName.trim()) return;
    try {
      await saveFn({ data: { qbank_id: qbankId, kind, name: newName } });
      setNewName("");
      q.refetch();
      toast.success("Added");
    } catch (e) { toast.error((e as Error).message); }
  };

  const save = async () => {
    if (!editing) return;
    try {
      await saveFn({ data: { qbank_id: qbankId, kind, id: editing.id, name: editing.name } });
      setEditing(null);
      q.refetch();
      toast.success("Renamed");
    } catch (e) { toast.error((e as Error).message); }
  };

  const remove = async (id: number, name: string) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await delFn({ data: { qbank_id: qbankId, kind, id } });
      q.refetch();
      toast.success("Deleted");
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="space-y-3">
      <div className="font-medium text-sm">{heading}</div>
      <div className="flex gap-2">
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={`New ${heading.toLowerCase().slice(0, -1)}`} />
        <Button type="button" onClick={add}><Plus className="h-4 w-4" /></Button>
      </div>
      <div className="divide-y border rounded-md max-h-[50vh] overflow-y-auto">
        {(q.data?.rows ?? []).map((r) => (
          <div key={r.id} className="flex items-center gap-2 p-2">
            {editing?.id === r.id ? (
              <>
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ id: r.id, name: e.target.value })}
                  className="h-8"
                />
                <Button size="sm" onClick={save}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              </>
            ) : (
              <>
                <button
                  className="flex-1 text-left text-sm hover:underline"
                  onClick={() => setEditing({ id: r.id, name: r.name })}
                >
                  {r.name}
                </button>
                <span className="text-xs text-muted-foreground">{r.count ?? 0}</span>
                <Button size="sm" variant="ghost" onClick={() => remove(r.id, r.name)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        ))}
        {!q.isLoading && !q.data?.rows.length && (
          <div className="p-4 text-sm text-muted-foreground text-center">Nothing here yet.</div>
        )}
      </div>
    </div>
  );
}
