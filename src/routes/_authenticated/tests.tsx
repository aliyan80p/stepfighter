import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listTests } from "@/lib/qbank.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/tests")({
  component: TestsList,
});

function TestsList() {
  const fn = useServerFn(listTests);
  const { data, isLoading } = useQuery({ queryKey: ["tests"], queryFn: () => fn() });

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">My Tests</h1>
        <Button asChild><Link to="/new-test">New Test</Link></Button>
      </div>

      <div className="mt-6 space-y-2">
        {isLoading && <div className="text-muted-foreground">Loading…</div>}
        {data?.length === 0 && <div className="text-muted-foreground">No tests yet. Start one!</div>}
        {(data ?? []).map((t) => {
          const answered = t.right_count + t.wrong_count;
          const pct = answered ? Math.round((t.right_count / answered) * 100) : 0;
          return (
            <Link key={t.id} to="/test/$id" params={{ id: String(t.id) }} className="block rounded-lg border border-border p-4 hover:bg-accent transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium capitalize">{t.mode} — {t.total} questions</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{new Date(t.created_at).toLocaleString()}</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{t.done ? `${pct}%` : `${answered}/${t.total}`}</div>
                  <div className="text-xs text-muted-foreground">{t.done ? "Completed" : "In progress"}</div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
