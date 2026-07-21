import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { waLink } from "@/lib/site";
import { CheckCircle2, BookOpen, Layers, BarChart3, Timer, Brain, Users, Star, ArrowRight, MessageCircle, ShieldCheck, GraduationCap, Trophy } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "StepFighter — USMLE Step 1, Step 2 CK & Step 3 QBank" },
      { name: "description", content: "High-yield USMLE preparation with 16,000+ board-style questions, NBME-style self-assessments, real-exam simulation, and AI performance analytics for Step 1, Step 2 CK and Step 3." },
      { property: "og:title", content: "StepFighter — Your Gateway to USMLE Success" },
      { property: "og:description", content: "16,000+ board-style USMLE questions, CMS forms, NBME-style self-assessments and AI analytics." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <SiteLayout>
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-[#0d2b4e] via-[#1a4b7c] to-[#0d2b4e] text-white overflow-hidden">
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.1)_1px,transparent_1px)] [background-size:40px_40px]" />
        <div className="relative max-w-7xl mx-auto px-4 py-20 md:py-28 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-400 text-[#0d2b4e] text-xs font-black uppercase tracking-widest rounded-sm mb-6">
              <Trophy className="h-3 w-3" /> Updated for 2026 Exams
            </div>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
              Sharper prep. <span className="text-amber-400">Sharper score.</span>
            </h1>
            <p className="text-lg text-slate-200 mb-8 leading-relaxed">
              16,000+ board-style USMLE questions across Step 1, Step 2 CK and Step 3 — with
              NBME-style self-assessments, CMS forms, AI analytics and a Prometric-accurate simulator.
              Subscribe to just the Step you're preparing for, or bundle all three.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/auth" search={{ mode: "signup" }}
                className="px-6 py-3 bg-amber-400 text-[#0d2b4e] font-bold rounded-md hover:bg-white transition-colors inline-flex items-center gap-2">
                Start Free Trial <ArrowRight className="h-4 w-4" />
              </Link>
              <a href={waLink("Hi, I want to know about StepFighter subscription plans.")}
                target="_blank" rel="noreferrer"
                className="px-6 py-3 bg-[#25D366] text-white font-bold rounded-md hover:opacity-90 inline-flex items-center gap-2">
                <MessageCircle className="h-4 w-4" /> Chat on WhatsApp
              </a>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-6 text-sm text-slate-300">
              <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-amber-400" /> 14-day free trial</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-amber-400" /> No credit card required</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-amber-400" /> Cancel anytime</div>
            </div>
          </div>
          <div className="relative">
            <div className="bg-white rounded-lg shadow-2xl p-6 text-slate-800">
              <div className="flex items-center justify-between border-b pb-3 mb-4">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Question 42 of 40</div>
                <div className="text-xs font-bold text-[#1a4b7c] flex items-center gap-1"><Timer className="h-3 w-3" /> 01:12:34</div>
              </div>
              <p className="text-sm leading-relaxed mb-4">
                A 58-year-old man presents to the emergency department with sudden onset chest pain radiating to the left arm.
                ECG shows ST-elevation in leads II, III, and aVF. Which coronary artery is most likely occluded?
              </p>
              <div className="space-y-2 text-sm">
                {[
                  { l: "A", t: "Left anterior descending", ok: false },
                  { l: "B", t: "Right coronary artery", ok: true },
                  { l: "C", t: "Left circumflex", ok: false },
                  { l: "D", t: "Left main coronary", ok: false },
                ].map((o) => (
                  <div key={o.l} className={`flex items-center gap-3 p-2 rounded border ${o.ok ? "border-green-500 bg-green-50" : "border-slate-200"}`}>
                    <span className={`h-6 w-6 rounded-full grid place-items-center text-xs font-bold ${o.ok ? "bg-green-500 text-white" : "bg-slate-100"}`}>{o.l}</span>
                    <span>{o.t}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t text-xs text-slate-500">
                Inferior STEMI → RCA supplies inferior wall in ~80% of population.
              </div>
            </div>
            <div className="absolute -bottom-4 -right-4 bg-amber-400 text-[#0d2b4e] rounded-lg shadow-xl px-4 py-3 font-bold text-sm hidden md:block">
              ✓ AI-verified explanations
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-10 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { n: "16,000+", l: "Board-style questions" },
            { n: "85+", l: "NBME & CMS forms" },
            { n: "3", l: "Full Step exams covered" },
            { n: "24/7", l: "Instant activation support" },
          ].map((s) => (
            <div key={s.l} className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-[#1a4b7c]">{s.n}</div>
              <div className="text-xs uppercase tracking-widest text-slate-500 mt-1 font-semibold">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Why Choose */}
      <section className="max-w-7xl mx-auto px-4 py-20">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-3">Why StepFighter</div>
          <h2 className="text-3xl md:text-4xl font-bold text-[#0d2b4e] mb-4">Everything you need in one platform</h2>
          <p className="text-slate-600">Built to mirror the real Prometric exam experience — from question stems to timing to interface.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { i: BookOpen, t: "Massive Question Library", d: "16,000+ questions from official NBME-style banks including CMS forms and full-length self-assessments." },
            { i: Brain, t: "AI Performance Analytics", d: "Track weak systems, subjects and topics with drill-down analytics and a personalized score predictor." },
            { i: Timer, t: "Real Exam Simulation", d: "Prometric-style interface with authentic timers, block navigation and question flagging." },
            { i: Layers, t: "Custom Test Builder", d: "Build blocks by system, subject, difficulty, unused, incorrect, or flagged — the exact drill you need." },
            { i: BarChart3, t: "Detailed Explanations", d: "High-yield explanations with images, tables, and clinical correlates for every option." },
            { i: ShieldCheck, t: "Regularly Updated", d: "Content reviewed and updated by USMLE-scoring physicians to match the latest content outline." },
          ].map((f) => (
            <div key={f.t} className="border border-slate-200 rounded-lg p-6 hover:border-[#1a4b7c] hover:shadow-lg transition-all">
              <div className="h-12 w-12 rounded-md bg-[#1a4b7c]/10 text-[#1a4b7c] grid place-items-center mb-4">
                <f.i className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-[#0d2b4e] mb-2 text-lg">{f.t}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Curriculum */}
      <section className="bg-slate-50 py-20 border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-3">Courses</div>
            <h2 className="text-3xl md:text-4xl font-bold text-[#0d2b4e] mb-4">Pick the Step you need</h2>
            <p className="text-slate-600">Each course is a standalone subscription. Preparing for two or three? The All-Steps Combo is the fastest path.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { t: "Step 1", d: "Foundational science woven into clinical vignettes — path, pharm, micro, physio, biochem.", q: "5,200+ Q · 4 SA forms", p: "from $29 / 6 mo" },
              { t: "Step 2 CK", d: "Clinical reasoning and wards-level management across every core rotation.", q: "6,800+ Q · 9 SA · 22 CMS", p: "from $35 / 6 mo" },
              { t: "Step 3", d: "FIP + ACM practice for the final licensing exam and residency-year readiness.", q: "4,000+ Q · SA1 + SA2", p: "from $29 / 6 mo" },
              { t: "All-Steps Combo", d: "Every question, every form, every Step — priced up to 40% below buying separately.", q: "16,000+ Q · 40+ forms", p: "from $69 / 6 mo" },
            ].map((c, i) => (
              <div key={c.t} className="bg-white rounded-lg border border-slate-200 p-6 hover:border-[#1a4b7c] hover:-translate-y-1 transition-all">
                <div className="text-xs font-mono text-slate-400 mb-3">0{i + 1}</div>
                <GraduationCap className="h-8 w-8 text-[#1a4b7c] mb-3" />
                <h4 className="text-xl font-bold text-[#0d2b4e] mb-2">{c.t}</h4>
                <p className="text-sm text-slate-600 mb-3 leading-relaxed">{c.d}</p>
                <div className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-2">{c.q}</div>
                <div className="text-xs font-semibold text-[#1a4b7c]">{c.p}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="max-w-7xl mx-auto px-4 py-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-3">Testimonials</div>
          <h2 className="text-3xl md:text-4xl font-bold text-[#0d2b4e] mb-4">Trusted by future physicians</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { n: "Dr. A. Khan", r: "IMG · Matched IM 2025", t: "The question quality is on par with UWorld and the explanations connect basic science to bedside reasoning. Moved my NBME score by 18 points." },
            { n: "S. Patel, MS4", r: "Step 2 CK: 264", t: "The CMS forms alone were worth the subscription. The interface feels exactly like the real exam. Highly recommended." },
            { n: "Dr. M. Ali", r: "IMG · Step 3: 240", t: "Affordable, fast activation, responsive support on WhatsApp. Beats the big brands on value by miles." },
          ].map((t) => (
            <div key={t.n} className="border border-slate-200 rounded-lg p-6 bg-white">
              <div className="flex gap-1 mb-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-sm text-slate-700 leading-relaxed mb-4">"{t.t}"</p>
              <div className="border-t pt-3">
                <div className="font-bold text-[#0d2b4e] text-sm">{t.n}</div>
                <div className="text-xs text-slate-500">{t.r}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing preview — per-Step model */}
      <section className="bg-gradient-to-br from-[#0d2b4e] to-[#1a4b7c] text-white py-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-3">Simple Pricing</div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Pay only for the Step you're taking</h2>
            <p className="text-slate-300">Each Step is priced separately. Preparing for two or three? The All-Steps Combo saves you up to 40%.</p>
          </div>

          <div className="grid md:grid-cols-4 gap-4 max-w-5xl mx-auto">
            {[
              { t: "Step 1", p: "$45", pop: false },
              { t: "Step 2 CK", p: "$49", pop: false },
              { t: "Step 3", p: "$45", pop: false },
              { t: "All-Steps Combo", p: "$99", pop: true, sub: "Save $40" },
            ].map((t) => (
              <div key={t.t} className={`relative rounded-lg p-6 ${t.pop ? "bg-amber-400 text-[#0d2b4e] shadow-2xl scale-[1.03]" : "bg-white/10 border border-white/20"}`}>
                {t.pop && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#0d2b4e] text-amber-400 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">Best Value</div>}
                <div className={`text-xs font-bold uppercase tracking-widest mb-2 ${t.pop ? "text-[#0d2b4e]" : "text-amber-400"}`}>{t.t}</div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-bold">{t.p}</span>
                  <span className={`text-xs ${t.pop ? "text-[#0d2b4e]/70" : "text-slate-300"}`}>/ 12 mo</span>
                </div>
                <div className={`text-[11px] font-semibold ${t.pop ? "text-[#0d2b4e]/80" : "text-amber-400"}`}>{t.sub ?? "6-mo plan also available"}</div>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link to="/pricing" className="inline-flex items-center gap-2 px-6 py-3 bg-amber-400 text-[#0d2b4e] font-bold rounded-md hover:bg-white transition-colors">
              See all plans <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-7xl mx-auto px-4 py-20 text-center">
        <Users className="h-12 w-12 text-[#1a4b7c] mx-auto mb-4" />
        <h2 className="text-3xl md:text-4xl font-bold text-[#0d2b4e] mb-4">Join thousands preparing with StepFighter</h2>
        <p className="text-slate-600 max-w-xl mx-auto mb-8">Start your 14-day free trial today. No credit card required.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/auth" search={{ mode: "signup" }} className="px-8 py-4 bg-[#1a4b7c] text-white font-bold rounded-md hover:bg-[#0d2b4e]">
            Start Free Trial
          </Link>
          <a href={waLink("Hi, I want to activate my StepFighter account.")} target="_blank" rel="noreferrer"
             className="px-8 py-4 bg-[#25D366] text-white font-bold rounded-md hover:opacity-90 inline-flex items-center gap-2">
            <MessageCircle className="h-4 w-4" /> Activate via WhatsApp
          </a>
        </div>
      </section>
    </SiteLayout>
  );
}
