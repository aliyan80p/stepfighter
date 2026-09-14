import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Pencil, Search, Plus, Trash2, ImagePlus, Check } from "lucide-react";
import {
  listQbanks, searchQuestions, getQuestionFull, updateQuestionFull, uploadQuestionMedia,
  type AdminQuestionFull,
} from "@/lib/admin-content.functions";
import { ImportExportPanel } from "./ImportExportPanel";

type Choice = { id?: number; answer_index: number; answer_text: string };

export function QuestionsTab() {
  const qbanksFn = useServerFn(listQbanks);
  const searchFn = useServerFn(searchQuestions);
  const getFn = useServerFn(getQuestionFull);

  const qbanksQ = useQuery({ queryKey: ["admin-qbanks"], queryFn: () => qbanksFn() });
  const [qbankId, setQbankId] = useState<number | null>(null);
  const [term, setTerm] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [selected, setSelected] = useState<AdminQuestionFull | null>(null);

  useEffect(() => {
    if (qbankId === null && qbanksQ.data?.rows.length) setQbankId(qbanksQ.data.rows[0].id);
  }, [qbanksQ.data, qbankId]);

  const listQ = useQuery({
    queryKey: ["admin-questions", qbankId, submitted],
    queryFn: () => searchFn({ data: { qbank_id: qbankId!, search: submitted, limit: 40 } }),
    enabled: qbankId !== null,
  });

  const open = async (id: number) => {
    try {
      const q = await getFn({ data: { qbank_id: qbankId!, id } });
      if (!q) { toast.error("Question not found"); return; }
      setSelected(q);
    } catch (e) { toast.error((e as Error).message); }
  };

  if (selected) {
    return (
      <QuestionEditor
        question={selected}
        onClose={() => setSelected(null)}
        onSaved={() => { setSelected(null); listQ.refetch(); }}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Pencil className="h-5 w-5" /> Question bank</CardTitle>
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
            <Label className="text-xs">Search</Label>
            <Search className="absolute left-3 bottom-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Question number or any words…"
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="secondary">Search</Button>
        </form>

        {listQ.isLoading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>
        ) : (
          <div className="divide-y border rounded-md">
            {(listQ.data?.rows ?? []).map((q) => (
              <button
                key={q.id}
                onClick={() => open(q.id)}
                className="w-full text-left p-3 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <span className="font-mono">#{q.id}</span>
                  <span>{q.source}</span>
                </div>
                <div className="text-sm line-clamp-2">
                  {q.title?.trim() || stripTags(q.question).slice(0, 180)}
                </div>
              </button>
            ))}
            {!listQ.data?.rows.length && (
              <div className="p-8 text-center text-sm text-muted-foreground">No questions found.</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function stripTags(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function QuestionEditor({
  question, onClose, onSaved,
}: { question: AdminQuestionFull; onClose: () => void; onSaved: () => void }) {
  const saveFn = useServerFn(updateQuestionFull);
  const uploadFn = useServerFn(uploadQuestionMedia);

  const [title, setTitle] = useState(question.title ?? "");
  const [stem, setStem] = useState(question.question);
  const [explanation, setExplanation] = useState(question.explanation ?? "");
  const [correct, setCorrect] = useState<number | null>(question.correct_answer);
  const [mediaName, setMediaName] = useState(question.media_name ?? "");
  const [others, setOthers] = useState<string[]>(
    (question.other_medias ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  );
  const [choices, setChoices] = useState<Choice[]>(
    question.answers.map((a) => ({ id: a.id, answer_index: a.answer_index, answer_text: a.answer_text })),
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const mainFileRef = useRef<HTMLInputElement>(null);
  const extraFileRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File, target: "main" | "extra") => {
    setUploading(true);
    try {
      const buf = await file.arrayBuffer();
      let binary = "";
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }
      const res = await uploadFn({
        data: { qbank_id: question.qbank_id, filename: file.name, contentBase64: btoa(binary) },
      });
      if (target === "main") setMediaName(res.name);
      else setOthers((prev) => (prev.includes(res.name) ? prev : [...prev, res.name]));
      toast.success("Image uploaded");
    } catch (e) { toast.error((e as Error).message); }
    finally { setUploading(false); }
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveFn({
        data: {
          qbank_id: question.qbank_id,
          id: question.id,
          title: title.trim() || null,
          question: stem,
          explanation: explanation.trim() || null,
          correct_answer: correct,
          media_name: mediaName.trim() || null,
          other_medias: others.length ? others.join(",") : null,
          answers: choices.map((c, i) => ({ id: c.id, answer_index: i, answer_text: c.answer_text })),
        },
      });
      toast.success("Question saved");
      onSaved();
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Pencil className="h-4 w-4" /> Editing question #{question.id}
        </CardTitle>
        <Button variant="outline" size="sm" onClick={onClose}>Back to list</Button>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div>
          <Label>Question</Label>
          <Textarea value={stem} onChange={(e) => setStem(e.target.value)} rows={10} className="font-mono text-xs" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Answer choices</Label>
            <Button
              type="button" size="sm" variant="outline"
              onClick={() => setChoices([...choices, { answer_index: choices.length, answer_text: "" }])}
            >
              <Plus className="h-3 w-3 mr-1" /> Add choice
            </Button>
          </div>
          <div className="space-y-2">
            {choices.map((c, i) => (
              <div key={c.id ?? `new-${i}`} className="flex items-start gap-2">
                <Button
                  type="button" size="sm"
                  variant={correct === i ? "default" : "outline"}
                  className="mt-0.5 shrink-0"
                  onClick={() => setCorrect(i)}
                  title="Mark as the correct answer"
                >
                  {correct === i ? <Check className="h-3 w-3" /> : String.fromCharCode(65 + i)}
                </Button>
                <Textarea
                  value={c.answer_text}
                  rows={2}
                  onChange={(e) => {
                    const next = [...choices];
                    next[i] = { ...c, answer_text: e.target.value };
                    setChoices(next);
                  }}
                />
                <Button
                  type="button" size="sm" variant="ghost" className="mt-0.5 shrink-0"
                  onClick={() => {
                    setChoices(choices.filter((_, idx) => idx !== i));
                    if (correct === i) setCorrect(null);
                  }}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
            {!choices.length && (
              <p className="text-xs text-muted-foreground">No choices yet — add one.</p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            The highlighted letter is the correct answer.
          </p>
        </div>

        <div>
          <Label>Explanation</Label>
          <Textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            rows={12}
            className="font-mono text-xs"
          />
        </div>

        <div className="space-y-3 border-t pt-4">
          <Label>Images</Label>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[220px]">
              <Label className="text-xs">Main image file name</Label>
              <Input value={mediaName} onChange={(e) => setMediaName(e.target.value)} placeholder="none" />
            </div>
            <input
              ref={mainFileRef} type="file" accept="image/*,video/mp4" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, "main"); e.target.value = ""; }}
            />
            <Button type="button" variant="outline" disabled={uploading} onClick={() => mainFileRef.current?.click()}>
              <ImagePlus className="h-4 w-4 mr-1" /> {uploading ? "Uploading…" : "Upload"}
            </Button>
          </div>

          <div>
            <Label className="text-xs">Extra images</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {others.map((n) => (
                <span key={n} className="inline-flex items-center gap-1 text-xs border rounded px-2 py-1">
                  {n}
                  <button
                    type="button"
                    onClick={() => setOthers(others.filter((x) => x !== n))}
                    className="text-destructive"
                  >×</button>
                </span>
              ))}
              {!others.length && <span className="text-xs text-muted-foreground">None</span>}
            </div>
            <input
              ref={extraFileRef} type="file" accept="image/*,video/mp4" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, "extra"); e.target.value = ""; }}
            />
            <Button
              type="button" size="sm" variant="outline" className="mt-2"
              disabled={uploading} onClick={() => extraFileRef.current?.click()}
            >
              <ImagePlus className="h-4 w-4 mr-1" /> Add image
            </Button>
          </div>
        </div>

        <div className="flex gap-2 border-t pt-4">
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}
