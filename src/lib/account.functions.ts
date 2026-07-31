import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Permanent, user-initiated account deletion (GDPR / CCPA "right to erasure").
 *
 * Removes every row of personal data this app stores about the caller, then
 * deletes the auth account itself. A user can only ever delete *their own*
 * account: the id comes from the verified bearer token, never from the body.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ confirm: z.literal("DELETE") }).parse(d),
  )
  .handler(async ({ context }) => {
    const userId = context.userId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Tables keyed by user_id. Ordered children-first; the auth cascade covers
    // the FK-linked ones too, but we clear them explicitly so nothing survives
    // on tables without an auth.users foreign key (decks, reviews, notes).
    const owned = [
      "flashcard_reviews",
      "flashcards",
      "flashcard_decks",
      "question_notes",
      "bookmarks",
      "attempts",
      "tests",
      "qbank_resets",
      "feedback",
      "login_otps",
      "user_entitlements",
      "user_roles",
    ];

    const db = supabaseAdmin as unknown as {
      from: (t: string) => { delete: () => { eq: (c: string, v: string) => Promise<{ error: unknown }> } };
    };

    const failed: string[] = [];
    for (const table of owned) {
      const { error } = await db.from(table).delete().eq("user_id", userId);
      if (error) failed.push(table);
    }
    // profiles is keyed by `id`, not `user_id`.
    const { error: profErr } = await db.from("profiles").delete().eq("id", userId);
    if (profErr) failed.push("profiles");

    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authErr) {
      // Never echo the raw provider error — it can contain account identifiers.
      throw new Error("Could not delete the account. Please contact support.");
    }

    return { ok: true as const, partial: failed.length > 0 };
  });

