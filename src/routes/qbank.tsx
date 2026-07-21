import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { COURSES, waLink } from "@/lib/site";
import { BookOpen, ChevronRight, FileText, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/qbank")({
  head: () => ({
    meta: [
      { title: "QBanks — StepFighter USMLE Question Banks" },
      { name: "description", content: "Explore StepFighter's USMLE QBanks: Step 1, Step 2 CK with 22 CMS forms, Step 3, and 40+ NBME-style self-assessments. Per-Step subscriptions or bundle all three." },
      { property: "og:title", content: "StepFighter QBanks" },
      { property: "og:description", content: "Step 1, Step 2 CK, Step 3, CMS forms and NBME-style self-assessments — subscribe per Step." },
    ],
  }),
  component: QBankPage,
});

const topicsByStep: Record<string, string[]> = {
  step1: ["Cardiovascular", "Renal", "Endocrine", "Neurology", "GI", "Hematology", "Pulmonary", "Reproductive", "MSK", "Psychiatry"],
  step2ck: ["Internal Medicine", "Surgery", "Pediatrics", "OB/GYN", "Psychiatry", "Family Medicine", "Emergency Medicine", "Neurology"],
  step3: ["Ambulatory", "Emergency", "Inpatient", "CCS cases", "Biostatistics", "Ethics"],
  combo: ["Step 1", "Step 2 CK", "Step 3", "All self-assessments", "All CMS forms"],
};

function QBankPage() {
  return (
    <SiteLayout>
      <section className="bg-gradient-to-br from-[#0d2b4e] to-[#1a4b7c] text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-3">Question Banks</div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Board-style questions for every Step</h1>
          <p className="text-lg text-slate-200">Every Step, every self-assessment, every CMS form — subscribe to just what you need.</p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 py-16 space-y-6">
        {COURSES.map((c, i) => (
          <div key={c.id} className="grid md:grid-cols-3 gap-6 p-8 border border-slate-200 rounded-lg hover:border-[#1a4b7c] hover:shadow-lg transition-all">
            <div>
              <div className="text-xs font-mono text-slate-400 mb-2">0{i + 1}</div>
              <div className="flex items-center gap-3 mb-3">
                <BookOpen className="h-8 w-8 text-[#1a4b7c]" />
                <h2 className="text-2xl font-bold text-[#0d2b4e]">{c.name}</h2>
              </div>
              <div className="inline-block px-3 py-1 bg-amber-100 text-amber-700 text-xs font-black rounded-full mb-3">{c.tagline}</div>
              <div className="text-xs text-slate-500">
                From <span className="font-bold text-[#0d2b4e]">${c.price["6mo"].usd}</span> / 6 mo · <span className="font-bold text-[#0d2b4e]">${c.price["12mo"].usd}</span> / 12 mo
              </div>
            </div>
            <div className="md:col-span-2">
              <p className="text-slate-700 leading-relaxed mb-4">{c.blurb}</p>
              <ul className="grid sm:grid-cols-2 gap-1 text-sm text-slate-700 mb-4">
                {c.extras.map((e) => <li key={e}>· {e}</li>)}
              </ul>
              <div className="flex flex-wrap gap-2 mb-5">
                {topicsByStep[c.id].map((tp) => (
                  <span key={tp} className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-full">{tp}</span>
                ))}
              </div>
              <div className="flex flex-wrap gap-3">
                <Link to="/auth" search={{ mode: "signup" }} className="inline-flex items-center gap-1 text-[#1a4b7c] font-bold text-sm hover:gap-2 transition-all">
                  Try {c.short} free <ChevronRight className="h-4 w-4" />
                </Link>
                <a href={waLink(`Hi, I'd like to subscribe to StepFighter — ${c.name}. Please guide me for activation.`)}
                   target="_blank" rel="noreferrer"
                   className="inline-flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white font-bold text-xs rounded-md hover:opacity-90">
                  <MessageCircle className="h-3 w-3" /> Register on WhatsApp
                </a>
              </div>
            </div>
          </div>
        ))}

        <div className="bg-gradient-to-br from-[#0d2b4e] to-[#1a4b7c] rounded-xl p-10 text-white text-center mt-12">
          <FileText className="h-12 w-12 text-amber-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Not sure which Step to start with?</h2>
          <p className="text-slate-300 mb-6">Start the 14-day free trial — full library, no card, no commitment.</p>
          <Link to="/auth" search={{ mode: "signup" }} className="inline-block px-8 py-4 bg-amber-400 text-[#0d2b4e] font-bold rounded-md hover:bg-white">
            Create Free Account
          </Link>
        </div>
      </section>
    </SiteLayout>
  );
}
