import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getDashboardStats } from "@/lib/qbank.functions";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Target, CheckCircle2, Bookmark } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const fn = useServerFn(getDashboardStats);
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => fn() });

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Your USMLE Step 2 progress</p>
        </div>
        <Button asChild size="lg"><Link to="/new-test">Start New Test</Link></Button>
      </div>

      {isLoading || !data ? (
        <div className="mt-8 grid gap-4 md:grid-cols-4">
          {[0,1,2,3].map((i) => <div key={i} className="h-28 rounded-lg border border-border animate-pulse bg-muted/30" />)}
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-4 md:grid-cols-4">
            <Stat icon={BookOpen} label="Questions Answered" value={`${data.answered} / ${data.totalQuestions}`} />
            <Stat icon={Target} label="Accuracy" value={`${data.accuracy}%`} />
            <Stat icon={CheckCircle2} label="Correct" value={`${data.correctAttempts} / ${data.totalAttempts}`} />
            <Stat icon={Bookmark} label="Bookmarks" value={String(data.bookmarks)} />
          </div>

          <div className="mt-8">
            <h2 className="text-lg font-semibold mb-3">By Subject</h2>
            <div className="rounded-lg border border-border divide-y divide-border">
              {data.subjects.map((s) => (
                <div key={s.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.count} questions</div>
                  </div>
                  <div className="w-40"><Progress value={data.totalQuestions ? (s.count / data.totalQuestions) * 100 : 0} /></div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-5">
      <Icon className="h-5 w-5 text-primary" />
      <div className="mt-3 text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}
