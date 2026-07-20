import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCategoryStats } from "@/lib/performance.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Info, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Kind = "subject" | "system" | "topic";

export function StatisticsByCategoryModal({
  open, onOpenChange, qbankId,
}: { open: boolean; onOpenChange: (v: boolean) => void; qbankId: number }) {
  const [kind, setKind] = useState<Kind>("subject");
  const fn = useServerFn(getCategoryStats);
  const { data, isLoading } = useQuery({
    queryKey: ["category-stats", qbankId, kind],
    queryFn: () => fn({ data: { qbankId, kind } }),
    enabled: open,
  });

  const tabs: { key: Kind; label: string }[] = [
    { key: "subject", label: "Subjects" },
    { key: "system", label: "Systems" },
    { key: "topic", label: "Topics" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="bg-gradient-to-r from-blue-700 to-blue-600 text-white px-6 py-4 rounded-t-lg">
          <DialogTitle className="text-white text-lg font-semibold">Statistics by Category</DialogTitle>
        </DialogHeader>
        <div className="p-6 space-y-4">
          <div className="flex gap-2">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setKind(t.key)}
                className={cn(
                  "px-5 py-2 rounded-full text-sm font-medium transition-colors",
                  kind === t.key
                    ? "bg-blue-700 text-white"
                    : "bg-muted text-foreground hover:bg-muted/70",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 px-3 py-2 text-sm">
            <Info className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
            <span className="text-amber-900 dark:text-amber-200">Your category statistics are sorted from strongest to weakest.</span>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading…
              </div>
            ) : !data?.rows.length ? (
              <div className="text-center py-10 text-sm text-muted-foreground">No data yet — answer some questions to see stats.</div>
            ) : (
              <ul className="divide-y divide-border">
                {data.rows.map((r) => {
                  const up = r.pct >= 50;
                  return (
                    <li key={r.name} className="flex items-center justify-between py-3">
                      <span className="text-sm">{r.name}</span>
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold",
                        up ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                           : "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
                      )}>
                        {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                        {r.pct.toFixed(1)}%
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
