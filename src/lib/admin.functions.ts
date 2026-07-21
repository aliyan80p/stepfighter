import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export const isCurrentUserAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { admin: Boolean(data) };
  });

export type AdminAnalytics = {
  kpis: {
    totalUsers: number;
    signups7d: number;
    signups30d: number;
    activeTrials: number;
    paid: number;
    expired: number;
    conversionRate: number; // paid / (paid + expired)
    attempts7d: number;
    tests7d: number;
  };
  signupsByDay: { day: string; count: number }[];
  attemptsByDay: { day: string; step1: number; step2: number; step3: number }[];
  qbankAccess: { qbank: string; trial: number; paid: number }[];
  countries: { country: string; count: number }[];
};

export const getAdminAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminAnalytics> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const now = Date.now();
    const d7 = new Date(now - 7 * 86_400_000).toISOString();
    const d30 = new Date(now - 30 * 86_400_000).toISOString();

    // --- profiles / signups ---
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, created_at, country")
      .order("created_at", { ascending: false })
      .limit(50000);
    const profs = profiles ?? [];

    const signupsByDayMap = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * 86_400_000).toISOString().slice(0, 10);
      signupsByDayMap.set(d, 0);
    }
    let signups7d = 0;
    let signups30d = 0;
    for (const p of profs) {
      const iso = new Date(p.created_at as string).toISOString();
      if (iso >= d7) signups7d++;
      if (iso >= d30) {
        signups30d++;
        const day = iso.slice(0, 10);
        if (signupsByDayMap.has(day)) signupsByDayMap.set(day, (signupsByDayMap.get(day) ?? 0) + 1);
      }
    }
    const signupsByDay = Array.from(signupsByDayMap.entries()).map(([day, count]) => ({ day, count }));

    // --- entitlements ---
    const { data: ents } = await supabaseAdmin
      .from("user_entitlements")
      .select("user_id, plan, trial_ends_at, paid_until, qbank_access")
      .limit(50000);
    const rows = ents ?? [];
    let activeTrials = 0;
    let paid = 0;
    let expired = 0;
    const qbankMap: Record<string, { trial: number; paid: number }> = {
      "USMLE Step 1": { trial: 0, paid: 0 },
      "USMLE Step 2 CK": { trial: 0, paid: 0 },
      "USMLE Step 3": { trial: 0, paid: 0 },
    };
    const slugToLabel: Record<string, string> = {
      step1: "USMLE Step 1",
      step2: "USMLE Step 2 CK",
      step2ck: "USMLE Step 2 CK",
      step3: "USMLE Step 3",
    };
    for (const r of rows) {
      const isPaid = r.plan === "paid" && (!r.paid_until || new Date(r.paid_until as string).getTime() > now);
      const isTrial =
        r.plan === "trial" && r.trial_ends_at && new Date(r.trial_ends_at as string).getTime() > now;
      if (isPaid) paid++;
      else if (isTrial) activeTrials++;
      else expired++;

      const access = (r.qbank_access as string[] | null) ?? [];
      for (const slug of access) {
        const label = slugToLabel[slug] ?? slug;
        if (!qbankMap[label]) qbankMap[label] = { trial: 0, paid: 0 };
        if (isPaid) qbankMap[label].paid++;
        else if (isTrial) qbankMap[label].trial++;
      }
    }
    const qbankAccess = Object.entries(qbankMap).map(([qbank, v]) => ({ qbank, ...v }));

    // --- attempts / tests ---
    const { data: attempts } = await supabaseAdmin
      .from("attempts")
      .select("qbank_id, created_at")
      .gte("created_at", d30)
      .limit(200000);
    const at = attempts ?? [];
    const qbankNameById: Record<number, "step1" | "step2" | "step3"> = { 1: "step2", 2: "step1", 3: "step3" };
    const attemptsMap = new Map<string, { step1: number; step2: number; step3: number }>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * 86_400_000).toISOString().slice(0, 10);
      attemptsMap.set(d, { step1: 0, step2: 0, step3: 0 });
    }
    let attempts7d = 0;
    for (const a of at) {
      const iso = new Date(a.created_at as string).toISOString();
      if (iso >= d7) attempts7d++;
      const day = iso.slice(0, 10);
      const bucket = attemptsMap.get(day);
      if (!bucket) continue;
      const key = qbankNameById[a.qbank_id as number];
      if (key) bucket[key]++;
    }
    const attemptsByDay = Array.from(attemptsMap.entries()).map(([day, v]) => ({ day, ...v }));

    const { count: tests7d } = await supabaseAdmin
      .from("tests")
      .select("id", { count: "exact", head: true })
      .gte("created_at", d7);

    // --- countries ---
    const countryMap = new Map<string, number>();
    for (const p of profs) {
      const c = (p.country as string | null)?.trim() || "Unknown";
      countryMap.set(c, (countryMap.get(c) ?? 0) + 1);
    }
    const countries = Array.from(countryMap.entries())
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const conversionRate = paid + expired > 0 ? paid / (paid + expired) : 0;

    return {
      kpis: {
        totalUsers: profs.length,
        signups7d,
        signups30d,
        activeTrials,
        paid,
        expired,
        conversionRate,
        attempts7d,
        tests7d: tests7d ?? 0,
      },
      signupsByDay,
      attemptsByDay,
      qbankAccess,
      countries,
    };
  });
