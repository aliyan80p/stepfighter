import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { waLink, COURSES } from "@/lib/site";
import {
  CheckCircle2, BookOpen, Layers, BarChart3, Timer, Brain, ArrowRight, MessageCircle,
  ShieldCheck, GraduationCap, Trophy, Highlighter, StickyNote, FileText, Smartphone,
  Wallet, UserPlus, KeyRound,
} from "lucide-react";
import devicesHero from "@/assets/screens/devices-hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "StepFighter — USMLE Step 1, Step 2 CK & Step 3 QBank" },
      { name: "description", content: "High-yield USMLE preparation with 16,000+ board-style questions, NBME-style self-assessments, CMS forms and AI analytics for Step 1, Step 2 CK and Step 3." },
      { property: "og:title", content: "StepFighter — Sharper prep. Sharper score." },
      { property: "og:description", content: "16,000+ board-style USMLE questions across Step 1, Step 2 CK and Step 3, on desktop, iPad and mobile." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <SiteLayout>
      {/* HERO — clean, single column, big statement */}
      <section className="relative bg-white">
        <div className="max-w-6xl mx-auto px-4 pt-16 pb-10 md:pt-24 md:pb-14 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 border border-slate-200 rounded-full text-[11px] font-bold uppercase tracking-widest text-slate-600 mb-6">
            <Trophy className="h-3 w-3 text-amber-500" /> Built for the 2026 USMLE
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-[#0d2b4e] leading-tight max-w-4xl mx-auto">
            Start <span className="underline decoration-amber-400 decoration-[6px] underline-offset-4">fighting</span> for your
            USMLE score with the <span className="text-[#1a4b7c]">most high-yield</span> QBank.
          </h1>
          <p className="mt-6 text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            16,000+ board-style questions across Step 1, Step 2 CK and Step 3 — plus 40+ NBME-style self-assessments,
            22 CMS specialty forms and AI-verified explanations. Subscribe to just the Step you need.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/auth" search={{ mode: "signup" }}
              className="px-6 py-3 bg-[#1a4b7c] text-white font-bold rounded-md hover:bg-[#0d2b4e] transition-colors inline-flex items-center gap-2">
              Start Free Trial <ArrowRight className="h-4 w-4" />
            </Link>
            <a href={waLink("Hi, I want to register for StepFighter. Please guide me for activation.")}
              target="_blank" rel="noreferrer"
              className="px-6 py-3 bg-[#25D366] text-white font-bold rounded-md hover:opacity-90 inline-flex items-center gap-2">
              <MessageCircle className="h-4 w-4" /> Register on WhatsApp
            </a>
          </div>
          <div className="mt-6 flex flex-wrap justify-center items-center gap-x-6 gap-y-2 text-xs text-slate-500 font-semibold">
            <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> 14-day free trial</span>
            <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> No credit card needed</span>
            <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Instant activation</span>
          </div>
        </div>

        {/* Device showcase */}
        <div className="max-w-6xl mx-auto px-4 pb-16">
          <img
            src={devicesHero}
            alt="StepFighter USMLE QBank shown on laptop, iPad and iPhone"
            width={1600}
            height={1008}
            className="w-full h-auto rounded-xl"
          />
          <p className="mt-6 text-center text-xs uppercase tracking-widest font-bold text-slate-500">
            Fully responsive · Desktop · iPad · Android · iPhone · Works offline (PWA)
          </p>
        </div>
      </section>

      {/* Feature strip — UF style */}
      <section className="border-y border-slate-200 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 py-14 grid md:grid-cols-4 gap-8">
          {[
            { i: GraduationCap, t: "Tutor & Exam Modes", d: "Guided learning or full Prometric-style simulation — switch any time." },
            { i: Brain, t: "AI Performance Analytics", d: "Drill down by system, subject and topic to find your weak points." },
            { i: Layers, t: "Smart Flashcards", d: "SM-2 spaced repetition. Build decks from mistakes and notes automatically." },
            { i: Wallet, t: "Affordable Pricing", d: "Per-Step subscriptions from $29 — a fraction of the big brands." },
          ].map((f) => (
            <div key={f.t}>
              <div className="h-10 w-10 rounded-md bg-[#1a4b7c]/10 text-[#1a4b7c] grid place-items-center mb-3">
                <f.i className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-[#0d2b4e] mb-1">{f.t}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* About / all-in-one */}
      <section className="max-w-6xl mx-auto px-4 py-20 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-3">Why StepFighter</div>
          <h2 className="text-3xl md:text-4xl font-bold text-[#0d2b4e] leading-tight mb-5">
            An all-in-one USMLE question bank — built by physicians.
          </h2>
          <p className="text-slate-600 leading-relaxed mb-6">
            StepFighter is designed to make your prep smarter and more effective. AI-powered tools, dual
            study modes, a medical library, flashcards and a personalized study planner — all on desktop,
            tablet and mobile. Everything you need to master the USMLE in one place.
          </p>
          <ul className="space-y-4">
            {[
              { t: "Smarter learning with AI", d: "Personalized study plans, mistake-based flashcards and real-time feedback." },
              { t: "Two powerful study modes", d: "Tutor mode for guided learning, Exam mode for real-test simulation." },
              { t: "Fully integrated system", d: "Custom quizzes, medical library, notebook and analytics — one seamless platform." },
            ].map((v) => (
              <li key={v.t} className="flex gap-3">
                <div className="h-6 w-6 rounded-full bg-amber-400 text-[#0d2b4e] grid place-items-center flex-shrink-0 font-black text-xs">✓</div>
                <div>
                  <div className="font-bold text-[#0d2b4e]">{v.t}</div>
                  <div className="text-sm text-slate-600">{v.d}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { n: "16,000+", l: "Questions" },
            { n: "40+", l: "SA forms" },
            { n: "22", l: "CMS forms" },
            { n: "3", l: "Full Steps" },
          ].map((s) => (
            <div key={s.l} className="border border-slate-200 rounded-lg p-6 text-center hover:border-[#1a4b7c] transition-colors">
              <div className="text-3xl font-bold text-[#1a4b7c]">{s.n}</div>
              <div className="text-xs uppercase tracking-widest font-semibold text-slate-500 mt-1">{s.l}</div>
            </div>
          ))}
          <div className="col-span-2 border border-slate-200 rounded-lg p-6 bg-[#0d2b4e] text-white">
            <div className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-2">On the exam interface</div>
            <div className="flex flex-wrap gap-3 text-xs font-semibold">
              <span className="inline-flex items-center gap-1"><Highlighter className="h-3 w-3 text-amber-400" /> Multi-color highlights</span>
              <span className="inline-flex items-center gap-1"><StickyNote className="h-3 w-3 text-amber-400" /> Personal notes</span>
              <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3 text-amber-400" /> Lab values</span>
              <span className="inline-flex items-center gap-1"><Timer className="h-3 w-3 text-amber-400" /> Real timers</span>
              <span className="inline-flex items-center gap-1"><Smartphone className="h-3 w-3 text-amber-400" /> PWA install</span>
            </div>
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="bg-slate-50 border-y border-slate-200 py-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <div className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-3">Features</div>
            <h2 className="text-3xl md:text-4xl font-bold text-[#0d2b4e]">Everything you need in one platform</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { i: BookOpen, t: "Massive Question Library", d: "16,000+ questions from NBME-style banks, CMS forms and full-length self-assessments." },
              { i: BarChart3, t: "Detailed Explanations", d: "High-yield explanations with images, tables and clinical correlates for every option." },
              { i: Timer, t: "Real Exam Simulation", d: "Prometric-style interface with authentic timers, block navigation and question flagging." },
              { i: Layers, t: "Custom Test Builder", d: "Build blocks by system, subject, difficulty — unused, incorrect or flagged." },
              { i: ShieldCheck, t: "Regularly Updated", d: "Content reviewed and updated by USMLE-scoring physicians to match the latest outline." },
              { i: Smartphone, t: "Works On Any Device", d: "Responsive PWA on desktop, iPad, Android and iPhone. Install and study offline." },
            ].map((f) => (
              <div key={f.t} className="bg-white border border-slate-200 rounded-lg p-6 hover:border-[#1a4b7c] hover:shadow-md transition-all">
                <div className="h-11 w-11 rounded-md bg-[#1a4b7c]/10 text-[#1a4b7c] grid place-items-center mb-3">
                  <f.i className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-[#0d2b4e] mb-1">{f.t}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{f.d}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link to="/features" className="inline-flex items-center gap-1 text-[#1a4b7c] font-bold hover:gap-2 transition-all">
              Explore all QBank features <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Courses */}
      <section className="max-w-7xl mx-auto px-4 py-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-3">Courses</div>
          <h2 className="text-3xl md:text-4xl font-bold text-[#0d2b4e] mb-4">Pick the Step you need</h2>
          <p className="text-slate-600">Each Step is a standalone subscription. Preparing for two or three? The All-Steps Combo is the fastest path.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {COURSES.map((c, i) => (
            <div key={c.id} className={`rounded-lg p-6 border transition-all ${c.id === "combo" ? "bg-[#0d2b4e] text-white border-[#0d2b4e]" : "bg-white border-slate-200 hover:border-[#1a4b7c] hover:-translate-y-1"}`}>
              <div className={`text-xs font-mono mb-3 ${c.id === "combo" ? "text-amber-400" : "text-slate-400"}`}>0{i + 1}</div>
              <GraduationCap className={`h-8 w-8 mb-3 ${c.id === "combo" ? "text-amber-400" : "text-[#1a4b7c]"}`} />
              <h4 className={`text-xl font-bold mb-2 ${c.id === "combo" ? "text-white" : "text-[#0d2b4e]"}`}>{c.short}</h4>
              <p className={`text-sm leading-relaxed mb-4 ${c.id === "combo" ? "text-slate-300" : "text-slate-600"}`}>{c.blurb}</p>
              <div className={`text-xs font-bold uppercase tracking-widest mb-3 ${c.id === "combo" ? "text-amber-400" : "text-amber-600"}`}>{c.qcount}</div>
              <div className={`text-sm font-semibold ${c.id === "combo" ? "text-white" : "text-[#1a4b7c]"}`}>
                From ${c.price["6mo"].usd} <span className={`text-xs font-normal ${c.id === "combo" ? "text-slate-300" : "text-slate-500"}`}>/ 6 mo</span>
              </div>
            </div>
          ))}
        </div>
        <div className="text-center mt-10">
          <Link to="/pricing" className="inline-flex items-center gap-2 px-6 py-3 bg-[#1a4b7c] text-white font-bold rounded-md hover:bg-[#0d2b4e]">
            See full pricing <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* HOW REGISTRATION WORKS — Stepwise-style 4 steps */}
      <section className="bg-slate-50 border-y border-slate-200 py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-3">How Registration Works</div>
            <h2 className="text-3xl md:text-4xl font-bold text-[#0d2b4e] mb-3">Activate in minutes — no online checkout</h2>
            <p className="text-slate-600">We activate every account manually so you get personal onboarding and regional payment options.</p>
          </div>
          <div className="grid md:grid-cols-4 gap-5">
            {[
              { i: MessageCircle, t: "Message us", d: "Tap the WhatsApp button and send us your chosen Step and plan.", n: "1" },
              { i: Wallet, t: "Pay your way", d: "Local bank, Wise, JazzCash, Easypaisa, USDT or card — we accept most regional methods.", n: "2" },
              { i: KeyRound, t: "Get credentials", d: "We create your account within minutes during working hours and send login details.", n: "3" },
              { i: UserPlus, t: "Start studying", d: "Log in on any device or install the PWA and begin your first block right away.", n: "4" },
            ].map((s) => (
              <div key={s.n} className="bg-white rounded-lg border border-slate-200 p-6 relative">
                <div className="absolute -top-3 -left-3 h-8 w-8 rounded-full bg-amber-400 text-[#0d2b4e] font-black grid place-items-center text-sm">{s.n}</div>
                <s.i className="h-6 w-6 text-[#1a4b7c] mb-3" />
                <h3 className="font-bold text-[#0d2b4e] mb-1">{s.t}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <a href={waLink("Hi, I'd like to register for StepFighter. Please share available plans.")}
               target="_blank" rel="noreferrer"
               className="inline-flex items-center gap-2 px-6 py-3 bg-[#25D366] text-white font-bold rounded-md hover:opacity-90">
              <MessageCircle className="h-4 w-4" /> Chat with us on WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-[#0d2b4e] text-white">
        <div className="max-w-4xl mx-auto px-4 py-20 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to activate your StepFighter access?</h2>
          <p className="text-slate-300 mb-8">Start with a 14-day free trial or message us on WhatsApp to activate a paid plan instantly.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/auth" search={{ mode: "signup" }} className="px-8 py-4 bg-amber-400 text-[#0d2b4e] font-bold rounded-md hover:bg-white">
              Start Free Trial
            </Link>
            <a href={waLink("Hi, I want to activate my StepFighter account.")} target="_blank" rel="noreferrer"
               className="px-8 py-4 bg-[#25D366] text-white font-bold rounded-md hover:opacity-90 inline-flex items-center gap-2">
              <MessageCircle className="h-4 w-4" /> Activate via WhatsApp
            </a>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
