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
    let q = supabase.from("flashcards").select("id,question_id,qbank_id,front,back,front_image,back_image,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(500);
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
      front: z.string().trim().max(3000).default(""),
      back: z.string().trim().max(3000).default(""),
      frontImage: z.string().max(3_000_000).optional().nullable(),
      backImage: z.string().max(3_000_000).optional().nullable(),
    }).refine((v) => (v.front && v.front.length > 0) || !!v.frontImage, { message: "Front cannot be empty" }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase.from("flashcards").insert({
      user_id: userId,
      qbank_id: data.qbankId ?? null,
      question_id: data.questionId ?? null,
      front: data.front ?? "",
      back: data.back ?? "",
      front_image: data.frontImage ?? null,
      back_image: data.backImage ?? null,
    }).select("id,question_id,qbank_id,front,back,front_image,back_image,created_at").single();
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
