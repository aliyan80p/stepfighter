import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertQbankAccess } from "@/lib/entitlements.functions";

export const getMediaToken = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ qbankId: z.number() }).parse(d))
  .handler(async ({ data, context }): Promise<{ token: string; expiresAt: number }> => {
    await assertQbankAccess(context.supabase, context.userId, data.qbankId);
    const { signMediaToken } = await import("@/lib/media-token.server");
    return signMediaToken(context.userId, data.qbankId);
  });

/**
 * Medical Library media token. The library dataset is shared across Step 1,
 * Step 2 CK and Step 3, so any user with an active plan for ANY qbank gets a
 * token bound to the library qbank (2) where its figures are stored.
 */
export const getLibraryMediaToken = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ token: string; expiresAt: number }> => {
    const { assertAnyQbankAccess } = await import("@/lib/entitlements.functions");
    await assertAnyQbankAccess(context.supabase, context.userId);
    const { signMediaToken } = await import("@/lib/media-token.server");
    return signMediaToken(context.userId, 2);
  });
