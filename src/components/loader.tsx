import { useEffect, useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Fighter-brand loader: two counter-rotating accent arcs, a pulsing core,
 * expanding ring, and an animated dot label. Adapts automatically to the user's
 * active theme and accent color.
 */
export function Loader({
  label = "Loading",
  size = 56,
  className,
  labelClassName,
}: {
  label?: string | null;
  size?: number;
  className?: string;
  labelClassName?: string;
}) {
  const inner = Math.round(size * 0.76);
  return (
    <div className={cn("sf-scale-enter flex flex-col items-center justify-center gap-4 py-10", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        {/* Expanding pulse ring */}
        <span
          aria-hidden
          className="sf-loader-ring absolute inset-0 rounded-full border-2"
          style={{ borderColor: "var(--primary)" }}
        />
        {/* Outer arc — clockwise */}
        <svg
          width={size}
          height={size}
          viewBox="0 0 50 50"
          className="sf-loader-spin absolute inset-0"
          aria-hidden
        >
          <circle
            cx="25"
            cy="25"
            r="21"
            fill="none"
            stroke="var(--border)"
            strokeWidth="3"
            opacity="0.55"
          />
          <path
            d="M25 4 a21 21 0 0 1 21 21"
            fill="none"
            stroke="var(--primary)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </svg>
        {/* Inner arc — counter-clockwise */}
        <svg
          width={inner}
          height={inner}
          viewBox="0 0 50 50"
          className="sf-loader-spin-rev absolute"
          style={{ top: (size - inner) / 2, left: (size - inner) / 2 }}
          aria-hidden
        >
          <path
            d="M25 8 a17 17 0 0 0 -17 17"
            fill="none"
            stroke="var(--primary)"
            strokeOpacity="0.65"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </svg>
        {/* Pulsing core */}
        <span
          aria-hidden
          className="sf-loader-pulse absolute rounded-full"
          style={{
            width: size * 0.22,
            height: size * 0.22,
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "var(--primary)",
            boxShadow: "0 0 16px color-mix(in srgb, var(--primary) 55%, transparent)",
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

/** Full-viewport centered loader with a smooth theme-aware shimmer track. */
export function PageLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="sf-page-enter flex-1 min-h-[60vh] flex flex-col items-center justify-center gap-5 px-4">
      <Loader label={label} className="py-2" />
      <div className="relative h-1.5 w-52 overflow-hidden rounded-full bg-muted">
        <div
          className="sf-loader-bar absolute inset-y-0 left-0 w-1/3 rounded-full"
          style={{ background: "linear-gradient(90deg, transparent, var(--primary), transparent)" }}
        />
      </div>
    </div>
  );
}

/** Smooth glassmorphic overlay shown while generating a new quiz/test session. */
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
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!open) {
      setStep(0);
      return;
    }
    const t1 = window.setTimeout(() => setStep(1), 550);
    const t2 = window.setTimeout(() => setStep(2), 1250);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [open]);

  if (!open) return null;

  const steps = [
    "Filtering your question pool",
    "Balancing topics & question order",
    "Preparing your exam interface",
  ];
  const pct = step === 0 ? 32 : step === 1 ? 68 : 92;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4 transition-opacity duration-200"
    >
      <div className="sf-scale-enter w-full max-w-md rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-2xl space-y-5">
        <div className="flex flex-col items-center text-center">
          <Loader label={null} size={62} className="py-2" />
          <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Building Your Test
          </div>
          <h2 className="mt-1 text-lg font-bold text-foreground truncate max-w-full">
            {quizName?.trim() || "Custom Practice Session"}
          </h2>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 text-xs">
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

        {/* Smooth progress bar */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Step checklist */}
        <div className="space-y-2.5 pt-1">
          {steps.map((text, idx) => {
            const done = step > idx;
            const active = step === idx;
            return (
              <div
                key={text}
                className={cn(
                  "flex items-center gap-3 text-sm transition-all duration-300",
                  done
                    ? "text-foreground"
                    : active
                      ? "text-foreground font-medium translate-x-0.5"
                      : "text-muted-foreground/60",
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full border text-xs shrink-0 transition-all duration-300",
                    done
                      ? "bg-primary border-primary text-primary-foreground"
                      : active
                        ? "border-primary text-primary"
                        : "border-border",
                  )}
                >
                  {done ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        active ? "bg-primary animate-pulse" : "bg-muted-foreground/40",
                      )}
                    />
                  )}
                </span>
                <span>{text}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Inline skeleton block with brand shimmer — drop-in for placeholder cards. */
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
      className={cn("sf-loader-shimmer rounded-md", className)}
      style={style}
    />
  );
}
