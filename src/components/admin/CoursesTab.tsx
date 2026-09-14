import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { GraduationCap, Plus } from "lucide-react";
import { listCourses, saveCourse, type CourseRow } from "@/lib/admin-content.functions";

type Draft = { id?: number; slug: string; name: string; description: string };

export function CoursesTab() {
  const listFn = useServerFn(listCourses);
  const saveFn = useServerFn(saveCourse);
  const q = useQuery({ queryKey: ["admin-courses"], queryFn: () => listFn() });
  const [draft, setDraft] = useState<Draft | null>(null);

  const save = async () => {
    if (!draft) return;
    try {
      await saveFn({
        data: {
          id: draft.id,
          slug: draft.slug,
          name: draft.name,
          description: draft.description.trim() || null,
        },
      });
      setDraft(null);
      q.refetch();
      toast.success("Saved");
    } catch (e) { toast.error((e as Error).message); }
  };

  const edit = (c: CourseRow) =>
    setDraft({ id: c.id, slug: c.slug, name: c.name, description: c.description ?? "" });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5" /> Courses
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {draft ? (
          <div className="space-y-3 border rounded-md p-4">
            <div>
              <Label className="text-xs">Name</Label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Short code</Label>
              <Input
                value={draft.slug}
                onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                placeholder="step2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Lowercase letters, numbers or dashes. Changing it affects existing links.
              </p>
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={save}>Save</Button>
              <Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <Button onClick={() => setDraft({ slug: "", name: "", description: "" })}>
            <Plus className="h-4 w-4 mr-1" /> New course
          </Button>
        )}

        <div className="divide-y border rounded-md">
          {(q.data?.rows ?? []).map((c) => (
            <button
              key={c.id}
              onClick={() => edit(c)}
              className="w-full text-left p-3 hover:bg-muted/40 transition-colors"
            >
              <div className="text-sm font-medium">{c.name}</div>
              <div className="text-xs text-muted-foreground">
                {c.slug} · {c.questions} questions
              </div>
            </button>
          ))}
          {q.isLoading && (
            <div className="p-6 text-sm text-muted-foreground text-center">Loading…</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
