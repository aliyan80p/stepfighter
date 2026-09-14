import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { BookOpen, Plus, Trash2, Search } from "lucide-react";
import {
  listQbanks, listLibraryDocs, getLibraryDoc, updateLibraryDoc, createLibraryDoc, deleteLibraryDoc,
  type LibraryDocFull,
} from "@/lib/admin-content.functions";

export function LibraryTab() {
  const qbanksFn = useServerFn(listQbanks);
  const listFn = useServerFn(listLibraryDocs);
  const getFn = useServerFn(getLibraryDoc);
  const createFn = useServerFn(createLibraryDoc);

  const qbanksQ = useQuery({ queryKey: ["admin-qbanks"], queryFn: () => qbanksFn() });
  const [qbankId, setQbankId] = useState<number | null>(null);
  const [term, setTerm] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [doc, setDoc] = useState<LibraryDocFull | null>(null);

  useEffect(() => {
    if (qbankId === null && qbanksQ.data?.rows.length) setQbankId(qbanksQ.data.rows[0].id);
  }, [qbanksQ.data, qbankId]);

  const listQ = useQuery({
    queryKey: ["admin-library", qbankId, submitted],
    queryFn: () => listFn({ data: { qbank_id: qbankId!, search: submitted, limit: 60 } }),
    enabled: qbankId !== null,
  });

  const open = async (id: number) => {
    try {
      const d = await getFn({ data: { id } });
      if (!d) { toast.error("Article not found"); return; }
      setDoc(d);
    } catch (e) { toast.error((e as Error).message); }
  };

  const addNew = async () => {
    if (qbankId === null) return;
    try {
      const res = await createFn({ data: { qbank_id: qbankId, title: "Untitled article", html: "<p></p>" } });
      if (res.id !== null) await open(res.id);
      else toast.success("Saved as a draft — publish it to make it live");
      listQ.refetch();
    } catch (e) { toast.error((e as Error).message); }
  };

  if (doc) {
    return (
      <LibraryEditor
        doc={doc}
        onClose={() => setDoc(null)}
        onChanged={() => { setDoc(null); listQ.refetch(); }}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" /> Medical library</CardTitle>
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
            <Label className="text-xs">Search titles</Label>
            <Search className="absolute left-3 bottom-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={term} onChange={(e) => setTerm(e.target.value)} className="pl-9" placeholder="e.g. myocardial" />
          </div>
          <Button type="submit" variant="secondary">Search</Button>
          <Button type="button" onClick={addNew}><Plus className="h-4 w-4 mr-1" /> New article</Button>
        </form>

        {listQ.isLoading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>
        ) : (
          <div className="divide-y border rounded-md max-h-[60vh] overflow-y-auto">
            {(listQ.data?.rows ?? []).map((d) => (
              <button
                key={d.id}
                onClick={() => open(d.id)}
                className="w-full text-left p-3 hover:bg-muted/40 transition-colors"
              >
                <div className="text-sm">{d.title}</div>
                <div className="text-xs text-muted-foreground font-mono">#{d.id}</div>
              </button>
            ))}
            {!listQ.data?.rows.length && (
              <div className="p-8 text-center text-sm text-muted-foreground">No articles found.</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LibraryEditor({
  doc, onClose, onChanged,
}: { doc: LibraryDocFull; onClose: () => void; onChanged: () => void }) {
  const saveFn = useServerFn(updateLibraryDoc);
  const delFn = useServerFn(deleteLibraryDoc);
  const [title, setTitle] = useState(doc.title);
  const [html, setHtml] = useState(doc.html);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await saveFn({ data: { id: doc.id, title, html } });
      toast.success("Article saved");
      onChanged();
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };

  const remove = async () => {
    if (!confirm("Delete this article permanently?")) return;
    try {
      await delFn({ data: { id: doc.id } });
      toast.success("Article deleted");
      onChanged();
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <BookOpen className="h-4 w-4" /> Article #{doc.id}
        </CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setPreview((p) => !p)}>
            {preview ? "Edit" : "Preview"}
          </Button>
          <Button size="sm" variant="outline" onClick={onClose}>Back to list</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        {preview ? (
          <div
            className="prose prose-sm dark:prose-invert max-w-none border rounded p-4 max-h-[60vh] overflow-y-auto"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <div>
            <Label>Content (HTML)</Label>
            <Textarea value={html} onChange={(e) => setHtml(e.target.value)} rows={22} className="font-mono text-xs" />
          </div>
        )}
        <div className="flex gap-2 border-t pt-4">
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="ghost" className="ml-auto text-destructive" onClick={remove}>
            <Trash2 className="h-4 w-4 mr-1" /> Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
