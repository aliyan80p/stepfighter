import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { waLink, SITE } from "@/lib/site";
import {
  MessageCircle,
  ShieldCheck,
  Globe,
  BookOpen,
  Brain,
  Zap,
  ArrowRight,
  BarChart3,
} from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About StepFighter — Mission, Values & Why We Exist" },
      {
        name: "description",
        content:
          "StepFighter is physician-built board prep for medical students worldwide. Learn why we made premium QBank access per-course, affordable, and free of forced bundles.",
      },
      { property: "og:title", content: "About StepFighter" },
      {
        property: "og:description",
        content:
          "Our mission: make high-yield medical board prep accessible with board-style questions, real NBME-style forms, and AI-powered study tools.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: About,
});

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
            StepFighter is a physician-built medical board prep platform built to put high-yield,
            board-quality practice in reach of every medical student — no matter the country,
            budget, or exam schedule.
          </p>
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


      {/* What makes StepFighter different */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-3">
            What makes StepFighter different
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-[#0d2b4e]">
            Designed for real study habits
          </h2>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {[
            {
              i: BookOpen,
              t: "NBME-style self-assessments",
              d: "Timed forms with sequential block unlocking and realistic exam-day pacing, so you are ready when it counts.",
            },
            {
              i: Brain,
              t: "Smart performance analytics",
              d: "AI-generated study plans and detailed dashboards turn every mistake into a targeted next step.",
            },
            {
              i: Zap,
              t: "Built-in active learning tools",
              d: "Native highlighting, notes, and manual flashcards from your own flagged questions — no extra plugins needed.",
            },
            {
              i: BarChart3,
              t: "Peer ranking & progress tracking",
              d: "Compare your progress, track mastery by topic, and see exactly where to focus your next session.",
            },
            {
              i: ShieldCheck,
              t: "Simple, honest activation",
              d: "Clear USD pricing and WhatsApp activation. No forced bundles, no hidden fees, no checkout maze.",
            },
            {
              i: Globe,
              t: "Works on every device",
              d: "Study at a desk, in a clinic, or on a phone. Progress, highlights, and notes sync across sessions.",
            },
          ].map((f) => (
            <div
              key={f.t}
              className="bg-white border border-slate-200 rounded-xl p-6 hover:border-[#1a4b7c] hover:shadow-lg transition-all"
            >
              <div className="flex gap-4">
                <div className="h-10 w-10 rounded-md bg-[#1a4b7c]/10 text-[#1a4b7c] grid place-items-center flex-shrink-0">
                  <f.i className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-[#0d2b4e] text-sm">{f.t}</h4>
                  <p className="text-sm text-slate-600 leading-relaxed">{f.d}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>


      {/* Final CTA */}
      <section className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-[#0d2b4e] mb-4">
          Ready to study like it matters?
        </h2>
        <p className="text-slate-600 mb-8 max-w-2xl mx-auto leading-relaxed">
          Start a free 14-day trial, explore the full QBank, and see how StepFighter helps you
          build real exam-day confidence.
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
          <span>Cancel anytime</span>
          <span>WhatsApp activation</span>
          <span>WhatsApp & email support</span>
        </div>
      </section>
    </SiteLayout>
  );
}
