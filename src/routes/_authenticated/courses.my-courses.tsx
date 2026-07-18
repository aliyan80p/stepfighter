import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, BookOpen, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { QBANKS, useActiveQbankId, setActiveQbankId } from "@/lib/active-qbank";
import { getDashboardStats } from "@/lib/qbank.functions";

export const Route = createFileRoute("/_authenticated/courses/my-courses")({
  component: MyCourses,
});

function MyCourses() {
  const active = useActiveQbankId();
  const navigate = useNavigate();

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Courses</h1>
        <p className="text-muted-foreground mt-1">Select an active course. All quizzes, stats and searches use the selected course.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {QBANKS.map((q) => (
          <CourseCard
            key={q.id}
            id={q.id}
            name={q.name}
            active={active === q.id}
            onSelect={() => setActiveQbankId(q.id)}
            onOpen={() => {
              setActiveQbankId(q.id);
              navigate({ to: "/dashboard" });
            }}
          />
        ))}
      </div>
    </div>
  );
}

function CourseCard({
  id, name, active, onSelect, onOpen,
}: { id: number; name: string; active: boolean; onSelect: () => void; onOpen: () => void }) {
  const fn = useServerFn(getDashboardStats);
  const { data } = useQuery({ queryKey: ["course-stats", id], queryFn: () => fn({ data: { qbankId: id } }) });
  const total = data?.totalQuestions ?? 0;

  return (
    <div
      className={cn(
        "rounded-xl border p-5 bg-card transition-all cursor-pointer",
        active ? "border-primary ring-2 ring-primary/30 shadow-md" : "border-border hover:border-primary/40 hover:shadow-sm",
      )}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <BookOpen className="h-5 w-5" />
        </div>
        {active && <CheckCircle2 className="h-5 w-5 text-primary" />}
      </div>
      <h3 className="mt-4 font-semibold text-lg">{name}</h3>
      <p className="text-xs text-muted-foreground mt-1">
        {total > 0 ? `${total.toLocaleString()} questions` : "No content yet"}
      </p>
      <Button
        size="sm"
        variant={active ? "default" : "outline"}
        className="mt-4 w-full"
        onClick={(e) => { e.stopPropagation(); onOpen(); }}
        disabled={total === 0}
      >
        {active ? "Open Dashboard" : "Select & Open"}
        <ArrowRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}
