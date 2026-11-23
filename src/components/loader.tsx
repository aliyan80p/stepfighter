import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Brand-new StepFighter Clinical ECG Pulse Loader:
 * Pure GPU-accelerated SVG heartbeat trace + soft pulse node + animated dots.
 * Adapts automatically to the user's active theme and accent color with zero layout shift.
 */
export function Loader({
  label = "Loading",
  size = 64,
  className,
  labelClassName,
}: {
  label?: string | null;
  size?: number;
  className?: string;
  labelClassName?: string;
}) {
  const width = Math.max(96, Math.round(size * 2.1));
  const height = Math.max(38, Math.round(size * 0.72));

  return (
    <div className={cn("sf-scale-enter flex flex-col items-center justify-center gap-3.5 py-8", className)}>
      <div
        className="relative flex items-center justify-center rounded-2xl border border-border/70 bg-card/80 px-4 py-2.5 shadow-sm"
        style={{ minWidth: width + 24 }}
      >
        <svg
          width={width}
          height={height}
          viewBox="0 0 140 48"
          fill="none"
          aria-hidden
          className="overflow-visible"
        >
          {/* Baseline subtle guide */}
          <path
            d="M 2 26 H 38 L 46 26 L 52 17 L 58 34 L 66 7 L 74 41 L 81 22 L 87 26 H 138"
            stroke="var(--border)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.45"
          />
          {/* Animated live ECG trace */}
          <path
            d="M 2 26 H 38 L 46 26 L 52 17 L 58 34 L 66 7 L 74 41 L 81 22 L 87 26 H 138"
            stroke="var(--primary)"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="sf-ecg-path"
            style={{ filter: "drop-shadow(0 0 6px color-mix(in srgb, var(--primary) 50%, transparent))" }}
          />
        </svg>
        <span
          aria-hidden
          className="sf-ecg-dot absolute right-3 top-2.5 h-2 w-2 rounded-full"
          style={{
            background: "var(--primary)",
            boxShadow: "0 0 10px color-mix(in srgb, var(--primary) 65%, transparent)",
          }}
        />
      </div>

      {label && (
        <span
          className={cn(
            "text-sm text-muted-foreground font-medium tracking-wide flex items-center",
            labelClassName,
          )}
        >
          {label}
          <span className="sf-loader-dot ml-0.5">.</span>
          <span className="sf-loader-dot">.</span>
          <span className="sf-loader-dot">.</span>
        </span>
      )}
    </div>
  );
}

/** Full-viewport centered Clinical ECG loader with a GPU shimmer progress bar. */
export function PageLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="sf-page-enter min-h-[calc(100vh-4rem)] w-full flex flex-col items-center justify-center gap-4 px-4">
      <Loader label={label} className="py-2" />
      <div className="relative h-1.5 w-48 overflow-hidden rounded-full bg-muted">
        <div
          className="sf-loader-bar absolute inset-y-0 left-0 w-1/2 rounded-full"
          style={{ background: "linear-gradient(90deg, transparent, var(--primary), transparent)" }}
        />
      </div>
    </div>
  );
}

/** Clean, centered ECG Pulse overlay shown while generating a new quiz/test session. */
export function TestCreationOverlay({
  open,
  mode,
  timed,
  questionCount,
  quizName,
}: {
  open: boolean;
  mode: "practice" | "test";
  timed: boolean;
  questionCount: number;
  quizName?: string;
}) {
  const [pct, setPct] = useState(28);

  useEffect(() => {
    if (!open) {
      setPct(28);
      return;
    }
    const t1 = window.setTimeout(() => setPct(68), 450);
    const t2 = window.setTimeout(() => setPct(92), 1100);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4"
    >
      <div className="sf-scale-enter w-full max-w-sm rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-2xl space-y-5 text-center">
        <div className="flex flex-col items-center">
          <Loader label={null} size={62} className="py-1" />
          <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
            <Activity className="h-3.5 w-3.5" />
            Generating Test
          </div>
          <h2 className="mt-1 text-base font-bold text-foreground truncate max-w-full">
            {quizName?.trim() || "Custom Practice Session"}
          </h2>
          <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5 text-xs">
            <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 font-medium text-foreground">
              {mode === "practice" ? "Tutor Mode" : "Exam Mode"}
            </span>
            <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 font-medium text-foreground">
              {timed ? "Timed" : "Untimed"}
            </span>
            <span className="rounded-full bg-primary/15 text-primary px-2.5 py-0.5 font-semibold">
              {questionCount} {questionCount === 1 ? "Question" : "Questions"}
            </span>
          </div>
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/** GPU-only shimmer skeleton block — zero layout repaint. */
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      aria-hidden
      className={cn("sf-loader-shimmer rounded-lg", className)}
      style={style}
    />
  );
}

/** Structured shimmer skeleton for Dashboard cards & charts. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
            <Skeleton className="h-7 w-20" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <Skeleton className="h-4 w-32" />
            <div className="flex items-center gap-6">
              <Skeleton className="h-36 w-36 rounded-full shrink-0" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-5/6" />
                <Skeleton className="h-8 w-4/6" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Structured shimmer skeleton for table/list views (Previous Tests, Search, Notes). */
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-4 w-24" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-2">
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
      ))}
    </div>
  );
}
