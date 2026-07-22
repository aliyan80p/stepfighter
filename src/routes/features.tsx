import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { BookOpen, Brain, Timer, Layers, BarChart3, ShieldCheck, Highlighter, StickyNote, Zap, Smartphone, Calculator, FileText } from "lucide-react";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "Features — StepFighter USMLE QBank" },
      { name: "description", content: "Real exam simulator, AI analytics, custom test builder, spaced-repetition flashcards, native highlighting, score predictor — every tool you need for Step 1, 2 CK & 3 prep." },
      { property: "og:title", content: "StepFighter Features" },
      { property: "og:description", content: "Every board prep tool: exam simulator, AI analytics, flashcards, highlighter, score calculator, and more." },
    ],
  }),
  component: Features,
});

const features = [
  { i: BookOpen, t: "Board-Style Questions", d: "Comprehensive coverage of Step 1, Step 2 CK and Step 3 with clinical vignettes, media, and detailed answer choices." },
  { i: FileText, t: "85+ NBME & CMS Forms", d: "Every official-style self-assessment and CMS specialty form for realistic score prediction." },
  { i: Timer, t: "Real Exam Simulator", d: "Prometric-accurate interface with authentic timers, block navigation, flagging, strikeout and lab values panel." },
  { i: Brain, t: "AI Performance Analytics", d: "Drill-down performance by system, subject and topic. See patterns behind wrong answers, not just tallies." },
  { i: Calculator, t: "Score Predictor", d: "Calibrated to NBME 9–31 slopes and intercepts — know where you stand before test day." },
  { i: Layers, t: "Custom Test Builder", d: "Filter by system, subject, difficulty, unused, incorrect, or flagged. Build the exact block you need." },
  { i: Highlighter, t: "Native Highlighting", d: "UWorld-style multi-color highlighting that works on desktop, iPad and phone with a floating toolbar." },
  { i: StickyNote, t: "Notes & Flashcards", d: "Attach notes per question. Convert any card into an SM-2 spaced-repetition flashcard automatically." },
  { i: BarChart3, t: "Overall Performance Dashboard", d: "Track answer changes, test count, streaks and accuracy trends over time." },
  { i: Zap, t: "Media-Rich Explanations", d: "Every question ships with high-yield imagery, tables, videos and audio where relevant." },
  { i: Smartphone, t: "Works on Every Device", d: "Fully responsive on mobile, tablet, desktop and installable as a Progressive Web App." },
  { i: ShieldCheck, t: "Regularly Updated", d: "Content reviewed against the latest USMLE content outline. New forms added every quarter." },
];

function Features() {
  return (
    <SiteLayout>
      <section className="bg-gradient-to-br from-[#0d2b4e] to-[#1a4b7c] text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-3">Platform Features</div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Every tool you need to conquer the USMLE</h1>
          <p className="text-lg text-slate-200">From question stems to score prediction — one platform, everything included.</p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.t} className="border border-slate-200 rounded-lg p-6 hover:border-[#1a4b7c] hover:shadow-lg transition-all">
              <div className="h-12 w-12 rounded-md bg-[#1a4b7c]/10 text-[#1a4b7c] grid place-items-center mb-4">
                <f.i className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-[#0d2b4e] mb-2 text-lg">{f.t}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{f.d}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-16">
          <h2 className="text-2xl font-bold text-[#0d2b4e] mb-4">Ready to try it yourself?</h2>
          <p className="text-slate-600 mb-6">Start your 14-day free trial — no credit card required.</p>
          <Link to="/auth" search={{ mode: "signup" }} className="px-8 py-4 bg-[#1a4b7c] text-white font-bold rounded-md hover:bg-[#0d2b4e]">
            Start Free Trial
          </Link>
        </div>
      </section>
    </SiteLayout>
  );
}
