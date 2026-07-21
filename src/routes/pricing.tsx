import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { waLink, SITE } from "@/lib/site";
import { CheckCircle2, MessageCircle, Mail, ShieldCheck, Zap } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — StepFighter USMLE QBank" },
      { name: "description", content: "Affordable USMLE preparation. 6-month and 12-month subscriptions with full access to Step 1, Step 2 CK, Step 3 and all self-assessments." },
      { property: "og:title", content: "StepFighter Pricing" },
      { property: "og:description", content: "Affordable, flat-rate USMLE prep. Register instantly on WhatsApp." },
    ],
  }),
  component: Pricing,
});

const tiers = [
  {
    d: "6 Months", p: "$39", pkr: "PKR 9,750", per: "$6.50 / mo",
    perks: ["Full access to all QBanks", "All CMS + NBME forms", "AI analytics + predictor", "WhatsApp support", "Free content updates"],
    pop: false,
  },
  {
    d: "12 Months", p: "$59", pkr: "PKR 14,750", per: "$4.92 / mo",
    perks: ["Everything in 6 Months", "Save 25% vs 6-month plan", "Priority WhatsApp support", "Free content updates", "Best value for full prep cycle"],
    pop: true, save: "Save 25%",
  },
];

function Pricing() {
  return (
    <SiteLayout>
      <section className="bg-gradient-to-br from-[#0d2b4e] to-[#1a4b7c] text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-3">Pricing</div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Simple, affordable pricing</h1>
          <p className="text-lg text-slate-200">One subscription. Full access to every Step, every self-assessment, every CMS form.</p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 gap-6">
          {tiers.map((t) => (
            <div key={t.d} className={`relative rounded-xl p-8 border-2 ${t.pop ? "border-amber-400 shadow-2xl bg-white" : "border-slate-200 bg-white"}`}>
              {t.pop && <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-400 text-[#0d2b4e] text-xs font-black px-4 py-1 rounded-full">MOST POPULAR</div>}
              <div className="text-sm font-bold text-[#1a4b7c] uppercase tracking-widest mb-2">{t.d}</div>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold text-[#0d2b4e]">{t.p}</span>
                <span className="text-slate-500 text-sm">USD</span>
              </div>
              <div className="text-sm text-slate-500 mb-1">{t.pkr}</div>
              <div className="text-xs text-slate-400 mb-4">{t.per}</div>
              {t.save && <div className="inline-block px-2 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded mb-4">{t.save}</div>}
              <ul className="space-y-3 text-sm mb-8">
                {t.perks.map((p) => (
                  <li key={p} className="flex gap-2 text-slate-700">
                    <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
              <a href={waLink(`Hello, I want to subscribe to StepFighter ${t.d} plan.`)} target="_blank" rel="noreferrer"
                 className={`block text-center py-3 rounded-md font-bold text-white ${t.pop ? "bg-[#25D366] hover:opacity-90" : "bg-[#1a4b7c] hover:bg-[#0d2b4e]"}`}>
                <MessageCircle className="h-4 w-4 inline mr-2" /> Register on WhatsApp
              </a>
              <a href={`mailto:${SITE.email}?subject=StepFighter ${t.d} Subscription`}
                 className="block text-center py-2 mt-2 text-sm text-slate-600 hover:text-[#1a4b7c]">
                <Mail className="h-4 w-4 inline mr-1" /> or email us
              </a>
            </div>
          ))}
        </div>

        <div className="mt-12 bg-slate-50 rounded-lg p-8 border border-slate-200">
          <h2 className="font-bold text-[#0d2b4e] text-xl mb-4">How registration works</h2>
          <ol className="space-y-3 text-sm text-slate-700">
            <li><b>1.</b> Click "Register on WhatsApp" — we'll respond within minutes.</li>
            <li><b>2.</b> Choose your payment method: bank transfer (PK), EasyPaisa/JazzCash, Wise, or crypto.</li>
            <li><b>3.</b> Send payment confirmation. We activate your account within 1–4 hours.</li>
            <li><b>4.</b> Log in and start practicing immediately.</li>
          </ol>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mt-12">
          {[
            { i: Zap, t: "Instant activation", d: "Account live within hours of payment confirmation." },
            { i: ShieldCheck, t: "3-day refund", d: "Full refund within 3 days if the platform isn't right for you." },
            { i: MessageCircle, t: "Human support", d: "Real physicians on WhatsApp — not a chatbot." },
          ].map((b) => (
            <div key={b.t} className="text-center p-6">
              <b.i className="h-8 w-8 text-[#1a4b7c] mx-auto mb-3" />
              <div className="font-bold text-[#0d2b4e] mb-1">{b.t}</div>
              <div className="text-sm text-slate-600">{b.d}</div>
            </div>
          ))}
        </div>

        <div className="text-center mt-8 text-sm text-slate-600">
          Prefer to try before you buy? <Link to="/auth" search={{ mode: "signup" }} className="text-[#1a4b7c] font-semibold hover:underline">Start a 14-day free trial</Link>.
        </div>
      </section>
    </SiteLayout>
  );
}
