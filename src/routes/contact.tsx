import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { SITE, waLink } from "@/lib/site";
import { MessageCircle, Mail, Clock } from "lucide-react";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact StepFighter — Support & Sales" },
      { name: "description", content: "Reach the StepFighter team on WhatsApp or email for Step 1, 2 CK & 3 QBank support, activation help and subscription questions." },
      { property: "og:title", content: "Contact StepFighter" },
      { property: "og:description", content: "Get in touch with our board prep team — WhatsApp and email support." },
    ],
  }),
  component: Contact,
});

function Contact() {
  return (
    <SiteLayout>
      <section className="bg-gradient-to-br from-[#0d2b4e] to-[#1a4b7c] text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-3">Get in Touch</div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">We're here to help</h1>
          <p className="text-lg text-slate-200">Fast responses from real physicians — no bots, no ticket queues.</p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 py-16 grid md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-2xl font-bold text-[#0d2b4e] mb-6">Contact Information</h2>
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="h-12 w-12 rounded-md bg-[#25D366]/10 text-[#25D366] grid place-items-center flex-shrink-0">
                <MessageCircle className="h-6 w-6" />
              </div>
              <div>
                <div className="font-bold text-[#0d2b4e]">WhatsApp (fastest)</div>
                <a href={waLink("Hi StepFighter team,")} target="_blank" rel="noreferrer"
                   className="text-[#1a4b7c] hover:underline break-all">+{SITE.whatsapp}</a>
                <div className="text-xs text-slate-500 mt-1">Typical reply: within minutes</div>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="h-12 w-12 rounded-md bg-[#1a4b7c]/10 text-[#1a4b7c] grid place-items-center flex-shrink-0">
                <Mail className="h-6 w-6" />
              </div>
              <div>
                <div className="font-bold text-[#0d2b4e]">Email</div>
                <a href={`mailto:${SITE.email}`} className="text-[#1a4b7c] hover:underline">{SITE.email}</a>
                <div className="text-xs text-slate-500 mt-1">Typical reply: within 24 hours</div>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="h-12 w-12 rounded-md bg-amber-400/20 text-amber-600 grid place-items-center flex-shrink-0">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <div className="font-bold text-[#0d2b4e]">Support Hours</div>
                <div className="text-slate-700">7 days a week</div>
                <div className="text-xs text-slate-500 mt-1">Extended hours during exam seasons</div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 rounded-lg p-8 border border-slate-200">
          <h2 className="text-xl font-bold text-[#0d2b4e] mb-4">Send a message</h2>
          <p className="text-sm text-slate-600 mb-6">Fill in the details below and we'll reply via WhatsApp or email.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = e.currentTarget;
              const name = (f.elements.namedItem("name") as HTMLInputElement).value;
              const subj = (f.elements.namedItem("subject") as HTMLInputElement).value;
              const msg = (f.elements.namedItem("message") as HTMLTextAreaElement).value;
              window.open(waLink(`Hi, I'm ${name}. Subject: ${subj}. ${msg}`), "_blank");
            }}
            className="space-y-4"
          >
            <input name="name" required placeholder="Your name" className="w-full px-4 py-3 border border-slate-300 rounded-md text-sm focus:border-[#1a4b7c] focus:outline-none" />
            <input name="email" type="email" required placeholder="Email address" className="w-full px-4 py-3 border border-slate-300 rounded-md text-sm focus:border-[#1a4b7c] focus:outline-none" />
            <input name="subject" required placeholder="Subject" className="w-full px-4 py-3 border border-slate-300 rounded-md text-sm focus:border-[#1a4b7c] focus:outline-none" />
            <textarea name="message" required rows={5} placeholder="How can we help?" className="w-full px-4 py-3 border border-slate-300 rounded-md text-sm focus:border-[#1a4b7c] focus:outline-none" />
            <button type="submit" className="w-full py-3 bg-[#1a4b7c] text-white font-bold rounded-md hover:bg-[#0d2b4e] inline-flex items-center justify-center gap-2">
              <MessageCircle className="h-4 w-4" /> Send via WhatsApp
            </button>
          </form>
        </div>
      </section>
    </SiteLayout>
  );
}
