import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { SITE, waLink } from "@/lib/site";

export const Route = createFileRoute("/refund")({
  head: () => ({
    meta: [
      { title: "Refund Policy — StepFighter" },
      { name: "description", content: "StepFighter refund policy for digital subscriptions and free trial access." },
      { property: "og:title", content: "Refund Policy — StepFighter" },
      { property: "og:description", content: "StepFighter refund policy for digital subscriptions and free trial access." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Refund,
});

function Refund() {
  return (
    <SiteLayout>
      <article className="max-w-3xl mx-auto px-4 py-16 prose prose-lg prose-slate prose-headings:text-[#0d2b4e] prose-headings:font-bold prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-3 prose-h2:border-b prose-h2:border-slate-200 prose-h2:pb-2 prose-p:text-[17px] prose-p:leading-relaxed prose-li:text-[17px] prose-a:text-[#0d2b4e] prose-a:underline">
        <h1 className="!text-4xl font-bold text-[#0d2b4e] !mb-2">Refund Policy</h1>
        <p className="text-sm text-slate-500">Last updated: {new Date().toLocaleDateString()}</p>

        <h2>1. Digital Sales Are Final</h2>
        <p>StepFighter sells digital access to study content. Once a subscription is purchased and activated, all sales are final. We do not issue refunds for change of mind or unused access.</p>

        <h2>2. Use the Free Trial</h2>
        <p>Every new account receives an 8-day free trial. Use this period to evaluate the platform before subscribing.</p>

        <h2>3. Technical Issues</h2>
        <p>If you experience a problem that prevents access to content, contact our support team and we will work to resolve it.</p>

        <h2>4. Contact</h2>
        <p>
          Questions? Email <a href={`mailto:${SITE.email}`}>{SITE.email}</a>{" "}
          or message us on{" "}
          <a href={waLink("Hi, I have a question about the StepFighter refund policy.")} target="_blank" rel="noreferrer">
            WhatsApp
          </a>.
        </p>
      </article>
    </SiteLayout>
  );
}
