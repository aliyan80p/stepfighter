import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// qbank id → slug mapping (matches public.qbanks)
export const QBANK_ID_TO_SLUG: Record<number, string> = { 1: "step2", 2: "step1", 3: "step3" };
export const QBANK_ACCESS_ALIASES: Record<string, string> = {
  "1": "step2",
  "2": "step1",
  "3": "step3",
  step1: "step1",
  step2: "step2",
  step2ck: "step2",
  step3: "step3",
};
export const QBANK_SLUG_TO_LABEL: Record<string, string> = {
  step1: "USMLE Step 1",
  step2: "USMLE Step 2 CK",
  step3: "USMLE Step 3",
};

export type Entitlement = {
  plan: "trial" | "paid" | "expired";
  trial_started_at: string;
  trial_ends_at: string;
  paid_until: string | null;
  qbank_access: string[];
  effective_access: string[];
  days_left: number;
  is_active: boolean;
};

export function normalizeQbankAccess(values: string[] | null | undefined): string[] {
  const normalized = new Set<string>();
  for (const value of values ?? []) {
    const slug = QBANK_ACCESS_ALIASES[String(value).trim().toLowerCase()];
    if (slug) normalized.add(slug);
  }
  return Array.from(normalized);
}

function compute(row: {
  plan: string;
  trial_started_at: string;
  trial_ends_at: string;
  paid_until: string | null;
  qbank_access: string[] | null;
}): Entitlement {
  const now = Date.now();
  const trialEnds = new Date(row.trial_ends_at).getTime();
  const paidUntil = row.paid_until ? new Date(row.paid_until).getTime() : null;
  const paidActive = row.plan === "paid" && (paidUntil == null || paidUntil > now);
  const trialActive = row.plan === "trial" && trialEnds > now;
  const isActive = paidActive || trialActive;
  const daysLeft = Math.max(0, Math.ceil((trialEnds - now) / (1000 * 60 * 60 * 24)));
  const access = normalizeQbankAccess(row.qbank_access);
  return {
    plan: (paidActive ? "paid" : trialActive ? "trial" : "expired") as Entitlement["plan"],
    trial_started_at: row.trial_started_at,
    trial_ends_at: row.trial_ends_at,
    paid_until: row.paid_until,
    qbank_access: access,
    effective_access: isActive ? access : [],
    days_left: daysLeft,
    is_active: isActive,
  };
}

export const getMyEntitlement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Entitlement | null> => {
    const { data } = await context.supabase
      .from("user_entitlements")
      .select("plan,trial_started_at,trial_ends_at,paid_until,qbank_access")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!data) return null;
    return compute(data as any);
  });

/**
 * Server-only: throws if the current user cannot access the given qbank id.
 * Import inside handlers; do not call from client code.
 */
export async function assertQbankAccess(
  supabase: any,
  userId: string,
  qbankId: number,
): Promise<void> {
  const { data } = await supabase
    .from("user_entitlements")
    .select("plan,trial_started_at,trial_ends_at,paid_until,qbank_access")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("ACCESS_DENIED: no entitlement");
  const e = compute(data as any);
  const slug = QBANK_ID_TO_SLUG[qbankId];
  if (!e.is_active) throw new Error("ACCESS_DENIED: trial_expired");
  if (!slug || !e.effective_access.includes(slug))
    throw new Error(`ACCESS_DENIED: no_access_to_${slug ?? qbankId}`);
}

/**
 * Server-only: throws unless the user has an active plan for at least one
 * qbank. Used for the Medical Library, which is shared by Step 1/2 CK/3.
 */
export async function assertAnyQbankAccess(
  supabase: any,
  userId: string,
): Promise<void> {
  const { data } = await supabase
    .from("user_entitlements")
    .select("plan,trial_started_at,trial_ends_at,paid_until,qbank_access")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("ACCESS_DENIED: no entitlement");
  const e = compute(data as any);
  if (!e.is_active || e.effective_access.length === 0)
    throw new Error("ACCESS_DENIED: trial_expired");
}
