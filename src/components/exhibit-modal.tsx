import { useEffect, useRef, useState } from "react";
import { X, Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCcw, Contrast, SunMoon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHydratedSettings } from "@/lib/user-settings";

export type ExhibitContent =
  | { kind: "image"; src: string; alt?: string }
  | { kind: "video"; src: string }
  | { kind: "audio"; src: string };

/**
 * USMLE-Fighter–style "Exhibit Display" modal with medical imaging tools:
 * - Mouse-wheel zoom (50%–400%), click-and-drag pan when zoomed
 * - High-contrast boost & Invert colors (ideal for X-rays, CTs, MRIs, ECGs)
 * - Respects user's Exhibit Viewer Size & Close-on-Click-Outside settings
 */
export function ExhibitModal({
  content,
  title = "Exhibit Display",
  onClose,
}: {
  content: ExhibitContent | null;
  title?: string;
  onClose: () => void;
}) {
  const [maximized, setMaximized] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [inverted, setInverted] = useState(false);
  const dragOrigin = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const userSettings = useHydratedSettings();

  const viewerWidthClass =
    userSettings.exhibitViewerSize === "small"
      ? "w-[min(92vw,440px)]"
      : userSettings.exhibitViewerSize === "medium"
        ? "w-[min(92vw,780px)]"
        : userSettings.exhibitViewerSize === "large"
          ? "w-[min(96vw,1060px)]"
          : "w-[min(92vw,620px)]";

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setHighContrast(false);
    setInverted(false);
  };

  useEffect(() => {
    if (!content) return;
    setMaximized(false);
    resetView();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [content, onClose]);

  if (!content) return null;

  const imgFilter = [
    highContrast ? "contrast(1.25) brightness(1.06)" : "",
    inverted ? "invert(1)" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={() => {
        if (userSettings.closeExhibitOnOutsideClick !== false) onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "sf-scale-enter bg-card text-card-foreground rounded-lg shadow-2xl overflow-hidden flex flex-col border border-border",
          maximized ? "w-[98vw] h-[96vh]" : `${viewerWidthClass} max-h-[88vh]`,
        )}
        style={{ fontFamily: "Verdana, Arial, Georgia, serif" }}
      >
        {/* Header — adapts to user nav accent */}
        <div
          className="flex items-center justify-between px-4 text-white shrink-0"
          style={{ backgroundColor: "var(--sf-nav-bg, #1a4b7c)", height: 42 }}
        >
          <div className="text-[13px] font-semibold tracking-wide flex items-center gap-2">
            <span>{title}</span>
            {content.kind === "image" && (
              <span className="text-[11px] font-normal text-white/75">{Math.round(zoom * 100)}%</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {content.kind === "image" && (
              <>
                <IconBtn
                  title="Contrast boost (X-ray / CT)"
                  active={highContrast}
                  onClick={() => setHighContrast((v) => !v)}
                >
                  <Contrast className="h-4 w-4" />
                </IconBtn>
                <IconBtn
                  title="Invert colors (radiographs / ECG)"
                  active={inverted}
                  onClick={() => setInverted((v) => !v)}
                >
                  <SunMoon className="h-4 w-4" />
                </IconBtn>
                <IconBtn title="Zoom out" onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}>
                  <ZoomOut className="h-4 w-4" />
                </IconBtn>
                <IconBtn title="Zoom in" onClick={() => setZoom((z) => Math.min(4, Number((z + 0.25).toFixed(2))))}>
                  <ZoomIn className="h-4 w-4" />
                </IconBtn>
                <IconBtn title="Reset view" onClick={resetView}>
                  <RotateCcw className="h-4 w-4" />
                </IconBtn>
              </>
            )}
            <IconBtn title={maximized ? "Restore" : "Maximize"} onClick={() => setMaximized((v) => !v)}>
              {maximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </IconBtn>
            <IconBtn title="Close" onClick={onClose}>
              <X className="h-4 w-4" />
            </IconBtn>
          </div>
        </div>

        {/* Body */}
        <div
          className={cn(
            "flex-1 min-h-0 overflow-hidden bg-muted/40 flex items-center justify-center p-4 relative",
            content.kind === "image" && zoom > 1 ? (dragging ? "cursor-grabbing" : "cursor-grab") : "",
          )}
          onWheel={(e) => {
            if (content.kind !== "image") return;
            e.preventDefault();
            const delta = e.deltaY < 0 ? 0.15 : -0.15;
            setZoom((z) => Math.max(0.5, Math.min(4, Number((z + delta).toFixed(2)))));
          }}
          onPointerDown={(e) => {
            if (content.kind !== "image" || zoom <= 1) return;
            e.preventDefault();
            setDragging(true);
            dragOrigin.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
          }}
          onPointerMove={(e) => {
            if (!dragging || !dragOrigin.current) return;
            setPan({
              x: dragOrigin.current.px + (e.clientX - dragOrigin.current.x),
              y: dragOrigin.current.py + (e.clientY - dragOrigin.current.y),
            });
          }}
          onPointerUp={() => {
            setDragging(false);
            dragOrigin.current = null;
          }}
          onPointerLeave={() => {
            setDragging(false);
            dragOrigin.current = null;
          }}
        >
          {content.kind === "image" && (
            <img
              src={content.src}
              alt={content.alt ?? ""}
              draggable={false}
              className="max-w-full block select-none rounded"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "center center",
                transition: dragging ? "none" : "transform 120ms ease, filter 150ms ease",
                filter: imgFilter || undefined,
                maxHeight: maximized ? "85vh" : "70vh",
              }}
            />
          )}
          {content.kind === "video" && (
            <video
              key={content.src}
              src={content.src}
              controls
              controlsList="nodownload"
              preload="metadata"
              width={maximized ? undefined : 300}
              height={maximized ? undefined : 150}
              className={maximized ? "max-w-full max-h-full rounded" : "rounded"}
              style={maximized ? { maxHeight: "85vh" } : undefined}
            />
          )}

          {content.kind === "audio" && (
            <div className="w-full max-w-lg flex flex-col items-center gap-3 p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Audio exhibit</div>
              <audio key={content.src} src={content.src} controls preload="auto" className="w-full" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cn(
        "h-7 w-7 rounded flex items-center justify-center transition-colors",
        active ? "bg-white/30 text-white" : "hover:bg-white/15 text-white/90",
      )}
    >
      {children}
    </button>
  );
}
