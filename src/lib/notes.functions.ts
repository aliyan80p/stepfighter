import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getNote = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ questionId: z.number().int() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("question_notes")
      .select("id,content,updated_at")
      .eq("user_id", userId)
      .eq("question_id", data.questionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row ?? null;
  });

export const saveNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      questionId: z.number().int(),
      qbankId: z.number().int().optional(),
      content: z.string().max(10000),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("question_notes")
      .upsert(
        {
          user_id: userId,
          question_id: data.questionId,
          qbank_id: data.qbankId ?? null,
          content: data.content,
        },
        { onConflict: "user_id,question_id" },
      )
      .select("id,content,updated_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
