import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "StepFighter — USMLE Step 1, Step 2 CK & Step 3 Prep" },
      { name: "description", content: "16,000+ board-style USMLE questions across Step 1, Step 2 CK, and Step 3, with NBME-style self-assessments, AI performance analysis, and a real-exam simulator." },
      { property: "og:title", content: "StepFighter — USMLE Board Prep" },
      { property: "og:description", content: "Board-style USMLE questions with AI analysis and real-exam simulation." },
    ],
  }),
  component: LandingPage,
});

const display = { fontFamily: "'Instrument Serif', serif" };
const body = { fontFamily: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif" };

function LandingPage() {
  return (
    <div
      className="w-full min-h-screen bg-[#0a0a0c] text-zinc-300 antialiased selection:bg-amber-400 selection:text-black"
      style={body}
    >
      {/* Nav */}
      <nav className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between relative z-20">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-amber-400 text-black font-bold text-sm">
            SF
          </div>
          <span className="text-white font-semibold tracking-tight">QBank</span>
        </Link>
        <div className="hidden md:flex items-center gap-8 text-sm text-zinc-400">
          <a href="#curriculum" className="hover:text-white transition-colors">Curriculum</a>
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/auth" className="text-sm text-zinc-300 hover:text-white transition-colors">Sign in</Link>
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="px-4 py-2 bg-amber-400 text-black font-semibold text-sm hover:bg-white transition-colors"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-16 pb-24 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[700px] bg-gradient-to-b from-amber-500/10 via-transparent to-transparent opacity-60 pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900/50 text-amber-400 text-xs font-bold uppercase tracking-widest mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
              Updated for 2026
            </div>
            <h1
              className="text-5xl md:text-7xl lg:text-8xl font-medium tracking-tight text-white mb-6 leading-[0.95]"
              style={display}
            >
              Dominate the boards with{" "}
              <span className="italic text-amber-400 underline decoration-1 underline-offset-8">
                surgical
              </span>{" "}
              precision.
            </h1>
            <p className="text-lg md:text-xl text-zinc-400 mb-10 leading-relaxed max-w-2xl">
              16,000+ board-style questions across Step 1, Step 2 CK, and Step 3.
              Real-exam simulation, AI performance analysis, and NBME-style self assessments —
              engineered to lift your score, not your stress.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="px-8 py-4 bg-amber-400 text-black font-bold hover:bg-white transition-all transform hover:-translate-y-0.5"
              >
                START PRACTICING
              </Link>
              <Link
                to="/auth"
                className="px-8 py-4 border border-zinc-700 text-white font-bold hover:bg-zinc-900 transition-all"
              >
                SIGN IN
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-y border-zinc-800 bg-zinc-900/30">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { n: "16,000+", l: "Board-style questions" },
              { n: "Step 1/2/3", l: "Full exam coverage" },
              { n: "85+", l: "NBME & CMS forms" },
              { n: "AI", l: "Performance diagnostics" },
            ].map((s) => (
              <div key={s.l}>
                <div className="text-3xl md:text-4xl font-light text-white mb-1" style={display}>
                  {s.n}
                </div>
                <div className="text-[11px] uppercase tracking-widest text-zinc-500 font-bold">
                  {s.l}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features bento */}
      <section id="features" className="py-24 max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-end mb-16 gap-6">
          <h2 className="text-4xl md:text-5xl font-light text-white" style={display}>
            Engineered for mastery
          </h2>
          <p className="text-zinc-500 max-w-xs text-sm">
            Every tool is calibrated to match the pressure and clinical complexity of the actual exam.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 group p-8 bg-zinc-900 border border-zinc-800 hover:border-amber-400/50 transition-colors relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="text-2xl text-white mb-4" style={display}>
                AI performance analysis
              </h3>
              <p className="text-zinc-400 max-w-md">
                Pinpoint gaps by subject and system. We don't just show what you got wrong —
                we surface the pattern behind it so you fix the reasoning, not the flashcard.
              </p>
            </div>
            <div className="absolute -bottom-12 -right-12 w-64 h-64 bg-amber-400/5 rounded-full blur-3xl group-hover:bg-amber-400/10 transition-colors" />
          </div>

          {[
            { t: "Real-exam simulator", d: "Interface, timers, and pacing modeled on the Prometric environment to eliminate test-day surprises." },
            { t: "Tutor & exam modes", d: "Switch between guided learning with instant explanations or timed high-stakes blocks." },
            { t: "Custom test builder", d: "Filter by system, subject, unused, incorrect, or flagged — build the exact drill you need." },
            { t: "Media-rich explanations", d: "Every question ships with high-yield imagery, tables, and clinical correlates." },
          ].map((f) => (
            <div
              key={f.t}
              className="p-8 bg-zinc-900 border border-zinc-800 hover:border-amber-400/50 transition-colors"
            >
              <h3 className="text-xl text-white mb-3" style={display}>{f.t}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Curriculum */}
      <section id="curriculum" className="py-24 bg-zinc-900/50 border-y border-zinc-800">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-xs uppercase tracking-[0.3em] text-amber-500 font-bold mb-12">
            The curriculum
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { n: "01", t: "Step 1", d: "Foundational science and pathophysiology, integrated with clinical vignettes." },
              { n: "02", t: "Step 2 CK", d: "Diagnostic reasoning, management, and the wards-level clinical judgment." },
              { n: "03", t: "Step 3", d: "Comprehensive practice for the final licensing exam and residency prep." },
              { n: "04", t: "Self-Assessments", d: "Full-length NBME-style exams and CMS specialty forms for gauge readiness." },
            ].map((p) => (
              <div key={p.t} className="bg-zinc-950 p-1 border border-zinc-800 group cursor-pointer">
                <div className="p-8 border border-transparent group-hover:border-zinc-700 transition-colors h-full">
                  <div className="text-zinc-500 text-xs mb-6 font-mono">{p.n}</div>
                  <h4 className="text-2xl text-white mb-4" style={display}>{p.t}</h4>
                  <p className="text-sm text-zinc-500 mb-8 leading-relaxed">{p.d}</p>
                  <div className="h-[1px] w-8 group-hover:w-full bg-amber-400 transition-all duration-500" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="py-24 border-b border-zinc-800">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="text-amber-400 mb-8 text-5xl leading-none italic" style={display}>
            &ldquo;
          </div>
          <blockquote
            className="text-2xl md:text-3xl font-medium text-white mb-10 tracking-tight leading-snug"
            style={display}
          >
            The explanations connect the dots between basic science and bedside reasoning better
            than anything else I've used. Working through the bank once moved my score more than
            a full month of textbook review.
          </blockquote>
          <div className="flex items-center justify-center gap-4">
            <div className="h-11 w-11 rounded-full bg-gradient-to-br from-amber-400 to-amber-600" />
            <div className="text-left">
              <div className="text-white font-bold text-sm">Anonymous PGY-1</div>
              <div className="text-zinc-500 text-[11px] uppercase tracking-widest">Verified user</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="pricing" className="py-20 relative overflow-hidden bg-amber-400">
        <div className="relative z-10 max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-10">
          <div>
            <h2
              className="text-4xl md:text-5xl font-medium text-black tracking-tight mb-3"
              style={display}
            >
              Stop guessing. Start knowing.
            </h2>
            <p className="text-black/70 font-medium text-lg">
              Full access to Step 1, Step 2 CK, Step 3, and every self-assessment.
            </p>
          </div>
          <div className="flex flex-col items-start md:items-center">
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="px-10 py-5 bg-black text-white font-bold text-lg hover:bg-zinc-900 transition-colors"
            >
              CREATE YOUR ACCOUNT
            </Link>
            <p className="mt-4 text-black/60 text-xs font-bold uppercase tracking-widest">
              Cancel anytime
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black py-16 border-t border-zinc-900">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-amber-400 text-black font-bold text-sm">
                SF
              </div>
              <span className="text-white font-semibold tracking-tight">QBank</span>
            </div>
            <p className="text-zinc-500 max-w-sm text-sm leading-relaxed">
              A precision board-prep platform for medical students and residents.
              Built around real clinical reasoning, not rote memorization.
            </p>
          </div>
          <div>
            <h5 className="text-white font-bold mb-5 text-xs uppercase tracking-widest">Product</h5>
            <ul className="space-y-3 text-zinc-500 text-sm">
              <li><a href="#curriculum" className="hover:text-amber-400 transition-colors">Curriculum</a></li>
              <li><a href="#features" className="hover:text-amber-400 transition-colors">Features</a></li>
              <li><a href="#pricing" className="hover:text-amber-400 transition-colors">Pricing</a></li>
            </ul>
          </div>
          <div>
            <h5 className="text-white font-bold mb-5 text-xs uppercase tracking-widest">Account</h5>
            <ul className="space-y-3 text-zinc-500 text-sm">
              <li><Link to="/auth" className="hover:text-amber-400 transition-colors">Sign in</Link></li>
              <li><Link to="/auth" search={{ mode: "signup" }} className="hover:text-amber-400 transition-colors">Create account</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 mt-16 pt-8 border-t border-zinc-900 text-zinc-600 text-[10px] uppercase tracking-widest">
          © 2026 StepFighter. Not affiliated with the NBME, FSMB, or the USMLE program.
        </div>
      </footer>
    </div>
  );
}
