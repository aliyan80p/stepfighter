import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { listNotes, deleteNote } from "@/lib/notes.functions";
import { setActiveQbankId, useActiveQbankId, QBANKS } from "@/lib/active-qbank";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/components/confirm-dialog";
import { Search, Trash2, Pencil, ExternalLink, StickyNote } from "lucide-react";
import { NotesModal } from "@/components/notes-modal";

export const Route = createFileRoute("/_authenticated/notes/")({
  component: NotesBrowser,
});

function NotesBrowser() {
  const list = useServerFn(listNotes);
  const del = useServerFn(deleteNote);
  const qc = useQueryClient();
  const router = useRouter();

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["notes-list"],
    queryFn: () => list(),
  });

  const activeQbankId = useActiveQbankId();
  const activeQbankName = QBANKS.find((q) => q.id === activeQbankId)?.name ?? "";

  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState<string>("all");
  const [pageSize, setPageSize] = useState(25);
  const { confirm, dialog } = useConfirm();
  const [editNote, setEditNote] = useState<{ qbankId: number; questionId: number } | null>(null);

  // Notes scoped to the currently selected qbank
  const scopedNotes = useMemo(
    () => notes.filter((n) => Number(n.qbankId) === activeQbankId),
    [notes, activeQbankId],
  );

  const subjects = useMemo(
    () => Array.from(new Set(scopedNotes.map((n) => n.subject).filter(Boolean))) as string[],
    [scopedNotes],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scopedNotes.filter((n) => {
      if (subject !== "all" && n.subject !== subject) return false;
      if (!q) return true;
      return (
        n.content?.toLowerCase().includes(q) ||
        String(n.questionId).includes(q) ||
        n.subject?.toLowerCase().includes(q) ||
        n.system?.toLowerCase().includes(q)
      );
    }).slice(0, pageSize);
  }, [scopedNotes, search, subject, pageSize]);

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes-list"] }),
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            <StickyNote className="h-6 w-6" /> My Notes
          </h1>
          <p className="text-sm text-muted-foreground">View and manage your study notes from quizzes</p>
        </div>
        <Badge variant="default" className="text-sm px-3 py-1">{notes.length} Notes</Badge>
      </div>

      <div className="bg-card border rounded-lg p-4 mb-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 text-sm">
          <span>Show</span>
          <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
            <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[10, 25, 50, 100].map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span>entries</span>
        </div>

        {activeQbankName && (
          <Badge variant="outline" className="text-xs">{activeQbankName}</Badge>
        )}

        <Select value={subject} onValueChange={setSubject}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Subject" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Subjects</SelectItem>
            {subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="ml-auto relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9 w-64"
            placeholder="Search notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-primary text-primary-foreground px-4 py-3 rounded-t-lg font-semibold">
        Notes
      </div>

      <div className="border border-t-0 rounded-b-lg divide-y">
        {isLoading && <div className="p-8 text-center text-muted-foreground">Loading...</div>}
        {!isLoading && filtered.length === 0 && (
          <div className="p-10 text-center text-muted-foreground">
            No notes yet. Open the Notes icon during a quiz to save your first one.
          </div>
        )}
        {filtered.map((n) => (
          <div key={n.id} className="p-4 flex items-start gap-4 hover:bg-muted/30">
            <div className="flex-1 min-w-0">
              {n.content && (
                <p className="text-sm mb-2 line-clamp-2">{n.content}</p>
              )}
              <div className="flex flex-wrap gap-2 items-center text-xs text-muted-foreground">
                <span>Question ID: <b className="text-foreground">{n.questionId}</b></span>
                {n.qbankName && <Badge variant="outline" className="text-xs">{n.qbankName}</Badge>}
                {n.subject && <Badge variant="secondary" className="text-xs">{n.subject}</Badge>}
                {n.system && <Badge variant="secondary" className="text-xs">{n.system}</Badge>}
                <span className="ml-auto">
                  {n.updatedAt ? new Date(n.updatedAt).toLocaleString() : ""}
                </span>
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button
                size="icon"
                variant="ghost"
                title="Open question"
                onClick={() => {
                  if (n.qbankId) setActiveQbankId(Number(n.qbankId));
                  router.navigate({ to: "/qbanks/search", search: { q: String(n.questionId), open: String(n.questionId) } as never });
                }}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" title="Edit note"
                onClick={() => {
                  setEditNote({ qbankId: Number(n.qbankId), questionId: Number(n.questionId) });
                }}>
                <Pencil className="h-4 w-4 text-blue-500" />
              </Button>

              <Button size="icon" variant="ghost" title="Delete"
                onClick={async () => {
                  const ok = await confirm({
                    title: "Delete this note?",
                    description: "This cannot be undone.",
                    confirmLabel: "Delete",
                  });
                  if (ok) delMut.mutate(n.id);
                }}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {dialog}
      <NotesModal
        open={!!editNote}
        onClose={() => {
          setEditNote(null);
          qc.invalidateQueries({ queryKey: ["notes-list"] });
        }}
        qbankId={editNote?.qbankId}
        questionId={editNote?.questionId}
      />
    </div>
  );
}
