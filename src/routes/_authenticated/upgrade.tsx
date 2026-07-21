import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMyEntitlement } from "@/lib/entitlements.functions";
import { Check, Sparkles, MessageCircle, Mail, ShieldCheck, Zap } from "lucide-react";

export const Route = createFileRoute("/_authenticated/upgrade")({
  head: () => ({
    meta: [
      { title: "Pricing — StepFighter" },
      { name: "description", content: "One subscription. Full access to Step 1, Step 2 CK, and Step 3 QBanks, CMS forms, and NBME-style self-assessments." },
    ],
  }),
  component: UpgradePage,
});

// Change these to your real contact endpoints.
const WHATSAPP_NUMBER = "923000000000"; // international format, no +
const SUPPORT_EMAIL = "support@stepfighter.app";

const waLink = (plan: string) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    `Hello, I want to register for StepFighter. Plan selected: ${plan}. Please guide me for activation.`,
  )}`;

type Tier = {
  key: string;
  label: string;
  duration: string;
  price: string;
  perMonth: string;
  save?: string;
  highlight?: boolean;
  badge?: string;
  perks: string[];
};

const tiers: Tier[] = [
  {
    key: "3-months",
    label: "3 Months",
    duration: "3 Months",
    price: "PKR 4,500 / $18",
    perMonth: "PKR 1,500 / month",
    badge: "Flexible Start",
    perks: [
      "Full access to all QBanks",
      "CMS Forms + NBME-style assessments",
      "AI test analysis + score predictor",
      "Web, tablet & mobile access",
      "24/7 WhatsApp support",
    ],
  },
  {
    key: "6-months",
    label: "6 Months",
    duration: "6 Months",
    price: "PKR 7,000 / $28",
    perMonth: "PKR 1,167 / month",
    badge: "Most Popular",
    highlight: true,
    perks: [
      "Everything in 3 Months",
      "Priority activation",
      "Save vs. shorter plans",
      "Full exam-season coverage",
      "24/7 WhatsApp support",
    ],
  },
  {
    key: "12-months",
    label: "12 Months",
    duration: "12 Months",
    price: "PKR 12,000 / $48",
    perMonth: "PKR 1,000 / month",
    badge: "Best Value",
    save: "Save PKR 2,000",
    perks: [
      "Everything in 6 Months",
      "Best price per month",
      "Priority activation",
      "Long-term prep coverage",
      "24/7 WhatsApp support",
    ],
  },
];

function UpgradePage() {
  const fn = useServerFn(getMyEntitlement);
  const { data: ent } = useQuery({ queryKey: ["my-entitlement"], queryFn: () => fn() });

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-6xl mx-auto p-6 md:p-10 space-y-10">
        <header className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium">
            <Sparkles className="h-3.5 w-3.5" /> Simple pricing
          </div>
          <h1 className="text-3xl md:text-4xl font-bold">One plan. Full access.</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {ent?.plan === "trial" && ent.is_active
              ? `You have ${ent.days_left} day${ent.days_left === 1 ? "" : "s"} left on your free trial. Pick a plan below and message us on WhatsApp — we activate manually, usually within a few hours.`
              : ent?.plan === "expired"
              ? "Your free trial has ended. Pick a plan and message us on WhatsApp — we'll reactivate your account and you'll pick up right where you left off."
              : "No hidden fees. Every plan includes the full StepFighter experience — pick the duration that fits your exam timeline."}
          </p>
        </header>

        <section className="grid gap-5 md:grid-cols-3">
          {tiers.map((t) => (
            <TierCard key={t.key} tier={t} />
          ))}
        </section>

        <p className="text-center text-xs text-muted-foreground">
          Prices shown in PKR and USD. Message us for the exact amount and payment options available in your region.
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
                href={`mailto:${SUPPORT_EMAIL}?subject=Upgrade%20request`}
                className="mt-3 inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
              >
                <Mail className="h-4 w-4" /> {SUPPORT_EMAIL}
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

function TierCard({ tier }: { tier: Tier }) {
  return (
    <div
      className={`rounded-xl border p-6 bg-card flex flex-col ${
        tier.highlight ? "border-primary shadow-md ring-1 ring-primary/20" : "border-border"
      }`}
    >
      {tier.badge && (
        <div className={`text-xs font-medium mb-2 ${tier.highlight ? "text-primary" : "text-muted-foreground"}`}>
          {tier.badge}
        </div>
      )}
      <div className="font-semibold text-lg">{tier.duration}</div>
      <div className="mt-3">
        <span className="text-2xl font-bold">{tier.price}</span>
      </div>
      <div className="text-xs text-muted-foreground mt-1">{tier.perMonth}</div>
      {tier.save && (
        <div className="mt-1 inline-block text-xs font-medium text-emerald-600">{tier.save}</div>
      )}

      <ul className="mt-4 space-y-1.5 text-sm flex-1">
        {tier.perks.map((p) => (
          <li key={p} className="flex gap-2">
            <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> {p}
          </li>
        ))}
      </ul>

      <a
        href={waLink(tier.label)}
        target="_blank"
        rel="noopener noreferrer"
        className={`mt-5 inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold transition-colors ${
          tier.highlight
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "bg-foreground text-background hover:opacity-90"
        }`}
      >
        <MessageCircle className="h-4 w-4" /> Register on WhatsApp
      </a>
      <a
        href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Register — ${tier.label}`)}`}
        className="mt-2 text-center text-xs text-muted-foreground hover:text-foreground"
      >
        or email us
      </a>
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
