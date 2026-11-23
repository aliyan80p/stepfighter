import { useEffect, useState } from "react";
import { X, Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHydratedSettings } from "@/lib/user-settings";

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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [content, onClose]);

  if (!content) return null;

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
          "sf-scale-enter bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col",
          maximized ? "w-[98vw] h-[96vh]" : `${viewerWidthClass} max-h-[88vh]`,
        )}
        style={{ fontFamily: "Verdana, Arial, Georgia, serif" }}
      >
        <div
          className="flex items-center justify-between px-4 text-white shrink-0"
          style={{ backgroundColor: "var(--sf-nav-bg, #1a4b7c)", height: 40 }}
        >
          <div className="text-[13px] font-semibold tracking-wide">{title}</div>
          <div className="flex items-center gap-1">
            {content.kind === "image" && (
              <>
                <IconBtn title="Zoom out" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>
                  <ZoomOut className="h-4 w-4" />
                </IconBtn>
                <IconBtn title="Zoom in" onClick={() => setZoom((z) => Math.min(4, z + 0.25))}>
                  <ZoomIn className="h-4 w-4" />
                </IconBtn>
                <IconBtn title="Reset zoom" onClick={() => setZoom(1)}>
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

        <div className="flex-1 min-h-0 overflow-auto bg-slate-50 flex items-center justify-center p-4">
          {content.kind === "image" && (
            <img
              src={content.src}
              alt={content.alt ?? ""}
              draggable={false}
              className="max-w-none block select-none"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "center center",
                transition: "transform 120ms ease",
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
              <div className="text-xs uppercase tracking-wider text-slate-500">Audio exhibit</div>
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
