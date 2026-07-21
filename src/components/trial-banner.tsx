import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMyEntitlement } from "@/lib/entitlements.functions";
import { Clock, Sparkles, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export function TrialBanner() {
  const fn = useServerFn(getMyEntitlement);
  const { data } = useQuery({ queryKey: ["my-entitlement"], queryFn: () => fn(), staleTime: 60_000 });
  if (!data) return null;
  if (data.plan === "paid") return null;

  const expired = !data.is_active;
  const critical = data.days_left <= 1;
  const warning = data.days_left <= 3 && !critical;

  const tone = expired
    ? "bg-red-500/10 border-red-500/40 text-red-100"
    : critical
    ? "bg-red-500/10 border-red-500/40 text-red-100"
    : warning
    ? "bg-amber-500/10 border-amber-500/40 text-amber-100"
    : "bg-primary/10 border-primary/30 text-sidebar-foreground";

  return (
    <div className={cn("mx-3 mb-2 rounded-md border px-3 py-2 text-xs", tone)}>
      <div className="flex items-center gap-2 font-medium">
        {expired ? <AlertTriangle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
        {expired
          ? "Trial ended"
          : critical
          ? `${data.days_left} day left`
          : `${data.days_left} days left in trial`}
      </div>
      <p className="mt-1 opacity-80 leading-snug">
        {expired
          ? "Upgrade to keep answering questions."
          : "Free trial. Upgrade any time to keep your progress."}
      </p>
      <Link
        to="/upgrade"
        className="mt-2 inline-flex items-center gap-1 rounded bg-white/10 hover:bg-white/20 px-2 py-1 font-medium transition-colors"
      >
        <Sparkles className="h-3 w-3" />
        {expired ? "Upgrade now" : "See plans"}
      </Link>
    </div>
  );
}
