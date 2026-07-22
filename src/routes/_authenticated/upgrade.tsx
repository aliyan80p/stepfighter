import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getMyEntitlement } from "@/lib/entitlements.functions";
import { COURSES, durationLabel, waLink, SITE, type Duration } from "@/lib/site";
import { Check, Sparkles, MessageCircle, Mail, ShieldCheck, Zap } from "lucide-react";

export const Route = createFileRoute("/_authenticated/upgrade")({
  head: () => ({
    meta: [
      { title: "Pricing — StepFighter" },
      { name: "description", content: "Subscribe to a single Step — Step 1, Step 2 CK, or Step 3 — or grab the All-Steps Combo. 6-month and 12-month plans." },
    ],
  }),
  component: UpgradePage,
});

function UpgradePage() {
  const fn = useServerFn(getMyEntitlement);
  const { data: ent } = useQuery({ queryKey: ["my-entitlement"], queryFn: () => fn() });
  const [dur, setDur] = useState<Duration>("6mo");

  const individual = COURSES.filter((c) => c.id !== "combo");
  const combo = COURSES.find((c) => c.id === "combo")!;
  const singleTotal = individual.reduce((s, c) => s + c.price[dur].usd, 0);
  const comboPrice = combo.price[dur].usd;
  const savings = singleTotal - comboPrice;

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-6xl mx-auto p-6 md:p-10 space-y-10">
        <header className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium">
            <Sparkles className="h-3.5 w-3.5" /> Pick your Step
          </div>
          <h1 className="text-3xl md:text-4xl font-bold">Subscribe to just the Step you need.</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {ent?.plan === "trial" && ent.is_active
              ? `You have ${ent.days_left} day${ent.days_left === 1 ? "" : "s"} left on your free trial. Pick a plan below and message us on WhatsApp — we activate manually, usually within a few hours.`
              : ent?.plan === "expired"
              ? "Your free trial has ended. Pick a plan and message us on WhatsApp — we'll reactivate your account and you'll pick up right where you left off."
              : "Every Step is priced separately so you're not paying for content you don't need. Or grab the All-Steps Combo to unlock everything."}
          </p>

          <div className="inline-flex rounded-lg border border-border bg-card p-1 mt-2">
            {(["6mo", "12mo"] as Duration[]).map((d) => (
              <button
                key={d}
                onClick={() => setDur(d)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  dur === d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {durationLabel[d]}
              </button>
            ))}
          </div>
        </header>

        {/* Individual Step plans */}
        <section className="grid gap-5 md:grid-cols-3">
          {individual.map((c) => {
            const price = c.price[dur].usd;
            const perMonth = (price / (dur === "6mo" ? 6 : 12)).toFixed(2);
            return (
              <div key={c.id} className="rounded-xl border border-border bg-card p-6 flex flex-col">
                <div className="text-xs font-medium text-muted-foreground">{c.tagline}</div>
                <div className="font-semibold text-lg mt-1">{c.name}</div>
                <div className="mt-3">
                  <span className="text-3xl font-bold">${price}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">≈ ${perMonth} / month · {durationLabel[dur]}</div>
                <ul className="mt-4 space-y-1.5 text-sm flex-1">
                  {c.extras.map((p) => (
                    <li key={p} className="flex gap-2">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> {p}
                    </li>
                  ))}
                </ul>
                <a
                  href={waLink(`Hi, I'd like to subscribe to StepFighter — ${c.name}, ${durationLabel[dur]} ($${price}). Please guide me for activation.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex items-center justify-center gap-2 rounded-md bg-foreground text-background px-4 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  <MessageCircle className="h-4 w-4" /> Register on WhatsApp
                </a>
              </div>
            );
          })}
        </section>

        {/* Combo tier */}
        <section>
          <div className="rounded-xl border-2 border-primary bg-card p-6 md:p-8 shadow-md">
            <div className="grid md:grid-cols-2 gap-6 items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium mb-3">
                  <Sparkles className="h-3.5 w-3.5" /> Best value
                </div>
                <h3 className="text-2xl md:text-3xl font-bold mb-2">{combo.name}</h3>
                <p className="text-muted-foreground text-sm mb-4">{combo.blurb}</p>
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-bold">${comboPrice}</span>
                  <span className="text-sm text-muted-foreground line-through">${singleTotal}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  ≈ ${(comboPrice / (dur === "6mo" ? 6 : 12)).toFixed(2)} / month · {durationLabel[dur]}
                </div>
                {savings > 0 && (
                  <div className="mt-2 inline-block text-xs font-medium text-emerald-600">
                    Save ${savings} vs. buying separately
                  </div>
                )}
                <a
                  href={waLink(`Hi, I'd like the StepFighter All-Steps Combo — ${durationLabel[dur]} ($${comboPrice}). Please guide me for activation.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors"
                >
                  <MessageCircle className="h-4 w-4" /> Register on WhatsApp
                </a>
              </div>
              <ul className="space-y-1.5 text-sm">
                {combo.extras.map((p) => (
                  <li key={p} className="flex gap-2">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> {p}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <p className="text-center text-xs text-muted-foreground">
          Prices shown in USD. {SITE.currencyNote}.
        </p>

        <section className="grid gap-4 md:grid-cols-3">
          <InfoCard icon={<Zap className="h-5 w-5" />} title="Fast activation" body="Most accounts are unlocked within a few hours of payment confirmation." />
          <InfoCard icon={<ShieldCheck className="h-5 w-5" />} title="Guided setup" body="Our team walks you through payment and account activation end-to-end." />
          <InfoCard icon={<MessageCircle className="h-5 w-5" />} title="24/7 WhatsApp" body="Real humans, real fast — ping us any time on WhatsApp for help." />
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <div className="flex flex-col md:flex-row items-start gap-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 text-primary grid place-items-center">
              <Mail className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Prefer email?</h3>
              <p className="text-sm text-muted-foreground mt-1">
                No WhatsApp? Email us and we'll set up your account manually — usually within 24 hours.
              </p>
              <a
                href={`mailto:${SITE.email}?subject=Upgrade%20request`}
                className="mt-3 inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
              >
                <Mail className="h-4 w-4" /> {SITE.email}
              </a>
            </div>
          </div>
        </section>

        <p className="text-center text-xs text-muted-foreground">
          <Link to="/dashboard" className="underline hover:text-foreground">Back to dashboard</Link>
        </p>
      </div>
    </div>
  );
}

function InfoCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="h-9 w-9 rounded-full bg-primary/10 text-primary grid place-items-center mb-3">
        {icon}
      </div>
      <div className="font-semibold">{title}</div>
      <p className="text-sm text-muted-foreground mt-1">{body}</p>
    </div>
  );
}
