import { cn } from "@/lib/utils";

/**
 * Fighter-brand loader: two counter-rotating gradient arcs, a pulsing core,
 * expanding ring, and an animated dot label. Same public API as before.
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
  const inner = Math.round(size * 0.78);
  return (
    <div className={cn("flex flex-col items-center justify-center gap-4 py-10", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        {/* Expanding ring */}
        <span
          aria-hidden
          className="sf-loader-ring absolute inset-0 rounded-full border-2"
          style={{ borderColor: "#38bdf8" }}
        />
        {/* Outer arc — clockwise */}
        <svg
          width={size}
          height={size}
          viewBox="0 0 50 50"
          className="sf-loader-spin absolute inset-0"
          aria-hidden
        >
          <defs>
            <linearGradient id="sf-loader-g1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1a4b7c" />
              <stop offset="100%" stopColor="#38bdf8" />
            </linearGradient>
          </defs>
          <circle cx="25" cy="25" r="21" fill="none" stroke="#e5e7eb" strokeWidth="3" opacity="0.4" />
          <path
            d="M25 4 a21 21 0 0 1 21 21"
            fill="none"
            stroke="url(#sf-loader-g1)"
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
          <defs>
            <linearGradient id="sf-loader-g2" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0ea5e9" />
              <stop offset="100%" stopColor="#1a4b7c" />
            </linearGradient>
          </defs>
          <path
            d="M25 8 a17 17 0 0 0 -17 17"
            fill="none"
            stroke="url(#sf-loader-g2)"
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
            background: "linear-gradient(135deg, #1a4b7c, #38bdf8)",
            boxShadow: "0 0 12px rgba(56,189,248,0.55)",
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

/** Full-viewport centered loader with a subtle shimmer track. */
export function PageLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex-1 min-h-[60vh] flex flex-col items-center justify-center gap-6">
      <Loader label={label} />
      <div className="relative h-1 w-48 overflow-hidden rounded-full bg-slate-200/60">
        <div
          className="sf-loader-bar absolute inset-y-0 left-0 w-1/4 rounded-full"
          style={{ background: "linear-gradient(90deg, transparent, #38bdf8, transparent)" }}
        />
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
