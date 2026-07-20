import { useEffect, useState, useSyncExternalStore } from "react";

export type QuizTheme = "default" | "light" | "dark";

export type UserSettings = {
  // Account
  darkMode: boolean;
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
  // Reading
  fontSize: number;
  fontWeight: number;
  // Highlights
  enabledHighlights: Record<string, boolean>;
  customHighlights: string[];
  // Toolbar
  toolbar: Record<string, boolean>;
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
  { key: "notebook", label: "Add to Notebook" },
  { key: "library", label: "Medical Library" },
  { key: "newFlashcard", label: "New Flashcard" },
  { key: "existingFlashcard", label: "Existing Flashcard" },
  { key: "copy", label: "Copy Text" },
];


export const DEFAULT_SETTINGS: UserSettings = {
  darkMode: false,
  imagesAutoZoom: false,
  hideNameOnLeaderboard: false,
  defaultTheme: "default",
  splitExplanations: false,
  transparentExplanations: true,
  largeImages: true,
  highlightOnly: true,
  multiHighlight: true,
  showTimer: true,
  stopTimerOnBlur: false,
  confirmOmission: false,
  hidePercentages: false,
  autoNightMode: false,
  fontSize: 15,
  fontWeight: 0,
  enabledHighlights: Object.fromEntries(Object.keys(DEFAULT_HIGHLIGHTS).map((k) => [k, true])),
  customHighlights: [],
  toolbar: Object.fromEntries(TOOLBAR_ITEMS.map((t) => [t.key, true])),
};

const KEY = "usmle:user-settings:v1";

function load(): UserSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      enabledHighlights: { ...DEFAULT_SETTINGS.enabledHighlights, ...(parsed.enabledHighlights ?? {}) },
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
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) {
      current = load();
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
  const next = typeof updater === "function" ? updater(current) : { ...current, ...updater };
  current = next;
  if (typeof window !== "undefined") {
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  }
  listeners.forEach((l) => l());
}

export function useUserSettings(): [UserSettings, (u: Partial<UserSettings> | ((s: UserSettings) => UserSettings)) => void] {
  const s = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return [s, setUserSettings];
}

export function useHydratedSettings(): UserSettings {
  const [s, setS] = useState<UserSettings>(DEFAULT_SETTINGS);
  useEffect(() => {
    setS(load());
    const unsub = subscribe(() => setS(current));
    return () => { unsub(); };
  }, []);
  return s;
}
