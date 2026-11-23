import { useEffect, useState, useSyncExternalStore } from "react";

export type AppTheme =
  | "light"
  | "ocean"
  | "mint"
  | "sepia"
  | "dark"
  | "forest"
  | "high-contrast"
  | "custom";

export type QuizTheme =
  | "default"
  | "light"
  | "ocean"
  | "mint"
  | "sepia"
  | "dark"
  | "forest"
  | "high-contrast"
  | "custom";

export type ResolvedQuizTheme =
  | "light"
  | "ocean"
  | "mint"
  | "sepia"
  | "dark"
  | "forest"
  | "high-contrast"
  | "custom";

export type CustomThemeColors = {
  background: string;
  card: string;
  sidebar: string;
  text: string;
};

export type FontFamilyId =
  | "system"
  | "open-sans"
  | "arial"
  | "verdana"
  | "inter"
  | "space-grotesk"
  | "atkinson"
  | "georgia"
  | "merriweather"
  | "mono";

export type HighlightStyle = "solid" | "pastel" | "underline";
export type ContentWidth = "narrow" | "standard" | "wide" | "full";
export type UiRadius = "sharp" | "rounded" | "pill";
export type ExhibitStyle = "button" | "link" | "plain";
export type ExhibitViewerSize = "default" | "small" | "medium" | "large";
export type ExplanationAlign = "left" | "justify" | "center";
export type ImageAlign = "left" | "center";

export type UserSettings = {
  // Account & Global Appearance
  darkMode: boolean;
  appTheme: AppTheme;
  customTheme: CustomThemeColors;
  accentColor: string;
  useAccentInQuizNav: boolean;
  uiRadius: UiRadius;
  imagesAutoZoom: boolean;
  hideNameOnLeaderboard: boolean;

  // Quiz defaults
  defaultTheme: QuizTheme;
  splitExplanations: boolean;
  splitRatio: number; // 28 - 72 (% width of question column in split screen)
  transparentExplanations: boolean;
  largeImages: boolean;
  highlightOnly: boolean;
  multiHighlight: boolean;
  showTimer: boolean;
  stopTimerOnBlur: boolean;
  confirmOmission: boolean;
  hidePercentages: boolean;
  showUnsubmittedIndicator: boolean;
  smartContextMenu: boolean;
  autoNightMode: boolean;
  nightStart: number; // hour 0-23
  nightEnd: number;   // hour 0-23

  // Reading & Layout
  fontFamily: FontFamilyId;
  applyFontGlobally: boolean;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  contentWidth: ContentWidth;
  lineWidthPercent: number; // 50 - 100
  contentPadding: number;   // 0 - 48 px
  explanationAlign: ExplanationAlign;
  imageAlign: ImageAlign;

  // Exhibits
  exhibitStyle: ExhibitStyle;
  exhibitViewerSize: ExhibitViewerSize;
  closeExhibitOnOutsideClick: boolean;

  // Sidebar behavior (Quiz Runner)
  saveSpaceForSidebar: boolean;
  autoShowSidebar: boolean;
  autoHideSidebar: boolean;
  hoverEdgeSidebar: boolean;

  // Highlights
  highlightStyle: HighlightStyle;
  highlightBold: boolean;
  highlightShadow: boolean;
  highlightShadowIntensity: number; // 0 - 100
  highlightDarkShine: boolean;
  highlightDarkShineIntensity: number; // 0 - 100
  strikeColor: string;
  enabledHighlights: Record<string, boolean>;
  customHighlights: string[];
  customHighlightLabels: Record<string, string>;

  // Toolbar
  toolbar: Record<string, boolean>;
};

export const DEFAULT_CUSTOM_THEME: CustomThemeColors = {
  background: "#f4f7fb",
  card: "#ffffff",
  sidebar: "#16243b",
  text: "#142033",
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
    label: "Crisp White",
    description: "Clean clinical white & cool slate",
    isDark: false,
    preview: { bg: "#f8fafc", card: "#ffffff", sidebar: "#1e293b", text: "#0f172a", border: "#e2e8f0" },
  },
  {
    id: "ocean",
    label: "Clinical Ocean",
    description: "Refreshing airy ice-blue medical workspace",
    isDark: false,
    preview: { bg: "#edf5fc", card: "#f9fcff", sidebar: "#0f2d4a", text: "#0c2238", border: "#c5dcf0" },
  },
  {
    id: "mint",
    label: "Fresh Mint",
    description: "Calm botanical sage & mint for long focus",
    isDark: false,
    preview: { bg: "#eef7f3", card: "#f9fdfb", sidebar: "#133329", text: "#102a22", border: "#c4e2d6" },
  },
  {
    id: "sepia",
    label: "Warm Paper",
    description: "Book-like warm cream with reduced blue light",
    isDark: false,
    preview: { bg: "#f4ecd8", card: "#fbf6e9", sidebar: "#2f2519", text: "#3b2f1e", border: "#d9c9a8" },
  },
  {
    id: "dark",
    label: "Midnight Dark",
    description: "Refined deep slate for night study",
    isDark: true,
    preview: { bg: "#0d1321", card: "#151f32", sidebar: "#080d17", text: "#f1f5f9", border: "#26354d" },
  },
  {
    id: "forest",
    label: "Deep Emerald",
    description: "Rich dark emerald that eases eye fatigue",
    isDark: true,
    preview: { bg: "#0b1714", card: "#12241f", sidebar: "#07100d", text: "#ecfdf5", border: "#1f3d34" },
  },
  {
    id: "high-contrast",
    label: "High Contrast",
    description: "Maximum legibility with crisp borders",
    isDark: false,
    preview: { bg: "#ffffff", card: "#ffffff", sidebar: "#000000", text: "#000000", border: "#111827" },
  },
  {
    id: "custom",
    label: "Custom Theme",
    description: "Design your own background, card & sidebar",
    isDark: false,
    preview: { bg: "#f4f7fb", card: "#ffffff", sidebar: "#16243b", text: "#142033", border: "#cbd5e1" },
  },
];

export const QUIZ_THEME_OPTIONS: {
  id: QuizTheme;
  label: string;
  swatchBg: string;
  swatchBorder: string;
}[] = [
  { id: "default", label: "Match App", swatchBg: "linear-gradient(135deg, #ffffff 50%, #0d1321 50%)", swatchBorder: "#94a3b8" },
  { id: "light", label: "Light", swatchBg: "#ffffff", swatchBorder: "#cbd5e1" },
  { id: "ocean", label: "Ocean", swatchBg: "#edf5fc", swatchBorder: "#93c5fd" },
  { id: "mint", label: "Mint", swatchBg: "#eef7f3", swatchBorder: "#6ee7b7" },
  { id: "sepia", label: "Sepia", swatchBg: "#f4ecd8", swatchBorder: "#c9b58a" },
  { id: "dark", label: "Dark", swatchBg: "#0d1321", swatchBorder: "#334155" },
  { id: "forest", label: "Emerald", swatchBg: "#0b1714", swatchBorder: "#1f3d34" },
  { id: "high-contrast", label: "High Contrast", swatchBg: "#ffffff", swatchBorder: "#000000" },
  { id: "custom", label: "Custom", swatchBg: "conic-gradient(#38bdf8, #a855f7, #f472b6, #facc15, #38bdf8)", swatchBorder: "#94a3b8" },
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
    id: "open-sans",
    label: "Open Sans",
    category: "Clean Exam Sans",
    css: '"Open Sans", ui-sans-serif, system-ui, sans-serif',
  },
  {
    id: "arial",
    label: "Arial",
    category: "Classic Exam",
    css: 'Arial, Helvetica, sans-serif',
  },
  {
    id: "verdana",
    label: "Verdana",
    category: "USMLE Classic",
    css: 'Verdana, Geneva, sans-serif',
  },
  {
    id: "inter",
    label: "Inter",
    category: "Clean UI Sans",
    css: '"Inter", ui-sans-serif, system-ui, sans-serif',
  },
  {
    id: "georgia",
    label: "Georgia",
    category: "Classic Serif",
    css: 'Georgia, "Times New Roman", Times, serif',
  },
  {
    id: "atkinson",
    label: "Atkinson Hyperlegible",
    category: "Accessibility",
    css: '"Atkinson Hyperlegible", ui-sans-serif, system-ui, sans-serif',
  },
  {
    id: "space-grotesk",
    label: "Space Grotesk",
    category: "Modern Geometric",
    css: '"Space Grotesk", ui-sans-serif, system-ui, sans-serif',
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
  customTheme: { ...DEFAULT_CUSTOM_THEME },
  accentColor: "#2563eb",
  useAccentInQuizNav: true,
  uiRadius: "rounded",
  imagesAutoZoom: false,
  hideNameOnLeaderboard: false,

  defaultTheme: "default",
  splitExplanations: false,
  splitRatio: 50,
  transparentExplanations: true,
  largeImages: false,
  highlightOnly: true,
  multiHighlight: true,
  showTimer: true,
  stopTimerOnBlur: false,
  confirmOmission: false,
  hidePercentages: false,
  showUnsubmittedIndicator: true,
  smartContextMenu: true,
  autoNightMode: false,
  nightStart: 20,
  nightEnd: 6,

  fontFamily: "system",
  applyFontGlobally: false,
  fontSize: 15,
  fontWeight: 0,
  lineHeight: 1.65,
  contentWidth: "standard",
  lineWidthPercent: 85,
  contentPadding: 0,
  explanationAlign: "left",
  imageAlign: "center",

  exhibitStyle: "button",
  exhibitViewerSize: "default",
  closeExhibitOnOutsideClick: true,

  saveSpaceForSidebar: true,
  autoShowSidebar: true,
  autoHideSidebar: false,
  hoverEdgeSidebar: false,

  highlightStyle: "solid",
  highlightBold: false,
  highlightShadow: false,
  highlightShadowIntensity: 30,
  highlightDarkShine: true,
  highlightDarkShineIntensity: 50,
  strikeColor: "#ef4444",
  enabledHighlights: Object.fromEntries(Object.keys(DEFAULT_HIGHLIGHTS).map((k) => [k, true])),
  customHighlights: [],
  customHighlightLabels: {},
  toolbar: Object.fromEntries(TOOLBAR_ITEMS.map((t) => [t.key, true])),
};

function parseHexRgb(hex: string): [number, number, number] | null {
  const clean = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

export function isColorDark(hex: string): boolean {
  const rgb = parseHexRgb(hex);
  if (!rgb) return false;
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.35;
}

export function mixHex(hexA: string, hexB: string, weightA = 0.5): string {
  const a = parseHexRgb(hexA);
  const b = parseHexRgb(hexB);
  if (!a || !b) return hexA;
  const w = Math.max(0, Math.min(1, weightA));
  const [r, g, bl] = [0, 1, 2].map((i) => Math.round(a[i] * w + b[i] * (1 - w)));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bl.toString(16).padStart(2, "0")}`;
}

export function isDarkAppTheme(theme: AppTheme, customTheme?: CustomThemeColors): boolean {
  if (theme === "custom") return isColorDark(customTheme?.background ?? DEFAULT_CUSTOM_THEME.background);
  return theme === "dark" || theme === "forest";
}

export function getFontStack(id: FontFamilyId): string {
  return FONT_FAMILIES.find((f) => f.id === id)?.css ?? FONT_FAMILIES[0].css;
}

export function resolveQuizTheme(settings: UserSettings): ResolvedQuizTheme {
  if (settings.defaultTheme !== "default") {
    const raw = settings.defaultTheme as string;
    if (raw === "oled" || raw === "slate") return "dark";
    return settings.defaultTheme as ResolvedQuizTheme;
  }
  return settings.appTheme;
}

export function getQuizPalette(theme: ResolvedQuizTheme, customTheme?: CustomThemeColors) {
  switch (theme) {
    case "dark":
      return { pageBg: "#0d1321", sideBg: "#151f32", text: "#e5e7eb", cardBg: "#151f32", border: "#26354d", isDark: true };
    case "forest":
      return { pageBg: "#0b1714", sideBg: "#12241f", text: "#e6f5ef", cardBg: "#12241f", border: "#1f3d34", isDark: true };
    case "ocean":
      return { pageBg: "#edf5fc", sideBg: "#dfeefb", text: "#0c2238", cardBg: "#f9fcff", border: "#c5dcf0", isDark: false };
    case "mint":
      return { pageBg: "#eef7f3", sideBg: "#e0f0e9", text: "#102a22", cardBg: "#f9fdfb", border: "#c4e2d6", isDark: false };
    case "sepia":
      return { pageBg: "#f4ecd8", sideBg: "#ebe0c4", text: "#3b2f1e", cardBg: "#faf3e0", border: "#d6c9a8", isDark: false };
    case "high-contrast":
      return { pageBg: "#ffffff", sideBg: "#f3f4f6", text: "#000000", cardBg: "#ffffff", border: "#000000", isDark: false };
    case "custom": {
      const ct = customTheme ?? DEFAULT_CUSTOM_THEME;
      const dark = isColorDark(ct.background);
      return {
        pageBg: ct.background,
        sideBg: mixHex(ct.background, ct.card, 0.55),
        text: ct.text,
        cardBg: ct.card,
        border: mixHex(ct.text, ct.background, dark ? 0.22 : 0.16),
        isDark: dark,
      };
    }
    default:
      return { pageBg: "#f5f7fa", sideBg: "#eef1f5", text: "#1f2937", cardBg: "#ffffff", border: "#d1d5db", isDark: false };
  }
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

const CUSTOM_VAR_KEYS = [
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--popover",
  "--popover-foreground",
  "--secondary",
  "--secondary-foreground",
  "--muted",
  "--muted-foreground",
  "--accent",
  "--accent-foreground",
  "--border",
  "--input",
  "--sidebar",
  "--sidebar-foreground",
  "--sidebar-accent",
  "--sidebar-accent-foreground",
  "--sidebar-border",
];

export function applyUserThemeToDocument(settings: UserSettings) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const theme = settings.appTheme || (settings.darkMode ? "dark" : "light");
  const isDark = isDarkAppTheme(theme, settings.customTheme);

  root.setAttribute("data-theme", theme);
  root.classList.toggle("dark", isDark);
  root.setAttribute("data-hl-style", settings.highlightStyle || "solid");
  root.setAttribute("data-hl-bold", settings.highlightBold ? "true" : "false");
  root.setAttribute("data-hl-shadow", settings.highlightShadow ? "true" : "false");
  root.setAttribute("data-hl-shine", settings.highlightDarkShine ? "true" : "false");
  root.setAttribute("data-exhibit-style", settings.exhibitStyle || "button");
  root.setAttribute("data-img-align", settings.imageAlign || "center");
  root.setAttribute("data-expl-align", settings.explanationAlign || "left");
  root.style.setProperty("--sf-hl-shadow-alpha", String(Math.max(0, Math.min(100, settings.highlightShadowIntensity ?? 30)) / 100));
  root.style.setProperty("--sf-hl-shine-alpha", String(Math.max(0, Math.min(100, settings.highlightDarkShineIntensity ?? 50)) / 100));
  root.style.setProperty("--sf-content-padding", `${Math.max(0, Math.min(48, settings.contentPadding ?? 0))}px`);
  root.style.setProperty("--sf-expl-align", settings.explanationAlign || "left");

  // Clear inline custom surface vars when switching away from custom theme
  if (theme === "custom") {
    const ct = settings.customTheme ?? DEFAULT_CUSTOM_THEME;
    const mutedBg = mixHex(ct.card, ct.background, 0.35);
    const mutedFg = mixHex(ct.text, ct.background, 0.62);
    const borderCol = mixHex(ct.text, ct.background, isDark ? 0.24 : 0.16);
    const sidebarFg = getReadableForeground(ct.sidebar);
    const sidebarAccent = mixHex(ct.sidebar, sidebarFg, 0.84);
    root.style.setProperty("--background", ct.background);
    root.style.setProperty("--foreground", ct.text);
    root.style.setProperty("--card", ct.card);
    root.style.setProperty("--card-foreground", ct.text);
    root.style.setProperty("--popover", ct.card);
    root.style.setProperty("--popover-foreground", ct.text);
    root.style.setProperty("--secondary", mutedBg);
    root.style.setProperty("--secondary-foreground", ct.text);
    root.style.setProperty("--muted", mutedBg);
    root.style.setProperty("--muted-foreground", mutedFg);
    root.style.setProperty("--accent", mixHex(settings.accentColor, ct.card, 0.14));
    root.style.setProperty("--accent-foreground", ct.text);
    root.style.setProperty("--border", borderCol);
    root.style.setProperty("--input", borderCol);
    root.style.setProperty("--sidebar", ct.sidebar);
    root.style.setProperty("--sidebar-foreground", sidebarFg);
    root.style.setProperty("--sidebar-accent", sidebarAccent);
    root.style.setProperty("--sidebar-accent-foreground", sidebarFg);
    root.style.setProperty("--sidebar-border", mixHex(sidebarFg, ct.sidebar, 0.16));
  } else {
    for (const k of CUSTOM_VAR_KEYS) root.style.removeProperty(k);
  }

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

function normalizeAppTheme(raw: unknown, darkModeFallback: boolean): AppTheme {
  if (raw === "oled" || raw === "slate") return "dark";
  if (
    raw === "light" ||
    raw === "ocean" ||
    raw === "mint" ||
    raw === "sepia" ||
    raw === "dark" ||
    raw === "forest" ||
    raw === "high-contrast" ||
    raw === "custom"
  ) {
    return raw;
  }
  return darkModeFallback ? "dark" : "light";
}

function load(): UserSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    const customTheme: CustomThemeColors = {
      ...DEFAULT_CUSTOM_THEME,
      ...(parsed.customTheme ?? {}),
    };
    const appTheme = normalizeAppTheme(parsed.appTheme, !!parsed.darkMode);
    const defaultTheme: QuizTheme =
      parsed.defaultTheme === "oled" || parsed.defaultTheme === "slate"
        ? "dark"
        : (parsed.defaultTheme ?? "default");
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      appTheme,
      defaultTheme,
      customTheme,
      darkMode: isDarkAppTheme(appTheme, customTheme),
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
      next = { ...next, darkMode: isDarkAppTheme(updater.appTheme, next.customTheme) };
    } else if ("customTheme" in updater && updater.customTheme !== undefined && next.appTheme === "custom") {
      next = { ...next, darkMode: isDarkAppTheme("custom", next.customTheme) };
    } else if ("darkMode" in updater && updater.darkMode !== undefined) {
      const targetTheme: AppTheme = updater.darkMode
        ? (isDarkAppTheme(prev.appTheme, prev.customTheme) ? prev.appTheme : "dark")
        : (isDarkAppTheme(prev.appTheme, prev.customTheme) ? "light" : prev.appTheme);
      next = { ...next, appTheme: targetTheme };
    }
  } else {
    if (next.appTheme !== prev.appTheme || next.customTheme !== prev.customTheme) {
      next = { ...next, darkMode: isDarkAppTheme(next.appTheme, next.customTheme) };
    } else if (next.darkMode !== prev.darkMode) {
      const targetTheme: AppTheme = next.darkMode
        ? (isDarkAppTheme(next.appTheme, next.customTheme) ? next.appTheme : "dark")
        : (isDarkAppTheme(next.appTheme, next.customTheme) ? "light" : next.appTheme);
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
    customTheme: { ...DEFAULT_CUSTOM_THEME },
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
