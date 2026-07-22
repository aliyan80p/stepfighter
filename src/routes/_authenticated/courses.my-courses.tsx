import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { CheckCircle2, BookOpen, ArrowRight, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { QBANKS, useActiveQbankId, setActiveQbankId } from "@/lib/active-qbank";
import { getDashboardStats } from "@/lib/qbank.functions";
import { getMyEntitlement, QBANK_ID_TO_SLUG } from "@/lib/entitlements.functions";

export const Route = createFileRoute("/_authenticated/courses/my-courses")({
  component: MyCourses,
});

function MyCourses() {
  const active = useActiveQbankId();
  const navigate = useNavigate();
  const entFn = useServerFn(getMyEntitlement);
  const entQ = useQuery({ queryKey: ["my-entitlement"], queryFn: () => entFn(), staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: true });
  const allowed = new Set(entQ.data?.effective_access ?? []);
  const isAllowed = (id: number) => allowed.has(QBANK_ID_TO_SLUG[id]);

  // Auto-correct active qbank if user has no access to the currently-selected one
  useEffect(() => {
    if (!entQ.data) return;
    if (allowed.size === 0) return;
    if (!isAllowed(active)) {
      const first = QBANKS.find((q) => isAllowed(q.id));
      if (first) setActiveQbankId(first.id);
    }
  }, [entQ.data, active]);

  const visibleQbanks = QBANKS.filter((q) => isAllowed(q.id));
  const hasMore = entQ.data ? visibleQbanks.length < QBANKS.length : false;

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Courses</h1>
        <p className="text-muted-foreground mt-1">Your active course is used for all quizzes, stats and searches.</p>
      </div>

      {entQ.data && visibleQbanks.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <p className="text-muted-foreground">You don't have access to any courses yet.</p>
          <Button asChild className="mt-4"><Link to="/upgrade">View Plans</Link></Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {visibleQbanks.map((q) => (
          <CourseCard
            key={q.id}
            id={q.id}
            name={q.name}
            active={active === q.id}
            locked={false}
            onSelect={() => setActiveQbankId(q.id)}
            onOpen={() => {
              setActiveQbankId(q.id);
              navigate({ to: "/dashboard" });
            }}
          />
        ))}
      </div>

      {hasMore && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-semibold">Want access to more Steps?</div>
            <p className="text-sm text-muted-foreground">Upgrade to unlock additional courses or the combo bundle.</p>
          </div>
          <Button asChild><Link to="/upgrade">View Plans</Link></Button>
        </div>
      )}
    </div>
  );
}

function CourseCard({
  id, name, active, locked, onSelect, onOpen,
}: { id: number; name: string; active: boolean; locked: boolean; onSelect: () => void; onOpen: () => void }) {
  const fn = useServerFn(getDashboardStats);
  const { data } = useQuery({
    queryKey: ["course-stats", id],
    queryFn: () => fn({ data: { qbankId: id } }),
    enabled: !locked,
  });
  const total = data?.totalQuestions ?? 0;

  return (
    <div
      className={cn(
        "rounded-xl border p-5 bg-card transition-all",
        locked
          ? "border-border opacity-70 cursor-not-allowed"
          : "cursor-pointer " + (active ? "border-primary ring-2 ring-primary/30 shadow-md" : "border-border hover:border-primary/40 hover:shadow-sm"),
      )}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between">
        <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", locked ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary")}>
          {locked ? <Lock className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
        </div>
        {active && !locked && <CheckCircle2 className="h-5 w-5 text-primary" />}
        {locked && <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded">Locked</span>}
      </div>
      <h3 className="mt-4 font-semibold text-lg">{name}</h3>
      <p className="text-xs text-muted-foreground mt-1">
        {locked ? "Upgrade required" : total > 0 ? `${total.toLocaleString()} questions` : "No content yet"}
      </p>
      <Button
        size="sm"
        variant={locked ? "outline" : active ? "default" : "outline"}
        className="mt-4 w-full"
        onClick={(e) => { e.stopPropagation(); onOpen(); }}
        disabled={!locked && total === 0}
      >
        {locked ? "Unlock" : active ? "Open Dashboard" : "Select & Open"}
        <ArrowRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}
