import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getFilters, createTest } from "@/lib/qbank.functions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/new-test")({
  component: NewTest,
});

function NewTest() {
  const getFn = useServerFn(getFilters);
  const createFn = useServerFn(createTest);
  const navigate = useNavigate();
  const { data } = useQuery({ queryKey: ["filters"], queryFn: () => getFn() });

  const [subjectIds, setSubjectIds] = useState<number[]>([]);
  const [systemIds, setSystemIds] = useState<number[]>([]);
  const [count, setCount] = useState(20);
  const [mode, setMode] = useState<"practice" | "test">("practice");
  const [scope, setScope] = useState<"all" | "unused" | "incorrect" | "bookmarked">("all");
  const [loading, setLoading] = useState(false);

  const toggle = (arr: number[], id: number, set: (v: number[]) => void) =>
    set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  const start = async () => {
    setLoading(true);
    try {
      const r = await createFn({ data: { subjectIds, systemIds, count, mode, scope } });
      navigate({ to: "/test/$id", params: { id: String(r.id) } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create test");
    } finally { setLoading(false); }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold">New Test</h1>
      <p className="text-muted-foreground mt-1">Configure your practice session</p>

      <div className="mt-8 space-y-6">
        <section>
          <Label className="text-base">Mode</Label>
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as any)} className="mt-2 grid grid-cols-2 gap-3">
            <label className="flex items-start gap-3 rounded-lg border border-border p-4 cursor-pointer hover:bg-accent">
              <RadioGroupItem value="practice" />
              <div><div className="font-medium">Practice / Tutor</div><div className="text-xs text-muted-foreground">See explanation after each question</div></div>
            </label>
            <label className="flex items-start gap-3 rounded-lg border border-border p-4 cursor-pointer hover:bg-accent">
              <RadioGroupItem value="test" />
              <div><div className="font-medium">Test</div><div className="text-xs text-muted-foreground">Explanations only at the end</div></div>
            </label>
          </RadioGroup>
        </section>

        <section>
          <Label className="text-base">Question Pool</Label>
          <RadioGroup value={scope} onValueChange={(v) => setScope(v as any)} className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-3">
            {[{v:"all",l:"All"},{v:"unused",l:"Unused"},{v:"incorrect",l:"Incorrect"},{v:"bookmarked",l:"Bookmarked"}].map(o=>(
              <label key={o.v} className="flex items-center gap-2 rounded-lg border border-border p-3 cursor-pointer hover:bg-accent">
                <RadioGroupItem value={o.v} /> <span className="text-sm">{o.l}</span>
              </label>
            ))}
          </RadioGroup>
        </section>

        <section>
          <Label className="text-base">Subjects</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {(data?.subjects ?? []).map((s) => (
              <label key={s.id} className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm cursor-pointer transition-colors ${subjectIds.includes(s.id) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`}>
                <Checkbox checked={subjectIds.includes(s.id)} onCheckedChange={() => toggle(subjectIds, s.id, setSubjectIds)} className="h-3 w-3" />
                {s.name} <span className="opacity-60 text-xs">({s.count})</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">Leave empty for all subjects</p>
        </section>

        <section>
          <Label className="text-base">Systems</Label>
          <div className="mt-2 flex flex-wrap gap-2 max-h-60 overflow-auto p-2 border border-border rounded-lg">
            {(data?.systems ?? []).map((s) => (
              <label key={s.id} className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs cursor-pointer transition-colors ${systemIds.includes(s.id) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`}>
                <Checkbox checked={systemIds.includes(s.id)} onCheckedChange={() => toggle(systemIds, s.id, setSystemIds)} className="h-3 w-3" />
                {s.name}
              </label>
            ))}
          </div>
        </section>

        <section>
          <Label htmlFor="count" className="text-base">Number of Questions</Label>
          <Input id="count" type="number" min={1} max={200} value={count} onChange={(e) => setCount(+e.target.value)} className="mt-2 w-32" />
        </section>

        <Button size="lg" onClick={start} disabled={loading}>{loading ? "Creating..." : "Start Test"}</Button>
      </div>
    </div>
  );
}
