import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { BookOpen, Layers, Plus, Trash2, Pencil } from "lucide-react";
import {
  listQbanksAdmin, saveQbank, listTaxonomy, saveTaxon, deleteTaxon,
  listLibraryDocs, getLibraryDoc, saveLibraryDoc, deleteLibraryDoc,
} from "@/lib/admin-content.functions";

export function ContentManager() {
  const qc = useQueryClient();
  const qbanksFn = useServerFn(listQbanksAdmin);
  const saveQbankFn = useServerFn(saveQbank);
  const taxFn = useServerFn(listTaxonomy);
  const saveTaxFn = useServerFn(saveTaxon);
  const delTaxFn = useServerFn(deleteTaxon);

  const qbanks = useQuery({ queryKey: ["admin-qbanks"], queryFn: () => qbanksFn() });
  const [qbankId, setQbankId] = useState<number | null>(null);
  useEffect(() => { if (qbankId == null && qbanks.data?.length) setQbankId(qbanks.data[0].id); }, [qbanks.data, qbankId]);

  const [courseDraft, setCourseDraft] = useState<{ id?: number; slug: string; name: string; description: string } | null>(null);

  const courseM = useMutation({
    mutationFn: (d: { id?: number; slug: string; name: string; description: string }) =>
      saveQbankFn({ data: { id: d.id, slug: d.slug, name: d.name, description: d.description || null } }),
    onSuccess: () => { toast.success("Course saved"); setCourseDraft(null); qc.invalidateQueries({ queryKey: ["admin-qbanks"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const tax = useQuery({
    queryKey: ["admin-tax", qbankId],
    queryFn: () => taxFn({ data: { qbank_id: qbankId! } }),
    enabled: qbankId != null,
  });

  const taxM = useMutation({
    mutationFn: (d: { kind: "subjects" | "systems"; id?: number; name: string }) =>
      saveTaxFn({ data: { kind: d.kind, id: d.id, qbank_id: qbankId!, name: d.name } }),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["admin-tax"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const taxDelM = useMutation({
    mutationFn: (d: { kind: "subjects" | "systems"; id: number }) => delTaxFn({ data: d }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin-tax"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Layers className="h-5 w-5" /> Courses</CardTitle>
          <Button size="sm" onClick={() => setCourseDraft({ slug: "", name: "", description: "" })}><Plus className="h-4 w-4 mr-1" /> New course</Button>
        </CardHeader>
        <CardContent>
          <div className="border rounded divide-y">
            {(qbanks.data ?? []).map((q) => (
              <div key={q.id} className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{q.name}</div>
                  <div className="text-xs text-muted-foreground">{q.slug} · {q.question_count} questions</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setCourseDraft({ id: q.id, slug: q.slug, name: q.name, description: q.description ?? "" })}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">Subjects & systems</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs">Course</Label>
            <select className="border rounded h-9 px-2 text-sm block bg-background" value={qbankId ?? ""} onChange={(e) => setQbankId(Number(e.target.value))}>
              {(qbanks.data ?? []).map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
            </select>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <TaxonList title="Subjects" kind="subjects" items={tax.data?.subjects ?? []} onSave={(id, name) => taxM.mutate({ kind: "subjects", id, name })} onDelete={(id) => taxDelM.mutate({ kind: "subjects", id })} />
            <TaxonList title="Systems" kind="systems" items={tax.data?.systems ?? []} onSave={(id, name) => taxM.mutate({ kind: "systems", id, name })} onDelete={(id) => taxDelM.mutate({ kind: "systems", id })} />
          </div>
        </CardContent>
      </Card>

      <LibrarySection qbankId={qbankId} />

      <Dialog open={!!courseDraft} onOpenChange={(o) => !o && setCourseDraft(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{courseDraft?.id ? "Edit course" : "New course"}</DialogTitle></DialogHeader>
          {courseDraft && (
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={courseDraft.name} onChange={(e) => setCourseDraft({ ...courseDraft, name: e.target.value })} /></div>
              <div><Label>Short code</Label><Input value={courseDraft.slug} onChange={(e) => setCourseDraft({ ...courseDraft, slug: e.target.value })} placeholder="e.g. step2" /></div>
              <div><Label>Description</Label><Textarea rows={3} value={courseDraft.description} onChange={(e) => setCourseDraft({ ...courseDraft, description: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCourseDraft(null)}>Cancel</Button>
            <Button disabled={courseM.isPending} onClick={() => courseDraft && courseM.mutate(courseDraft)}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TaxonList({ title, kind, items, onSave, onDelete }: {
  title: string;
  kind: "subjects" | "systems";
  items: { id: number; name: string; count: number | null }[];
  onSave: (id: number | undefined, name: string) => void;
  onDelete: (id: number) => void;
}) {
  const [adding, setAdding] = useState("");
  return (
    <div className="border rounded">
      <div className="p-2 font-medium text-sm border-b">{title}</div>
      <div className="max-h-72 overflow-y-auto divide-y">
        {items.map((s) => (
          <Row key={s.id} name={s.name} count={s.count} onSave={(n) => onSave(s.id, n)} onDelete={() => { if (confirm(`Delete "${s.name}"?`)) onDelete(s.id); }} />
        ))}
        {!items.length && <div className="p-3 text-xs text-muted-foreground">Nothing yet.</div>}
      </div>
      <div className="p-2 flex gap-2 border-t">
        <Input value={adding} onChange={(e) => setAdding(e.target.value)} placeholder={`Add ${kind === "subjects" ? "subject" : "system"}`} className="h-8" />
        <Button size="sm" onClick={() => { if (adding.trim()) { onSave(undefined, adding.trim()); setAdding(""); } }}>Add</Button>
      </div>
    </div>
  );
}

function Row({ name, count, onSave, onDelete }: { name: string; count: number | null; onSave: (n: string) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(name);
  useEffect(() => setVal(name), [name]);
  return (
    <div className="p-2 flex items-center gap-2">
      {editing ? (
        <>
          <Input value={val} onChange={(e) => setVal(e.target.value)} className="h-8" />
          <Button size="sm" onClick={() => { onSave(val); setEditing(false); }}>Save</Button>
        </>
      ) : (
        <>
          <span className="text-sm flex-1 truncate">{name}</span>
          {count != null && <span className="text-[11px] text-muted-foreground">{count}</span>}
          <Button size="icon" variant="ghost" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" onClick={onDelete}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
        </>
      )}
    </div>
  );
}

function LibrarySection({ qbankId }: { qbankId: number | null }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listLibraryDocs);
  const getFn = useServerFn(getLibraryDoc);
  const saveFn = useServerFn(saveLibraryDoc);
  const delFn = useServerFn(deleteLibraryDoc);

  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 20;
  const [draft, setDraft] = useState<{ id?: number; title: string; path: string; html: string } | null>(null);

  const docs = useQuery({
    queryKey: ["admin-library", qbankId, applied, page],
    queryFn: () => listFn({ data: { qbank_id: qbankId!, search: applied || undefined, limit: pageSize, offset: page * pageSize } }),
    enabled: qbankId != null,
  });

  const saveM = useMutation({
    mutationFn: (d: { id?: number; title: string; path: string; html: string }) =>
      saveFn({ data: { id: d.id, qbank_id: qbankId!, title: d.title, path: d.path || null, html: d.html } }),
    onSuccess: () => { toast.success("Article saved"); setDraft(null); qc.invalidateQueries({ queryKey: ["admin-library"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const delM = useMutation({
    mutationFn: (id: number) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Article deleted"); qc.invalidateQueries({ queryKey: ["admin-library"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const total = docs.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" /> Medical library</CardTitle>
        <Button size="sm" onClick={() => setDraft({ title: "", path: "", html: "" })}><Plus className="h-4 w-4 mr-1" /> New article</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search titles" className="max-w-xs" onKeyDown={(e) => { if (e.key === "Enter") { setApplied(search); setPage(0); } }} />
          <Button variant="secondary" onClick={() => { setApplied(search); setPage(0); }}>Search</Button>
        </div>
        <div className="border rounded divide-y max-h-96 overflow-y-auto">
          {(docs.data?.rows ?? []).map((d) => (
            <div key={d.id} className="p-2 flex items-center gap-2">
              <span className="text-sm flex-1 truncate">{d.title}</span>
              <Button size="icon" variant="ghost" onClick={async () => {
                const full = await getFn({ data: { id: d.id } });
                if (full) setDraft({ id: full.id, title: full.title, path: full.path ?? "", html: full.html });
              }}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Delete "${d.title}"?`)) delM.mutate(d.id); }}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          {!(docs.data?.rows ?? []).length && <div className="p-3 text-xs text-muted-foreground">No articles.</div>}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="text-xs text-muted-foreground">Page {page + 1} of {pages} · {total} article(s)</span>
          <Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </CardContent>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{draft?.id ? "Edit article" : "New article"}</DialogTitle></DialogHeader>
          {draft && (
            <div className="space-y-3">
              <div><Label>Title</Label><Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></div>
              <div><Label>Section path (optional)</Label><Input value={draft.path} onChange={(e) => setDraft({ ...draft, path: e.target.value })} /></div>
              <div><Label>Content (HTML)</Label><Textarea rows={16} value={draft.html} onChange={(e) => setDraft({ ...draft, html: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
            <Button disabled={saveM.isPending} onClick={() => draft && saveM.mutate(draft)}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
