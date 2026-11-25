import { Link } from "@tanstack/react-router";
import { Palette, Check, Minus, Plus, SlidersHorizontal } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  useUserSettings,
  APP_THEMES,
  ACCENT_PRESETS,
  FONT_FAMILIES,
  type HighlightStyle,
} from "@/lib/user-settings";

export function AppearanceQuickPanel({ onNavigate }: { onNavigate?: () => void }) {
  const [s, set] = useUserSettings();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground mb-1"
        >
          <Palette className="h-4 w-4 mr-2" />
          Customize Theme
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="end"
        sideOffset={10}
        className="w-80 p-4 space-y-4 bg-popover text-popover-foreground border-border shadow-xl z-50"
      >
        <div className="flex items-center justify-between">
          <div className="font-semibold text-sm flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" />
            Quick Appearance
          </div>
          <Link
            to="/account/settings"
            onClick={onNavigate}
            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
          >
            <SlidersHorizontal className="h-3 w-3" />
            All Settings
          </Link>
        </div>

        {/* Themes */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Theme</div>
          <div className="grid grid-cols-2 gap-1.5">
            {APP_THEMES.map((t) => {
              const active = s.appTheme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => set({ appTheme: t.id })}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs font-medium transition text-left ${
                    active
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <span
                    className="h-3.5 w-3.5 rounded-full border shrink-0"
                    style={{ background: t.preview.bg, borderColor: t.preview.border }}
                  />
                  <span className="truncate flex-1">{t.label}</span>
                  {active && <Check className="h-3 w-3 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Accent Color */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Accent Color</span>
            <input
              type="color"
              value={s.accentColor}
              onChange={(e) => set({ accentColor: e.target.value })}
              aria-label="Custom accent color"
              className="h-5 w-7 rounded border border-border cursor-pointer bg-transparent p-0"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ACCENT_PRESETS.map((preset) => {
              const active = s.accentColor.toLowerCase() === preset.hex.toLowerCase();
              return (
                <button
                  key={preset.id}
                  type="button"
                  title={preset.label}
                  onClick={() => set({ accentColor: preset.hex })}
                  className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition ${
                    active ? "border-foreground scale-110" : "border-transparent"
                  }`}
                  style={{ background: preset.hex }}
                >
                  {active && <Check className="h-3 w-3 text-white drop-shadow" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Font Family & Size */}
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Reading Font</div>
          <select
            value={s.fontFamily}
            onChange={(e) => set({ fontFamily: e.target.value as typeof s.fontFamily })}
            className="w-full text-xs rounded-md border border-border bg-card text-foreground px-2.5 py-1.5"
          >
            {FONT_FAMILIES.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label} ({f.category})
              </option>
            ))}
          </select>

          <div className="flex items-center justify-between pt-0.5">
            <span className="text-xs text-muted-foreground">Font size: {s.fontSize}px</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => set({ fontSize: Math.max(10, s.fontSize - 1) })}
                className="h-7 w-7 rounded border border-border bg-muted hover:bg-muted/70 flex items-center justify-center"
                aria-label="Decrease font size"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => set({ fontSize: Math.min(28, s.fontSize + 1) })}
                className="h-7 w-7 rounded border border-border bg-muted hover:bg-muted/70 flex items-center justify-center"
                aria-label="Increase font size"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Highlight Style */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Highlight Style</div>
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { id: "solid", label: "Solid" },
                { id: "pastel", label: "Pastel" },
                { id: "underline", label: "Underline" },
              ] as { id: HighlightStyle; label: string }[]
            ).map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => set({ highlightStyle: st.id })}
                className={`py-1 rounded-md border text-xs font-medium transition ${
                  s.highlightStyle === st.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
