import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const submitFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      qbankId: z.number().int().optional(),
      questionId: z.number().int().optional(),
      message: z.string().trim().min(10, "Please provide a bit more detail").max(4000),
      isTechnical: z.boolean().default(false),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("feedback").insert({
      user_id: userId,
      qbank_id: data.qbankId ?? null,
      question_id: data.questionId ?? null,
      message: data.message,
      is_technical: data.isTechnical,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
