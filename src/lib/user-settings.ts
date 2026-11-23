import { useEffect, useState, useSyncExternalStore } from "react";

export type AppTheme =
  | "light"
  | "dark"
  | "oled"
  | "sepia"
  | "slate"
  | "forest"
  | "high-contrast";

export type QuizTheme =
  | "default"
  | "light"
  | "dark"
  | "sepia"
  | "oled"
  | "high-contrast";

export type ResolvedQuizTheme = "light" | "dark" | "sepia" | "oled" | "high-contrast";

export type FontFamilyId =
  | "system"
  | "inter"
  | "space-grotesk"
  | "atkinson"
  | "georgia"
  | "merriweather"
  | "mono";

export type HighlightStyle = "solid" | "pastel" | "underline";
export type ContentWidth = "narrow" | "standard" | "wide" | "full";
export type UiRadius = "sharp" | "rounded" | "pill";

export type UserSettings = {
  // Account & Global Appearance
  darkMode: boolean;
  appTheme: AppTheme;
  accentColor: string;
  useAccentInQuizNav: boolean;
  uiRadius: UiRadius;
  imagesAutoZoom: boolean;
  hideNameOnLeaderboard: boolean;

  // Quiz defaults
  defaultTheme: QuizTheme;
  splitExplanations: boolean;
  transparentExplanations: boolean;
  largeImages: boolean;
  highlightOnly: boolean;
  multiHighlight: boolean;
  showTimer: boolean;
  stopTimerOnBlur: boolean;
  confirmOmission: boolean;
  hidePercentages: boolean;
  autoNightMode: boolean;
  nightStart: number; // hour 0-23
  nightEnd: number;   // hour 0-23

  // Reading & Typography
  fontFamily: FontFamilyId;
  applyFontGlobally: boolean;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  contentWidth: ContentWidth;

  // Highlights
  highlightStyle: HighlightStyle;
  strikeColor: string;
  enabledHighlights: Record<string, boolean>;
  customHighlights: string[];
  customHighlightLabels: Record<string, string>;

  // Toolbar
  toolbar: Record<string, boolean>;
};

export const APP_THEMES: {
  id: AppTheme;
  label: string;
  description: string;
  isDark: boolean;
  preview: { bg: string; card: string; sidebar: string; text: string; border: string };
}[] = [
  {
    id: "light",
    label: "Classic Light",
    description: "Crisp clinical light interface",
    isDark: false,
    preview: { bg: "#f8fafc", card: "#ffffff", sidebar: "#1e293b", text: "#0f172a", border: "#e2e8f0" },
  },
  {
    id: "dark",
    label: "Midnight Dark",
    description: "Balanced dark slate for long study sessions",
    isDark: true,
    preview: { bg: "#0b1120", card: "#131c31", sidebar: "#070b14", text: "#f1f5f9", border: "#24324d" },
  },
  {
    id: "oled",
    label: "True Black",
    description: "Pure OLED black with crisp contrast",
    isDark: true,
    preview: { bg: "#000000", card: "#0d0d10", sidebar: "#050507", text: "#fafafa", border: "#222228" },
  },
  {
    id: "sepia",
    label: "Warm Paper",
    description: "Book-like warm sepia with low blue light",
    isDark: false,
    preview: { bg: "#f4ecd8", card: "#fbf6e9", sidebar: "#2f2519", text: "#3b2f1e", border: "#d9c9a8" },
  },
  {
    id: "slate",
    label: "Nord Slate",
    description: "Soft muted arctic blue-gray dark theme",
    isDark: true,
    preview: { bg: "#242933", card: "#2e3440", sidebar: "#1d222b", text: "#eceff4", border: "#3b4252" },
  },
  {
    id: "forest",
    label: "Deep Forest",
    description: "Calm dark emerald for reduced eye strain",
    isDark: true,
    preview: { bg: "#0b1613", card: "#12221d", sidebar: "#070f0d", text: "#ecfdf5", border: "#1f3a31" },
  },
  {
    id: "high-contrast",
    label: "High Contrast",
    description: "Maximum legibility and sharp borders",
    isDark: false,
    preview: { bg: "#ffffff", card: "#ffffff", sidebar: "#000000", text: "#000000", border: "#111827" },
  },
];

export const QUIZ_THEME_OPTIONS: {
  id: QuizTheme;
  label: string;
  swatchBg: string;
  swatchBorder: string;
}[] = [
  { id: "default", label: "Match App", swatchBg: "linear-gradient(135deg, #ffffff 50%, #0f172a 50%)", swatchBorder: "#94a3b8" },
  { id: "light", label: "Light", swatchBg: "#ffffff", swatchBorder: "#cbd5e1" },
  { id: "sepia", label: "Sepia", swatchBg: "#f4ecd8", swatchBorder: "#c9b58a" },
  { id: "dark", label: "Dark", swatchBg: "#0f172a", swatchBorder: "#334155" },
  { id: "oled", label: "OLED Black", swatchBg: "#000000", swatchBorder: "#27272a" },
  { id: "high-contrast", label: "High Contrast", swatchBg: "#ffffff", swatchBorder: "#000000" },
];

export const ACCENT_PRESETS: { id: string; label: string; hex: string }[] = [
  { id: "usmle-navy", label: "USMLE Navy", hex: "#1a4b7c" },
  { id: "royal-blue", label: "Royal Blue", hex: "#2563eb" },
  { id: "teal", label: "Clinical Teal", hex: "#0d9488" },
  { id: "emerald", label: "Emerald", hex: "#059669" },
  { id: "indigo", label: "Indigo", hex: "#4f46e5" },
  { id: "violet", label: "Violet", hex: "#7c3aed" },
  { id: "rose", label: "Crimson Rose", hex: "#e11d48" },
  { id: "amber", label: "Warm Amber", hex: "#d97706" },
];

export const FONT_FAMILIES: {
  id: FontFamilyId;
  label: string;
  category: string;
  css: string;
}[] = [
  {
    id: "system",
    label: "System Default",
    category: "Sans-serif",
    css: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  },
  {
    id: "inter",
    label: "Inter",
    category: "Clean UI Sans",
    css: '"Inter", ui-sans-serif, system-ui, sans-serif',
  },
  {
    id: "atkinson",
    label: "Atkinson Hyperlegible",
    category: "Accessibility / Exam",
    css: '"Atkinson Hyperlegible", ui-sans-serif, system-ui, sans-serif',
  },
  {
    id: "space-grotesk",
    label: "Space Grotesk",
    category: "Modern Geometric",
    css: '"Space Grotesk", ui-sans-serif, system-ui, sans-serif',
  },
  {
    id: "georgia",
    label: "Georgia",
    category: "Classic Serif",
    css: 'Georgia, "Times New Roman", Times, serif',
  },
  {
    id: "merriweather",
    label: "Merriweather",
    category: "Editorial Serif",
    css: '"Merriweather", Georgia, serif',
  },
  {
    id: "mono",
    label: "JetBrains Mono",
    category: "Monospace",
    css: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
  },
];

export const CONTENT_WIDTH_PX: Record<ContentWidth, string> = {
  narrow: "720px",
  standard: "900px",
  wide: "1140px",
  full: "100%",
};

export const UI_RADIUS_VALUE: Record<UiRadius, string> = {
  sharp: "0.25rem",
  rounded: "0.625rem",
  pill: "1rem",
};

export const DEFAULT_HIGHLIGHTS: Record<string, { label: string; color: string }> = {
  "#ffeb3b": { label: "Yellow Highlight", color: "#ffeb3b" },
  "#4ade80": { label: "Green Highlight", color: "#4ade80" },
  "#38bdf8": { label: "Cyan Highlight", color: "#38bdf8" },
  "#f472b6": { label: "Pink Highlight", color: "#f472b6" },
  "#fb923c": { label: "Orange Highlight", color: "#fb923c" },
  "#c084fc": { label: "Purple Highlight", color: "#c084fc" },
};

export const TOOLBAR_ITEMS: { key: string; label: string }[] = [
  { key: "notes", label: "Add to Notes" },
  { key: "library", label: "Medical Library" },
  { key: "newFlashcard", label: "New Flashcard" },
  { key: "existingFlashcard", label: "Existing Flashcard" },
  { key: "copy", label: "Copy Text" },
];

export const DEFAULT_SETTINGS: UserSettings = {
  darkMode: false,
  appTheme: "light",
  accentColor: "#2563eb",
  useAccentInQuizNav: true,
  uiRadius: "rounded",
  imagesAutoZoom: false,
  hideNameOnLeaderboard: false,

  defaultTheme: "default",
  splitExplanations: false,
  transparentExplanations: true,
  largeImages: false,
  highlightOnly: true,
  multiHighlight: true,
  showTimer: true,
  stopTimerOnBlur: false,
  confirmOmission: false,
  hidePercentages: false,
  autoNightMode: false,
  nightStart: 20,
  nightEnd: 6,

  fontFamily: "system",
  applyFontGlobally: false,
  fontSize: 15,
  fontWeight: 0,
  lineHeight: 1.65,
  contentWidth: "standard",

  highlightStyle: "solid",
  strikeColor: "#ef4444",
  enabledHighlights: Object.fromEntries(Object.keys(DEFAULT_HIGHLIGHTS).map((k) => [k, true])),
  customHighlights: [],
  customHighlightLabels: {},
  toolbar: Object.fromEntries(TOOLBAR_ITEMS.map((t) => [t.key, true])),
};

export function isDarkAppTheme(theme: AppTheme): boolean {
  return theme === "dark" || theme === "oled" || theme === "slate" || theme === "forest";
}

export function getFontStack(id: FontFamilyId): string {
  return FONT_FAMILIES.find((f) => f.id === id)?.css ?? FONT_FAMILIES[0].css;
}

export function resolveQuizTheme(settings: UserSettings): ResolvedQuizTheme {
  if (settings.defaultTheme !== "default") return settings.defaultTheme;
  switch (settings.appTheme) {
    case "dark":
    case "slate":
    case "forest":
      return "dark";
    case "oled":
      return "oled";
    case "sepia":
      return "sepia";
    case "high-contrast":
      return "high-contrast";
    default:
      return "light";
  }
}

function parseHexRgb(hex: string): [number, number, number] | null {
  const clean = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

export function getReadableForeground(hex: string): string {
  const rgb = parseHexRgb(hex);
  if (!rgb) return "#ffffff";
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.45 ? "#0f172a" : "#ffffff";
}

export function darkenHex(hex: string, factor = 0.72): string {
  const rgb = parseHexRgb(hex);
  if (!rgb) return "#1a4b7c";
  const [r, g, b] = rgb.map((v) => Math.max(0, Math.min(255, Math.round(v * factor))));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export function applyUserThemeToDocument(settings: UserSettings) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const theme = settings.appTheme || (settings.darkMode ? "dark" : "light");
  const isDark = isDarkAppTheme(theme);

  root.setAttribute("data-theme", theme);
  root.classList.toggle("dark", isDark);
  root.setAttribute("data-hl-style", settings.highlightStyle || "solid");

  const accent = parseHexRgb(settings.accentColor) ? settings.accentColor : DEFAULT_SETTINGS.accentColor;
  const accentFg = getReadableForeground(accent);
  root.style.setProperty("--primary", accent);
  root.style.setProperty("--primary-foreground", accentFg);
  root.style.setProperty("--ring", accent);
  root.style.setProperty("--sidebar-primary", accent);
  root.style.setProperty("--sidebar-primary-foreground", accentFg);
  root.style.setProperty("--sidebar-ring", accent);
  root.style.setProperty("--sf-accent", accent);
  root.style.setProperty("--sf-nav-bg", settings.useAccentInQuizNav ? darkenHex(accent, 0.78) : "#1a4b7c");

  const radius = UI_RADIUS_VALUE[settings.uiRadius] ?? UI_RADIUS_VALUE.rounded;
  root.style.setProperty("--radius", radius);

  const fontStack = getFontStack(settings.fontFamily);
  root.style.setProperty("--sf-font-reading", fontStack);
  root.style.setProperty(
    "--sf-font-app",
    settings.applyFontGlobally ? fontStack : FONT_FAMILIES[0].css,
  );
  root.style.setProperty("--sf-line-height", String(settings.lineHeight || 1.65));
  root.style.setProperty("--sf-strike-color", settings.strikeColor || "#ef4444");
}

const KEY = "usmle:user-settings:v1";

function load(): UserSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    const appTheme: AppTheme = parsed.appTheme
      ? parsed.appTheme
      : parsed.darkMode
        ? "dark"
        : "light";
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      appTheme,
      darkMode: isDarkAppTheme(appTheme),
      enabledHighlights: { ...DEFAULT_SETTINGS.enabledHighlights, ...(parsed.enabledHighlights ?? {}) },
      customHighlightLabels: { ...(parsed.customHighlightLabels ?? {}) },
      toolbar: { ...DEFAULT_SETTINGS.toolbar, ...(parsed.toolbar ?? {}) },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

let current: UserSettings = DEFAULT_SETTINGS;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  current = load();
  applyUserThemeToDocument(current);
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) {
      current = load();
      applyUserThemeToDocument(current);
      listeners.forEach((l) => l());
    }
  });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function getSnapshot() {
  return current;
}

function getServerSnapshot() {
  return DEFAULT_SETTINGS;
}

export function setUserSettings(updater: Partial<UserSettings> | ((s: UserSettings) => UserSettings)) {
  const prev = current;
  let next = typeof updater === "function" ? updater(prev) : { ...prev, ...updater };

  // Keep darkMode and appTheme synchronized in both directions
  if (typeof updater !== "function") {
    if ("appTheme" in updater && updater.appTheme !== undefined) {
      next = { ...next, darkMode: isDarkAppTheme(updater.appTheme) };
    } else if ("darkMode" in updater && updater.darkMode !== undefined) {
      const targetTheme: AppTheme = updater.darkMode
        ? (isDarkAppTheme(prev.appTheme) ? prev.appTheme : "dark")
        : (isDarkAppTheme(prev.appTheme) ? "light" : prev.appTheme);
      next = { ...next, appTheme: targetTheme };
    }
  } else {
    if (next.appTheme !== prev.appTheme) {
      next = { ...next, darkMode: isDarkAppTheme(next.appTheme) };
    } else if (next.darkMode !== prev.darkMode) {
      const targetTheme: AppTheme = next.darkMode
        ? (isDarkAppTheme(next.appTheme) ? next.appTheme : "dark")
        : (isDarkAppTheme(next.appTheme) ? "light" : next.appTheme);
      next = { ...next, appTheme: targetTheme };
    }
  }

  current = next;
  if (typeof window !== "undefined") {
    applyUserThemeToDocument(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  }
  listeners.forEach((l) => l());
}

export function resetAppearanceSettings() {
  setUserSettings((cur) => ({
    ...cur,
    darkMode: DEFAULT_SETTINGS.darkMode,
    appTheme: DEFAULT_SETTINGS.appTheme,
    accentColor: DEFAULT_SETTINGS.accentColor,
    useAccentInQuizNav: DEFAULT_SETTINGS.useAccentInQuizNav,
    uiRadius: DEFAULT_SETTINGS.uiRadius,
    defaultTheme: DEFAULT_SETTINGS.defaultTheme,
    fontFamily: DEFAULT_SETTINGS.fontFamily,
    applyFontGlobally: DEFAULT_SETTINGS.applyFontGlobally,
    fontSize: DEFAULT_SETTINGS.fontSize,
    fontWeight: DEFAULT_SETTINGS.fontWeight,
    lineHeight: DEFAULT_SETTINGS.lineHeight,
    contentWidth: DEFAULT_SETTINGS.contentWidth,
    highlightStyle: DEFAULT_SETTINGS.highlightStyle,
    strikeColor: DEFAULT_SETTINGS.strikeColor,
    enabledHighlights: { ...DEFAULT_SETTINGS.enabledHighlights },
    customHighlights: [],
    customHighlightLabels: {},
  }));
}

export function useUserSettings(): [UserSettings, (u: Partial<UserSettings> | ((s: UserSettings) => UserSettings)) => void] {
  const s = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return [s, setUserSettings];
}

export function useHydratedSettings(): UserSettings {
  const [s, setS] = useState<UserSettings>(DEFAULT_SETTINGS);
  useEffect(() => {
    const loaded = load();
    setS(loaded);
    applyUserThemeToDocument(loaded);
    const unsub = subscribe(() => setS(current));
    return () => { unsub(); };
  }, []);
  return s;
}
