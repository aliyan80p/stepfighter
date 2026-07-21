import { cn } from "@/lib/utils";

/**
 * Fighter-style loading spinner: a rotating semi-circular arc + muted label.
 * Replaces static "Loading…" text across the app.
 */
export function Loader({
  label = "Loading…",
  size = 48,
  className,
  labelClassName,
}: {
  label?: string | null;
  size?: number;
  className?: string;
  labelClassName?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-10", className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 50 50"
        className="animate-spin"
        style={{ animationDuration: "1.2s" }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="qbank-loader-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1a4b7c" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
        </defs>
        <circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="4"
          opacity="0.35"
        />
        <path
          d="M25 5 a20 20 0 0 1 20 20"
          fill="none"
          stroke="url(#qbank-loader-gradient)"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
      {label && (
        <span className={cn("text-sm text-muted-foreground font-medium", labelClassName)}>
          {label}
        </span>
      )}
    </div>
  );
}

/** Full-viewport centered loader for route-level loading states. */
export function PageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex-1 min-h-[60vh] flex items-center justify-center">
      <Loader label={label} />
    </div>
  );
}
