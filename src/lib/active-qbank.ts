import { useEffect, useState, useSyncExternalStore } from "react";

const KEY = "activeQbankId";
const DEFAULT = 1;

const listeners = new Set<() => void>();

function read(): number {
  if (typeof window === "undefined") return DEFAULT;
  const raw = window.localStorage.getItem(KEY);
  const n = raw ? Number(raw) : DEFAULT;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT;
}

export function setActiveQbankId(id: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, String(id));
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useActiveQbankId(): number {
  return useSyncExternalStore(subscribe, read, () => DEFAULT);
}

export const QBANKS: { id: number; slug: string; name: string }[] = [
  { id: 1, slug: "step2", name: "Step 2" },
  { id: 2, slug: "step1", name: "Step 1" },
];
