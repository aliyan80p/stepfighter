import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyEntitlement } from "@/lib/entitlements.functions";
import { COURSES, SITE, waLink, durationLabel, type Duration, type Course } from "@/lib/site";
import { CreditCard, MessageCircle, Mail, X, Sparkles, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/subscribe-renew")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Subscribe or Renew — StepFighter" },
      { name: "description", content: "Renew your StepFighter QBank subscription or add access to another USMLE Step." },
    ],
  }),
  component: SubscribeRenewPage,
});

// Map entitlement slug → COURSES id
const SLUG_TO_COURSE_ID: Record<string, Course["id"]> = {
  step1: "step1",
  step2: "step2ck",
  step3: "step3",
};

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

function SubscribeRenewPage() {
  const entFn = useServerFn(getMyEntitlement);
  const entQ = useQuery({ queryKey: ["my-entitlement"], queryFn: () => entFn(), staleTime: 0 });

  const [profile, setProfile] = useState<{ email: string; name: string }>({ email: "", name: "" });
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const email = u.user?.email ?? "";
      const { data: p } = await supabase.from("profiles").select("full_name,display_name").eq("id", u.user?.id ?? "").maybeSingle();
      setProfile({ email, name: p?.full_name || p?.display_name || "" });
    })();
  }, []);

  const ent = entQ.data;
  const ownedIds = useMemo<Course["id"][]>(() => {
    const slugs = ent?.qbank_access ?? [];
    const ids = slugs.map((s) => SLUG_TO_COURSE_ID[s]).filter(Boolean) as Course["id"][];
    // If owns all three individually, also treat combo as owned
    if (ids.includes("step1") && ids.includes("step2ck") && ids.includes("step3")) {
      if (!ids.includes("combo")) ids.push("combo");
    }
    return Array.from(new Set(ids));
  }, [ent]);

  const activeSubs = useMemo(() => {
    return COURSES.filter((c) => c.id !== "combo" && ownedIds.includes(c.id)).map((c) => ({
      course: c,
      start: ent?.trial_started_at ?? null,
      end: ent?.plan === "paid" ? ent.paid_until : ent?.trial_ends_at ?? null,
      isTrial: ent?.plan === "trial",
      isExpired: ent?.plan === "expired",
    }));
  }, [ownedIds, ent]);

  const addable = COURSES.filter((c) => !ownedIds.includes(c.id));

  const [modal, setModal] = useState<{ mode: "renew" | "subscribe"; course: Course } | null>(null);
  const [step, setStep] = useState<"duration" | "details">("duration");
  const [duration, setDuration] = useState<Duration>("6mo");
  const [form, setForm] = useState({ name: "", email: "", phone: "" });

  useEffect(() => {
    if (modal) {
      setStep("duration");
      setDuration("6mo");
      setForm({ name: profile.name, email: profile.email, phone: "" });
    }
  }, [modal, profile]);

  const closeModal = () => setModal(null);

  const buildWaMessage = () => {
    if (!modal) return "";
    const price = modal.course.price[duration].usd;
    return [
      `Hello StepFighter — I'd like to ${modal.mode === "renew" ? "renew" : "subscribe to"} the ${modal.course.name} QBank.`,
      "",
      `Plan: ${modal.course.name} — ${durationLabel[duration]} ($${price} USD)`,
      `Name: ${form.name || "—"}`,
      `Email: ${form.email || "—"}`,
      `Phone: ${form.phone || "—"}`,
      "",
      "Please share payment details for activation.",
    ].join("\n");
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">
        <header className="rounded-2xl bg-gradient-to-br from-[hsl(210_60%_25%)] to-[hsl(210_70%_18%)] text-white p-8 text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-white/10 grid place-items-center mb-4">
            <CreditCard className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-bold">Subscription Details</h1>
          <p className="text-white/80 mt-1">Manage your subscriptions</p>
        </header>

        {/* Active Subscriptions */}
        <section className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 p-5 border-b border-border">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/15 text-emerald-600 grid place-items-center">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold">Active Subscriptions</div>
              <div className="text-xs text-muted-foreground">Manage your subscription plans</div>
            </div>
          </div>

          {entQ.isLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
          ) : activeSubs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No active subscriptions yet. Pick a course below to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left p-3">Subscription Title</th>
                    <th className="text-left p-3">Start Date</th>
                    <th className="text-left p-3">End Date</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-right p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeSubs.map((s) => (
                    <tr key={s.course.id} className="border-t border-border">
                      <td className="p-3 font-medium">
                        {s.course.name} QBank {s.isTrial ? <span className="ml-1 text-xs text-amber-600">(Trial)</span> : null}
                      </td>
                      <td className="p-3 text-muted-foreground">{fmtDate(s.start)}</td>
                      <td className="p-3 text-muted-foreground">{fmtDate(s.end)}</td>
                      <td className="p-3">
                        {s.isExpired ? (
                          <span className="inline-flex items-center rounded-full bg-rose-500/10 text-rose-600 px-2 py-0.5 text-xs font-medium">Expired</span>
                        ) : s.isTrial ? (
                          <span className="inline-flex items-center rounded-full bg-amber-500/10 text-amber-600 px-2 py-0.5 text-xs font-medium">Trial</span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-emerald-500/10 text-emerald-600 px-2 py-0.5 text-xs font-medium">Active</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => setModal({ mode: "renew", course: s.course })}
                          className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold hover:bg-primary/90"
                        >
                          Select renewal plan
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Add New Membership */}
        {addable.length > 0 && (
          <section className="rounded-2xl bg-card border border-border shadow-sm p-5">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold">Add New Membership</div>
                <div className="text-xs text-muted-foreground">Purchase new premium steps and study packages</div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {addable.map((c) => (
                <div key={c.id} className="rounded-xl border border-border bg-background p-5 flex flex-col">
                  <div className="font-semibold">{c.name} QBank</div>
                  <p className="text-sm text-muted-foreground mt-1 flex-1">{c.blurb}</p>
                  <div className="mt-3 text-sm">
                    <span className="text-lg font-bold">${c.price["6mo"].usd}</span>
                    <span className="text-muted-foreground"> / 6 mo</span>
                    <span className="mx-2 text-muted-foreground">·</span>
                    <span className="text-lg font-bold">${c.price["12mo"].usd}</span>
                    <span className="text-muted-foreground"> / 12 mo</span>
                  </div>
                  <button
                    onClick={() => setModal({ mode: "subscribe", course: c })}
                    className="mt-4 inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 text-white px-4 py-2 text-sm font-semibold hover:bg-emerald-700"
                  >
                    Subscribe Now
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <p className="text-center text-xs text-muted-foreground">
          <Link to="/dashboard" className="underline hover:text-foreground">Back to dashboard</Link>
        </p>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={closeModal}>
          <div
            className="w-full max-w-md rounded-2xl bg-background shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border bg-primary text-primary-foreground">
              <div className="flex items-center gap-2 font-semibold">
                <CreditCard className="h-4 w-4" />
                {step === "duration"
                  ? modal.mode === "renew" ? "Select Renewal Package" : "Select Subscription Package"
                  : `Payment Details — ${durationLabel[duration]}`}
              </div>
              <button onClick={closeModal} aria-label="Close" className="p-1 hover:bg-white/10 rounded">
                <X className="h-4 w-4" />
              </button>
            </div>

            {step === "duration" ? (
              <div className="p-5 space-y-3">
                <div className="text-sm text-muted-foreground text-center mb-2">
                  {modal.course.name} QBank — Choose Duration
                </div>
                {(Object.keys(modal.course.price) as Duration[]).map((d) => {
                  const price = modal.course.price[d].usd;
                  const isBest = d === "12mo";
                  return (
                    <button
                      key={d}
                      onClick={() => { setDuration(d); setStep("details"); }}
                      className={`w-full flex items-center justify-between rounded-xl border-2 p-4 text-left transition-colors ${
                        isBest ? "border-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/10" : "border-border hover:border-primary hover:bg-primary/5"
                      }`}
                    >
                      <div>
                        <div className="font-semibold flex items-center gap-2">
                          {durationLabel[d]}
                          {isBest && (
                            <span className="text-[10px] font-bold uppercase tracking-wide bg-emerald-500 text-white rounded-full px-2 py-0.5">
                              Best Value
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">${(price / (d === "6mo" ? 6 : 12)).toFixed(2)} / month</div>
                      </div>
                      <div className="text-xl font-bold">${price.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">USD</span></div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <form
                className="p-5 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  window.open(waLink(buildWaMessage()), "_blank", "noopener,noreferrer");
                }}
              >
                <Field label="Full Name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Enter your name" required />
                <Field label="Email Address" value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} placeholder="you@email.com" type="email" required />
                <Field label="Phone Number (WhatsApp)" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} placeholder="+1 555 123 4567" required />

                <div className="rounded-lg bg-muted/50 p-3 text-sm flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-600" />
                  <span>
                    Total: <span className="font-bold">${modal.course.price[duration].usd}.00 USD</span> ({durationLabel[duration]})
                  </span>
                </div>

                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 text-white px-4 py-2.5 text-sm font-semibold hover:bg-emerald-700"
                >
                  <MessageCircle className="h-4 w-4" /> Pay via WhatsApp
                </button>
                <a
                  href={`mailto:${SITE.email}?subject=${encodeURIComponent(`${modal.mode === "renew" ? "Renew" : "Subscribe"} — ${modal.course.name} (${durationLabel[duration]})`)}&body=${encodeURIComponent(buildWaMessage())}`}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-input px-4 py-2 text-xs font-medium hover:bg-accent"
                >
                  <Mail className="h-3.5 w-3.5" /> or email {SITE.email}
                </a>
                <button type="button" onClick={() => setStep("duration")} className="w-full text-center text-xs text-muted-foreground hover:text-foreground">
                  ← Change duration
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", required }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <label className="block">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
    </label>
  );
}
