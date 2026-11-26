import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import {
  getLibraryToc,
  getLibraryDoc,
  searchLibrary,
  getRelatedLibraryQuestions,
  listLibraryUserData,
  saveLibraryUserData,
  type LibraryNode,
} from "@/lib/library.functions";
import { createCustomTest } from "@/lib/qbank.functions";
import { useActiveQbankId } from "@/lib/active-qbank";
import { listDecks } from "@/lib/decks.functions";
import { createFlashcard } from "@/lib/flashcards.functions";
import { useLibraryMediaToken } from "@/lib/use-media-token";
import { rewriteMedia } from "@/lib/media";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/loader";
import { ExhibitModal, type ExhibitContent } from "@/components/exhibit-modal";
import { CardEditorModal, type CardValue } from "@/components/flashcards/card-editor-modal";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ChevronRight, ChevronDown, BookOpen, Search, X, Star,
  Highlighter, StickyNote, Layers, Copy, Trash2, Minus, Plus,
  Image as ImageIcon, Play, Loader2,
} from "lucide-react";

type Tree = { node: LibraryNode; children: Tree[] };
type SavedBookmark = { id: number; title: string; savedAt: number };
type TextHighlight = { id: string; start: number; end: number; color: string; text: string };

const HIGHLIGHT_COLORS = [
  { id: "yellow", label: "Yellow", bg: "#fef08a", swatch: "#facc15" },
  { id: "green",  label: "Green",  bg: "#bbf7d0", swatch: "#4ade80" },
  { id: "blue",   label: "Blue",   bg: "#bfdbfe", swatch: "#60a5fa" },
  { id: "pink",   label: "Pink",   bg: "#fbcfe8", swatch: "#f472b6" },
] as const;

const BOOKMARKS_KEY = "sf:lib:bookmarks:v1";
const FONT_SIZE_KEY = "sf:lib:fontSize:v1";
const LAST_DOC_KEY = "sf:lib:lastDoc:v1";
const hlStorageKey = (docId: number) => `sf:lib:hl:v1:${docId}`;
const noteStorageKey = (docId: number) => `sf:lib:note:v1:${docId}`;

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

/** Compute character offset of a (node, offset) point within root's textContent. */
function getTextOffset(root: HTMLElement, targetNode: Node, targetOffset: number): number | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let total = 0;
  let current = walker.nextNode();
  while (current) {
    if (current === targetNode) return total + targetOffset;
    total += current.textContent?.length ?? 0;
    current = walker.nextNode();
  }
  return null;
}

/** Remove all applied <mark data-sf-hl> wrappers while preserving text nodes. */
function unwrapHighlights(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("mark[data-sf-hl]").forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
  });
  root.normalize();
}

/** Apply saved offset-based highlights cleanly to the article DOM. */
function applyHighlightsToDom(root: HTMLElement, highlights: TextHighlight[]) {
  unwrapHighlights(root);
  if (!highlights.length) return;
  // Sort ascending and ignore invalid/empty ranges
  const sorted = [...highlights]
    .filter((h) => h.end > h.start)
    .sort((a, b) => a.start - b.start);

  // Apply from end to start so earlier offsets remain intact as DOM splits
  for (let i = sorted.length - 1; i >= 0; i--) {
    const h = sorted[i];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let offset = 0;
    const segments: Array<{ node: Text; start: number; end: number }> = [];
    let node = walker.nextNode() as Text | null;
    while (node) {
      const len = node.textContent?.length ?? 0;
      const nodeStart = offset;
      const nodeEnd = offset + len;
      if (nodeEnd > h.start && nodeStart < h.end) {
        segments.push({
          node,
          start: Math.max(0, h.start - nodeStart),
          end: Math.min(len, h.end - nodeStart),
        });
      }
      offset = nodeEnd;
      if (offset >= h.end) break;
      node = walker.nextNode() as Text | null;
    }
    for (let s = segments.length - 1; s >= 0; s--) {
      const seg = segments[s];
      const range = document.createRange();
      range.setStart(seg.node, seg.start);
      range.setEnd(seg.node, seg.end);
      const mark = document.createElement("mark");
      mark.dataset.sfHl = h.id;
      mark.title = "Click to remove highlight";
      mark.style.backgroundColor = h.color;
      mark.style.color = "#111827";
      mark.style.borderRadius = "2px";
      mark.style.padding = "0 1px";
      mark.style.cursor = "pointer";
      try {
        range.surroundContents(mark);
      } catch {
        // Skip malformed boundary if any
      }
    }
  }
}

function mediaUrlWithFreshToken(src: string, token: string, retryKey?: string): string | null {
  try {
    const url = new URL(src, window.location.origin);
    if (url.origin !== window.location.origin || !url.pathname.startsWith("/api/media/")) return null;
    url.searchParams.set("t", token);
    if (retryKey) url.searchParams.set("r", retryKey);
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

function attachLibraryMediaReload(root: HTMLElement, token: string) {
  root.querySelectorAll<HTMLImageElement>("img[src]").forEach((img) => {
    const current = img.getAttribute("src") || "";
    const fresh = mediaUrlWithFreshToken(current, token);
    if (!fresh) return;

    img.dataset.sfLibraryMediaToken = token;
    img.style.cursor = "zoom-in";

    if ((!img.complete || img.naturalWidth === 0) && fresh !== current) {
      img.setAttribute("src", fresh);
    }

    if (img.dataset.sfLibraryRetryBound === "1") return;
    img.dataset.sfLibraryRetryBound = "1";
    img.dataset.sfLibraryRetryCount = "0";

    const retry = () => {
      const tries = Number(img.dataset.sfLibraryRetryCount || "0");
      const latestToken = img.dataset.sfLibraryMediaToken;
      const src = img.getAttribute("src") || current;
      if (tries >= 5 || !latestToken || !src) return;
      const next = mediaUrlWithFreshToken(src, latestToken, `${Date.now()}-${tries + 1}`);
      if (!next) return;
      img.dataset.sfLibraryRetryCount = String(tries + 1);
      window.setTimeout(() => img.setAttribute("src", next), 250 * (tries + 1));
    };

    img.addEventListener("error", retry);
    img.addEventListener("load", () => {
      img.dataset.sfLibraryRetryCount = "0";
    });
    if (img.complete && img.naturalWidth === 0) retry();
  });

  root.querySelectorAll<HTMLVideoElement | HTMLAudioElement | HTMLSourceElement>("video[src], audio[src], source[src]").forEach((node) => {
    const current = node.getAttribute("src") || "";
    const fresh = mediaUrlWithFreshToken(current, token);
    if (fresh && fresh !== current) node.setAttribute("src", fresh);
  });
}

function buildTree(rows: LibraryNode[]): Tree[] {
  const map = new Map<number, Tree>();
  for (const n of rows) map.set(n.id, { node: n, children: [] });
  const roots: Tree[] = [];
  for (const t of map.values()) {
    const p = t.node.parentId ? map.get(t.node.parentId) : undefined;
    if (p) p.children.push(t);
    else roots.push(t);
  }
  return roots;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export function MedicalLibraryBrowser({
  rootClassName,
  initialDocId,
  initialSearch,
}: {
  rootClassName?: string;
  initialDocId?: number | null;
  initialSearch?: string | null;
}) {
  const LIBRARY_QBANK_ID = 2;
  const qc = useQueryClient();
  const nav = useNavigate();
  const activeQbankId = useActiveQbankId();
  const tocFn = useServerFn(getLibraryToc);
  const docFn = useServerFn(getLibraryDoc);
  const searchFn = useServerFn(searchLibrary);
  const relatedQFn = useServerFn(getRelatedLibraryQuestions);
  const listUserDataFn = useServerFn(listLibraryUserData);
  const saveUserDataFn = useServerFn(saveLibraryUserData);
  const createTestFn = useServerFn(createCustomTest);
  const decksFn = useServerFn(listDecks);
  const createCardFn = useServerFn(createFlashcard);
  const mediaToken = useLibraryMediaToken();
  const [startingRelated, setStartingRelated] = useState(false);

  const [sidebarTab, setSidebarTab] = useState<"browse" | "saved">("browse");
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [activeDoc, setActiveDoc] = useState<number | null>(() => {
    if (initialDocId != null) return initialDocId;
    if (typeof window !== "undefined") {
      const urlDoc = new URLSearchParams(window.location.search).get("doc");
      if (urlDoc && /^\d+$/.test(urlDoc)) return Number(urlDoc);
      const saved = readJson<number | null>(LAST_DOC_KEY, null);
      if (saved != null && Number.isFinite(saved)) return saved;
    }
    return null;
  });
  const [anchor, setAnchor] = useState<string | null>(null);
  const [query, setQuery] = useState(initialSearch ?? "");
  const [debounced, setDebounced] = useState(initialSearch?.trim() ?? "");
  const [fontSize, setFontSize] = useState<number>(() => readJson<number>(FONT_SIZE_KEY, 15));
  const [bookmarks, setBookmarks] = useState<SavedBookmark[]>(() => readJson<SavedBookmark[]>(BOOKMARKS_KEY, []));
  const [highlights, setHighlights] = useState<TextHighlight[]>([]);
  const [noteText, setNoteText] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const [showInlineImages, setShowInlineImages] = useState(false);
  const [exhibit, setExhibit] = useState<{ content: ExhibitContent; title: string } | null>(null);
  const [cardDraft, setCardDraft] = useState<CardValue | null>(null);

  // Floating selection toolbar state
  const [selBar, setSelBar] = useState<{
    top: number;
    left: number;
    start: number;
    end: number;
    text: string;
  } | null>(null);

  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    writeJson(FONT_SIZE_KEY, fontSize);
  }, [fontSize]);

  useEffect(() => {
    if (initialDocId != null) {
      setActiveDoc(initialDocId);
    } else if (initialSearch) {
      setQuery(initialSearch);
      setDebounced(initialSearch.trim());
    }
  }, [initialDocId, initialSearch]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data: toc, isLoading } = useQuery({
    queryKey: ["library-toc"],
    queryFn: () => tocFn({ data: { qbankId: 2 } }),
    staleTime: 60 * 60 * 1000,
  });

  const { data: results, isFetching: searching } = useQuery({
    queryKey: ["library-search", debounced],
    queryFn: () => searchFn({ data: { qbankId: 2, q: debounced } }),
    enabled: debounced.length >= 2,
    staleTime: 5 * 60 * 1000,
  });

  const { data: doc, isFetching: loadingDoc } = useQuery({
    queryKey: ["library-doc", activeDoc],
    queryFn: () => docFn({ data: { id: activeDoc as number } }),
    enabled: activeDoc != null,
    staleTime: 30 * 60 * 1000,
  });

  const { data: decksData } = useQuery({
    queryKey: ["decks"],
    queryFn: () => decksFn(),
    enabled: cardDraft != null,
    staleTime: 5 * 60 * 1000,
  });
  const decks = (decksData?.decks as any[]) ?? [];

  const { data: relatedQ } = useQuery({
    queryKey: ["library-related-qs", doc?.title, activeQbankId],
    queryFn: () => relatedQFn({ data: { title: doc!.title, qbankId: activeQbankId } }),
    enabled: !!doc?.title,
    staleTime: 30 * 60 * 1000,
  });

  // Load saved highlights & notes instantly from localStorage (0ms, zero failing network calls)
  useEffect(() => {
    if (activeDoc == null) {
      setHighlights([]);
      setNoteText("");
      return;
    }
    setHighlights(readJson<TextHighlight[]>(hlStorageKey(activeDoc), []));
    setNoteText(readJson<string>(noteStorageKey(activeDoc), ""));
    setSelBar(null);
  }, [activeDoc]);

  const queueCloudSync = useCallback(
    (_docId: number, _docTitle: string, _nextBookmarked: boolean, _nextNote: string, _nextHighlights: TextHighlight[]) => {
      // LocalStorage persistence is already instant and zero-latency;
      // cloud sync activates once library_user_data migration is applied.
    },
    [],
  );

  const practiceRelatedQuestions = async () => {
    if (!relatedQ?.questionIds?.length || !doc || startingRelated) return;
    setStartingRelated(true);
    try {
      const created = await createTestFn({
        data: {
          qbankId: activeQbankId,
          questionIds: relatedQ.questionIds.slice(0, 50),
          mode: "practice",
          timed: false,
          name: `Library: ${doc.title.slice(0, 40)}`,
        },
      });
      nav({ to: "/test/$id", params: { id: String(created.id) } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create related quiz");
    } finally {
      setStartingRelated(false);
    }
  };

  const tree = useMemo(() => buildTree(toc ?? []), [toc]);

  // Auto-expand ancestor folders in the sidebar for the active article (e.g., after a page refresh)
  useEffect(() => {
    if (!toc?.length || activeDoc == null) return;
    const nodeById = new Map<number, LibraryNode>();
    for (const n of toc) nodeById.set(n.id, n);
    const topic = toc.find((n) => n.docId === activeDoc && n.section == null);
    if (!topic) return;
    const ancestors: number[] = [];
    let cur = topic.parentId != null ? nodeById.get(topic.parentId) : undefined;
    while (cur) {
      ancestors.push(cur.id);
      cur = cur.parentId != null ? nodeById.get(cur.parentId) : undefined;
    }
    if (ancestors.length > 0) {
      setOpen((prev) => {
        const next = new Set(prev);
        for (const id of ancestors) next.add(id);
        return next;
      });
    }
  }, [toc, activeDoc]);
  const sections = useMemo(() => {
    if (!toc || activeDoc == null) return [] as LibraryNode[];
    const topic = toc.find((n) => n.docId === activeDoc && n.section == null);
    if (!topic) return [];
    return toc.filter((n) => n.parentId === topic.id && n.section);
  }, [toc, activeDoc]);

  const html = useMemo(
    () =>
      doc && mediaToken
        ? rewriteMedia(doc.html, {
            qbankId: LIBRARY_QBANK_ID,
            mediaToken,
            collapseImages: !showInlineImages,
          })
        : "",
    [doc, mediaToken, showInlineImages],
  );

  // Seed article HTML imperatively so token refreshes never remount images
  const seededRef = useRef<string>("");
  useEffect(() => {
    const el = bodyRef.current;
    if (!el || !html || !mediaToken) return;
    const key = `${doc?.id ?? ""}:${showInlineImages ? "inline" : "collapsed"}:${html.length}`;
    if (seededRef.current !== key) {
      seededRef.current = key;
      el.innerHTML = html;
      applyHighlightsToDom(el, readJson<TextHighlight[]>(hlStorageKey(doc!.id), []));
    }
    attachLibraryMediaReload(el, mediaToken);
  }, [html, doc?.id, mediaToken, showInlineImages]);

  // Re-apply highlights whenever highlights array updates on current doc
  useEffect(() => {
    const el = bodyRef.current;
    if (!el || !doc || !seededRef.current.startsWith(`${doc.id}:`)) return;
    applyHighlightsToDom(el, highlights);
  }, [highlights, doc]);

  // Click handler on article body: remove highlight on <mark> click, zoom image on <img> click
  useEffect(() => {
    const el = bodyRef.current;
    if (!el || !doc) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const mark = target.closest("mark[data-sf-hl]") as HTMLElement | null;
      if (mark && el.contains(mark)) {
        const hlId = mark.dataset.sfHl;
        if (hlId && activeDoc != null) {
          setHighlights((prev) => {
            const next = prev.filter((h) => h.id !== hlId);
            writeJson(hlStorageKey(activeDoc), next);
            return next;
          });
          toast.success("Highlight removed");
        }
        return;
      }
      const figEl = target.closest("[data-sf-exhibit-src]") as HTMLElement | null;
      if (figEl && el.contains(figEl)) {
        e.preventDefault();
        e.stopPropagation();
        const rawSrc = figEl.dataset.sfExhibitSrc || "";
        const freshSrc = (mediaToken && mediaUrlWithFreshToken(rawSrc, mediaToken)) || rawSrc;
        const rawTitle = (figEl.dataset.sfExhibitTitle || doc.title).trim();
        const figTitle = rawTitle ? rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1) : doc.title;
        const kind = (figEl.dataset.sfExhibitKind as "image" | "video" | "audio" | undefined) ?? "image";
        if (freshSrc) {
          if (kind === "video") {
            setExhibit({ content: { kind: "video", src: freshSrc }, title: figTitle });
          } else if (kind === "audio") {
            setExhibit({ content: { kind: "audio", src: freshSrc }, title: figTitle });
          } else {
            setExhibit({ content: { kind: "image", src: freshSrc, alt: figTitle }, title: figTitle });
          }
        }
        return;
      }
      // Smooth-scroll internal #id links (e.g., table 1, section links) and briefly highlight target
      const anchorEl = target.closest('a[href^="#"]') as HTMLAnchorElement | null;
      if (anchorEl && el.contains(anchorEl)) {
        const hashId = anchorEl.getAttribute("href")?.slice(1);
        if (hashId) {
          const targetEl = el.querySelector<HTMLElement>(`#${CSS.escape(hashId)}`);
          if (targetEl) {
            e.preventDefault();
            e.stopPropagation();
            targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
            targetEl.classList.add("sf-anchor-pulse");
            window.setTimeout(() => targetEl.classList.remove("sf-anchor-pulse"), 1400);
            return;
          }
        }
      }
      const img = target.closest("img") as HTMLImageElement | null;
      if (img && el.contains(img)) {
        e.preventDefault();
        e.stopPropagation();
        const figTitle = img.alt || doc.title;
        setExhibit({ content: { kind: "image", src: img.currentSrc || img.src, alt: figTitle }, title: figTitle });
      }
    };
    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  }, [doc, activeDoc, mediaToken]);

  // Selection listener for floating study toolbar
  const handleSelection = useCallback(() => {
    const el = bodyRef.current;
    if (!el || activeDoc == null) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      setSelBar(null);
      return;
    }
    const text = sel.toString().trim();
    if (text.length < 2) {
      setSelBar(null);
      return;
    }
    const range = sel.getRangeAt(0);
    if (!el.contains(range.commonAncestorContainer)) {
      setSelBar(null);
      return;
    }
    const start = getTextOffset(el, range.startContainer, range.startOffset);
    const end = getTextOffset(el, range.endContainer, range.endOffset);
    if (start == null || end == null || end <= start) {
      setSelBar(null);
      return;
    }
    const rect = range.getBoundingClientRect();
    setSelBar({
      top: Math.max(12, rect.top - 48),
      left: Math.min(window.innerWidth - 290, Math.max(12, rect.left + rect.width / 2 - 140)),
      start,
      end,
      text,
    });
  }, [activeDoc]);

  const addHighlight = (bg: string) => {
    if (!selBar || activeDoc == null) return;
    const nextItem: TextHighlight = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      start: selBar.start,
      end: selBar.end,
      color: bg,
      text: selBar.text.slice(0, 200),
    };
    setHighlights((prev) => {
      const nonOverlapping = prev.filter((h) => h.end <= nextItem.start || h.start >= nextItem.end);
      const next = [...nonOverlapping, nextItem];
      writeJson(hlStorageKey(activeDoc), next);
      queueCloudSync(activeDoc, doc?.title ?? "", isBookmarked, noteText, next);
      return next;
    });
    window.getSelection()?.removeAllRanges();
    setSelBar(null);
  };

  const clearHighlights = () => {
    if (activeDoc == null) return;
    setHighlights([]);
    writeJson(hlStorageKey(activeDoc), []);
    queueCloudSync(activeDoc, doc?.title ?? "", isBookmarked, noteText, []);
    toast.success("Cleared all highlights on this article");
  };

  const appendSelectionToNote = () => {
    if (!selBar || activeDoc == null) return;
    const next = noteText.trim()
      ? `${noteText.trim()}\n\n• ${selBar.text}`
      : `• ${selBar.text}`;
    setNoteText(next);
    writeJson(noteStorageKey(activeDoc), next);
    queueCloudSync(activeDoc, doc?.title ?? "", isBookmarked, next, highlights);
    setNotesOpen(true);
    window.getSelection()?.removeAllRanges();
    setSelBar(null);
    toast.success("Added to article notes");
  };

  const openFlashcardFromSelection = () => {
    if (!selBar || !doc) return;
    setCardDraft({
      frontHtml: `<p><strong>${escapeHtml(doc.title)}</strong></p><p></p>`,
      backHtml: `<p>${escapeHtml(selBar.text)}</p>`,
      tags: [doc.title.slice(0, 32)],
      deckId: decks[0]?.id,
    });
    window.getSelection()?.removeAllRanges();
    setSelBar(null);
  };

  const saveFlashcard = async (v: CardValue & { front: string; back: string }) => {
    await createCardFn({
      data: {
        deckId: v.deckId ?? null,
        front: v.front,
        back: v.back,
        frontHtml: v.frontHtml,
        backHtml: v.backHtml,
        tags: v.tags,
      },
    });
    qc.invalidateQueries({ queryKey: ["cards"] });
    qc.invalidateQueries({ queryKey: ["decks"] });
    toast.success("Flashcard saved to your deck");
  };

  const isBookmarked = activeDoc != null && bookmarks.some((b) => b.id === activeDoc);
  const toggleBookmarkArticle = () => {
    if (!doc) return;
    setBookmarks((prev) => {
      const exists = prev.some((b) => b.id === doc.id);
      const next = exists
        ? prev.filter((b) => b.id !== doc.id)
        : [{ id: doc.id, title: doc.title, savedAt: Date.now() }, ...prev];
      writeJson(BOOKMARKS_KEY, next);
      queueCloudSync(doc.id, doc.title, !exists, noteText, highlights);
      toast.success(exists ? "Removed from Saved Articles" : "Saved to Bookmarks");
      return next;
    });
  };

  // Scroll to requested section
  useEffect(() => {
    if (!anchor || !html) return;
    const id = window.setTimeout(() => {
      const el = bodyRef.current?.querySelector(`#${CSS.escape(anchor)}`);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
      setAnchor(null);
    }, 60);
    return () => window.clearTimeout(id);
  }, [anchor, html]);

  useEffect(() => {
    if (doc) bodyRef.current?.parentElement?.parentElement?.scrollTo({ top: 0 });
  }, [doc?.id]);

  const openDoc = (docId: number, section?: string | null) => {
    setActiveDoc(docId);
    writeJson(LAST_DOC_KEY, docId);
    if (typeof window !== "undefined" && window.location.pathname === "/medical-library") {
      const url = new URL(window.location.href);
      url.searchParams.set("doc", String(docId));
      window.history.replaceState(null, "", url.pathname + url.search);
    }
    if (section) setAnchor(section);
  };

  const toggle = (id: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const renderNode = (t: Tree, depth: number) => {
    const { node } = t;
    const hasChildren = t.children.length > 0;
    const isOpen = open.has(node.id);
    const isActive = node.docId != null && node.docId === activeDoc && !node.section;
    return (
      <div key={node.id}>
        <button
          type="button"
          onClick={() => {
            if (node.section && node.docId != null) openDoc(node.docId, node.section);
            else if (hasChildren) toggle(node.id);
            if (node.docId != null && !node.section) openDoc(node.docId);
          }}
          className={cn(
            "flex w-full items-start gap-1.5 rounded-md px-2 py-1.5 text-left text-xs sm:text-sm transition-colors hover:bg-muted",
            isActive ? "bg-primary/10 font-semibold text-primary" : "text-foreground",
          )}
          style={{ paddingLeft: 8 + depth * 14 }}
        >
          {hasChildren ? (
            isOpen ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 opacity-60" /> : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 opacity-60" />
          ) : (
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
          )}
          <span className={depth === 0 ? "font-semibold" : ""}>{node.name}</span>
        </button>
        {hasChildren && isOpen && <div>{t.children.map((c) => renderNode(c, depth + 1))}</div>}
      </div>
    );
  };

  return (
    <div
      className={
        rootClassName ??
        "flex min-h-[calc(100vh-56px)] flex-col lg:h-[calc(100vh-56px)] lg:flex-row"
      }
    >
      {/* Sidebar */}
      <aside className="flex w-full shrink-0 flex-col border-b border-border bg-card lg:h-full lg:w-80 lg:border-b-0 lg:border-r">
        <div className="border-b border-border p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <BookOpen className="h-4 w-4 text-primary" /> Medical Library
            </div>
            <div className="inline-flex rounded-md bg-muted/70 p-0.5 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setSidebarTab("browse")}
                className={cn(
                  "px-2 py-0.5 rounded transition-colors",
                  sidebarTab === "browse" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                Topics
              </button>
              <button
                type="button"
                onClick={() => setSidebarTab("saved")}
                className={cn(
                  "px-2 py-0.5 rounded transition-colors inline-flex items-center gap-1",
                  sidebarTab === "saved" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                Saved {bookmarks.length > 0 && <span className="text-[10px] opacity-75">({bookmarks.length})</span>}
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search topics or clinical pearls…"
              className="h-9 pl-8 pr-8 text-xs"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="max-h-[45vh] flex-1 overflow-y-auto p-2 lg:max-h-none">
          {sidebarTab === "saved" && debounced.length < 2 ? (
            bookmarks.length === 0 ? (
              <div className="px-3 py-8 text-center text-xs text-muted-foreground">
                <Star className="h-6 w-6 mx-auto mb-2 opacity-30" />
                No saved articles yet. Click the star icon on any article to bookmark it here.
              </div>
            ) : (
              <div className="space-y-1">
                {bookmarks.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => openDoc(b.id)}
                    className={cn(
                      "flex items-center gap-2 w-full rounded-md px-2.5 py-2 text-left text-xs font-medium hover:bg-muted transition-colors",
                      b.id === activeDoc ? "bg-primary/10 text-primary font-semibold" : "text-foreground",
                    )}
                  >
                    <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" />
                    <span className="truncate">{b.title}</span>
                  </button>
                ))}
              </div>
            )
          ) : (
            <>
              {isLoading && <div className="p-6"><Loader label="Loading library…" /></div>}
              {!isLoading && (toc?.length ?? 0) === 0 && (
                <div className="px-3 py-6 text-xs text-muted-foreground">
                  The medical library is empty right now. Please try again in a moment.
                </div>
              )}

              {debounced.length >= 2 ? (
                <div className="space-y-0.5">
                  {searching && <div className="px-2 py-2 text-xs text-muted-foreground">Searching…</div>}
                  {!searching && (results?.length ?? 0) === 0 && (
                    <div className="px-2 py-2 text-xs text-muted-foreground">No matches.</div>
                  )}
                  {(results ?? []).map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => openDoc(r.id)}
                      className={cn(
                        "block w-full rounded-md px-2 py-1.5 text-left text-xs sm:text-sm hover:bg-muted",
                        r.id === activeDoc && "bg-primary/10 font-semibold text-primary",
                      )}
                    >
                      {r.title}
                      {r.inBody && <span className="ml-1 text-[11px] text-muted-foreground">(in text)</span>}
                    </button>
                  ))}
                </div>
              ) : (
                tree.map((t) => renderNode(t, 0))
              )}
            </>
          )}
        </div>
      </aside>

      {/* Main Reader Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
        {activeDoc == null ? (
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-2xl p-10 text-center text-muted-foreground">
              <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-primary/10 text-primary grid place-items-center">
                <BookOpen className="h-6 w-6" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Medical Library</h1>
              <p className="mt-2 text-sm">
                Pick a specialty on the left to browse topics, or search for a condition. Select any text inside an article to highlight it, save a study note, or create a flashcard.
              </p>
              {bookmarks.length > 0 && (
                <div className="mt-6 text-left rounded-xl border border-border bg-card p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2.5 flex items-center gap-1.5">
                    <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" /> Saved Articles
                  </div>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {bookmarks.slice(0, 6).map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => openDoc(b.id)}
                        className="text-left text-xs font-medium px-2.5 py-2 rounded-lg border border-border hover:border-primary/40 hover:bg-muted/40 truncate transition-colors"
                      >
                        {b.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (loadingDoc && !doc) || (doc && !mediaToken) ? (
          <div className="p-10"><Loader label="Opening article…" /></div>
        ) : (
          <>
            {/* Sticky Study Toolbar */}
            <div className="shrink-0 border-b border-border bg-card/90 backdrop-blur px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs sm:text-sm font-semibold truncate">{doc?.title}</span>
                {highlights.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/12 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-[11px] font-semibold shrink-0 tabular-nums">
                    <Highlighter className="h-3 w-3" /> {highlights.length}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {/* Practice Related QBank Questions */}
                {(relatedQ?.count ?? 0) > 0 && (
                  <button
                    type="button"
                    onClick={practiceRelatedQuestions}
                    disabled={startingRelated}
                    className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors"
                    title={`Launch a practice quiz with ${relatedQ!.count} QBank question(s) linked to this topic`}
                  >
                    {startingRelated ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                    <span>Practice ({relatedQ!.count})</span>
                  </button>
                )}

                {/* Font size controls */}
                <div className="inline-flex items-center rounded-md border border-border bg-background">
                  <button
                    type="button"
                    onClick={() => setFontSize((s) => Math.max(13, s - 1))}
                    className="h-7 w-7 grid place-items-center text-muted-foreground hover:text-foreground"
                    title="Decrease font size"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="px-1.5 text-[11px] font-semibold tabular-nums text-muted-foreground">{fontSize}px</span>
                  <button
                    type="button"
                    onClick={() => setFontSize((s) => Math.min(22, s + 1))}
                    className="h-7 w-7 grid place-items-center text-muted-foreground hover:text-foreground"
                    title="Increase font size"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>

                {/* Clear highlights */}
                {highlights.length > 0 && (
                  <button
                    type="button"
                    onClick={clearHighlights}
                    className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-border bg-background text-xs font-medium text-muted-foreground hover:text-rose-600 transition-colors"
                    title="Clear all highlights on this article"
                  >
                    <Trash2 className="h-3 w-3" /> Clear
                  </button>
                )}

                {/* Toggle Figures on demand vs Inline Images */}
                <button
                  type="button"
                  onClick={() => setShowInlineImages((v) => !v)}
                  className={cn(
                    "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border text-xs font-medium transition-colors",
                    showInlineImages
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border bg-background text-foreground hover:bg-muted",
                  )}
                  title={showInlineImages ? "Collapse images into clickable Figure buttons" : "Expand all figures inline"}
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{showInlineImages ? "Hide Images" : "Show All"}</span>
                </button>

                {/* Article Notes toggle */}
                <button
                  type="button"
                  onClick={() => setNotesOpen((v) => !v)}
                  className={cn(
                    "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border text-xs font-medium transition-colors",
                    notesOpen || noteText.trim()
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border bg-background text-foreground hover:bg-muted",
                  )}
                  title="Article study notes"
                >
                  <StickyNote className="h-3.5 w-3.5" />
                  <span>Notes</span>
                  {noteText.trim() && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                </button>

                {/* Bookmark article */}
                <button
                  type="button"
                  onClick={toggleBookmarkArticle}
                  className={cn(
                    "inline-flex items-center gap-1 h-7 px-2.5 rounded-md border text-xs font-medium transition-colors",
                    isBookmarked
                      ? "border-amber-500/40 bg-amber-500/12 text-amber-700 dark:text-amber-300"
                      : "border-border bg-background text-foreground hover:bg-muted",
                  )}
                  title={isBookmarked ? "Remove bookmark" : "Bookmark article"}
                >
                  <Star className={cn("h-3.5 w-3.5", isBookmarked && "fill-amber-500 text-amber-500")} />
                  <span className="hidden sm:inline">{isBookmarked ? "Saved" : "Save"}</span>
                </button>
              </div>
            </div>

            {/* Article Body + Optional Notes Split */}
            <div className="flex-1 flex min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto" onMouseUp={handleSelection} onTouchEnd={handleSelection}>
                <article className="mx-auto max-w-4xl p-5 sm:p-8">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <h1 className="text-2xl font-bold tracking-tight">{doc?.title}</h1>
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-4">
                    Tip: Select any text to highlight, add to notes, or create a flashcard. Click any image to zoom.
                  </p>

                  {sections.length > 0 && (
                    <nav className="mb-5 flex flex-wrap gap-1.5 border-b border-border pb-4">
                      {sections.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setAnchor(s.section)}
                          className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                        >
                          {s.name}
                        </button>
                      ))}
                    </nav>
                  )}

                  <div
                    ref={bodyRef}
                    className="library-article qbank-html"
                    style={{ fontSize }}
                    suppressHydrationWarning
                  />
                </article>
              </div>

              {/* Slide-out Article Notes Panel */}
              {notesOpen && activeDoc != null && (
                <aside className="w-80 max-w-[85vw] shrink-0 border-l border-border bg-card flex flex-col">
                  <div className="px-3.5 py-2.5 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      <StickyNote className="h-3.5 w-3.5 text-primary" /> Study Notes
                    </div>
                    <button type="button" onClick={() => setNotesOpen(false)} className="text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="p-3 flex-1 flex flex-col gap-2">
                    <textarea
                      value={noteText}
                      onChange={(e) => {
                        setNoteText(e.target.value);
                        writeJson(noteStorageKey(activeDoc), e.target.value);
                        queueCloudSync(activeDoc, doc?.title ?? "", isBookmarked, e.target.value, highlights);
                      }}
                      placeholder="Write high-yield pearls for this article, or select text and click 'Note'…"
                      className="flex-1 w-full resize-none rounded-lg border border-border bg-background p-2.5 text-xs leading-relaxed outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                      <span>Auto-saved locally</span>
                      <span>{noteText.length} chars</span>
                    </div>
                  </div>
                </aside>
              )}
            </div>
          </>
        )}
      </main>

      {/* Floating Selection Toolbar */}
      {selBar && (
        <div
          className="fixed z-50 flex items-center gap-1 rounded-lg border border-border bg-popover px-2 py-1.5 shadow-xl"
          style={{ top: selBar.top, left: selBar.left }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => addHighlight(c.bg)}
              title={`Highlight ${c.label}`}
              className="h-5 w-5 rounded-full border border-black/15 hover:scale-110 transition-transform"
              style={{ backgroundColor: c.swatch }}
            />
          ))}
          <div className="h-4 w-px bg-border mx-1" />
          <button
            type="button"
            onClick={openFlashcardFromSelection}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold hover:bg-muted text-foreground"
            title="Create Flashcard from selection"
          >
            <Layers className="h-3 w-3 text-primary" /> Card
          </button>
          <button
            type="button"
            onClick={appendSelectionToNote}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold hover:bg-muted text-foreground"
            title="Add selection to article notes"
          >
            <StickyNote className="h-3 w-3 text-amber-500" /> Note
          </button>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(selBar.text);
              toast.success("Copied");
              setSelBar(null);
            }}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            title="Copy selected text"
          >
            <Copy className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Zoomable Exhibit Modal for Library Images */}
      <ExhibitModal
        content={exhibit?.content ?? null}
        title={exhibit?.title ?? doc?.title ?? "Exhibit Display"}
        onClose={() => setExhibit(null)}
      />

      {/* Create Flashcard Modal from Selection */}
      {cardDraft && (
        <CardEditorModal
          open={!!cardDraft}
          onClose={() => setCardDraft(null)}
          decks={decks}
          initial={cardDraft}
          onSave={saveFlashcard}
        />
      )}
    </div>
  );
}
