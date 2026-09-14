import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Download, Upload, FileSearch } from "lucide-react";
import {
  exportQuestionsPage, listQuestionIds, importQuestions,
  type ExportedQuestion, type ImportItem,
} from "@/lib/admin-content.functions";

type FileReport = {
  fileName: string;
  items: ImportItem[];
  missing: number[];
  present: number[];
};

const CHUNK = 100;

export function ImportExportPanel({ qbankId, qbankName, onChanged }: {
  qbankId: number;
  qbankName: string;
  onChanged: () => void;
}) {
  const exportFn = useServerFn(exportQuestionsPage);
  const idsFn = useServerFn(listQuestionIds);
  const importFn = useServerFn(importQuestions);

  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [report, setReport] = useState<FileReport | null>(null);

  const doExport = async () => {
    setBusy("Preparing download…");
    try {
      const all: ExportedQuestion[] = [];
      let offset = 0;
      for (;;) {
        const page = await exportFn({ data: { qbank_id: qbankId, offset } });
        all.push(...page.rows);
        setBusy(`Collected ${all.length} questions…`);
        if (page.done) break;
        offset = page.nextOffset;
      }
      const blob = new Blob([JSON.stringify(all, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${qbankName.replace(/\s+/g, "-").toLowerCase()}-questions.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${all.length} questions`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const readFile = async (file: File) => {
    setBusy("Reading file…");
    setReport(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const raw: any[] = Array.isArray(parsed) ? parsed : (parsed?.questions ?? []);
      if (!Array.isArray(raw) || !raw.length) throw new Error("That file has no questions in it");

      const items: ImportItem[] = raw.map((r) => ({
        id: Number(r.id ?? r.question_id),
        title: r.title ?? null,
        question: String(r.question ?? r.stem ?? ""),
        explanation: r.explanation ?? null,
        correct_answer: r.correct_answer ?? null,
        media_name: r.media_name ?? null,
        other_medias: r.other_medias ?? null,
        source: r.source ?? null,
        subject_id: r.subject_id ?? null,
        system_id: r.system_id ?? null,
        answers: Array.isArray(r.answers)
          ? r.answers.map((a: any, i: number) => ({
              answer_index: typeof a.answer_index === "number" ? a.answer_index : i,
              answer_text: String(a.answer_text ?? a.text ?? ""),
            }))
          : [],
      }));
      if (items.some((i) => !Number.isFinite(i.id))) {
        throw new Error("Every question in the file needs a question number");
      }

      setBusy("Comparing with the question bank…");
      const { ids } = await idsFn({ data: { qbank_id: qbankId } });
      const have = new Set(ids);
      const missing = items.map((i) => i.id).filter((id) => !have.has(id));
      const present = items.map((i) => i.id).filter((id) => have.has(id));
      setReport({ fileName: file.name, items, missing, present });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const runImport = async (mode: "missing" | "all") => {
    if (!report) return;
    const items = mode === "missing"
      ? report.items.filter((i) => report.missing.includes(i.id))
      : report.items;
    if (!items.length) return;

    setBusy("Saving…");
    let added = 0, updated = 0;
    try {
      for (let i = 0; i < items.length; i += CHUNK) {
        const res = await importFn({ data: { qbank_id: qbankId, mode, items: items.slice(i, i + CHUNK) } });
        added += res.added;
        updated += res.updated;
        setBusy(`Saved ${Math.min(i + CHUNK, items.length)} of ${items.length}…`);
      }
      toast.success(`${added} question${added === 1 ? "" : "s"} added${updated ? `, ${updated} updated` : ""}`);
      setReport(null);
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSearch className="h-4 w-4" /> Import, export and check for missing questions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={doExport} disabled={busy !== null}>
            <Download className="h-4 w-4 mr-1" /> Download all questions
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = ""; }}
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy !== null}>
            <Upload className="h-4 w-4 mr-1" /> Choose an updated file
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Download the current questions as a file, or pick a newer file to see exactly which
          question numbers are not in this course yet — then add them in one go.
        </p>

        {busy && <div className="text-sm text-muted-foreground">{busy}</div>}

        {report && (
          <div className="border rounded-md p-4 space-y-3">
            <div className="text-sm">
              <span className="font-medium">{report.fileName}</span> — {report.items.length} questions in the file,{" "}
              {report.present.length} already here,{" "}
              <span className={report.missing.length ? "text-destructive font-medium" : ""}>
                {report.missing.length} missing
              </span>
              .
            </div>

            {report.missing.length > 0 && (
              <div className="text-xs font-mono max-h-32 overflow-auto bg-muted/40 rounded p-2">
                {report.missing.map((id) => `#${id}`).join("  ")}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => runImport("missing")}
                disabled={busy !== null || !report.missing.length}
              >
                Add the {report.missing.length} missing question{report.missing.length === 1 ? "" : "s"}
              </Button>
              <Button variant="secondary" onClick={() => runImport("all")} disabled={busy !== null}>
                Add missing and overwrite the rest
              </Button>
              <Button variant="ghost" onClick={() => setReport(null)} disabled={busy !== null}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
