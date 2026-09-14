import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Image as ImageIcon, Search, Trash2, Upload, AlertTriangle } from "lucide-react";
import {
  listQbanks, listMedia, deleteMedia, findMissingMedia, uploadQuestionMedia,
} from "@/lib/admin-content.functions";

export function MediaTab() {
  const qbanksFn = useServerFn(listQbanks);
  const listFn = useServerFn(listMedia);
  const delFn = useServerFn(deleteMedia);
  const missingFn = useServerFn(findMissingMedia);
  const uploadFn = useServerFn(uploadQuestionMedia);

  const qbanksQ = useQuery({ queryKey: ["admin-qbanks"], queryFn: () => qbanksFn() });
  const [qbankId, setQbankId] = useState<number | null>(null);
  const [term, setTerm] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [missing, setMissing] = useState<{ question_id: number; name: string }[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (qbankId === null && qbanksQ.data?.rows.length) setQbankId(qbanksQ.data.rows[0].id);
  }, [qbanksQ.data, qbankId]);

  const mediaQ = useQuery({
    queryKey: ["admin-media", qbankId, submitted],
    queryFn: () => listFn({ data: { qbank_id: qbankId!, search: submitted, limit: 100 } }),
    enabled: qbankId !== null,
  });

  const upload = async (file: File) => {
    if (qbankId === null) return;
    setBusy(true);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i += 8192) {
        bin += String.fromCharCode(...buf.subarray(i, i + 8192));
      }
      await uploadFn({
        data: { qbank_id: qbankId, filename: file.name, contentBase64: btoa(bin) },
      });
      toast.success(`Uploaded ${file.name}`);
      mediaQ.refetch();
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  };

  const remove = async (name: string) => {
    if (qbankId === null) return;
    if (!window.confirm(`Delete ${name}?`)) return;
    try {
      await delFn({ data: { qbank_id: qbankId, name } });
      toast.success("Deleted");
      mediaQ.refetch();
    } catch (e) { toast.error((e as Error).message); }
  };

  const checkMissing = async () => {
    if (qbankId === null) return;
    setBusy(true);
    try {
      const res = await missingFn({ data: { qbank_id: qbankId } });
      setMissing(res.rows);
      toast.success(res.rows.length ? `${res.rows.length} images are referenced but not stored` : "Every referenced image is present");
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" /> Media library
          </CardTitle>
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
                onChange={(e) => { setQbankId(Number(e.target.value)); setMissing(null); }}
                className="border rounded h-9 px-2 text-sm block bg-background"
              >
                {(qbanksQ.data?.rows ?? []).map((q) => (
                  <option key={q.id} value={q.id}>{q.name}</option>
                ))}
              </select>
            </div>
            <div className="relative flex-1 min-w-[220px]">
              <Label className="text-xs">Search file names</Label>
              <Search className="absolute left-3 bottom-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={term} onChange={(e) => setTerm(e.target.value)} className="pl-9" placeholder="e.g. l75496" />
            </div>
            <Button type="submit" variant="secondary">Search</Button>
            <Button type="button" variant="outline" disabled={busy} onClick={checkMissing}>
              <AlertTriangle className="h-4 w-4 mr-1" /> Check for missing images
            </Button>
            <label className="inline-flex">
              <input
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }}
              />
              <span className="inline-flex items-center h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm cursor-pointer">
                <Upload className="h-4 w-4 mr-1" /> Upload
              </span>
            </label>
          </form>

          <div className="text-xs text-muted-foreground">
            {mediaQ.data ? `${mediaQ.data.total} files in this course` : ""}
          </div>

          <div className="divide-y border rounded-md max-h-[55vh] overflow-y-auto">
            {(mediaQ.data?.rows ?? []).map((m) => (
              <div key={m.name} className="flex items-center gap-2 p-2">
                <span className="flex-1 text-sm font-mono truncate">{m.name}</span>
                <span className="text-xs text-muted-foreground">
                  {m.size_bytes ? `${Math.round(m.size_bytes / 1024)} KB` : ""}
                </span>
                <Button size="sm" variant="ghost" onClick={() => remove(m.name)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {mediaQ.isLoading && (
              <div className="p-6 text-sm text-muted-foreground text-center">Loading…</div>
            )}
            {!mediaQ.isLoading && !mediaQ.data?.rows.length && (
              <div className="p-6 text-sm text-muted-foreground text-center">No files found.</div>
            )}
          </div>
        </CardContent>
      </Card>

      {missing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Referenced but not stored ({missing.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {missing.length === 0 ? (
              <p className="text-sm text-muted-foreground">Every image used by a question is present.</p>
            ) : (
              <div className="text-sm font-mono max-h-60 overflow-y-auto space-y-1">
                {missing.map((m) => (
                  <div key={`${m.question_id}-${m.name}`}>
                    Q{m.question_id} → {m.name}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
