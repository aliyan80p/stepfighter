import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect, useRef } from "react";
import { getLibraryToc, getLibraryDoc, searchLibrary, type LibraryNode } from "@/lib/library.functions";
import { useActiveQbankId } from "@/lib/active-qbank";
import { useMediaToken } from "@/lib/use-media-token";
import { rewriteMedia } from "@/lib/media";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/loader";
import { ChevronRight, ChevronDown, BookOpen, Search, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/medical-library")({
  component: MedicalLibrary,
  head: () => ({
    meta: [
      { title: "Medical Library — StepFighter" },
      { name: "description", content: "Browse the StepFighter medical library: specialty chapters, illustrated topics and high-yield tables." },
      { property: "og:title", content: "Medical Library — StepFighter" },
      { property: "og:description", content: "Browse specialty chapters, illustrated topics and high-yield tables inside StepFighter." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Tree = { node: LibraryNode; children: Tree[] };

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

function MedicalLibrary() {
  const qbankId = useActiveQbankId();
  const tocFn = useServerFn(getLibraryToc);
  const docFn = useServerFn(getLibraryDoc);
  const searchFn = useServerFn(searchLibrary);
  const mediaToken = useMediaToken(qbankId);

  const [open, setOpen] = useState<Set<number>>(new Set());
  const [activeDoc, setActiveDoc] = useState<number | null>(null);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  const { data: toc, isLoading } = useQuery({
    queryKey: ["library-toc", qbankId],
    queryFn: () => tocFn({ data: { qbankId } }),
    staleTime: 60 * 60 * 1000,
  });

  const { data: results, isFetching: searching } = useQuery({
    queryKey: ["library-search", qbankId, debounced],
    queryFn: () => searchFn({ data: { qbankId, q: debounced } }),
    enabled: debounced.length >= 2,
    staleTime: 5 * 60 * 1000,
  });

  const { data: doc, isFetching: loadingDoc } = useQuery({
    queryKey: ["library-doc", activeDoc],
    queryFn: () => docFn({ data: { id: activeDoc as number } }),
    enabled: activeDoc != null,
    staleTime: 30 * 60 * 1000,
  });

  const tree = useMemo(() => buildTree(toc ?? []), [toc]);
  const sections = useMemo(() => {
    if (!toc || activeDoc == null) return [] as LibraryNode[];
    const topic = toc.find((n) => n.docId === activeDoc && n.section == null);
    if (!topic) return [];
    return toc.filter((n) => n.parentId === topic.id && n.section);
  }, [toc, activeDoc]);

  const html = useMemo(
    () => (doc ? rewriteMedia(doc.html, { qbankId, mediaToken }) : ""),
    [doc, qbankId, mediaToken],
  );

  // Scroll to the requested section once the article is painted.
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
    if (doc) bodyRef.current?.parentElement?.scrollTo({ top: 0 });
  }, [doc?.id]);

  const openDoc = (docId: number, section?: string | null) => {
    setActiveDoc(docId);
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
          className={`flex w-full items-start gap-1.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted ${
            isActive ? "bg-primary/10 font-semibold text-primary" : "text-foreground"
          }`}
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
    <div className="flex h-[calc(100vh-var(--qbank-header,56px))] flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="flex w-full shrink-0 flex-col border-b border-border bg-card lg:h-full lg:w-80 lg:border-b-0 lg:border-r">
        <div className="border-b border-border p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            <BookOpen className="h-4 w-4" /> Medical Library
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search topics…"
              className="pl-8 pr-8"
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
          {isLoading && <div className="p-6"><Loader label="Loading library…" /></div>}
          {debounced.length >= 2 ? (
            <div className="space-y-0.5">
              {searching && <div className="px-2 py-2 text-sm text-muted-foreground">Searching…</div>}
              {!searching && (results?.length ?? 0) === 0 && (
                <div className="px-2 py-2 text-sm text-muted-foreground">No matches.</div>
              )}
              {(results ?? []).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => openDoc(r.id)}
                  className={`block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted ${
                    r.id === activeDoc ? "bg-primary/10 font-semibold text-primary" : ""
                  }`}
                >
                  {r.title}
                  {r.inBody && <span className="ml-1 text-xs text-muted-foreground">(in text)</span>}
                </button>
              ))}
            </div>
          ) : (
            tree.map((t) => renderNode(t, 0))
          )}
        </div>
      </aside>

      {/* Article */}
      <main className="flex-1 overflow-y-auto bg-background">
        {activeDoc == null ? (
          <div className="mx-auto max-w-2xl p-10 text-center text-muted-foreground">
            <BookOpen className="mx-auto mb-3 h-10 w-10 opacity-40" />
            <h1 className="text-2xl font-bold text-foreground">Medical Library</h1>
            <p className="mt-2 text-sm">
              Pick a specialty on the left to browse topics, or search for a condition to jump straight to the article.
            </p>
          </div>
        ) : loadingDoc && !doc ? (
          <div className="p-10"><Loader label="Opening article…" /></div>
        ) : (
          <article className="mx-auto max-w-4xl p-5 sm:p-8">
            <h1 className="mb-1 text-2xl font-bold">{doc?.title}</h1>
            {sections.length > 0 && (
              <nav className="mb-5 flex flex-wrap gap-1.5 border-b border-border pb-4">
                {sections.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setAnchor(s.section)}
                    className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary"
                  >
                    {s.name}
                  </button>
                ))}
              </nav>
            )}
            <div
              ref={bodyRef}
              className="library-article"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </article>
        )}
      </main>
    </div>
  );
}
