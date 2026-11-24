import { useEffect, useState } from "react";
import { X, Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCcw, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHydratedSettings } from "@/lib/user-settings";

const UWORLD_NAVY = "#004a77";

export type ExhibitContent =
  | { kind: "image"; src: string; alt?: string }
  | { kind: "video"; src: string }
  | { kind: "audio"; src: string };

/**
 * USMLE-Fighter–style "Exhibit Display" modal.
 * Clean header with Zoom In / Zoom Out / Reset, Maximize, and Close.
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
  const [bright, setBright] = useState(false);
  const userSettings = useHydratedSettings();

  const viewerWidthClass =
    userSettings.exhibitViewerSize === "small"
      ? "w-[min(92vw,440px)]"
      : userSettings.exhibitViewerSize === "medium"
        ? "w-[min(92vw,780px)]"
        : userSettings.exhibitViewerSize === "large"
          ? "w-[min(96vw,1060px)]"
          : "w-[min(92vw,620px)]";

  useEffect(() => {
    if (!content) return;
    setMaximized(false);
    setZoom(1);
    setBright(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [content, onClose]);

  if (!content) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 backdrop-blur-[1px] p-4"
      onClick={() => {
        if (userSettings.closeExhibitOnOutsideClick !== false) onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "sf-scale-enter rounded-[3px] shadow-2xl overflow-hidden flex flex-col border-[4px]",
          maximized ? "w-[96vw] h-[95vh]" : `${viewerWidthClass} max-h-[90vh]`,
        )}
        style={{ borderColor: UWORLD_NAVY, backgroundColor: UWORLD_NAVY }}
      >
        <div
          className="flex items-center justify-between px-3 text-white shrink-0"
          style={{ backgroundColor: UWORLD_NAVY, height: 38 }}
        >
          <div className="text-[13px] font-medium tracking-wide">{title}</div>
          <div className="flex items-center gap-1">
            <IconBtn title={maximized ? "Restore" : "Expand"} onClick={() => setMaximized((v) => !v)}>
              {maximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </IconBtn>
            <IconBtn title="Close" onClick={onClose}>
              <X className="h-4 w-4" />
            </IconBtn>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto bg-white flex items-center justify-center p-4">
          {content.kind === "image" && (
            <img
              src={content.src}
              alt={content.alt ?? ""}
              draggable={false}
              className="max-w-full h-auto block select-none object-contain"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "center center",
                transition: "transform 140ms ease, filter 140ms ease",
                filter: bright ? "brightness(1.12)" : "none",
                maxHeight: maximized ? "80vh" : "66vh",
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
              <div className="text-xs uppercase tracking-wider text-slate-500">Audio exhibit</div>
              <audio key={content.src} src={content.src} controls preload="auto" className="w-full" />
            </div>
          )}
        </div>

        {content.kind === "image" && (
          <div className="flex items-center justify-center gap-3 border-t border-slate-300 bg-white py-1.5 px-3 text-slate-700 shrink-0">
            <button
              type="button"
              onClick={() => setBright((b) => !b)}
              title={bright ? "Normal brightness" : "Slightly brighten image"}
              className={cn(
                "p-1.5 rounded transition-colors",
                bright ? "bg-[#004a77]/12 text-[#004a77]" : "hover:bg-slate-100",
              )}
            >
              <Sun className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(3.5, +(z + 0.25).toFixed(2)))}
              title="Zoom in"
              className="p-1.5 rounded hover:bg-slate-100 transition-colors"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
              title="Zoom out"
              className="p-1.5 rounded hover:bg-slate-100 transition-colors"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => { setZoom(1); setBright(false); }}
              title="Reset view"
              className="p-1.5 rounded hover:bg-slate-100 transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <span className="text-[11px] font-medium text-slate-500 tabular-nums ml-1">
              {Math.round(zoom * 100)}%
            </span>
          </div>
        )}

        <div className="h-3.5 shrink-0" style={{ backgroundColor: UWORLD_NAVY }} />
      </div>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="h-7 w-7 rounded flex items-center justify-center hover:bg-white/15 transition-colors"
    >
      {children}
    </button>
  );
}
