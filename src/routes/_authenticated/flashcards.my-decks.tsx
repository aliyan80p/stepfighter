import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, FolderPlus, Plus, MoreVertical, LayoutGrid, GraduationCap, Settings as SettingsIcon, BarChart3, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { listDecks, createDeck, updateDeck, deleteDeck, touchDeck } from "@/lib/decks.functions";
import { listFlashcards, createFlashcard, updateFlashcard, deleteFlashcard } from "@/lib/flashcards.functions";
import { CreateDeckModal } from "@/components/flashcards/create-deck-modal";
import { CardEditorModal, type CardValue } from "@/components/flashcards/card-editor-modal";
import { DeckSettingsModal } from "@/components/flashcards/deck-settings-modal";
import { StatsPanel } from "@/components/flashcards/stats-panel";
import { StudySession } from "@/components/flashcards/study-session";

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
  const [statsDeck, setStatsDeck] = useState<Deck | null | undefined>(undefined); // undefined = closed, null = all
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
    return decks.filter(d => d.name.toLowerCase().includes(s));
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
    if (!confirm(`Delete "${d.name}" and all its cards?`)) return;
    try { await deleteDeckFn({ data: { id: d.id } }); invalidateAll(); toast.success("Deleted"); }
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
    <div className="sf-fluid-page">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-slate-800">Your Flashcards</h1>
        <p className="text-sm text-slate-500">Create and manage your study flashcards</p>
      </div>

      <div className="flex gap-6 border-b border-slate-200 mb-4">
        <TabBtn active={tab === "browse"} onClick={() => setTab("browse")} icon={<LayoutGrid className="h-4 w-4" />}>Browse Decks</TabBtn>
        <TabBtn active={tab === "study"} onClick={() => setTab("study")} icon={<GraduationCap className="h-4 w-4" />}>Study Mode</TabBtn>
      </div>

      {tab === "browse" && (
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search flashcards"
                className="w-full pl-9 pr-3 py-2 border-b border-slate-300 text-sm outline-none focus:border-blue-500 bg-transparent" />
            </div>
            <button onClick={() => setShowCreateDeck(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">
              <FolderPlus className="h-4 w-4" /> Create Deck
            </button>
            <button
              onClick={() => setCardEditor({ deckId: decks[0]?.id })}
              disabled={!decks.length}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-md text-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> New Card
            </button>
          </div>

          {!decks.length && !(cardsByDeck["__none"]?.length) ? (
            <EmptyDecks onCreate={() => setShowCreateDeck(true)} />
          ) : (
            <div className="space-y-6">
              {(cardsByDeck["__none"]?.length ?? 0) > 0 && (
                <section className="border rounded-lg p-4 bg-amber-50/40">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded flex items-center justify-center text-white text-sm font-semibold bg-amber-500">★</div>
                      <div>
                        <div className="font-semibold text-slate-800">Unsorted</div>
                        <div className="text-xs text-slate-500">{cardsByDeck["__none"].length} cards created from question reviews</div>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {cardsByDeck["__none"].slice(0, 24).map((c: any) => (
                      <CardTile
                        key={c.id} card={c}
                        menuOpen={cardMenuOpen === c.id}
                        onMenu={() => setCardMenuOpen(cardMenuOpen === c.id ? null : c.id)}
                        onEdit={() => { setCardMenuOpen(null); setCardEditor({ initial: cardToValue(c) }); }}
                        onDelete={async () => {
                          setCardMenuOpen(null);
                          if (!confirm("Delete this card?")) return;
                          try { await deleteCardFn({ data: { id: c.id } }); invalidateAll(); } catch (e: any) { toast.error(e?.message ?? "Failed"); }
                        }}
                      />
                    ))}
                  </div>
                  <div className="text-xs text-slate-500 mt-2">Tip: open a card to assign it to a deck.</div>
                </section>
              )}
              {filteredDecks.map(d => {
                const st = stats[d.id] ?? { total: 0, new: 0, learning: 0, review: 0 };
                const list = cardsByDeck[d.id] ?? [];
                return (
                  <section key={d.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded flex items-center justify-center text-white text-sm font-semibold" style={{ backgroundColor: d.color }}>
                          {d.name[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800">{d.name}</div>
                          <div className="text-xs text-slate-500">{st.total} cards</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 relative">
                        <button onClick={() => startStudy(d)} className="text-xs px-3 py-1 border rounded-full text-slate-600 hover:bg-slate-50">See All</button>
                        <button onClick={() => setDeckMenuOpen(deckMenuOpen === d.id ? null : d.id)} className="p-1 hover:bg-slate-100 rounded">
                          <MoreVertical className="h-4 w-4 text-slate-500" />
                        </button>
                        {deckMenuOpen === d.id && (
                          <div className="absolute right-0 top-8 bg-white border rounded shadow-lg z-10 w-32">
                            <button onClick={() => { setEditDeck(d); setDeckMenuOpen(null); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-slate-50 text-left">
                              <Pencil className="h-3.5 w-3.5" /> Edit
                            </button>
                            <button onClick={() => { setDeckMenuOpen(null); handleDeleteDeck(d); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-slate-50 text-red-600 text-left">
                              <Trash2 className="h-3.5 w-3.5" /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 mb-3">
                      <Pill color="bg-blue-100 text-blue-700">New {st.new}</Pill>
                      <Pill color="bg-orange-100 text-orange-700">Learning {st.learning}</Pill>
                      <Pill color="bg-green-100 text-green-700">Review {st.review}</Pill>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                      {list.slice(0, 12).map((c: any) => (
                        <CardTile
                          key={c.id} card={c}
                          menuOpen={cardMenuOpen === c.id}
                          onMenu={() => setCardMenuOpen(cardMenuOpen === c.id ? null : c.id)}
                          onEdit={() => { setCardMenuOpen(null); setCardEditor({ initial: cardToValue(c) }); }}
                          onDelete={async () => {
                            setCardMenuOpen(null);
                            if (!confirm("Delete this card?")) return;
                            try { await deleteCardFn({ data: { id: c.id } }); invalidateAll(); } catch (e: any) { toast.error(e?.message ?? "Failed"); }
                          }}
                        />
                      ))}
                      <button
                        onClick={() => setCardEditor({ deckId: d.id })}
                        className="h-32 border border-dashed border-slate-300 rounded-md flex flex-col items-center justify-center text-slate-500 hover:border-blue-400 hover:text-blue-600"
                      >
                        <Plus className="h-5 w-5" />
                        <span className="text-xs mt-1">New Card</span>
                      </button>
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "study" && (
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search decks"
                className="w-full pl-9 pr-3 py-2 border-b border-slate-300 text-sm outline-none focus:border-blue-500 bg-transparent" />
            </div>
            <div className="flex-1" />
            <button onClick={() => setStatsDeck(null)} className="inline-flex items-center gap-2 text-blue-600 hover:underline text-sm">
              <BarChart3 className="h-4 w-4" /> View Stats
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-600 border-b">
                  <th className="text-left font-semibold py-2 px-2">Choose Deck</th>
                  <th className="font-semibold py-2 px-2">New Cards</th>
                  <th className="font-semibold py-2 px-2">Learning</th>
                  <th className="font-semibold py-2 px-2">To Review</th>
                  <th className="font-semibold py-2 px-2">Last Used</th>
                  <th className="font-semibold py-2 px-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredDecks.map(d => {
                  const st = stats[d.id] ?? { total: 0, new: 0, learning: 0, review: 0 };
                  return (
                    <tr key={d.id} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="py-3 px-2">
                        <button onClick={() => startStudy(d)} className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-full text-white text-xs font-semibold flex items-center justify-center" style={{ backgroundColor: d.color }}>
                            {d.name[0]?.toUpperCase()}
                          </span>
                          <span className="text-slate-800">{d.name}</span>
                        </button>
                      </td>
                      <td className="text-center py-3 px-2 text-blue-600 font-medium">{st.new}</td>
                      <td className="text-center py-3 px-2 text-orange-600 font-medium">{st.learning}</td>
                      <td className="text-center py-3 px-2 text-green-600 font-medium">{st.review}</td>
                      <td className="text-center py-3 px-2 text-slate-500">{d.last_used_at ? new Date(d.last_used_at).toLocaleDateString() : "—"}</td>
                      <td className="text-center py-3 px-2">
                        <button onClick={() => setSettingsDeck(d)} className="p-1.5 hover:bg-slate-100 rounded">
                          <SettingsIcon className="h-4 w-4 text-slate-600" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!filteredDecks.length && (
                  <tr><td colSpan={6} className="py-6 text-center text-slate-500">No decks yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
    </div>
  );
}

function TabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 pb-2 -mb-px text-sm ${active ? "text-blue-600 border-b-2 border-blue-600 font-medium" : "text-slate-500"}`}>
      {icon} {children}
    </button>
  );
}

function Pill({ children, color }: { children: React.ReactNode; color: string }) {
  return <span className={`text-xs px-2 py-0.5 rounded-full ${color}`}>{children}</span>;
}

function EmptyDecks({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="text-center py-10">
      <div className="text-slate-500 mb-3">You don't have any decks yet.</div>
      <button onClick={onCreate} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">Create your first deck</button>
    </div>
  );
}

function CardTile({ card, menuOpen, onMenu, onEdit, onDelete }: {
  card: any; menuOpen: boolean; onMenu: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const preview = stripHtmlBrowser(card.front_html) || card.front || "";
  return (
    <div className="relative h-32 border border-slate-200 rounded-md p-2 text-xs text-slate-700 bg-white hover:border-blue-400 overflow-hidden">
      {card.front_image && <img src={card.front_image} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />}
      <div className="relative line-clamp-6">{preview}</div>
      <button onClick={onMenu} className="absolute top-1 right-1 p-0.5 bg-white/80 rounded hover:bg-slate-100">
        <MoreVertical className="h-3.5 w-3.5 text-slate-500" />
      </button>
      {menuOpen && (
        <div className="absolute top-6 right-1 bg-white border rounded shadow-lg z-10 w-24">
          <div className="flex justify-end p-1"><button onClick={onMenu}><X className="h-3 w-3 text-slate-400" /></button></div>
          <button onClick={onEdit} className="flex items-center gap-2 w-full px-2 py-1.5 text-xs hover:bg-slate-50 text-left">
            <Pencil className="h-3 w-3" /> Edit
          </button>
          <button onClick={onDelete} className="flex items-center gap-2 w-full px-2 py-1.5 text-xs hover:bg-slate-50 text-red-600 text-left">
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
