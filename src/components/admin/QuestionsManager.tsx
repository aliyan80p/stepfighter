import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, Trash2, Pencil, X } from "lucide-react";
import {
  listQbanksAdmin, listTaxonomy, listSources, searchQuestions,
  getFullQuestion, saveFullQuestion, deleteQuestion,
  type FullQuestion, type QuestionInput,
} from "@/lib/admin-content.functions";

type Draft = QuestionInput & {
  answers: { answer_index: number; answer_text: string; correct_percentage?: number | null }[];
  refs: { ref_title?: string | null; ref_link?: string | null }[];
};

function emptyDraft(qbankId: number): Draft {
  return {
    qbank_id: qbankId,
    title: "",
    question: "",
    explanation: "",
    correct_answer: 0,
    subject_id: null,
    system_id: null,
    source: "custom",
    media_name: "",
    other_medias: "",
    answers: [0, 1, 2, 3].map((i) => ({ answer_index: i, answer_text: "", correct_percentage: null })),
    refs: [],
  };
}

export function QuestionsManager() {
  const qc = useQueryClient();
  const qbanksFn = useServerFn(listQbanksAdmin);
  const taxFn = useServerFn(listTaxonomy);
  const sourcesFn = useServerFn(listSources);
  const searchFn = useServerFn(searchQuestions);
  const getFn = useServerFn(getFullQuestion);
  const saveFn = useServerFn(saveFullQuestion);
  const delFn = useServerFn(deleteQuestion);

  const qbanks = useQuery({ queryKey: ["admin-qbanks"], queryFn: () => qbanksFn() });
  const [qbankId, setQbankId] = useState<number | null>(null);
  useEffect(() => {
    if (qbankId == null && qbanks.data?.length) setQbankId(qbanks.data[0].id);
  }, [qbanks.data, qbankId]);

  const [text, setText] = useState("");
  const [applied, setApplied] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [systemId, setSystemId] = useState("");
  const [source, setSource] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const tax = useQuery({
    queryKey: ["admin-tax", qbankId],
    queryFn: () => taxFn({ data: { qbank_id: qbankId! } }),
    enabled: qbankId != null,
  });
  const sources = useQuery({
    queryKey: ["admin-sources", qbankId],
    queryFn: () => sourcesFn({ data: { qbank_id: qbankId! } }),
    enabled: qbankId != null,
  });

  const list = useQuery({
    queryKey: ["admin-questions", qbankId, applied, subjectId, systemId, source, page],
    queryFn: () =>
      searchFn({
        data: {
          qbank_id: qbankId!,
          text: applied || undefined,
          subject_id: subjectId ? Number(subjectId) : null,
          system_id: systemId ? Number(systemId) : null,
          source: source || null,
          limit: pageSize,
          offset: page * pageSize,
        },
      }),
    enabled: qbankId != null,
  });

  const [draft, setDraft] = useState<Draft | null>(null);
  const [open, setOpen] = useState(false);

  const openNew = () => {
    if (qbankId == null) return;
    setDraft(emptyDraft(qbankId));
    setOpen(true);
  };

  const openEdit = async (id: number) => {
    try {
      const q = (await getFn({ data: { id } })) as FullQuestion | null;
      if (!q) return toast.error("Question not found");
      setDraft({
        ...q,
        answers: q.answers.length
          ? q.answers.map((a) => ({ answer_index: a.answer_index, answer_text: a.answer_text, correct_percentage: a.correct_percentage }))
          : emptyDraft(q.qbank_id).answers,
        refs: q.refs.map((r) => ({ ref_title: r.ref_title, ref_link: r.ref_link })),
      });
      setOpen(true);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const saveM = useMutation({
    mutationFn: (d: Draft) => saveFn({ data: d }),
    onSuccess: () => {
      toast.success("Saved");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-questions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delM = useMutation({
    mutationFn: (id: number) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Question deleted");
      qc.invalidateQueries({ queryKey: ["admin-questions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const subjectName = useMemo(
    () => new Map((tax.data?.subjects ?? []).map((s) => [s.id, s.name])),
    [tax.data],
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2"><Pencil className="h-5 w-5" /> Questions</CardTitle>
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" /> New question</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <Label className="text-xs">Course</Label>
            <select
              className="border rounded h-9 px-2 text-sm block bg-background"
              value={qbankId ?? ""}
              onChange={(e) => { setQbankId(Number(e.target.value)); setPage(0); setSubjectId(""); setSystemId(""); setSource(""); }}
            >
              {(qbanks.data ?? []).map((q) => (
                <option key={q.id} value={q.id}>{q.name} ({q.question_count})</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">Subject</Label>
            <select className="border rounded h-9 px-2 text-sm block bg-background max-w-[200px]" value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setPage(0); }}>
              <option value="">All</option>
              {(tax.data?.subjects ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs">System</Label>
            <select className="border rounded h-9 px-2 text-sm block bg-background max-w-[200px]" value={systemId} onChange={(e) => { setSystemId(e.target.value); setPage(0); }}>
              <option value="">All</option>
              {(tax.data?.systems ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs">Source</Label>
            <select className="border rounded h-9 px-2 text-sm block bg-background max-w-[180px]" value={source} onChange={(e) => { setSource(e.target.value); setPage(0); }}>
              <option value="">All</option>
              {(sources.data ?? []).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex gap-2 items-end">
            <div>
              <Label className="text-xs">Search (text or ID)</Label>
              <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { setApplied(text); setPage(0); } }} className="w-56" placeholder="e.g. myocardial or 10670" />
            </div>
            <Button variant="secondary" onClick={() => { setApplied(text); setPage(0); }}><Search className="h-4 w-4" /></Button>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">{total} question(s)</div>

        <div className="border rounded divide-y">
          {list.isLoading && <div className="p-4 text-sm text-muted-foreground">Loading…</div>}
          {(list.data?.rows ?? []).map((r) => (
            <div key={r.id} className="p-3 flex items-start gap-3">
              <div className="text-xs font-mono text-muted-foreground w-16 shrink-0 pt-1">#{r.id}</div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm truncate">{r.title || "(untitled)"}</div>
                <div className="text-xs text-muted-foreground line-clamp-2">{r.question.replace(/<[^>]*>/g, " ").slice(0, 220)}</div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  {r.source}{r.subject_id ? ` · ${subjectName.get(r.subject_id) ?? ""}` : ""}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => openEdit(r.id)}><Pencil className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Delete question #${r.id}? This cannot be undone.`)) delM.mutate(r.id); }}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
          {!list.isLoading && !(list.data?.rows ?? []).length && (
            <div className="p-4 text-sm text-muted-foreground">No questions match.</div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="text-xs text-muted-foreground">Page {page + 1} of {pages}</span>
          <Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft?.id ? `Edit question #${draft.id}` : "New question"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <div><Label>Title / topic</Label><Input value={draft.title ?? ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></div>
                <div><Label>Source</Label><Input value={draft.source ?? ""} onChange={(e) => setDraft({ ...draft, source: e.target.value })} /></div>
                <div>
                  <Label>Subject</Label>
                  <select className="border rounded h-9 px-2 text-sm w-full bg-background" value={draft.subject_id ?? ""} onChange={(e) => setDraft({ ...draft, subject_id: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">None</option>
                    {(tax.data?.subjects ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label>System</Label>
                  <select className="border rounded h-9 px-2 text-sm w-full bg-background" value={draft.system_id ?? ""} onChange={(e) => setDraft({ ...draft, system_id: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">None</option>
                    {(tax.data?.systems ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              <div><Label>Question</Label><Textarea rows={8} value={draft.question} onChange={(e) => setDraft({ ...draft, question: e.target.value })} /></div>

              <div className="space-y-2">
                <Label>Answer choices (select the correct one)</Label>
                {draft.answers.map((a, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="radio" name="correct" checked={draft.correct_answer === a.answer_index} onChange={() => setDraft({ ...draft, correct_answer: a.answer_index })} />
                    <span className="text-xs w-5 text-muted-foreground">{String.fromCharCode(65 + i)}</span>
                    <Input value={a.answer_text} onChange={(e) => {
                      const answers = [...draft.answers];
                      answers[i] = { ...a, answer_text: e.target.value };
                      setDraft({ ...draft, answers });
                    }} />
                    <Button size="icon" variant="ghost" onClick={() => {
                      const answers = draft.answers.filter((_, j) => j !== i).map((x, j) => ({ ...x, answer_index: j }));
                      setDraft({ ...draft, answers });
                    }}><X className="h-4 w-4" /></Button>
                  </div>
                ))}
                <Button size="sm" variant="outline" onClick={() => setDraft({ ...draft, answers: [...draft.answers, { answer_index: draft.answers.length, answer_text: "", correct_percentage: null }] })}>
                  <Plus className="h-4 w-4 mr-1" /> Add choice
                </Button>
              </div>

              <div><Label>Explanation</Label><Textarea rows={8} value={draft.explanation ?? ""} onChange={(e) => setDraft({ ...draft, explanation: e.target.value })} /></div>

              <div className="grid md:grid-cols-2 gap-3">
                <div><Label>Main image name</Label><Input value={draft.media_name ?? ""} onChange={(e) => setDraft({ ...draft, media_name: e.target.value })} placeholder="e.g. 12345.jpg" /></div>
                <div><Label>Other images (comma separated)</Label><Input value={draft.other_medias ?? ""} onChange={(e) => setDraft({ ...draft, other_medias: e.target.value })} /></div>
              </div>

              <div className="space-y-2">
                <Label>References</Label>
                {draft.refs.map((r, i) => (
                  <div key={i} className="flex gap-2">
                    <Input placeholder="Title" value={r.ref_title ?? ""} onChange={(e) => {
                      const refs = [...draft.refs]; refs[i] = { ...r, ref_title: e.target.value }; setDraft({ ...draft, refs });
                    }} />
                    <Input placeholder="Link" value={r.ref_link ?? ""} onChange={(e) => {
                      const refs = [...draft.refs]; refs[i] = { ...r, ref_link: e.target.value }; setDraft({ ...draft, refs });
                    }} />
                    <Button size="icon" variant="ghost" onClick={() => setDraft({ ...draft, refs: draft.refs.filter((_, j) => j !== i) })}><X className="h-4 w-4" /></Button>
                  </div>
                ))}
                <Button size="sm" variant="outline" onClick={() => setDraft({ ...draft, refs: [...draft.refs, { ref_title: "", ref_link: "" }] })}>
                  <Plus className="h-4 w-4 mr-1" /> Add reference
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={saveM.isPending} onClick={() => draft && saveM.mutate(draft)}>
              {saveM.isPending ? "Saving…" : "Save question"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
