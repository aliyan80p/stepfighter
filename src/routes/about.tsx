import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Target, Heart, Users, Award, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About StepFighter — Our Mission for USMLE Aspirants" },
      { name: "description", content: "StepFighter was built by physicians for medical students preparing for USMLE Step 1, Step 2 CK and Step 3. Learn our story, mission and values." },
      { property: "og:title", content: "About StepFighter" },
      { property: "og:description", content: "Physician-built USMLE prep for IMGs and US medical students." },
    ],
  }),
  component: About,
});

function About() {
  return (
    <SiteLayout>
      <section className="bg-gradient-to-br from-[#0d2b4e] to-[#1a4b7c] text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-3">About Us</div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Built by physicians, for physicians</h1>
          <p className="text-lg text-slate-200">StepFighter exists to make world-class USMLE preparation accessible and affordable for every medical student, everywhere.</p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-[#0d2b4e] mb-4">Our Story</h2>
        <p className="text-slate-700 leading-relaxed mb-4">
          StepFighter was founded by a team of practicing physicians and USMLE high-scorers who saw thousands of IMGs struggling
          with the cost and quality gap of existing prep resources. The best QBanks cost hundreds of dollars per Step — putting
          them out of reach for students in Pakistan, India, Egypt, Nigeria and much of the world.
        </p>
        <p className="text-slate-700 leading-relaxed mb-4">
          We built StepFighter to solve that. Every question is written or reviewed against the latest NBME content outline.
          Every explanation is designed to build clinical reasoning, not memorization. And every subscription costs a fraction
          of what the big brands charge.
        </p>
        <p className="text-slate-700 leading-relaxed">
          Today, StepFighter serves thousands of medical students across 40+ countries with 16,000+ board-style questions,
          85+ NBME and CMS forms, and AI-powered performance analytics.
        </p>
      </section>

      <section className="bg-slate-50 py-16 border-y border-slate-200">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-[#0d2b4e] text-center mb-12">Our Values</h2>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { i: Target, t: "Accuracy", d: "Every question and explanation is peer-reviewed by USMLE-scoring physicians." },
              { i: Heart, t: "Accessibility", d: "Premium USMLE prep priced for medical students, not private-equity investors." },
              { i: Users, t: "Community", d: "Direct WhatsApp support from our medical team, 7 days a week." },
              { i: Award, t: "Results", d: "Our users consistently report score gains of 15+ points on NBME assessments." },
            ].map((v) => (
              <div key={v.t} className="bg-white rounded-lg p-6 border border-slate-200 text-center">
                <div className="h-12 w-12 rounded-md bg-[#1a4b7c]/10 text-[#1a4b7c] grid place-items-center mx-auto mb-4">
                  <v.i className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-[#0d2b4e] mb-2">{v.t}</h3>
                <p className="text-sm text-slate-600">{v.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-[#0d2b4e] mb-6">What sets us apart</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            "16,000+ board-style questions across all three Steps",
            "85+ NBME-style self-assessments and CMS specialty forms",
            "Prometric-accurate exam simulator",
            "AI performance analytics with score predictor",
            "Physician-written high-yield explanations",
            "Native highlighting, notes and flashcards (SM-2 spaced repetition)",
            "Mobile, tablet and desktop friendly",
            "Instant WhatsApp activation — no complex checkout",
          ].map((f) => (
            <div key={f} className="flex items-start gap-3 p-4 bg-slate-50 rounded-md">
              <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-slate-700">{f}</span>
            </div>
          ))}
        </div>
        <div className="text-center mt-12">
          <Link to="/auth" search={{ mode: "signup" }} className="px-8 py-4 bg-[#1a4b7c] text-white font-bold rounded-md hover:bg-[#0d2b4e]">
            Start Free Trial
          </Link>
        </div>
      </section>
    </SiteLayout>
  );
}
