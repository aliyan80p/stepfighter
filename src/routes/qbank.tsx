import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { COURSES, waLink } from "@/lib/site";
import { BookOpen, ChevronRight, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/qbank")({
  head: () => ({
    meta: [
      { title: "QBanks — StepFighter USMLE Question Banks" },
      { name: "description", content: "Explore StepFighter's USMLE QBanks: Step 1, Step 2 CK with CMS forms, Step 3, and NBME-style self-assessments. Per-Step subscriptions or bundle all three." },
      { property: "og:title", content: "StepFighter QBanks" },
      { property: "og:description", content: "Step 1, Step 2 CK, Step 3, CMS forms and NBME-style self-assessments — subscribe per Step." },
    ],
  }),
  component: QBankPage,
});


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

      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 gap-6">
          {COURSES.map((c, i) => (
            <div key={c.id} className={`rounded-lg p-6 border transition-all ${c.id === "combo" ? "bg-[#0d2b4e] text-white border-[#0d2b4e]" : "bg-white border-slate-200 hover:border-[#1a4b7c] hover:shadow-md"}`}>
              <div className={`text-xs font-mono mb-2 ${c.id === "combo" ? "text-amber-400" : "text-slate-400"}`}>0{i + 1}</div>
              <div className="flex items-center gap-3 mb-3">
                <BookOpen className={`h-7 w-7 ${c.id === "combo" ? "text-amber-400" : "text-[#1a4b7c]"}`} />
                <h2 className={`text-xl font-bold ${c.id === "combo" ? "text-white" : "text-[#0d2b4e]"}`}>{c.name}</h2>
              </div>
              <div className={`text-xs font-bold uppercase tracking-widest mb-2 ${c.id === "combo" ? "text-amber-400" : "text-amber-600"}`}>{c.tagline}</div>
              <p className={`text-sm leading-relaxed mb-4 ${c.id === "combo" ? "text-slate-300" : "text-slate-600"}`}>{c.blurb}</p>
              <div className={`text-sm font-semibold mb-5 ${c.id === "combo" ? "text-white" : "text-[#1a4b7c]"}`}>
                ${c.price["6mo"].usd} / 6 mo · ${c.price["12mo"].usd} / 12 mo
              </div>
              <div className="flex flex-wrap gap-3">
                <Link to="/auth" search={{ mode: "signup" }} className={`inline-flex items-center gap-1 font-bold text-sm hover:gap-2 transition-all ${c.id === "combo" ? "text-amber-400" : "text-[#1a4b7c]"}`}>
                  Try {c.short} free <ChevronRight className="h-4 w-4" />
                </Link>
                <a href={waLink(`Hi, I'd like to subscribe to StepFighter — ${c.name}. Please guide me for activation.`)}
                   target="_blank" rel="noreferrer"
                   className="inline-flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white font-bold text-xs rounded-md hover:opacity-90">
                  <MessageCircle className="h-3 w-3" /> Register on WhatsApp
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>
    </SiteLayout>
  );
}
