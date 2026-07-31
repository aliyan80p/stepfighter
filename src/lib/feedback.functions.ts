import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { internalError } from "./errors";

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
    // Abuse guard: cap submissions per user per hour so the feedback table
    // cannot be flooded by a script.
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("feedback")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", since);
    if ((count ?? 0) >= 15) {
      throw new Error("Too many messages sent. Please try again in an hour.");
    }
    const { error } = await supabase.from("feedback").insert({
      user_id: userId,
      qbank_id: data.qbankId ?? null,
      question_id: data.questionId ?? null,
      message: data.message,
      is_technical: data.isTechnical,
    });
    if (error) throw internalError(error);
    return { ok: true };
  });
