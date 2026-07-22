import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { waLink, SITE, COURSES, durationLabel, type Duration } from "@/lib/site";
import {
  CheckCircle2,
  MessageCircle,
  Mail,
  ShieldCheck,
  Zap,
  Crown,
  Layers,
  Brain,
  RotateCcw,
  Library,
  BookOpen,
  Users,
  Sparkles,
  Headphones,
} from "lucide-react";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Pick Your USMLE Step | StepFighter" },
      { name: "description", content: "Subscribe to just the Step you're preparing for — Step 1, Step 2 CK or Step 3 — or grab the All-Steps Combo. Simple 6-month and 12-month plans, activated on WhatsApp." },
      { property: "og:title", content: "StepFighter Pricing — per-Step plans" },
      { property: "og:description", content: "Choose one Step or bundle all three. Transparent USD pricing, instant WhatsApp activation." },
    ],
  }),
  component: Pricing,
});

function Pricing() {
  const [dur, setDur] = useState<Duration>("12mo");

  const individual = COURSES.filter((c) => c.id !== "combo");
  const combo = COURSES.find((c) => c.id === "combo")!;

  return (
    <SiteLayout>
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#0d2b4e] to-[#1a4b7c] text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-3">Pricing</div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Only pay for the Step you're taking</h1>
          <p className="text-lg text-slate-200 max-w-2xl mx-auto">
            Every Step is priced separately so you're not paying for content you don't need.
            Preparing for more than one? The All-Steps Combo saves you up to 33%.
          </p>

          {/* Duration switch */}
          <div className="mt-8 inline-flex bg-white/10 border border-white/20 rounded-full p-1">
            {(["6mo", "12mo"] as Duration[]).map((d) => (
              <button
                key={d}
                onClick={() => setDur(d)}
                className={`px-5 py-2 text-sm font-bold rounded-full transition-all ${
                  dur === d ? "bg-amber-400 text-[#0d2b4e]" : "text-white hover:bg-white/10"
                }`}
              >
                {durationLabel[d]}
                {d === "12mo" && <span className="ml-2 text-[10px] font-black">SAVE ~30%</span>}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Individual Steps */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-10">
          <div className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-2">Single Step</div>
          <h2 className="text-2xl md:text-3xl font-bold text-[#0d2b4e]">Preparing for one exam?</h2>
          <p className="text-slate-600 mt-2 text-sm">Full access to just that Step — questions, self-assessments, and analytics.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {individual.map((c) => {
            const price = c.price[dur];
            const perMonth = (price.usd / (dur === "6mo" ? 6 : 12)).toFixed(2);
            return (
              <div key={c.id} className="rounded-xl p-7 border-2 border-slate-200 bg-white hover:border-[#1a4b7c] hover:shadow-lg transition-all flex flex-col">
                <div className="text-sm font-bold text-[#1a4b7c] uppercase tracking-widest mb-1">{c.short}</div>
                <div className="text-xs text-slate-500 mb-4">{c.tagline}</div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-bold text-[#0d2b4e]">${price.usd}</span>
                  <span className="text-slate-500 text-sm">USD</span>
                </div>
                <div className="text-xs text-slate-400 mb-5">≈ ${perMonth} / month · {durationLabel[dur]}</div>

                <ul className="space-y-2 text-sm text-slate-700 mb-6 flex-1">
                  {c.extras.map((e) => (
                    <li key={e} className="flex gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span>{e}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href={waLink(`Hi, I'd like to subscribe to StepFighter — ${c.name}, ${durationLabel[dur]} ($${price.usd}). Please guide me for activation.`)}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-center py-3 rounded-md font-bold text-white bg-[#25D366] hover:opacity-90"
                >
                  <MessageCircle className="h-4 w-4 inline mr-2" /> Register on WhatsApp
                </a>
              </div>
            );
          })}
        </div>
      </section>

      {/* Combo tier */}
      <section className="max-w-6xl mx-auto px-4 pb-16">
        <div className="text-center mb-8">
          <div className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-2">Best Value</div>
          <h2 className="text-2xl md:text-3xl font-bold text-[#0d2b4e]">Taking two or three Steps?</h2>
        </div>

        {(() => {
          const price = combo.price[dur];
          const singleTotal = individual.reduce((s, c) => s + c.price[dur].usd, 0);
          const savings = singleTotal - price.usd;
          const perMonth = (price.usd / (dur === "6mo" ? 6 : 12)).toFixed(2);
          return (
            <div className="relative rounded-2xl overflow-hidden border-2 border-amber-400 shadow-2xl bg-gradient-to-br from-[#0d2b4e] to-[#1a4b7c] text-white">
              <div className="absolute top-0 right-0 bg-amber-400 text-[#0d2b4e] text-xs font-black px-4 py-1 uppercase tracking-widest">
                Save ${savings}
              </div>
              <div className="grid md:grid-cols-2 gap-8 p-8 md:p-10">
                <div>
                  <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-widest mb-3">
                    <Crown className="h-4 w-4" /> All-Steps Combo
                  </div>
                  <h3 className="text-3xl font-bold mb-3">Every Step. Every form. One price.</h3>
                  <p className="text-slate-200 text-sm leading-relaxed mb-4">
                    {combo.blurb} Priced ~{Math.round((savings / singleTotal) * 100)}% below buying
                    each Step separately.
                  </p>
                  <div className="flex items-baseline gap-2 mt-6">
                    <span className="text-5xl font-bold">${price.usd}</span>
                    <span className="text-slate-300 text-sm">USD · {durationLabel[dur]}</span>
                  </div>
                  <div className="text-xs text-slate-300 mt-1">
                    ≈ ${perMonth}/month · buying separately: ${singleTotal}
                  </div>
                </div>

                <div>
                  <ul className="space-y-2 text-sm mb-6">
                    {combo.extras.map((e) => (
                      <li key={e} className="flex gap-2">
                        <CheckCircle2 className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                        <span>{e}</span>
                      </li>
                    ))}
                  </ul>
                  <a
                    href={waLink(`Hi, I'd like the StepFighter All-Steps Combo — ${durationLabel[dur]} ($${price.usd}). Please guide me for activation.`)}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-center py-3 rounded-md font-black bg-amber-400 text-[#0d2b4e] hover:bg-white"
                  >
                    <MessageCircle className="h-4 w-4 inline mr-2" /> Register Combo on WhatsApp
                  </a>
                  <a href={`mailto:${SITE.email}?subject=StepFighter Combo Subscription`}
                    className="block text-center py-2 mt-2 text-xs text-slate-300 hover:text-white">
                    <Mail className="h-4 w-4 inline mr-1" /> or email us
                  </a>
                </div>
              </div>
            </div>
          );
        })()}
      </section>

      {/* Included features */}
      <section className="max-w-6xl mx-auto px-4 pb-16">
        <div className="text-center mb-10">
          <div className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-2">Included in every plan</div>
          <h2 className="text-2xl md:text-3xl font-bold text-[#0d2b4e]">Everything your prep needs</h2>
          <p className="text-slate-600 mt-2 text-sm max-w-2xl mx-auto">
            No tiers, no hidden add-ons. Every subscription unlocks the full feature set below.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { i: Zap, t: "AI Test Analysis", d: "After each test, AI breaks down your mistakes by subject, system and difficulty, then suggests targeted next steps." },
            { i: RotateCcw, t: "Unlimited Quiz Resets & Custom Quizzes", d: "Retake any block as many times as you want and build custom quizzes by subject or system." },
            { i: Library, t: "Flashcards (Manual)", d: "Create your own decks and cards from questions you flag or answer incorrectly." },
            { i: BookOpen, t: "Integrated Medical Library", d: "Quick-reference medical notes, lab values, and high-yield facts integrated into your study flow." },
            { i: Users, t: "Peer Ranking & Progress Tracking", d: "Compare your percentile against other students and track your progress across subjects." },
            { i: Sparkles, t: "Free Updates During Subscription", d: "Every new question, form, and correction lands in your account automatically." },
            { i: Headphones, t: "WhatsApp & Email Support", d: "Reach us on WhatsApp or email for account, content, or technical help." },
          ].map((f) => (
            <div key={f.t} className="flex items-start gap-3 p-4 rounded-lg border border-slate-200 bg-white">
              <div className="h-10 w-10 rounded-lg bg-[#1a4b7c]/10 flex items-center justify-center flex-shrink-0">
                <f.i className="h-5 w-5 text-[#1a4b7c]" />
              </div>
              <div>
                <div className="font-bold text-[#0d2b4e] text-sm leading-tight">{f.t}</div>
                <div className="text-xs text-slate-600 mt-1 leading-relaxed">{f.d}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-slate-50 border-y border-slate-200 py-16">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="font-bold text-[#0d2b4e] text-2xl mb-8 text-center">Four steps from click to first block</h2>
          <div className="grid md:grid-cols-4 gap-4">
            {[
              { n: 1, t: "Pick your Step", d: "Choose the Step and duration that matches your test timeline." },
              { n: 2, t: "Ping us on WhatsApp", d: "Tap the button — a pre-filled message opens with your plan attached." },
              { n: 3, t: "Confirm payment", d: "We share regional options: bank transfer, EasyPaisa, JazzCash, Wise, crypto." },
              { n: 4, t: "Study within hours", d: "Your account goes live fast, usually the same day during working hours." },
            ].map((s) => (
              <div key={s.n} className="bg-white p-6 rounded-lg border border-slate-200">
                <div className="h-8 w-8 rounded-full bg-[#1a4b7c] text-white font-bold grid place-items-center mb-3">{s.n}</div>
                <div className="font-bold text-[#0d2b4e] text-sm mb-1">{s.t}</div>
                <p className="text-xs text-slate-600 leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Value strip */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { i: Zap, t: "Same-day activation", d: "Most accounts are live within hours of payment confirmation." },
            { i: ShieldCheck, t: "8-day free trial", d: "Try every feature before you pay. No card required, no auto-renewal." },
            { i: Layers, t: "Free content updates", d: "Every new form, question and correction lands in your account automatically." },
          ].map((b) => (
            <div key={b.t} className="text-center p-6">
              <b.i className="h-8 w-8 text-[#1a4b7c] mx-auto mb-3" />
              <div className="font-bold text-[#0d2b4e] mb-1">{b.t}</div>
              <div className="text-sm text-slate-600">{b.d}</div>
            </div>
          ))}
        </div>

        <div className="text-center mt-8 text-sm text-slate-600">
          Want to test-drive first? <Link to="/auth" search={{ mode: "signup" }} className="text-[#1a4b7c] font-semibold hover:underline">Start an 8-day free trial</Link> — no card, no commitment.
        </div>
      </section>
    </SiteLayout>
  );
}
