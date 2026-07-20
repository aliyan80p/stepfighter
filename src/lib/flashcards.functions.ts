import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { schedule, type Rating } from "@/lib/srs";

const CARD_COLS =
  "id,question_id,qbank_id,deck_id,front,back,front_html,back_html,front_image,back_image,tags,state,due_at,interval_days,ease,reps,lapses,last_reviewed_at,created_at";

export const listFlashcards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      qbankId: z.number().int().optional(),
      questionId: z.number().int().optional(),
      deckId: z.string().uuid().optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    let q = supabase.from("flashcards").select(CARD_COLS).eq("user_id", userId).order("created_at", { ascending: false }).limit(2000);
    if (data.qbankId) q = q.eq("qbank_id", data.qbankId);
    if (data.deckId) q = q.eq("deck_id", data.deckId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createFlashcard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      qbankId: z.number().int().optional(),
      questionId: z.number().int().optional(),
      deckId: z.string().uuid().optional().nullable(),
      front: z.string().trim().max(6000).default(""),
      back: z.string().trim().max(6000).default(""),
      frontHtml: z.string().max(20000).optional().nullable(),
      backHtml: z.string().max(20000).optional().nullable(),
      frontImage: z.string().max(3_000_000).optional().nullable(),
      backImage: z.string().max(3_000_000).optional().nullable(),
      tags: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
    }).refine((v) => !!(v.front || v.frontHtml || v.frontImage), { message: "Front cannot be empty" }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase.from("flashcards").insert({
      user_id: userId,
      qbank_id: data.qbankId ?? null,
      question_id: data.questionId ?? null,
      deck_id: data.deckId ?? null,
      front: data.front ?? "",
      back: data.back ?? "",
      front_html: data.frontHtml ?? null,
      back_html: data.backHtml ?? null,
      front_image: data.frontImage ?? null,
      back_image: data.backImage ?? null,
      tags: data.tags ?? [],
    }).select(CARD_COLS).single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateFlashcard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      deckId: z.string().uuid().optional().nullable(),
      front: z.string().max(6000).optional(),
      back: z.string().max(6000).optional(),
      frontHtml: z.string().max(20000).optional().nullable(),
      backHtml: z.string().max(20000).optional().nullable(),
      frontImage: z.string().max(3_000_000).optional().nullable(),
      backImage: z.string().max(3_000_000).optional().nullable(),
      tags: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { id, ...rest } = data;
    const patch: Record<string, unknown> = {};
    if (rest.deckId !== undefined) patch.deck_id = rest.deckId;
    if (rest.front !== undefined) patch.front = rest.front;
    if (rest.back !== undefined) patch.back = rest.back;
    if (rest.frontHtml !== undefined) patch.front_html = rest.frontHtml;
    if (rest.backHtml !== undefined) patch.back_html = rest.backHtml;
    if (rest.frontImage !== undefined) patch.front_image = rest.frontImage;
    if (rest.backImage !== undefined) patch.back_image = rest.backImage;
    if (rest.tags !== undefined) patch.tags = rest.tags;
    const { error } = await supabase.from("flashcards").update(patch).eq("id", id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteFlashcard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("flashcards").delete().eq("id", data.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// STUDY QUEUE
export const getStudyQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ deckId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: deck } = await supabase.from("flashcard_decks").select("new_cards_per_day,reviews_per_day,new_card_order").eq("id", data.deckId).eq("user_id", userId).single();
    const nowIso = new Date().toISOString();
    const { data: cards, error } = await supabase
      .from("flashcards")
      .select(CARD_COLS)
      .eq("user_id", userId)
      .eq("deck_id", data.deckId);
    if (error) throw new Error(error.message);

    const newCards = (cards ?? []).filter(c => c.state === "new");
    const learning = (cards ?? []).filter(c => c.state === "learning" && (!c.due_at || c.due_at <= nowIso));
    const review = (cards ?? []).filter(c => c.state === "review" && (!c.due_at || c.due_at <= nowIso));

    const nMax = deck?.new_cards_per_day ?? 20;
    const rMax = deck?.reviews_per_day ?? 200;
    const ordered = deck?.new_card_order === "random"
      ? [...newCards].sort(() => Math.random() - 0.5)
      : newCards;

    return {
      queue: [...learning, ...review.slice(0, rMax), ...ordered.slice(0, nMax)],
      counts: { new: newCards.length, learning: learning.length, review: review.length },
    };
  });

export const reviewCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      rating: z.enum(["again", "hard", "good", "easy"]),
      timeMs: z.number().int().min(0).max(10 * 60_000).default(0),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: card, error: e1 } = await supabase
      .from("flashcards")
      .select("id,deck_id,state,interval_days,ease,reps,lapses,time_spent_ms")
      .eq("id", data.id).eq("user_id", userId).single();
    if (e1 || !card) throw new Error(e1?.message ?? "Card not found");

    const next = schedule({
      state: (card.state as "new" | "learning" | "review") ?? "new",
      interval_days: card.interval_days ?? 0,
      ease: card.ease ?? 2.5,
      reps: card.reps ?? 0,
      lapses: card.lapses ?? 0,
    }, data.rating as Rating);

    const { error: e2 } = await supabase.from("flashcards").update({
      state: next.state,
      interval_days: next.interval_days,
      ease: next.ease,
      reps: next.reps,
      lapses: next.lapses,
      due_at: next.due_at,
      last_reviewed_at: new Date().toISOString(),
      time_spent_ms: (card.time_spent_ms ?? 0) + data.timeMs,
    }).eq("id", data.id).eq("user_id", userId);
    if (e2) throw new Error(e2.message);

    await supabase.from("flashcard_reviews").insert({
      user_id: userId, card_id: data.id, deck_id: card.deck_id ?? null,
      rating: data.rating, time_ms: data.timeMs,
    });
    return { ok: true, next };
  });

export const getDeckStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ deckId: z.string().uuid().optional() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    let q = supabase.from("flashcard_reviews").select("card_id,rating,time_ms,reviewed_at,deck_id").eq("user_id", userId).gte("reviewed_at", since);
    if (data.deckId) q = q.eq("deck_id", data.deckId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    let todayCount = 0, todayMs = 0, totalReviews = 0, totalMs = 0;
    const daysStudied = new Set<string>();
    for (const r of rows ?? []) {
      totalReviews++; totalMs += r.time_ms ?? 0;
      const dt = new Date(r.reviewed_at);
      daysStudied.add(dt.toDateString());
      if (dt >= todayStart) { todayCount++; todayMs += r.time_ms ?? 0; }
    }

    // forecast: cards due tomorrow
    const tomorrowStart = new Date(todayStart.getTime() + 86_400_000).toISOString();
    const tomorrowEnd = new Date(todayStart.getTime() + 2 * 86_400_000).toISOString();
    let fq = supabase.from("flashcards").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("due_at", tomorrowStart).lt("due_at", tomorrowEnd);
    if (data.deckId) fq = fq.eq("deck_id", data.deckId);
    const { count: dueTomorrow } = await fq;

    const days = Math.max(1, daysStudied.size);
    return {
      today: { count: todayCount, timeMs: todayMs },
      forecast: { dueTomorrow: dueTomorrow ?? 0 },
      totalReviews,
      avgReviewsPerDay: Math.round(totalReviews / days),
      totalMs,
      avgMsPerDay: Math.round(totalMs / days),
      avgAnswerMs: totalReviews > 0 ? Math.round(totalMs / totalReviews) : 0,
    };
  });
