import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMyEntitlement } from "@/lib/entitlements.functions";
import { Check, Sparkles, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/upgrade")({
  head: () => ({
    meta: [
      { title: "Upgrade — IMD QBank" },
      { name: "description", content: "Choose a plan and keep practicing USMLE questions with full access." },
    ],
  }),
  component: UpgradePage,
});

type Tier = {
  key: string;
  name: string;
  months: number;
  price: string;
  perMonth: string;
  highlight?: boolean;
};

const step1: Tier[] = [
  { key: "s1-1", name: "1 month", months: 1, price: "$49", perMonth: "$49/mo" },
  { key: "s1-3", name: "3 months", months: 3, price: "$119", perMonth: "$39/mo", highlight: true },
  { key: "s1-6", name: "6 months", months: 6, price: "$199", perMonth: "$33/mo" },
  { key: "s1-12", name: "12 months", months: 12, price: "$299", perMonth: "$24/mo" },
];

const bundle: Tier[] = [
  { key: "all-3", name: "3 months (all Steps)", months: 3, price: "$199", perMonth: "$66/mo" },
  { key: "all-6", name: "6 months (all Steps)", months: 6, price: "$329", perMonth: "$54/mo", highlight: true },
  { key: "all-12", name: "12 months (all Steps)", months: 12, price: "$499", perMonth: "$41/mo" },
];

function UpgradePage() {
  const fn = useServerFn(getMyEntitlement);
  const { data: ent } = useQuery({ queryKey: ["my-entitlement"], queryFn: () => fn() });

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-6xl mx-auto p-6 md:p-10 space-y-8">
        <header className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium">
            <Sparkles className="h-3.5 w-3.5" /> Upgrade your access
          </div>
          <h1 className="text-3xl md:text-4xl font-bold">Choose your plan</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {ent?.plan === "trial" && ent.is_active
              ? `You have ${ent.days_left} day${ent.days_left === 1 ? "" : "s"} left on your free trial.`
              : ent?.plan === "expired"
              ? "Your free trial has ended. Pick a plan to continue where you left off."
              : "Full access to 16,000+ board-style questions, self-assessments, and AI analysis."}
          </p>
        </header>

        <section>
          <h2 className="text-xl font-semibold mb-4">Single QBank</h2>
          <div className="grid gap-4 md:grid-cols-4">
            {step1.map((t) => (
              <TierCard key={t.key} tier={t} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Same pricing applies for Step 2 CK or Step 3 individually.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">All-Steps Bundle (save 30%+)</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {bundle.map((t) => (
              <TierCard key={t.key} tier={t} />
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 text-primary grid place-items-center">
              <Mail className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Payments launching soon</h3>
              <p className="text-sm text-muted-foreground mt-1">
                We're finalizing our checkout. In the meantime, email us and we'll set up your account
                manually — usually within 24 hours.
              </p>
              <a
                href="mailto:support@imdqbank.com?subject=Upgrade%20request"
                className="inline-block mt-3"
              >
                <Button>Contact us to upgrade</Button>
              </a>
            </div>
          </div>
        </section>

        <p className="text-center text-xs text-muted-foreground">
          Questions? <Link to="/dashboard" className="underline hover:text-foreground">Back to dashboard</Link>
        </p>
      </div>
    </div>
  );
}

function TierCard({ tier }: { tier: Tier }) {
  return (
    <div
      className={`rounded-xl border p-5 bg-card ${
        tier.highlight ? "border-primary shadow-sm ring-1 ring-primary/20" : "border-border"
      }`}
    >
      {tier.highlight && (
        <div className="text-xs font-medium text-primary mb-2">Most popular</div>
      )}
      <div className="font-semibold">{tier.name}</div>
      <div className="mt-2">
        <span className="text-3xl font-bold">{tier.price}</span>
      </div>
      <div className="text-xs text-muted-foreground">{tier.perMonth}</div>
      <ul className="mt-4 space-y-1.5 text-sm">
        <li className="flex gap-2"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> Unlimited questions</li>
        <li className="flex gap-2"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> Performance analytics</li>
        <li className="flex gap-2"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> Flashcards & notes</li>
        <li className="flex gap-2"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> AI test analysis</li>
      </ul>
    </div>
  );
}
