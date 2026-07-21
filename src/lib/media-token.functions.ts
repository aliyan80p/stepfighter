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
