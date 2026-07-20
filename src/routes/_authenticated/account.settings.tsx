import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Minus, Plus, Trash2, User, Sparkles, Palette, LayoutGrid, BookOpen, Highlighter } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  useUserSettings,
  DEFAULT_SETTINGS,
  DEFAULT_HIGHLIGHTS,
  TOOLBAR_ITEMS,
  type UserSettings,
  type QuizTheme,
} from "@/lib/user-settings";

export const Route = createFileRoute("/_authenticated/account/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const [s, set] = useUserSettings();

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="bg-gradient-to-r from-slate-900 to-blue-900 h-16" />
      <div className="p-6 md:p-8 max-w-6xl mx-auto -mt-8 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card icon={<User className="h-4 w-4" />} iconBg="bg-teal-500" title="Account" subtitle="Global dashboard preferences and privacy.">
            <ToggleRow
              label="Dark mode"
              hint="Use the dark dashboard theme across your account."
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

          <Card icon={<Sparkles className="h-4 w-4" />} iconBg="bg-purple-600" title="Quiz Defaults" subtitle="Applied automatically every time a quiz opens.">
            <div className="flex gap-2 pb-3 border-b border-border">
              {(["default", "light", "dark"] as QuizTheme[]).map((t) => (
                <button
                  key={t}
                  onClick={() => set({ defaultTheme: t })}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium border transition ${
                    s.defaultTheme === t
                      ? "bg-blue-50 border-blue-400 text-blue-700"
                      : "bg-card border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {t[0].toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            <ToggleRow label="Split screen explanations" hint="Open answer explanations side by side with the question."
              value={s.splitExplanations} onChange={(v) => set({ splitExplanations: v })} />
            <ToggleRow label="Transparent background in explanations" hint="Remove the white explanation card background by default."
              value={s.transparentExplanations} onChange={(v) => set({ transparentExplanations: v })} />
            <ToggleRow label="Large image size" hint="Show quiz images larger and clearer when space allows."
              value={s.largeImages} onChange={(v) => set({ largeImages: v })} />
            <ToggleRow label="Highlight only mode" hint="Prefer selection behavior focused on highlights."
              value={s.highlightOnly} onChange={(v) => set({ highlightOnly: v })} />
            <ToggleRow label="Multi highlight" hint="Enable multi-color highlighting tools in quizzes."
              value={s.multiHighlight} onChange={(v) => set({ multiHighlight: v })} />
            <ToggleRow label="Show timer" hint="Keep the quiz timer visible by default."
              value={s.showTimer} onChange={(v) => set({ showTimer: v })} />
            <ToggleRow label="Stop timer on blur" hint="Pause timer when you leave the quiz tab or window."
              value={s.stopTimerOnBlur} onChange={(v) => set({ stopTimerOnBlur: v })} />
            <ToggleRow label="Confirm answer omission" hint="Ask before leaving a question omitted."
              value={s.confirmOmission} onChange={(v) => set({ confirmOmission: v })} />
            <ToggleRow label="Hide percentages" hint="Hide detailed answer percentage breakdowns by default."
              value={s.hidePercentages} onChange={(v) => set({ hidePercentages: v })} />
            <ToggleRow label="Automatic night mode" hint="Auto-switch quiz to dark mode based on scheduled time."
              value={s.autoNightMode} onChange={(v) => set({ autoNightMode: v })} />
            <div className="flex items-center justify-between gap-4 py-2 border-t border-border">
              <div>
                <div className="font-semibold text-sm">Night mode schedule</div>
                <div className="text-xs text-blue-600/80">Start and end hours (24h).</div>
              </div>
              <div className="flex items-center gap-2">
                <select value={s.nightStart} onChange={(e) => set({ nightStart: Number(e.target.value) })}
                  className="text-sm border border-border rounded px-2 py-1 bg-card">
                  {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>)}
                </select>
                <span className="text-muted-foreground text-sm">→</span>
                <select value={s.nightEnd} onChange={(e) => set({ nightEnd: Number(e.target.value) })}
                  className="text-sm border border-border rounded px-2 py-1 bg-card">
                  {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>)}
                </select>
              </div>
            </div>

          </Card>
        </div>

        <Card icon={<BookOpen className="h-4 w-4" />} iconBg="bg-orange-500" title="Reading" subtitle="Text defaults for question and explanation content.">
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
            hint={`Current default: ${s.fontWeight}`}
            value={s.fontWeight}
            min={-2}
            max={4}
            onChange={(v) => set({ fontWeight: v })}
            onReset={() => set({ fontWeight: DEFAULT_SETTINGS.fontWeight })}
          />
        </Card>

        <Card icon={<Highlighter className="h-4 w-4" />} iconBg="bg-blue-500" title="Quiz Highlights" subtitle="Choose the highlight colors available in quizzes.">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(DEFAULT_HIGHLIGHTS).map(([hex, meta]) => (
              <PillToggle
                key={hex}
                active={!!s.enabledHighlights[hex]}
                onClick={() => set((cur) => ({ ...cur, enabledHighlights: { ...cur.enabledHighlights, [hex]: !cur.enabledHighlights[hex] } }))}
              >
                <span className="h-4 w-4 rounded-full shrink-0" style={{ background: meta.color }} />
                <span className="font-semibold text-sm">{meta.label}</span>
              </PillToggle>
            ))}
          </div>
          <CustomColors settings={s} set={set} />
        </Card>

        <Card icon={<LayoutGrid className="h-4 w-4" />} iconBg="bg-blue-500" title="Quiz Toolbar Icons" subtitle="Choose which quiz toolbar actions are visible by default.">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {TOOLBAR_ITEMS.map((item) => (
              <PillToggle
                key={item.key}
                active={!!s.toolbar[item.key]}
                onClick={() => set((cur) => ({ ...cur, toolbar: { ...cur.toolbar, [item.key]: !cur.toolbar[item.key] } }))}
              >
                <span className="font-semibold text-sm">{item.label}</span>
              </PillToggle>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Card({ icon, iconBg, title, subtitle, children }: { icon: React.ReactNode; iconBg: string; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
      <div className="flex items-start gap-3">
        <div className={`h-9 w-9 rounded-lg ${iconBg} text-white flex items-center justify-center shrink-0`}>{icon}</div>
        <div>
          <div className="text-sm font-semibold text-muted-foreground">{title}</div>
          <div className="text-sm text-blue-600/80">{subtitle}</div>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function ToggleRow({ label, hint, value, onChange }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-t border-border first:border-t-0 first:pt-0">
      <div className="min-w-0">
        <div className="font-semibold text-sm">{label}</div>
        <div className="text-xs text-blue-600/80">{hint}</div>
      </div>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}

function NumberRow({ label, hint, value, min, max, onChange, onReset }: { label: string; hint: string; value: number; min: number; max: number; onChange: (v: number) => void; onReset: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-t border-border first:border-t-0 first:pt-0">
      <div>
        <div className="font-semibold text-sm">{label}</div>
        <div className="text-xs text-blue-600/80">{hint}</div>
      </div>
      <div className="flex items-center gap-2">
        <IconBtn onClick={() => onChange(Math.max(min, value - 1))}><Minus className="h-4 w-4" /></IconBtn>
        <div className="w-10 text-center font-semibold">{value}</div>
        <IconBtn onClick={() => onChange(Math.min(max, value + 1))}><Plus className="h-4 w-4" /></IconBtn>
        <Button variant="ghost" size="sm" onClick={onReset} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 ml-2">Reset</Button>
      </div>
    </div>
  );
}

function IconBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="h-8 w-8 rounded-md bg-muted hover:bg-muted/70 text-foreground flex items-center justify-center border border-border">
      {children}
    </button>
  );
}

function PillToggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-full border-2 transition text-left ${
        active
          ? "bg-emerald-50 border-emerald-300 text-emerald-800"
          : "bg-card border-border text-muted-foreground hover:bg-muted"
      }`}
    >
      <span className="flex-1 flex items-center gap-2">{children}</span>
      <span className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${active ? "text-emerald-600" : "text-muted-foreground/40"}`}>
        <Check className="h-4 w-4" />
      </span>
    </button>
  );
}

function CustomColors({ settings, set }: { settings: UserSettings; set: (u: Partial<UserSettings> | ((s: UserSettings) => UserSettings)) => void }) {
  const [picking, setPicking] = useState(false);
  const [color, setColor] = useState("#a78bfa");
  return (
    <div className="pt-4 border-t border-border space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold text-sm">Custom colors</div>
          <div className="text-xs text-blue-600/80">Add any color and it will appear in the quiz highlight toolbar.</div>
        </div>
        {!picking ? (
          <Button size="sm" variant="ghost" className="bg-blue-50 text-blue-600 hover:bg-blue-100" onClick={() => setPicking(true)}>
            Add color
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-10 rounded border border-border" />
            <Button size="sm" onClick={() => {
              set((cur) => ({
                ...cur,
                customHighlights: cur.customHighlights.includes(color) ? cur.customHighlights : [...cur.customHighlights, color],
                enabledHighlights: { ...cur.enabledHighlights, [color]: true },
              }));
              setPicking(false);
            }}>Add</Button>
            <Button size="sm" variant="ghost" onClick={() => setPicking(false)}>Cancel</Button>
          </div>
        )}
      </div>
      {settings.customHighlights.map((hex, i) => (
        <div key={hex} className="flex items-center justify-between rounded-lg border border-border p-3">
          <div className="flex items-center gap-3">
            <span className="h-7 w-10 rounded border border-border" style={{ background: hex }} />
            <span className="font-semibold text-sm">Custom {i + 1}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => set((cur) => ({ ...cur, enabledHighlights: { ...cur.enabledHighlights, [hex]: !cur.enabledHighlights[hex] } }))}
              className={`h-8 w-8 rounded-md flex items-center justify-center ${settings.enabledHighlights[hex] ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}
              aria-label="Toggle"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={() => set((cur) => ({
                ...cur,
                customHighlights: cur.customHighlights.filter((c) => c !== hex),
                enabledHighlights: Object.fromEntries(Object.entries(cur.enabledHighlights).filter(([k]) => k !== hex)),
              }))}
              className="h-8 w-8 rounded-md bg-rose-100 text-rose-600 flex items-center justify-center hover:bg-rose-200"
              aria-label="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
