import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { internalError } from "./errors";

const COLOR = z.string().regex(/^#([0-9a-fA-F]{6})$/);

export const listDecks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: decks, error } = await supabase
      .from("flashcard_decks")
      .select("id,name,color,new_cards_per_day,reviews_per_day,new_card_order,last_used_at,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (error) throw internalError(error);

    // stats per deck
    const { data: cards, error: e2 } = await supabase
      .from("flashcards")
      .select("id,deck_id,state,due_at")
      .eq("user_id", userId);
    if (e2) throw new Error(e2.message);

    const nowIso = new Date().toISOString();
    const stats: Record<string, { total: number; new: number; learning: number; review: number }> = {};
    for (const d of decks ?? []) stats[d.id] = { total: 0, new: 0, learning: 0, review: 0 };
    for (const c of cards ?? []) {
      const key = c.deck_id ?? "__none";
      if (!stats[key]) stats[key] = { total: 0, new: 0, learning: 0, review: 0 };
      stats[key].total++;
      if (c.state === "new") stats[key].new++;
      else if (c.state === "learning") stats[key].learning++;
      else if (c.state === "review" && (!c.due_at || c.due_at <= nowIso)) stats[key].review++;
    }
    return { decks: decks ?? [], stats };
  });

export const createDeck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      name: z.string().trim().min(1).max(80),
      color: COLOR.default("#3b82f6"),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("flashcard_decks")
      .insert({ user_id: userId, name: data.name, color: data.color })
      .select("*")
      .single();
    if (error) throw internalError(error);
    return row;
  });

export const updateDeck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      name: z.string().trim().min(1).max(80).optional(),
      color: COLOR.optional(),
      new_cards_per_day: z.number().int().min(0).max(9999).optional(),
      reviews_per_day: z.number().int().min(0).max(9999).optional(),
      new_card_order: z.enum(["added", "random"]).optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { id, ...patch } = data;
    const { error } = await supabase.from("flashcard_decks").update(patch).eq("id", id).eq("user_id", userId);
    if (error) throw internalError(error);
    return { ok: true };
  });

export const deleteDeck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    // delete deck's cards first
    const { error: e1 } = await supabase.from("flashcards").delete().eq("deck_id", data.id).eq("user_id", userId);
    if (e1) throw new Error(e1.message);
    const { error } = await supabase.from("flashcard_decks").delete().eq("id", data.id).eq("user_id", userId);
    if (error) throw internalError(error);
    return { ok: true };
  });

export const touchDeck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await supabase.from("flashcard_decks").update({ last_used_at: new Date().toISOString() }).eq("id", data.id).eq("user_id", userId);
    return { ok: true };
  });
