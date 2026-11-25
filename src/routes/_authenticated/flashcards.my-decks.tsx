import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search, FolderPlus, Plus, MoreVertical, LayoutGrid, GraduationCap,
  Settings as SettingsIcon, BarChart3, Pencil, Trash2, X,
} from "lucide-react";
import { toast } from "sonner";
import { listDecks, createDeck, updateDeck, deleteDeck, touchDeck } from "@/lib/decks.functions";
import { listFlashcards, createFlashcard, updateFlashcard, deleteFlashcard } from "@/lib/flashcards.functions";
import { CreateDeckModal } from "@/components/flashcards/create-deck-modal";
import { CardEditorModal, type CardValue } from "@/components/flashcards/card-editor-modal";
import { DeckSettingsModal } from "@/components/flashcards/deck-settings-modal";
import { StatsPanel } from "@/components/flashcards/stats-panel";
import { StudySession } from "@/components/flashcards/study-session";
import { useConfirm } from "@/components/confirm-dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/flashcards/my-decks")({
  component: FlashcardsPage,
});

type Deck = {
  id: string; name: string; color: string;
  new_cards_per_day: number; reviews_per_day: number;
  new_card_order: string; last_used_at: string | null;
};

function FlashcardsPage() {
  const qc = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const listDecksFn = useServerFn(listDecks);
  const createDeckFn = useServerFn(createDeck);
  const updateDeckFn = useServerFn(updateDeck);
  const deleteDeckFn = useServerFn(deleteDeck);
  const touchDeckFn = useServerFn(touchDeck);
  const listCardsFn = useServerFn(listFlashcards);
  const createCardFn = useServerFn(createFlashcard);
  const updateCardFn = useServerFn(updateFlashcard);
  const deleteCardFn = useServerFn(deleteFlashcard);

  const [tab, setTab] = useState<"browse" | "study">("browse");
  const [q, setQ] = useState("");
  const [showCreateDeck, setShowCreateDeck] = useState(false);
  const [editDeck, setEditDeck] = useState<Deck | null>(null);
  const [deckMenuOpen, setDeckMenuOpen] = useState<string | null>(null);
  const [cardMenuOpen, setCardMenuOpen] = useState<string | null>(null);
  const [cardEditor, setCardEditor] = useState<{ deckId?: string; initial?: CardValue } | null>(null);
  const [settingsDeck, setSettingsDeck] = useState<Deck | null>(null);
  const [statsDeck, setStatsDeck] = useState<Deck | null | undefined>(undefined);
  const [studyDeck, setStudyDeck] = useState<Deck | null>(null);

  const { data: decksData } = useQuery({
    queryKey: ["decks"],
    queryFn: () => listDecksFn(),
  });
  const decks: Deck[] = (decksData?.decks as Deck[]) ?? [];
  const stats = decksData?.stats ?? {};

  const { data: cards = [] } = useQuery({
    queryKey: ["cards", "all"],
    queryFn: () => listCardsFn({ data: {} }),
  });

  const filteredDecks = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return decks;
    return decks.filter((d) => d.name.toLowerCase().includes(s));
  }, [decks, q]);

  const cardsByDeck = useMemo(() => {
    const m: Record<string, any[]> = {};
    for (const c of cards as any[]) {
      const k = c.deck_id ?? "__none";
      (m[k] ||= []).push(c);
    }
    return m;
  }, [cards]);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["decks"] });
    qc.invalidateQueries({ queryKey: ["cards"] });
  };

  const handleCreateDeck = async (name: string, color: string) => {
    try { await createDeckFn({ data: { name, color } }); invalidateAll(); toast.success("Deck created"); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  };
  const handleEditDeck = async (name: string, color: string) => {
    if (!editDeck) return;
    try { await updateDeckFn({ data: { id: editDeck.id, name, color } }); invalidateAll(); toast.success("Deck updated"); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  };
  const handleDeleteDeck = async (d: Deck) => {
    const ok = await confirm({
      title: `Delete "${d.name}"?`,
      description: "This deck and all of its flashcards will be permanently deleted.",
      confirmLabel: "Delete Deck",
      tone: "danger",
    });
    if (!ok) return;
    try { await deleteDeckFn({ data: { id: d.id } }); invalidateAll(); toast.success("Deck deleted"); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  };
  const handleDeleteCard = async (cardId: string) => {
    const ok = await confirm({
      title: "Delete flashcard?",
      description: "This flashcard will be permanently removed from your deck.",
      confirmLabel: "Delete Card",
      tone: "danger",
    });
    if (!ok) return;
    try { await deleteCardFn({ data: { id: cardId } }); invalidateAll(); toast.success("Card deleted"); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  };

  const saveCard = async (v: CardValue & { front: string; back: string }) => {
    if (v.id) {
      await updateCardFn({ data: { id: v.id, deckId: v.deckId ?? null, front: v.front, back: v.back, frontHtml: v.frontHtml, backHtml: v.backHtml, tags: v.tags } });
      toast.success("Saved");
    } else {
      await createCardFn({ data: { deckId: v.deckId ?? null, front: v.front, back: v.back, frontHtml: v.frontHtml, backHtml: v.backHtml, tags: v.tags } });
      toast.success("Card created");
    }
    invalidateAll();
  };

  const startStudy = async (d: Deck) => {
    setStudyDeck(d);
    try { await touchDeckFn({ data: { id: d.id } }); qc.invalidateQueries({ queryKey: ["decks"] }); } catch {}
  };

  const saveSettings = async (s: { new_cards_per_day: number; reviews_per_day: number; new_card_order: "added" | "random" }) => {
    if (!settingsDeck) return;
    try { await updateDeckFn({ data: { id: settingsDeck.id, ...s } }); invalidateAll(); toast.success("Settings saved"); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  };

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="sf-fluid-page space-y-5">
        {/* Clinical Studio Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b border-border">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Flashcards</h1>
              <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary tabular-nums">
                {decks.length} {decks.length === 1 ? "deck" : "decks"} · {(cards as any[]).length} cards
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Create, organize, and review spaced-repetition study decks
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStatsDeck(null)}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card text-xs font-medium text-foreground hover:bg-muted/60 transition-colors"
            >
              <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" /> Stats
            </button>
            <button
              onClick={() => setShowCreateDeck(true)}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card text-xs font-medium text-foreground hover:bg-muted/60 transition-colors"
            >
              <FolderPlus className="h-3.5 w-3.5 text-muted-foreground" /> Create Deck
            </button>
            <button
              onClick={() => setCardEditor({ deckId: decks[0]?.id })}
              disabled={!decks.length}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> New Card
            </button>
          </div>
        </div>

        {/* Control bar: Tabs + Search */}
        <div className="rounded-xl bg-card border border-border p-3 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-lg bg-muted/60 p-1">
            <TabBtn active={tab === "browse"} onClick={() => setTab("browse")} icon={<LayoutGrid className="h-3.5 w-3.5" />}>Browse Decks</TabBtn>
            <TabBtn active={tab === "study"} onClick={() => setTab("study")} icon={<GraduationCap className="h-3.5 w-3.5" />}>Study Mode</TabBtn>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={tab === "browse" ? "Search decks…" : "Filter decks…"}
              className="h-9 w-full pl-8 pr-3 rounded-lg border border-border bg-background text-xs outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        {tab === "browse" && (
          <div className="space-y-4">
            {!decks.length && !(cardsByDeck["__none"]?.length) ? (
              <EmptyDecks onCreate={() => setShowCreateDeck(true)} />
            ) : (
              <>
                {(cardsByDeck["__none"]?.length ?? 0) > 0 && (
                  <section className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-semibold bg-amber-500">★</div>
                      <div>
                        <div className="font-semibold text-sm">Unsorted</div>
                        <div className="text-xs text-muted-foreground">{cardsByDeck["__none"].length} cards created from question reviews</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                      {cardsByDeck["__none"].slice(0, 24).map((c: any) => (
                        <CardTile
                          key={c.id} card={c}
                          menuOpen={cardMenuOpen === c.id}
                          onMenu={() => setCardMenuOpen(cardMenuOpen === c.id ? null : c.id)}
                          onEdit={() => { setCardMenuOpen(null); setCardEditor({ initial: cardToValue(c) }); }}
                          onDelete={() => { setCardMenuOpen(null); handleDeleteCard(c.id); }}
                        />
                      ))}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-2.5">Tip: edit any card to assign it to a deck.</div>
                  </section>
                )}

                {filteredDecks.map((d) => {
                  const st = stats[d.id] ?? { total: 0, new: 0, learning: 0, review: 0 };
                  const list = cardsByDeck[d.id] ?? [];
                  return (
                    <section key={d.id} className="rounded-xl bg-card border border-border p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ backgroundColor: d.color }}>
                            {d.name[0]?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-sm truncate">{d.name}</div>
                            <div className="text-xs text-muted-foreground tabular-nums">{st.total} cards</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 relative shrink-0">
                          <button
                            onClick={() => startStudy(d)}
                            className="h-7 px-3 rounded-md bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/15 transition-colors"
                          >
                            Study
                          </button>
                          <button onClick={() => setDeckMenuOpen(deckMenuOpen === d.id ? null : d.id)} className="h-7 w-7 grid place-items-center hover:bg-muted rounded-md">
                            <MoreVertical className="h-4 w-4 text-muted-foreground" />
                          </button>
                          {deckMenuOpen === d.id && (
                            <div className="absolute right-0 top-8 bg-popover border border-border rounded-lg shadow-lg z-10 w-32 py-1">
                              <button onClick={() => { setEditDeck(d); setDeckMenuOpen(null); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-muted text-left">
                                <Pencil className="h-3.5 w-3.5" /> Edit
                              </button>
                              <button onClick={() => { setDeckMenuOpen(null); handleDeleteDeck(d); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-muted text-rose-600 dark:text-rose-400 text-left">
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5 mb-3">
                        <Pill color="bg-blue-500/12 text-blue-600 dark:text-blue-400">New {st.new}</Pill>
                        <Pill color="bg-amber-500/12 text-amber-600 dark:text-amber-400">Learning {st.learning}</Pill>
                        <Pill color="bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">Review {st.review}</Pill>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {list.slice(0, 12).map((c: any) => (
                          <CardTile
                            key={c.id} card={c}
                            menuOpen={cardMenuOpen === c.id}
                            onMenu={() => setCardMenuOpen(cardMenuOpen === c.id ? null : c.id)}
                            onEdit={() => { setCardMenuOpen(null); setCardEditor({ initial: cardToValue(c) }); }}
                            onDelete={() => { setCardMenuOpen(null); handleDeleteCard(c.id); }}
                          />
                        ))}
                        <button
                          onClick={() => setCardEditor({ deckId: d.id })}
                          className="h-32 border border-dashed border-border rounded-lg flex flex-col items-center justify-center text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-colors"
                        >
                          <Plus className="h-5 w-5" />
                          <span className="text-xs mt-1 font-medium">New Card</span>
                        </button>
                      </div>
                    </section>
                  );
                })}
              </>
            )}
          </div>
        )}

        {tab === "study" && (
          <div className="rounded-xl bg-card border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="bg-muted/40 border-b border-border text-muted-foreground">
                    <th className="text-left font-semibold uppercase tracking-wide text-[11px] py-2.5 px-4">Deck</th>
                    <th className="text-center font-semibold uppercase tracking-wide text-[11px] py-2.5 px-3">New</th>
                    <th className="text-center font-semibold uppercase tracking-wide text-[11px] py-2.5 px-3">Learning</th>
                    <th className="text-center font-semibold uppercase tracking-wide text-[11px] py-2.5 px-3">To Review</th>
                    <th className="text-center font-semibold uppercase tracking-wide text-[11px] py-2.5 px-3">Last Used</th>
                    <th className="text-right font-semibold uppercase tracking-wide text-[11px] py-2.5 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredDecks.map((d) => {
                    const st = stats[d.id] ?? { total: 0, new: 0, learning: 0, review: 0 };
                    return (
                      <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4">
                          <button onClick={() => startStudy(d)} className="flex items-center gap-3 text-left group">
                            <span className="w-7 h-7 rounded-lg text-white text-xs font-bold flex items-center justify-center shrink-0" style={{ backgroundColor: d.color }}>
                              {d.name[0]?.toUpperCase()}
                            </span>
                            <span className="font-medium group-hover:text-primary transition-colors">{d.name}</span>
                          </button>
                        </td>
                        <td className="text-center py-3 px-3 text-blue-600 dark:text-blue-400 font-semibold tabular-nums">{st.new}</td>
                        <td className="text-center py-3 px-3 text-amber-600 dark:text-amber-400 font-semibold tabular-nums">{st.learning}</td>
                        <td className="text-center py-3 px-3 text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">{st.review}</td>
                        <td className="text-center py-3 px-3 text-muted-foreground tabular-nums">{d.last_used_at ? new Date(d.last_used_at).toLocaleDateString() : "—"}</td>
                        <td className="text-right py-3 px-4">
                          <div className="inline-flex items-center gap-1.5">
                            <button onClick={() => startStudy(d)} className="h-7 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90">
                              Study
                            </button>
                            <button onClick={() => setSettingsDeck(d)} className="h-7 w-7 grid place-items-center hover:bg-muted rounded-md" title="Deck settings">
                              <SettingsIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!filteredDecks.length && (
                    <tr><td colSpan={6} className="py-8 text-center text-xs text-muted-foreground">No decks yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <CreateDeckModal open={showCreateDeck} onClose={() => setShowCreateDeck(false)} onCreate={handleCreateDeck} />
      <CreateDeckModal
        open={!!editDeck}
        onClose={() => setEditDeck(null)}
        onCreate={handleEditDeck}
        initialName={editDeck?.name}
        initialColor={editDeck?.color}
        title="Edit Deck"
      />
      {cardEditor && (
        <CardEditorModal
          open={!!cardEditor}
          onClose={() => setCardEditor(null)}
          decks={decks}
          initial={cardEditor.initial ?? { frontHtml: "", backHtml: "", tags: [], deckId: cardEditor.deckId }}
          onSave={saveCard}
        />
      )}
      {settingsDeck && (
        <DeckSettingsModal
          open={!!settingsDeck}
          onClose={() => setSettingsDeck(null)}
          deckName={settingsDeck.name}
          initial={{
            new_cards_per_day: settingsDeck.new_cards_per_day,
            reviews_per_day: settingsDeck.reviews_per_day,
            new_card_order: (settingsDeck.new_card_order as "added" | "random") ?? "added",
          }}
          onSave={saveSettings}
        />
      )}
      <StatsPanel open={statsDeck !== undefined} onClose={() => setStatsDeck(undefined)} deckId={statsDeck?.id} />
      {studyDeck && (
        <StudySession open={!!studyDeck} onClose={() => { setStudyDeck(null); invalidateAll(); }} deckId={studyDeck.id} deckName={studyDeck.name} />
      )}
      {confirmDialog}
    </div>
  );
}

function TabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors",
        active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon} {children}
    </button>
  );
}

function Pill({ children, color }: { children: React.ReactNode; color: string }) {
  return <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-md tabular-nums", color)}>{children}</span>;
}

function EmptyDecks({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-xl bg-card border border-border text-center py-12 px-4">
      <div className="text-sm text-muted-foreground mb-3">You don't have any flashcard decks yet.</div>
      <button onClick={onCreate} className="h-9 px-4 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90">
        Create your first deck
      </button>
    </div>
  );
}

function CardTile({ card, menuOpen, onMenu, onEdit, onDelete }: {
  card: any; menuOpen: boolean; onMenu: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const preview = stripHtmlBrowser(card.front_html) || card.front || "";
  return (
    <div className="relative h-32 border border-border rounded-lg p-2.5 text-xs text-foreground/90 bg-background hover:border-primary/50 overflow-hidden transition-colors">
      {card.front_image && <img src={card.front_image} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />}
      <div className="relative line-clamp-6 leading-relaxed">{preview}</div>
      <button onClick={onMenu} className="absolute top-1.5 right-1.5 p-0.5 bg-background/80 rounded hover:bg-muted">
        <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      {menuOpen && (
        <div className="absolute top-7 right-1.5 bg-popover border border-border rounded-lg shadow-lg z-10 w-24 py-1">
          <div className="flex justify-end px-1.5 pb-0.5"><button onClick={onMenu}><X className="h-3 w-3 text-muted-foreground" /></button></div>
          <button onClick={onEdit} className="flex items-center gap-1.5 w-full px-2.5 py-1 text-xs hover:bg-muted text-left">
            <Pencil className="h-3 w-3" /> Edit
          </button>
          <button onClick={onDelete} className="flex items-center gap-1.5 w-full px-2.5 py-1 text-xs hover:bg-muted text-rose-600 dark:text-rose-400 text-left">
            <Trash2 className="h-3 w-3" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

function stripHtmlBrowser(html?: string | null) {
  if (!html) return "";
  if (typeof document === "undefined") return html.replace(/<[^>]+>/g, "");
  const el = document.createElement("div"); el.innerHTML = html;
  return el.textContent ?? "";
}

function cardToValue(c: any): CardValue {
  return {
    id: c.id,
    deckId: c.deck_id ?? null,
    frontHtml: c.front_html ?? (c.front ? `<p>${escapeHtml(c.front)}</p>` : ""),
    backHtml: c.back_html ?? (c.back ? `<p>${escapeHtml(c.back)}</p>` : ""),
    tags: c.tags ?? [],
  };
}
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
