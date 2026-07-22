import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { waLink, COURSES } from "@/lib/site";
import {
  CheckCircle2, BookOpen, Layers, BarChart3, Timer, Brain, ArrowRight, MessageCircle,
  ShieldCheck, GraduationCap, Trophy, Highlighter, StickyNote, FileText, Smartphone,
  Wallet, UserPlus, KeyRound,
} from "lucide-react";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "StepFighter — USMLE Step 1, Step 2 CK & Step 3 QBank" },
      { name: "description", content: "High-yield medical board prep with board-style questions, NBME-style self-assessments, CMS forms and AI analytics for Step 1, Step 2 CK and Step 3." },
      { property: "og:title", content: "StepFighter — Sharper prep. Sharper score." },
      { property: "og:description", content: "Board-style USMLE questions across Step 1, Step 2 CK and Step 3, on desktop, iPad and mobile." },
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
            Train like a fighter. <span className="underline decoration-amber-400 decoration-[6px] underline-offset-4">Score like a surgeon.</span>
            <br className="hidden md:block" />
            Step-by-step board prep on <span className="text-[#1a4b7c]">your terms</span>.
          </h1>
          <p className="mt-6 text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Board-style questions across Step 1, Step 2 CK and Step 3 — plus NBME-style self-assessments,
            CMS specialty forms and AI-verified explanations. Subscribe to just the Step you need.
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

        {/* Device showcase — real screenshots from the live app */}
        <div className="max-w-7xl mx-auto px-4 pb-16">
          <div className="relative flex items-end justify-center gap-4 md:gap-6">
            {/* Ambient glow */}
            <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
              <div className="h-[420px] w-[420px] rounded-full bg-amber-300/25 blur-3xl sf-glow-pulse" />
            </div>

            {/* iPhone — exam mode */}
            <div className="hidden sm:block sf-fade-up" style={{ animationDelay: "0.25s" }}>
              <div className="sf-float-slower will-change-transform w-[110px] md:w-[150px] lg:w-[180px] shrink-0 rounded-[26px] bg-slate-900 p-1.5 shadow-2xl ring-1 ring-slate-800 mb-8">
                <div className="rounded-[20px] overflow-hidden bg-white aspect-[9/19]">
                  <img
                    src="/__l5e/assets-v1/3101a121-ca59-4b1c-920d-a4c823eb2f72/iphone-exam-question.jpg"
                    alt="StepFighter exam mode question on iPhone"
                    className="w-full h-full object-cover object-top"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>

            {/* Laptop — dashboard */}
            <div className="relative flex-1 max-w-[720px] sf-fade-up" style={{ animationDelay: "0.05s" }}>
              <div className="sf-float-slow will-change-transform">
                <div className="rounded-t-xl bg-slate-900 p-2.5 shadow-2xl ring-1 ring-slate-800">
                  <div className="flex items-center gap-1.5 mb-2 px-2">
                    <span className="h-2 w-2 rounded-full bg-red-400" />
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  </div>
                  <div className="rounded-md overflow-hidden bg-white aspect-[16/10]">
                    <img
                      src="/__l5e/assets-v1/53f16ac0-7b02-40f1-bae2-2ba6155ac922/desktop_dashboard.png"
                      alt="StepFighter USMLE dashboard on laptop"
                      className="w-full h-full object-cover object-top"
                      loading="eager"
                    />
                  </div>
                </div>
                <div className="h-3 bg-slate-800 rounded-b-xl mx-[-8px]" />
                <div className="h-1 bg-slate-700 rounded-b-full mx-auto w-24" />
              </div>
            </div>

            {/* iPad — tutor mode */}
            <div className="hidden md:block sf-fade-up" style={{ animationDelay: "0.15s" }}>
              <div className="sf-float-slow will-change-transform w-[200px] lg:w-[240px] shrink-0 rounded-2xl bg-slate-900 p-2 shadow-2xl ring-1 ring-slate-800 mb-4">
                <div className="rounded-xl overflow-hidden bg-white aspect-[3/4]">
                  <img
                    src="/__l5e/assets-v1/e817b329-f357-4140-9dea-6fe059e24980/ipad-tutor-question.jpg"
                    alt="StepFighter tutor mode question with diagram on iPad"
                    className="w-full h-full object-cover object-top"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>
          </div>

          <p className="mt-8 text-center text-xs uppercase tracking-widest font-bold text-slate-500">
            Multi-device support
          </p>




          {/* Feature screenshot strip */}
          <div className="mt-14 grid md:grid-cols-3 gap-6">
            {[
              { u: "/__l5e/assets-v1/9c97374c-9f3d-4423-86ce-1440635ebd32/desktop_new_test.png", t: "Custom Quiz Builder", d: "Tutor or exam mode, timed or untimed, filtered by subject, system, topic." },
              { u: "/__l5e/assets-v1/b9e527e7-e8a2-4666-a40d-8f4f49ec8004/desktop_performance.png", t: "Performance Analytics", d: "Score, correct, incorrect, answer changes and test count — updated in real time." },
              { u: "/__l5e/assets-v1/53f16ac0-7b02-40f1-bae2-2ba6155ac922/desktop_dashboard.png", t: "Study Dashboard", d: "Every metric that matters, in one glance — QBank usage, accuracy, momentum." },
            ].map((s) => (
              <div key={s.t} className="rounded-lg overflow-hidden border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">
                <div className="aspect-[16/10] overflow-hidden bg-slate-100 border-b border-slate-200">
                  <img src={s.u} alt={s.t} loading="lazy" className="w-full h-full object-cover object-top" />
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-[#0d2b4e] text-sm mb-1">{s.t}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{s.d}</p>
                </div>
              </div>
            ))}
          </div>
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
            { n: "Step 1", l: "Foundation" },
            { n: "Step 2 CK", l: "Clinical" },
            { n: "Step 3", l: "Licensing" },
            { n: "CMS", l: "Specialty forms" },
          ].map((s) => (
            <div key={s.l} className="border border-slate-200 rounded-lg p-6 text-center hover:border-[#1a4b7c] transition-colors">
              <div className="text-2xl font-bold text-[#1a4b7c]">{s.n}</div>
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
              <span className="inline-flex items-center gap-1"><Smartphone className="h-3 w-3 text-amber-400" /> Install on any device</span>
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
              { i: BookOpen, t: "Massive Question Library", d: "NBME-style banks, CMS forms and full-length self-assessments across all three Steps." },
              { i: BarChart3, t: "Detailed Explanations", d: "High-yield explanations with images, tables and clinical correlates for every option." },
              { i: Timer, t: "Real Exam Simulation", d: "Prometric-style interface with authentic timers, block navigation and question flagging." },
              { i: Layers, t: "Custom Test Builder", d: "Build blocks by system, subject, difficulty — unused, incorrect or flagged." },
              { i: ShieldCheck, t: "Regularly Updated", d: "Content reviewed and updated by USMLE-scoring physicians to match the latest outline." },
              { i: Smartphone, t: "Works On Any Device", d: "Responsive on desktop, iPad, Android and iPhone — study anywhere, any time." },
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
              <div className={`text-xs font-bold uppercase tracking-widest mb-3 ${c.id === "combo" ? "text-amber-400" : "text-amber-600"}`}>{c.tagline}</div>
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
              { i: UserPlus, t: "Start studying", d: "Log in on any device and begin your first block right away.", n: "4" },
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
