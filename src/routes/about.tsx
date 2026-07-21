import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { waLink, SITE, COURSES } from "@/lib/site";
import {
  Target,
  Heart,
  Users,
  Award,
  CheckCircle2,
  MessageCircle,
  ShieldCheck,
  Globe,
  BookOpen,
  Brain,
  Zap,
  ArrowRight,
  GraduationCap,
} from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About StepFighter — Mission, Values & Why We Exist" },
      {
        name: "description",
        content:
          "StepFighter is physician-built USMLE prep for medical students worldwide. Learn why we made premium QBank access per-Step, affordable, and free of forced bundles.",
      },
      { property: "og:title", content: "About StepFighter" },
      {
        property: "og:description",
        content:
          "Our mission: make high-yield USMLE preparation accessible with board-style questions, real NBME-style forms, and AI-powered study tools.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: About,
});

const allForms = COURSES.reduce((n, c) => n + c.extras.length, 0).toString();
void allForms;

function About() {
  return (
    <SiteLayout>
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-[#0d2b4e] via-[#1a4b7c] to-[#0d2b4e] text-white overflow-hidden">
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.1)_1px,transparent_1px)] [background-size:40px_40px]" />
        <div className="relative max-w-4xl mx-auto px-4 py-20 md:py-28 text-center">
          <div className="text-xs font-black uppercase tracking-widest text-amber-400 mb-4">
            About Us
          </div>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
            Preparation should fight for the student,{" "}
            <span className="text-amber-400">not against the wallet.</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-200 max-w-3xl mx-auto leading-relaxed">
            StepFighter is a physician-built USMLE preparation platform built to put high-yield,
            board-quality practice in reach of every medical student — no matter the country,
            budget, or exam schedule.
          </p>
        </div>
      </section>

      {/* Stats strip */}
      <section className="bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { n: "Step 1", l: "Foundational science" },
            { n: "Step 2 CK", l: "Clinical mastery" },
            { n: "Step 3", l: "Final licensing" },
            { n: "40+", l: "Countries served" },
          ].map((s) => (
            <div key={s.l} className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-[#1a4b7c]">{s.n}</div>
              <div className="text-xs uppercase tracking-widest text-slate-500 mt-1 font-semibold">
                {s.l}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Mission */}
      <section className="max-w-5xl mx-auto px-4 py-20 text-center">
        <div className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-3">
          Our Mission
        </div>
        <h2 className="text-3xl md:text-4xl font-bold text-[#0d2b4e] mb-6">
          Close the gap between great students and great resources
        </h2>
        <p className="text-slate-600 leading-relaxed max-w-3xl mx-auto text-lg">
          We believe passing the USMLE should depend on effort and strategy, not on paying inflated
          prices for content you never open. StepFighter gives every student access to a full,
          examiner-grade question bank with the tools to track, review, and retain exactly what they
          need — for the exact Step they are preparing for.
        </p>
      </section>

      {/* Values */}
      <section className="bg-slate-50 py-20 border-y border-slate-200">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <div className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-3">
              What guides us
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-[#0d2b4e]">Our core values</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                i: Target,
                t: "Precision",
                d: "Every question, explanation, and tag is reviewed against the latest NBME content outline and high-yield clinical reasoning.",
              },
              {
                i: Heart,
                t: "Access",
                d: "Per-Step pricing means you only pay for what you are studying. No forced bundles, no surprise add-ons, no hidden fees.",
              },
              {
                i: Users,
                t: "Community",
                d: "Direct WhatsApp and email support from our medical team. Real humans, fast replies, and activation guidance that actually helps.",
              },
              {
                i: Award,
                t: "Momentum",
                d: "Highlighting, flashcards, notes, and AI analytics work together so every study session builds long-term retention, not just clicks.",
              },
            ].map((v) => (
              <div
                key={v.t}
                className="bg-white rounded-lg p-6 border border-slate-200 text-center hover:border-[#1a4b7c] hover:shadow-lg transition-all"
              >
                <div className="h-12 w-12 rounded-md bg-[#1a4b7c]/10 text-[#1a4b7c] grid place-items-center mx-auto mb-4">
                  <v.i className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-[#0d2b4e] mb-2 text-lg">{v.t}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{v.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Story + Differentiators */}
      <section className="max-w-6xl mx-auto px-4 py-20 grid lg:grid-cols-2 gap-12 items-start">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-3">
            Our story
          </div>
          <h2 className="text-3xl font-bold text-[#0d2b4e] mb-4">
            Built from the same desks our users sit at
          </h2>
          <div className="space-y-4 text-slate-700 leading-relaxed">
            <p>
              StepFighter was created by physicians and high-scoring USMLE graduates who watched
              classmates spend more time worrying about subscription costs than studying. Existing
              resources were excellent but often bundled, expensive, and out of reach for students in
              many parts of the world.
            </p>
            <p>
              We started by building a simple, high-quality question bank with a clean interface,
              real exam timers, and detailed explanations. Then we added the tools we wished we had
              ourselves: system tagging, performance dashboards, flashcards with spaced repetition,
              native highlighting, and feedback that lets students fix the platform with us.
            </p>
            <p>
              Today the platform covers all three USMLE Steps with a full CMS Forms library and
              NBME-style self-assessments. The questions are reviewed by physicians, supported by
              AI-assisted verification, and delivered through an interface that works on desktop,
              tablet, and mobile.
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 md:p-8">
          <div className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-3">
            What makes StepFighter different
          </div>
          <h3 className="text-2xl font-bold text-[#0d2b4e] mb-6">
            Designed for real study habits
          </h3>
          <div className="space-y-4">
            {[
              {
                i: GraduationCap,
                t: "Per-Step subscriptions",
                d: "Buy Step 1, Step 2 CK, or Step 3 individually. Or choose the Combo if you want all three. You decide.",
              },
              {
                i: BookOpen,
                t: "Full-length NBME-style forms",
                d: "Timed self-assessments with sequential block unlocking, just like the real exam day experience.",
              },
              {
                i: Brain,
                t: "AI-assisted content + human review",
                d: "AI verifies metadata, tags, and explanations; physicians review before content reaches the live bank.",
              },
              {
                i: Zap,
                t: "Built-in active learning tools",
                d: "Highlighting, notes, flashcards, and spaced repetition are native — not bolted-on extras.",
              },
              {
                i: ShieldCheck,
                t: "No AI-override pricing",
                d: "Simple plans, clear USD + PKR prices, and activation over WhatsApp. No checkout maze.",
              },
              {
                i: Globe,
                t: "Works on every device",
                d: "Study at a desk, in a clinic, or on a phone. Progress, highlights, and notes sync across sessions.",
              },
            ].map((f) => (
              <div key={f.t} className="flex gap-4">
                <div className="h-10 w-10 rounded-md bg-[#1a4b7c]/10 text-[#1a4b7c] grid place-items-center flex-shrink-0">
                  <f.i className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-[#0d2b4e] text-sm">{f.t}</h4>
                  <p className="text-sm text-slate-600 leading-relaxed">{f.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who we are for */}
      <section className="bg-gradient-to-br from-[#0d2b4e] to-[#1a4b7c] text-white py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <div className="text-xs font-black uppercase tracking-widest text-amber-400 mb-3">
              Who we serve
            </div>
            <h2 className="text-3xl md:text-4xl font-bold">For every student taking the fight seriously</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                t: "International Medical Graduates",
                d: "Affordable, full-quality USMLE prep without the need for international credit cards or expensive bundled subscriptions.",
              },
              {
                t: "US Medical Students",
                d: "A clean, high-yield complement to your rotations and school curriculum with strong NBME-style assessment coverage.",
              },
              {
                t: "Repeat & Remediation Students",
                d: "Detailed analytics, weak-area drills, and retake-friendly explanations to turn gaps into gains.",
              },
            ].map((a) => (
              <div
                key={a.t}
                className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-lg p-6 hover:bg-white/15 transition-colors"
              >
                <h3 className="font-bold text-lg mb-2">{a.t}</h3>
                <p className="text-sm text-slate-200 leading-relaxed">{a.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-[#0d2b4e] mb-4">
          Ready to study like it matters?
        </h2>
        <p className="text-slate-600 mb-8 max-w-2xl mx-auto leading-relaxed">
          Start a free 14-day trial, explore the full QBank, and see why students in over 40 countries
          are preparing with StepFighter.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="px-6 py-3 bg-amber-400 text-[#0d2b4e] font-bold rounded-md hover:bg-white transition-colors inline-flex items-center gap-2 border border-amber-400"
          >
            Start Free Trial <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href={waLink(`Hi, I'd like to learn more about ${SITE.brand} subscriptions and activation.`)}
            target="_blank"
            rel="noreferrer"
            className="px-6 py-3 bg-[#25D366] text-white font-bold rounded-md hover:opacity-90 inline-flex items-center gap-2"
          >
            <MessageCircle className="h-4 w-4" /> Chat on WhatsApp
          </a>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-6 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" /> No credit card required
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" /> Cancel anytime
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" /> Instant WhatsApp activation
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
