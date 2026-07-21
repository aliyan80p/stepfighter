import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { BookOpen, ChevronRight, FileText } from "lucide-react";

export const Route = createFileRoute("/qbank")({
  head: () => ({
    meta: [
      { title: "QBanks — StepFighter USMLE Question Banks" },
      { name: "description", content: "Explore StepFighter's USMLE QBanks: Step 1, Step 2 CK with 22 CMS forms, Step 3, and 40+ NBME-style self-assessments." },
      { property: "og:title", content: "StepFighter QBanks" },
      { property: "og:description", content: "Step 1, Step 2 CK, Step 3, CMS forms and NBME-style self-assessments." },
    ],
  }),
  component: QBankPage,
});

const banks = [
  {
    t: "Step 1", n: "5,200+", d: "Foundational science and pathophysiology integrated with clinical vignettes. Covers anatomy, biochemistry, microbiology, immunology, pharmacology, pathology and behavioral sciences.",
    topics: ["Cardiovascular", "Renal", "Endocrine", "Neurology", "GI", "Hematology", "Pulmonary", "Reproductive", "MSK", "Psychiatry"],
  },
  {
    t: "Step 2 CK", n: "6,800+", d: "Diagnostic reasoning, management and wards-level clinical judgment. Includes 22 CMS specialty forms across every core rotation.",
    topics: ["Internal Medicine", "Surgery", "Pediatrics", "OB/GYN", "Psychiatry", "Family Medicine", "Emergency Medicine", "Neurology"],
  },
  {
    t: "Step 3", n: "4,000+", d: "Comprehensive practice for the final licensing exam covering FIP (Foundations) and ACM (Advanced Clinical Medicine) with CCS-style scenarios.",
    topics: ["Ambulatory", "Emergency", "Inpatient", "CCS cases", "Biostatistics", "Ethics"],
  },
  {
    t: "Self-Assessments", n: "40+ Forms", d: "Full-length NBME-style exams. Calibrated against NBME 9–31 to predict your real 3-digit score before test day.",
    topics: ["Step 1 SA1–SA4", "Step 2 CK SA1–SA9", "Step 3 SA1–SA2", "CMS forms across specialties"],
  },
];

function QBankPage() {
  return (
    <SiteLayout>
      <section className="bg-gradient-to-br from-[#0d2b4e] to-[#1a4b7c] text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-3">Question Banks</div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">16,000+ board-style questions</h1>
          <p className="text-lg text-slate-200">Complete USMLE coverage — one subscription unlocks every bank, every form, every assessment.</p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 py-16 space-y-6">
        {banks.map((b, i) => (
          <div key={b.t} className="grid md:grid-cols-3 gap-6 p-8 border border-slate-200 rounded-lg hover:border-[#1a4b7c] hover:shadow-lg transition-all">
            <div>
              <div className="text-xs font-mono text-slate-400 mb-2">0{i + 1}</div>
              <div className="flex items-center gap-3 mb-3">
                <BookOpen className="h-8 w-8 text-[#1a4b7c]" />
                <h2 className="text-2xl font-bold text-[#0d2b4e]">{b.t}</h2>
              </div>
              <div className="inline-block px-3 py-1 bg-amber-100 text-amber-700 text-xs font-black rounded-full">{b.n} Questions</div>
            </div>
            <div className="md:col-span-2">
              <p className="text-slate-700 leading-relaxed mb-4">{b.d}</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {b.topics.map((tp) => (
                  <span key={tp} className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-full">{tp}</span>
                ))}
              </div>
              <Link to="/auth" search={{ mode: "signup" }} className="text-[#1a4b7c] font-bold text-sm inline-flex items-center gap-1 hover:gap-2 transition-all">
                Try {b.t} free <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ))}

        <div className="bg-gradient-to-br from-[#0d2b4e] to-[#1a4b7c] rounded-xl p-10 text-white text-center mt-12">
          <FileText className="h-12 w-12 text-amber-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Ready to start practicing?</h2>
          <p className="text-slate-300 mb-6">14-day free trial. No credit card required.</p>
          <Link to="/auth" search={{ mode: "signup" }} className="inline-block px-8 py-4 bg-amber-400 text-[#0d2b4e] font-bold rounded-md hover:bg-white">
            Create Free Account
          </Link>
        </div>
      </section>
    </SiteLayout>
  );
}
