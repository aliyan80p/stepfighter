import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listFlashcards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ qbankId: z.number().int().optional(), questionId: z.number().int().optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    let q = supabase.from("flashcards").select("id,question_id,qbank_id,front,back,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(500);
    if (data.qbankId) q = q.eq("qbank_id", data.qbankId);
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
      front: z.string().trim().min(1).max(2000),
      back: z.string().trim().max(4000).default(""),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase.from("flashcards").insert({
      user_id: userId,
      qbank_id: data.qbankId ?? null,
      question_id: data.questionId ?? null,
      front: data.front,
      back: data.back ?? "",
    }).select("id,question_id,qbank_id,front,back,created_at").single();
    if (error) throw new Error(error.message);
    return row;
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
