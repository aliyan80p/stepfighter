import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  Minus,
  Plus,
  Trash2,
  User,
  Sparkles,
  Palette,
  LayoutGrid,
  Highlighter,
  ShieldAlert,
  RotateCcw,
  Type,
  Eye,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { deleteMyAccount } from "@/lib/account.functions";
import {
  useUserSettings,
  resetAppearanceSettings,
  DEFAULT_SETTINGS,
  DEFAULT_HIGHLIGHTS,
  TOOLBAR_ITEMS,
  APP_THEMES,
  QUIZ_THEME_OPTIONS,
  ACCENT_PRESETS,
  FONT_FAMILIES,
  getFontStack,
  resolveQuizTheme,
  getQuizPalette,
  type UserSettings,
  type CustomThemeColors,
  type HighlightStyle,
  type ContentWidth,
  type UiRadius,
  type ExhibitStyle,
  type ExhibitViewerSize,
  type ExplanationAlign,
  type ImageAlign,
} from "@/lib/user-settings";

export const Route = createFileRoute("/_authenticated/account/settings")({
  component: SettingsPage,
});

const LINE_HEIGHT_OPTIONS: { value: number; label: string }[] = [
  { value: 1.4, label: "Compact" },
  { value: 1.55, label: "Normal" },
  { value: 1.65, label: "Comfortable" },
  { value: 1.8, label: "Relaxed" },
  { value: 2.0, label: "Spacious" },
];

const STRIKE_PRESETS = ["#ef4444", "#f97316", "#64748b", "#a855f7", "#0ea5e9"];

function SettingsPage() {
  const [s, set] = useUserSettings();

  const onResetAppearance = () => {
    resetAppearanceSettings();
    toast.success("Appearance settings restored to defaults");
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-12">
      <div
        className="h-24 md:h-28 relative overflow-hidden border-b border-border"
        style={{
          background: `linear-gradient(135deg, var(--sidebar) 0%, var(--sf-nav-bg, #1a4b7c) 55%, var(--primary) 100%)`,
        }}
      >
        <div className="sf-fluid-page !py-0 h-full flex items-center justify-between gap-4">
          <div className="text-white">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Appearance & Settings</h1>
            <p className="text-xs md:text-sm text-white/80">
              Personalize themes, colors, typography, highlights, and quiz behavior.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={onResetAppearance}
            className="bg-white/15 hover:bg-white/25 text-white border border-white/20 backdrop-blur shrink-0"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Reset Appearance
          </Button>
        </div>
      </div>

      <div className="sf-fluid-page space-y-6">
        {/* Live Preview */}
        <LivePreviewCard settings={s} />

        {/* Theme & Accent Colors */}
        <Card
          icon={<Palette className="h-4 w-4" />}
          iconBg="bg-primary text-primary-foreground"
          title="Theme & Colors"
          subtitle="Customize your workspace theme, accent color, and UI shape."
        >
          <div>
            <div className="font-semibold text-sm mb-2.5">Workspace Theme</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {APP_THEMES.map((theme) => {
                const active = s.appTheme === theme.id;
                const preview =
                  theme.id === "custom"
                    ? {
                        bg: s.customTheme.background,
                        card: s.customTheme.card,
                        sidebar: s.customTheme.sidebar,
                        text: s.customTheme.text,
                        border: s.accentColor,
                      }
                    : theme.preview;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => set({ appTheme: theme.id })}
                    className={`group relative rounded-xl border-2 p-3 text-left transition-all ${
                      active
                        ? "border-primary ring-2 ring-primary/25 bg-accent/40"
                        : "border-border bg-card hover:border-primary/50"
                    }`}
                  >
                    {/* Mini app preview */}
                    <div
                      className="h-14 w-full rounded-lg overflow-hidden border flex mb-2.5 shadow-inner"
                      style={{ background: preview.bg, borderColor: preview.border }}
                    >
                      <div className="w-5 h-full shrink-0 p-1 flex flex-col gap-1" style={{ background: preview.sidebar }}>
                        <span className="h-1.5 w-full rounded-full" style={{ background: s.accentColor }} />
                        <span className="h-1 w-2.5 rounded-full bg-white/30" />
                        <span className="h-1 w-2 rounded-full bg-white/20" />
                      </div>
                      <div className="flex-1 p-1.5 flex flex-col justify-between">
                        <div
                          className="h-5 rounded border px-1.5 flex items-center gap-1"
                          style={{ background: preview.card, borderColor: preview.border }}
                        >
                          <span className="h-1.5 w-8 rounded-full opacity-70" style={{ background: preview.text }} />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="h-1.5 w-10 rounded-full opacity-40" style={{ background: preview.text }} />
                          <span className="h-2.5 w-6 rounded-sm" style={{ background: s.accentColor }} />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-sm truncate">{theme.label}</span>
                      {active && (
                        <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{theme.description}</div>
                  </button>
                );
              })}
            </div>

            {s.appTheme === "custom" && (
              <CustomThemeBuilder
                customTheme={s.customTheme}
                onChange={(next) => set({ customTheme: next })}
              />
            )}
          </div>

          <div className="pt-4 border-t border-border space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-semibold text-sm">Accent Color</div>
                <div className="text-xs text-muted-foreground">Controls buttons, active tabs, focus rings, and quiz bars.</div>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground" htmlFor="custom-accent-picker">
                  Custom:
                </label>
                <input
                  id="custom-accent-picker"
                  type="color"
                  value={s.accentColor}
                  onChange={(e) => set({ accentColor: e.target.value })}
                  className="h-8 w-10 rounded-md border border-border cursor-pointer bg-transparent p-0.5"
                />
                <span className="text-xs font-mono text-muted-foreground uppercase">{s.accentColor}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {ACCENT_PRESETS.map((preset) => {
                const active = s.accentColor.toLowerCase() === preset.hex.toLowerCase();
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => set({ accentColor: preset.hex })}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                      active
                        ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary"
                        : "border-border bg-card text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <span
                      className="h-3.5 w-3.5 rounded-full border border-black/15 shrink-0"
                      style={{ background: preset.hex }}
                    />
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          <ToggleRow
            label="Apply accent color to Quiz navigation bars"
            hint="Tint the top and bottom quiz bars with your chosen accent color instead of fixed navy."
            value={s.useAccentInQuizNav}
            onChange={(v) => set({ useAccentInQuizNav: v })}
          />

          <div className="flex flex-wrap items-center justify-between gap-4 py-2 border-t border-border">
            <div>
              <div className="font-semibold text-sm">Interface Corner Style</div>
              <div className="text-xs text-muted-foreground">Adjust roundness of cards, buttons, and inputs.</div>
            </div>
            <div className="flex gap-1.5">
              {(
                [
                  { id: "sharp", label: "Sharp" },
                  { id: "rounded", label: "Rounded" },
                  { id: "pill", label: "Soft" },
                ] as { id: UiRadius; label: string }[]
              ).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => set({ uiRadius: r.id })}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md border transition ${
                    s.uiRadius === r.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Typography & Reading */}
        <Card
          icon={<Type className="h-4 w-4" />}
          iconBg="bg-orange-500 text-white"
          title="Typography & Reading"
          subtitle="Choose fonts, sizing, spacing, and reading width for questions and explanations."
        >
          <div>
            <div className="font-semibold text-sm mb-2.5">Font Family</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {FONT_FAMILIES.map((f) => {
                const active = s.fontFamily === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => set({ fontFamily: f.id })}
                    className={`rounded-xl border-2 p-3 text-left transition ${
                      active
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:border-primary/40 hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-base font-semibold truncate" style={{ fontFamily: f.css }}>
                        {f.label}
                      </span>
                      {active && <Check className="h-4 w-4 text-primary shrink-0" />}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{f.category}</div>
                    <div className="text-xs text-muted-foreground mt-1.5 truncate" style={{ fontFamily: f.css }}>
                      A 62-year-old man presents…
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <ToggleRow
            label="Apply font across entire app"
            hint="Use this font for menus, dashboards, and tables (otherwise applies to questions & reading views only)."
            value={s.applyFontGlobally}
            onChange={(v) => set({ applyFontGlobally: v })}
          />

          <NumberRow
            label="Font size"
            hint={`Current default: ${s.fontSize}px`}
            value={s.fontSize}
            min={10}
            max={28}
            onChange={(v) => set({ fontSize: v })}
            onReset={() => set({ fontSize: DEFAULT_SETTINGS.fontSize })}
          />

          <NumberRow
            label="Font weight"
            hint={`Current weight: ${400 + s.fontWeight * 100}`}
            value={s.fontWeight}
            min={-1}
            max={3}
            onChange={(v) => set({ fontWeight: v })}
            onReset={() => set({ fontWeight: DEFAULT_SETTINGS.fontWeight })}
          />

          <div className="flex flex-wrap items-center justify-between gap-4 py-2 border-t border-border">
            <div>
              <div className="font-semibold text-sm">Line spacing</div>
              <div className="text-xs text-muted-foreground">Vertical space between lines in vignettes and explanations.</div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {LINE_HEIGHT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => set({ lineHeight: opt.value })}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md border transition ${
                    Math.abs(s.lineHeight - opt.value) < 0.02
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 py-2 border-t border-border">
            <div>
              <div className="font-semibold text-sm">Line Width ({s.lineWidthPercent ?? 85}%)</div>
              <div className="text-xs text-muted-foreground">Control how wide question stems span across the screen.</div>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={50}
                max={100}
                step={5}
                value={s.lineWidthPercent ?? 85}
                onChange={(e) => set({ lineWidthPercent: Number(e.target.value) })}
                className="w-36 accent-primary"
              />
              <Button variant="ghost" size="sm" onClick={() => set({ lineWidthPercent: 85 })} className="text-primary hover:bg-primary/10">
                Reset
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 py-2 border-t border-border">
            <div>
              <div className="font-semibold text-sm">Extra Reading Padding ({s.contentPadding ?? 0} px)</div>
              <div className="text-xs text-muted-foreground">Up to 48 px of extra spacing; narrower panels use less automatically.</div>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={48}
                step={4}
                value={s.contentPadding ?? 0}
                onChange={(e) => set({ contentPadding: Number(e.target.value) })}
                className="w-36 accent-primary"
              />
              <Button variant="ghost" size="sm" onClick={() => set({ contentPadding: 0 })} className="text-primary hover:bg-primary/10">
                Reset
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 py-2 border-t border-border">
            <div>
              <div className="font-semibold text-sm">Explanation Alignment</div>
              <div className="text-xs text-muted-foreground">Text alignment for explanation paragraphs.</div>
            </div>
            <div className="flex gap-1.5">
              {(["left", "justify", "center"] as ExplanationAlign[]).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => set({ explanationAlign: a })}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md border capitalize transition ${
                    (s.explanationAlign ?? "left") === a
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 py-2 border-t border-border">
            <div>
              <div className="font-semibold text-sm">Image Alignment</div>
              <div className="text-xs text-muted-foreground">Align question and explanation images left or center.</div>
            </div>
            <div className="flex gap-1.5">
              {(["left", "center"] as ImageAlign[]).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => set({ imageAlign: a })}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md border capitalize transition ${
                    (s.imageAlign ?? "center") === a
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Quiz Highlights Studio */}
        <Card
          icon={<Highlighter className="h-4 w-4" />}
          iconBg="bg-amber-500 text-white"
          title="Quiz Highlights & Strikethrough"
          subtitle="Customize highlight style, strikethrough color, and your highlight palette."
        >
          <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-border">
            <div>
              <div className="font-semibold text-sm">Highlight Style</div>
              <div className="text-xs text-muted-foreground">Choose how highlighted text renders inside questions.</div>
            </div>
            <div className="flex gap-1.5">
              {(
                [
                  { id: "solid", label: "Solid Marker" },
                  { id: "pastel", label: "Soft Pastel" },
                  { id: "underline", label: "Underline" },
                ] as { id: HighlightStyle; label: string }[]
              ).map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => set({ highlightStyle: st.id })}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md border transition ${
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

          <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-border">
            <div>
              <div className="font-semibold text-sm">Strikethrough Color</div>
              <div className="text-xs text-muted-foreground">Line color used when crossing out text in vignettes.</div>
            </div>
            <div className="flex items-center gap-2">
              {STRIKE_PRESETS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => set({ strikeColor: hex })}
                  aria-label={`Strikethrough color ${hex}`}
                  className={`h-6 w-6 rounded-full border-2 transition ${
                    s.strikeColor.toLowerCase() === hex.toLowerCase()
                      ? "border-foreground scale-110"
                      : "border-transparent"
                  }`}
                  style={{ background: hex }}
                />
              ))}
              <input
                type="color"
                value={s.strikeColor}
                onChange={(e) => set({ strikeColor: e.target.value })}
                aria-label="Custom strikethrough color"
                className="h-7 w-8 rounded border border-border cursor-pointer bg-transparent p-0.5"
              />
            </div>
          </div>

          <ToggleRow
            label="Show highlights as bold"
            hint="Render highlighted text in bold for stronger visual emphasis."
            value={!!s.highlightBold}
            onChange={(v) => set({ highlightBold: v })}
          />
          <ToggleRow
            label="Show highlights with shadows"
            hint="Add a subtle drop shadow glow behind highlighted phrases."
            value={!!s.highlightShadow}
            onChange={(v) => set({ highlightShadow: v })}
          />
          {s.highlightShadow && (
            <div className="flex items-center justify-between gap-4 py-2 border-t border-border">
              <div>
                <div className="font-semibold text-sm">Shadow intensity ({s.highlightShadowIntensity ?? 30})</div>
                <div className="text-xs text-muted-foreground">Adjust highlight shadow depth (0–100).</div>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={s.highlightShadowIntensity ?? 30}
                onChange={(e) => set({ highlightShadowIntensity: Number(e.target.value) })}
                className="w-40 accent-primary"
              />
            </div>
          )}
          <ToggleRow
            label="Shine in dark mode"
            hint="Add a soft luminous shine to highlights when using dark themes."
            value={s.highlightDarkShine !== false}
            onChange={(v) => set({ highlightDarkShine: v })}
          />
          {s.highlightDarkShine !== false && (
            <div className="flex items-center justify-between gap-4 py-2 border-t border-border">
              <div>
                <div className="font-semibold text-sm">Shine intensity ({s.highlightDarkShineIntensity ?? 50})</div>
                <div className="text-xs text-muted-foreground">Adjust dark-mode highlight glow strength (0–100).</div>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={s.highlightDarkShineIntensity ?? 50}
                onChange={(e) => set({ highlightDarkShineIntensity: Number(e.target.value) })}
                className="w-40 accent-primary"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(DEFAULT_HIGHLIGHTS).map(([hex, meta]) => (
              <PillToggle
                key={hex}
                active={!!s.enabledHighlights[hex]}
                onClick={() =>
                  set((cur) => ({
                    ...cur,
                    enabledHighlights: { ...cur.enabledHighlights, [hex]: !cur.enabledHighlights[hex] },
                  }))
                }
              >
                <span className="h-4 w-4 rounded-full shrink-0 border border-black/15" style={{ background: meta.color }} />
                <span className="font-semibold text-sm">{meta.label}</span>
              </PillToggle>
            ))}
          </div>
          <CustomColors settings={s} set={set} />
        </Card>

        {/* Account & Quiz Defaults */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card
            icon={<User className="h-4 w-4" />}
            iconBg="bg-teal-600 text-white"
            title="Account & Display"
            subtitle="Global dashboard preferences and privacy."
          >
            <ToggleRow
              label="Dark mode (Quick toggle)"
              hint="Quickly switch between dark and light workspace themes."
              value={s.darkMode}
              onChange={(v) => set({ darkMode: v })}
            />
            <ToggleRow
              label="Images auto zoom"
              hint="Automatically enable image zoom where supported."
              value={s.imagesAutoZoom}
              onChange={(v) => set({ imagesAutoZoom: v })}
            />
            <ToggleRow
              label="Hide full name on leaderboard"
              hint="Mask your full name when shown to other users."
              value={s.hideNameOnLeaderboard}
              onChange={(v) => set({ hideNameOnLeaderboard: v })}
            />
          </Card>

          <Card
            icon={<Sparkles className="h-4 w-4" />}
            iconBg="bg-purple-600 text-white"
            title="Quiz Defaults"
            subtitle="Applied automatically every time a quiz opens."
          >
            <div className="pb-3 border-b border-border space-y-2">
              <div className="font-semibold text-sm">Default Quiz Canvas Theme</div>
              <div className="flex flex-wrap gap-2">
                {QUIZ_THEME_OPTIONS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => set({ defaultTheme: t.id })}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                      s.defaultTheme === t.id
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <span
                      className="h-3.5 w-3.5 rounded-full border shrink-0"
                      style={{ background: t.swatchBg, borderColor: t.swatchBorder }}
                    />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <ToggleRow
              label="Split screen explanations"
              hint="Open answer explanations side by side with the question."
              value={s.splitExplanations}
              onChange={(v) => set({ splitExplanations: v })}
            />
            <ToggleRow
              label="Transparent background in explanations"
              hint="Remove the solid explanation card background by default."
              value={s.transparentExplanations}
              onChange={(v) => set({ transparentExplanations: v })}
            />
            <ToggleRow
              label="Large image size"
              hint="Show quiz images larger and clearer when space allows."
              value={s.largeImages}
              onChange={(v) => set({ largeImages: v })}
            />
            <ToggleRow
              label="Highlight only mode"
              hint="Prefer selection behavior focused on highlights."
              value={s.highlightOnly}
              onChange={(v) => set({ highlightOnly: v })}
            />
            <ToggleRow
              label="Multi highlight"
              hint="Enable multi-color highlighting tools in quizzes."
              value={s.multiHighlight}
              onChange={(v) => set({ multiHighlight: v })}
            />
            <ToggleRow
              label="Show timer"
              hint="Keep the quiz timer visible by default."
              value={s.showTimer}
              onChange={(v) => set({ showTimer: v })}
            />
            <ToggleRow
              label="Stop timer on blur"
              hint="Pause timer when you leave the quiz tab or window."
              value={s.stopTimerOnBlur}
              onChange={(v) => set({ stopTimerOnBlur: v })}
            />
            <ToggleRow
              label="Confirm answer omission"
              hint="Ask before leaving a question omitted."
              value={s.confirmOmission}
              onChange={(v) => set({ confirmOmission: v })}
            />
            <ToggleRow
              label="Hide percentages"
              hint="Hide detailed answer percentage breakdowns by default."
              value={s.hidePercentages}
              onChange={(v) => set({ hidePercentages: v })}
            />
            <ToggleRow
              label="Show unsubmitted question indicator"
              hint="Show an indicator when you select an answer without clicking Submit."
              value={s.showUnsubmittedIndicator !== false}
              onChange={(v) => set({ showUnsubmittedIndicator: v })}
            />
            <ToggleRow
              label="Hide question difficulty rating"
              hint="Hide difficulty badges during practice and review."
              value={!!s.hideDifficultyRating}
              onChange={(v) => set({ hideDifficultyRating: v })}
            />
            <ToggleRow
              label="Smart Context Menu"
              hint="Show the floating quick-highlight and copy toolbar when selecting text."
              value={s.smartContextMenu !== false}
              onChange={(v) => set({ smartContextMenu: v })}
            />
            <ToggleRow
              label="Automatic night mode"
              hint="Auto-switch quiz to dark mode based on scheduled time."
              value={s.autoNightMode}
              onChange={(v) => set({ autoNightMode: v })}
            />
            <div className="flex items-center justify-between gap-4 py-2 border-t border-border">
              <div>
                <div className="font-semibold text-sm">Night mode schedule</div>
                <div className="text-xs text-muted-foreground">Start and end hours (24h).</div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={s.nightStart}
                  onChange={(e) => set({ nightStart: Number(e.target.value) })}
                  className="text-sm border border-border rounded px-2 py-1 bg-card text-foreground"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {String(i).padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
                <span className="text-muted-foreground text-sm">→</span>
                <select
                  value={s.nightEnd}
                  onChange={(e) => set({ nightEnd: Number(e.target.value) })}
                  className="text-sm border border-border rounded px-2 py-1 bg-card text-foreground"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {String(i).padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>
        </div>

        {/* Exhibits, Sidebar & Windows */}
        <Card
          icon={<LayoutGrid className="h-4 w-4" />}
          iconBg="bg-indigo-600 text-white"
          title="Exhibits, Sidebar & Windows"
          subtitle="Control exhibit appearance, quiz question sidebar behavior, and floating windows."
        >
          <div className="flex flex-wrap items-center justify-between gap-4 pb-2">
            <div>
              <div className="font-semibold text-sm">Exhibit Style</div>
              <div className="text-xs text-muted-foreground">How inline exhibit links appear inside clinical vignettes.</div>
            </div>
            <div className="flex gap-1.5">
              {(["button", "link", "plain"] as ExhibitStyle[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => set({ exhibitStyle: st })}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md border capitalize transition ${
                    (s.exhibitStyle ?? "button") === st
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 py-2 border-t border-border">
            <div>
              <div className="font-semibold text-sm">Exhibit Viewer Size</div>
              <div className="text-xs text-muted-foreground">Default modal width when opening exhibits and images.</div>
            </div>
            <div className="flex gap-1.5">
              {(["default", "small", "medium", "large"] as ExhibitViewerSize[]).map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => set({ exhibitViewerSize: sz })}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md border capitalize transition ${
                    (s.exhibitViewerSize ?? "default") === sz
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>
          <ToggleRow
            label="Close Exhibit on click outside"
            hint="Dismiss exhibit popups when clicking the dark backdrop."
            value={s.closeExhibitOnOutsideClick !== false}
            onChange={(v) => set({ closeExhibitOnOutsideClick: v })}
          />
          <ToggleRow
            label="Save Space for Sidebar"
            hint="Reserve space beside the question content instead of overlaying the question list."
            value={s.saveSpaceForSidebar !== false}
            onChange={(v) => set({ saveSpaceForSidebar: v })}
          />
          <ToggleRow
            label="Show Sidebar Automatically"
            hint="Keep the question navigator open automatically when starting a block."
            value={s.autoShowSidebar !== false}
            onChange={(v) => set({ autoShowSidebar: v })}
          />
          <ToggleRow
            label="Hide Sidebar Automatically"
            hint="Auto-collapse the question navigator after selecting a question."
            value={!!s.autoHideSidebar}
            onChange={(v) => set({ autoHideSidebar: v })}
          />
          <ToggleRow
            label="Show Sidebar by hovering over screen edge"
            hint="Reveal the hidden question sidebar when moving your mouse to the left edge."
            value={!!s.hoverEdgeSidebar}
            onChange={(v) => set({ hoverEdgeSidebar: v })}
          />
          <ToggleRow
            label="Allow windows to go off screen"
            hint="Permit floating tool windows to move freely near or beyond viewport edges."
            value={!!s.allowWindowsOffScreen}
            onChange={(v) => set({ allowWindowsOffScreen: v })}
          />
        </Card>

        {/* Quiz Toolbar Icons */}
        <Card
          icon={<LayoutGrid className="h-4 w-4" />}
          iconBg="bg-blue-600 text-white"
          title="Quiz Toolbar Icons"
          subtitle="Choose which quiz toolbar actions are visible by default."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {TOOLBAR_ITEMS.map((item) => (
              <PillToggle
                key={item.key}
                active={!!s.toolbar[item.key]}
                onClick={() =>
                  set((cur) => ({
                    ...cur,
                    toolbar: { ...cur.toolbar, [item.key]: !cur.toolbar[item.key] },
                  }))
                }
              >
                <span className="font-semibold text-sm">{item.label}</span>
              </PillToggle>
            ))}
          </div>
        </Card>

        <DangerZone />
      </div>
    </div>
  );
}

function LivePreviewCard({ settings }: { settings: UserSettings }) {
  const quizTheme = resolveQuizTheme(settings);
  const p = getQuizPalette(quizTheme, settings.customTheme);
  const palette = { bg: p.pageBg, card: p.cardBg, text: p.text, border: p.border };

  const activeHighlights = [
    ...Object.keys(DEFAULT_HIGHLIGHTS).filter((c) => settings.enabledHighlights[c]),
    ...settings.customHighlights.filter((c) => settings.enabledHighlights[c]),
  ];
  const firstHl = activeHighlights[0] ?? "#ffeb3b";
  const secondHl = activeHighlights[1] ?? "#4ade80";

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/40">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Eye className="h-4 w-4 text-primary" />
          Live Study Preview
        </div>
        <div className="text-xs text-muted-foreground">
          {FONT_FAMILIES.find((f) => f.id === settings.fontFamily)?.label} · {settings.fontSize}px · Line {settings.lineHeight}
        </div>
      </div>

      <div
        className={`p-5 transition-colors qbank-theme-${quizTheme}`}
        style={{ background: palette.bg, color: palette.text }}
      >
        <div
          className="rounded-lg border p-4 space-y-3"
          style={{
            background: palette.card,
            borderColor: palette.border,
            fontFamily: getFontStack(settings.fontFamily),
            fontSize: `${settings.fontSize}px`,
            fontWeight: 400 + settings.fontWeight * 100,
            lineHeight: settings.lineHeight,
          }}
        >
          <p className="m-0">
            A 58-year-old man comes to the emergency department with{" "}
            <mark
              className="qbank-hl"
              data-color={firstHl}
              style={{ ["--hl-color" as string]: firstHl }}
            >
              substernal chest pain radiating to the left jaw
            </mark>{" "}
            for 45 minutes. ECG reveals{" "}
            <mark
              className="qbank-hl"
              data-color={secondHl}
              style={{ ["--hl-color" as string]: secondHl }}
            >
              ST-segment elevations in leads II, III, and aVF
            </mark>
            .{" "}
            <mark className="qbank-hl" data-strike="">
              Troponin I is pending.
            </mark>
          </p>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap gap-2 text-xs">
              <span
                className="px-2.5 py-1 rounded border font-medium"
                style={{ borderColor: palette.border }}
              >
                A. Left anterior descending artery
              </span>
              <span
                className="px-2.5 py-1 rounded border-2 font-semibold"
                style={{ borderColor: settings.accentColor }}
              >
                B. Right coronary artery
              </span>
            </div>
            <button
              type="button"
              className="px-4 py-1.5 text-xs font-semibold rounded-md bg-primary text-primary-foreground shadow-sm"
            >
              Submit Answer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const CUSTOM_THEME_PRESETS: { label: string; colors: CustomThemeColors }[] = [
  { label: "Lavender Mist", colors: { background: "#f5f3ff", card: "#ffffff", sidebar: "#2e1065", text: "#1e1b4b" } },
  { label: "Warm Latte", colors: { background: "#f7f1e8", card: "#fffcf7", sidebar: "#3b281c", text: "#2c1d13" } },
  { label: "Deep Navy", colors: { background: "#0a1628", card: "#112240", sidebar: "#060e1a", text: "#e6f1ff" } },
  { label: "Obsidian Plum", colors: { background: "#14101d", card: "#1e182b", sidebar: "#0c0912", text: "#f3e8ff" } },
];

function CustomThemeBuilder({
  customTheme,
  onChange,
}: {
  customTheme: CustomThemeColors;
  onChange: (next: CustomThemeColors) => void;
}) {
  const fields: { key: keyof CustomThemeColors; label: string }[] = [
    { key: "background", label: "Page Background" },
    { key: "card", label: "Card Surface" },
    { key: "sidebar", label: "Sidebar" },
    { key: "text", label: "Text Color" },
  ];
  return (
    <div className="sf-scale-enter mt-4 rounded-xl border border-primary/30 bg-muted/30 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">Customize Your Theme Colors</div>
          <div className="text-xs text-muted-foreground">Pick any colors below or start from a palette.</div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CUSTOM_THEME_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => onChange(p.colors)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border border-border bg-card hover:bg-muted transition"
            >
              <span className="h-3 w-3 rounded-full border border-black/15" style={{ background: p.colors.background }} />
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {fields.map((f) => (
          <label
            key={f.key}
            className="flex items-center gap-2.5 rounded-lg border border-border bg-card p-2.5 cursor-pointer hover:border-primary/50 transition"
          >
            <input
              type="color"
              value={customTheme[f.key]}
              onChange={(e) => onChange({ ...customTheme, [f.key]: e.target.value })}
              className="h-8 w-8 rounded border border-border cursor-pointer bg-transparent p-0 shrink-0"
            />
            <div className="min-w-0">
              <div className="text-xs font-semibold truncate">{f.label}</div>
              <div className="text-[11px] font-mono text-muted-foreground uppercase">{customTheme[f.key]}</div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

function DangerZone() {
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const remove = useServerFn(deleteMyAccount);

  const onDelete = async () => {
    setBusy(true);
    try {
      await remove({ data: { confirm: "DELETE" } });
      await supabase.auth.signOut();
      try {
        localStorage.clear();
      } catch {
        /* storage may be blocked */
      }
      toast.success("Your account and all personal data have been deleted.");
      navigate({ to: "/" });
    } catch {
      toast.error("Could not delete the account. Please contact support.");
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border-2 border-destructive/30 bg-card p-6 shadow-sm space-y-4">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-destructive text-destructive-foreground flex items-center justify-center shrink-0">
          <ShieldAlert className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-semibold text-destructive">Delete account</div>
          <div className="text-sm text-muted-foreground">
            Permanently erases your profile, subscription record, test history, answers,
            bookmarks, notes, flashcards and feedback. This cannot be undone.
          </div>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2 border-t border-border">
        <Input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Type DELETE to confirm"
          aria-label="Type DELETE to confirm account deletion"
          className="sm:max-w-xs"
        />
        <Button variant="destructive" disabled={confirm !== "DELETE" || busy} onClick={onDelete}>
          {busy ? "Deleting…" : "Delete my account"}
        </Button>
      </div>
    </div>
  );
}

function Card({
  icon,
  iconBg,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm space-y-4">
      <div className="flex items-start gap-3">
        <div className={`h-9 w-9 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>{icon}</div>
        <div>
          <div className="text-base font-semibold text-foreground">{title}</div>
          <div className="text-xs sm:text-sm text-muted-foreground">{subtitle}</div>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-t border-border first:border-t-0 first:pt-0">
      <div className="min-w-0">
        <div className="font-semibold text-sm">{label}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}

function NumberRow({
  label,
  hint,
  value,
  min,
  max,
  onChange,
  onReset,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  onReset: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-t border-border first:border-t-0 first:pt-0">
      <div>
        <div className="font-semibold text-sm">{label}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
      <div className="flex items-center gap-2">
        <IconBtn onClick={() => onChange(Math.max(min, value - 1))}>
          <Minus className="h-4 w-4" />
        </IconBtn>
        <div className="w-10 text-center font-semibold">{value}</div>
        <IconBtn onClick={() => onChange(Math.min(max, value + 1))}>
          <Plus className="h-4 w-4" />
        </IconBtn>
        <Button variant="ghost" size="sm" onClick={onReset} className="text-primary hover:bg-primary/10 ml-1">
          Reset
        </Button>
      </div>
    </div>
  );
}

function IconBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-8 w-8 rounded-md bg-muted hover:bg-muted/70 text-foreground flex items-center justify-center border border-border"
    >
      {children}
    </button>
  );
}

function PillToggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-full border-2 transition text-left ${
        active
          ? "bg-primary/10 border-primary text-foreground"
          : "bg-card border-border text-muted-foreground hover:bg-muted"
      }`}
    >
      <span className="flex-1 flex items-center gap-2 min-w-0">{children}</span>
      <span
        className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${
          active ? "bg-primary text-primary-foreground" : "text-muted-foreground/40"
        }`}
      >
        <Check className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}

function CustomColors({
  settings,
  set,
}: {
  settings: UserSettings;
  set: (u: Partial<UserSettings> | ((s: UserSettings) => UserSettings)) => void;
}) {
  const [picking, setPicking] = useState(false);
  const [color, setColor] = useState("#a78bfa");
  const [label, setLabel] = useState("");

  const addColor = () => {
    const cleanLabel = label.trim();
    set((cur) => ({
      ...cur,
      customHighlights: cur.customHighlights.includes(color)
        ? cur.customHighlights
        : [...cur.customHighlights, color],
      enabledHighlights: { ...cur.enabledHighlights, [color]: true },
      customHighlightLabels: cleanLabel
        ? { ...cur.customHighlightLabels, [color]: cleanLabel }
        : cur.customHighlightLabels,
    }));
    setLabel("");
    setPicking(false);
  };

  return (
    <div className="pt-4 border-t border-border space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-semibold text-sm">Custom highlight colors</div>
          <div className="text-xs text-muted-foreground">
            Add any color (e.g. for Labs, Pathology, Drugs) and it will appear in the quiz highlight toolbar.
          </div>
        </div>
        {!picking ? (
          <Button size="sm" variant="secondary" onClick={() => setPicking(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add color
          </Button>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-8 w-10 rounded border border-border cursor-pointer bg-transparent p-0.5"
            />
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label (optional)"
              className="h-8 w-36 text-xs"
            />
            <Button size="sm" onClick={addColor}>
              Add
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPicking(false)}>
              Cancel
            </Button>
          </div>
        )}
      </div>

      {settings.customHighlights.map((hex, i) => (
        <div key={hex} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex items-center gap-3">
            <span className="h-7 w-10 rounded border border-black/15 shrink-0" style={{ background: hex }} />
            <div>
              <div className="font-semibold text-sm">
                {settings.customHighlightLabels?.[hex] || `Custom ${i + 1}`}
              </div>
              <div className="text-[11px] font-mono text-muted-foreground uppercase">{hex}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                set((cur) => ({
                  ...cur,
                  enabledHighlights: { ...cur.enabledHighlights, [hex]: !cur.enabledHighlights[hex] },
                }))
              }
              className={`h-8 w-8 rounded-md flex items-center justify-center transition ${
                settings.enabledHighlights[hex]
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
              aria-label="Toggle custom highlight"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                set((cur) => ({
                  ...cur,
                  customHighlights: cur.customHighlights.filter((c) => c !== hex),
                  enabledHighlights: Object.fromEntries(
                    Object.entries(cur.enabledHighlights).filter(([k]) => k !== hex),
                  ),
                  customHighlightLabels: Object.fromEntries(
                    Object.entries(cur.customHighlightLabels ?? {}).filter(([k]) => k !== hex),
                  ),
                }))
              }
              className="h-8 w-8 rounded-md bg-destructive/15 text-destructive flex items-center justify-center hover:bg-destructive/25 transition"
              aria-label="Delete custom highlight"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
