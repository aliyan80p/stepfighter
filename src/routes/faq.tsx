import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { waLink } from "@/lib/site";
import { useState } from "react";
import { ChevronDown, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — StepFighter USMLE QBank" },
      { name: "description", content: "Answers to common questions about StepFighter's USMLE QBanks, subscription plans, payment, activation and refunds." },
      { property: "og:title", content: "StepFighter FAQ" },
      { property: "og:description", content: "Common questions about StepFighter USMLE prep, pricing, activation and refunds." },
    ],
  }),
  component: FAQ,
});

const faqs = [
  {
    q: "What Steps does StepFighter cover?",
    a: "We cover Step 1, Step 2 CK and Step 3 with 16,000+ board-style questions plus 85+ NBME-style self-assessments and CMS specialty forms.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes. Every new account gets a 14-day free trial with access to a sample of each QBank. No credit card required.",
  },
  {
    q: "How much does StepFighter cost?",
    a: "$39 for 6 months or $59 for 12 months (25% savings). One flat price unlocks every Step, every self-assessment and every CMS form.",
  },
  {
    q: "How do I pay?",
    a: "We accept bank transfer, EasyPaisa/JazzCash (Pakistan), Wise, PayPal on request, and crypto. Register via WhatsApp and we'll share instructions for your region.",
  },
  {
    q: "How fast is account activation?",
    a: "Within 1–4 hours of payment confirmation, usually much faster during business hours. Our WhatsApp team activates accounts 7 days a week.",
  },
  {
    q: "Can I get a refund?",
    a: "Yes — full refund within 3 days of activation if the platform isn't the right fit for you. No questions asked.",
  },
  {
    q: "Is the content up to date?",
    a: "Yes. Content is reviewed against the latest NBME content outline. New CMS forms and NBME-style assessments are added every quarter.",
  },
  {
    q: "How does StepFighter compare to UWorld / Amboss?",
    a: "Comparable question quality and explanations at roughly 1/10 the price. We include CMS forms and NBME-style self-assessments that most competitors sell separately.",
  },
  {
    q: "Does it work on mobile and iPad?",
    a: "Yes. Fully responsive on all devices with native touch highlighting, offline PWA support and Prometric-accurate simulation on tablet and desktop.",
  },
  {
    q: "Can I use it on multiple devices?",
    a: "Yes. Your account works across your phone, tablet and laptop with progress synced in real-time.",
  },
  {
    q: "Do you offer group / institution discounts?",
    a: "Yes. Message us on WhatsApp for group pricing (5+ users) or medical school partnerships.",
  },
];

function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <SiteLayout>
      <section className="bg-gradient-to-br from-[#0d2b4e] to-[#1a4b7c] text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-3">Frequently Asked</div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Questions & Answers</h1>
          <p className="text-lg text-slate-200">Can't find what you're looking for? Message us on WhatsApp — we usually reply in minutes.</p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 py-16">
        <div className="space-y-3">
          {faqs.map((f, i) => (
            <div key={f.q} className="border border-slate-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50"
              >
                <span className="font-bold text-[#0d2b4e]">{f.q}</span>
                <ChevronDown className={`h-5 w-5 text-slate-500 transition-transform ${open === i ? "rotate-180" : ""}`} />
              </button>
              {open === i && (
                <div className="px-5 pb-5 text-slate-700 leading-relaxed text-sm">
                  {f.a}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-12 bg-slate-50 rounded-lg p-8 text-center border border-slate-200">
          <h2 className="text-xl font-bold text-[#0d2b4e] mb-2">Still have questions?</h2>
          <p className="text-slate-600 mb-4">Our team is on WhatsApp 7 days a week.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <a href={waLink("Hi, I have a question about StepFighter.")} target="_blank" rel="noreferrer"
               className="px-6 py-3 bg-[#25D366] text-white font-bold rounded-md hover:opacity-90 inline-flex items-center gap-2">
              <MessageCircle className="h-4 w-4" /> WhatsApp Us
            </a>
            <Link to="/contact" className="px-6 py-3 border border-slate-300 text-slate-700 font-bold rounded-md hover:bg-slate-100">
              Contact Form
            </Link>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
