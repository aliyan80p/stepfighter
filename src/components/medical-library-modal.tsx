import { X, BookOpen } from "lucide-react";
import { MedicalLibraryBrowser } from "@/components/medical-library-browser";

/** Full-screen Medical Library overlay for use inside a test / review session. */
export function MedicalLibraryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
          <BookOpen className="h-4 w-4" /> Medical Library
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Medical Library"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        <MedicalLibraryBrowser rootClassName="flex h-full flex-col lg:flex-row" />
      </div>
    </div>
  );
}
