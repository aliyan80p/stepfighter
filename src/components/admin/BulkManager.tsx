import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Download, Upload } from "lucide-react";
import { listQbanksAdmin, bulkImportQuestions, exportQuestions } from "@/lib/admin-content.functions";

const SAMPLE = `[
  {
    "title": "Acute chest pain",
    "question": "A 55-year-old man ...",
    "explanation": "The answer is ...",
    "correct_answer": 0,
    "source": "custom",
    "answers": [
      { "answer_index": 0, "answer_text": "Myocardial infarction" },
      { "answer_index": 1, "answer_text": "Pericarditis" }
    ],
    "refs": [{ "ref_title": "UpToDate", "ref_link": "https://..." }]
  }
]`;

export function BulkManager() {
  const qbanksFn = useServerFn(listQbanksAdmin);
  const importFn = useServerFn(bulkImportQuestions);
  const exportFn = useServerFn(exportQuestions);

  const qbanks = useQuery({ queryKey: ["admin-qbanks"], queryFn: () => qbanksFn() });
  const [qbankId, setQbankId] = useState<number | null>(null);
  useEffect(() => { if (qbankId == null && qbanks.data?.length) setQbankId(qbanks.data[0].id); }, [qbanks.data, qbankId]);

  const [items, setItems] = useState<any[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<{ imported: number; errors: string[] } | null>(null);

  const onFile = async (f: File) => {
    setFileName(f.name);
    setReport(null);
    try {
      const parsed = JSON.parse(await f.text());
      if (!Array.isArray(parsed)) throw new Error("The file must contain a list");
      setItems(parsed);
      toast.success(`${parsed.length} question(s) read from file`);
    } catch (e) {
      setItems(null);
      toast.error(`Could not read file: ${(e as Error).message}`);
    }
  };

  const run = async (dryRun: boolean) => {
    if (!items || qbankId == null) return;
    setBusy(true);
    try {
      const res = await importFn({ data: { qbank_id: qbankId, items, dryRun } });
      setReport(res);
      toast.success(dryRun ? `${res.imported} ready to import` : `${res.imported} question(s) imported`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doExport = async () => {
    if (qbankId == null) return;
    setBusy(true);
    try {
      const all: any[] = [];
      for (let offset = 0; ; offset += 500) {
        const chunk = await exportFn({ data: { qbank_id: qbankId, limit: 500, offset } });
        all.push(...chunk);
        if (chunk.length < 500 || all.length >= 20000) break;
      }
      const blob = new Blob([JSON.stringify(all, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `questions-${qbankId}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${all.length} question(s) exported`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> Bulk import</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs">Course</Label>
            <select className="border rounded h-9 px-2 text-sm block bg-background" value={qbankId ?? ""} onChange={(e) => setQbankId(Number(e.target.value))}>
              {(qbanks.data ?? []).map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs">JSON file</Label>
            <input type="file" accept="application/json,.json" className="block text-sm mt-1"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
            {fileName && <div className="text-xs text-muted-foreground mt-1">{fileName} · {items?.length ?? 0} question(s)</div>}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={!items || busy} onClick={() => run(true)}>Check file</Button>
            <Button disabled={!items || busy} onClick={() => { if (confirm(`Import ${items?.length} question(s)?`)) run(false); }}>
              {busy ? "Working…" : "Import"}
            </Button>
          </div>
          {report && (
            <div className="text-sm border rounded p-3 space-y-1">
              <div>{report.imported} question(s) processed.</div>
              {report.errors.length > 0 && (
                <ul className="text-xs text-destructive list-disc pl-4 max-h-40 overflow-y-auto">
                  {report.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
          )}
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">File format example</summary>
            <pre className="mt-2 p-2 bg-muted rounded overflow-x-auto">{SAMPLE}</pre>
            <p className="mt-2">Include an <code>id</code> on a question to update an existing one; leave it out to add a new one. Nothing is ever deleted by an import.</p>
          </details>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Download className="h-5 w-5" /> Export</CardTitle></CardHeader>
        <CardContent>
          <Button variant="outline" disabled={busy} onClick={doExport}>Download all questions for this course</Button>
          <p className="text-xs text-muted-foreground mt-2">Downloads a JSON file you can edit and re-import.</p>
        </CardContent>
      </Card>
    </div>
  );
}
