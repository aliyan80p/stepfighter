import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { SITE, waLink } from "@/lib/site";

export const Route = createFileRoute("/refund")({
  head: () => ({
    meta: [
      { title: "Refund Policy — StepFighter" },
      { name: "description", content: "StepFighter's 3-day full refund policy for subscription plans." },
      { property: "og:title", content: "Refund Policy — StepFighter" },
      { property: "og:description", content: "Our 3-day full refund policy." },
    ],
  }),
  component: Refund,
});

function Refund() {
  return (
    <SiteLayout>
      <article className="max-w-3xl mx-auto px-4 py-16 prose prose-slate">
        <h1 className="text-3xl font-bold text-[#0d2b4e]">Refund Policy</h1>
        <p className="text-sm text-slate-500">Last updated: {new Date().toLocaleDateString()}</p>

        <h2>3-Day Full Refund</h2>
        <p>If StepFighter isn't the right fit for you, request a full refund within <b>3 days</b> of account activation. No questions asked.</p>

        <h2>How to Request</h2>
        <ol>
          <li>Message us on <a href={waLink("Hi, I would like to request a refund.")} target="_blank" rel="noreferrer">WhatsApp</a> or email <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.</li>
          <li>Include the email address on your StepFighter account and payment reference.</li>
          <li>We process refunds within 5–7 business days via the original payment method.</li>
        </ol>

        <h2>After 3 Days</h2>
        <p>After the 3-day window, refunds are not available. However, unused subscription time can be transferred to another user in special circumstances at our discretion.</p>

        <h2>Non-Refundable</h2>
        <ul>
          <li>Accounts terminated for credential sharing, content scraping or Terms violations.</li>
          <li>Requests made more than 3 days after activation.</li>
        </ul>

        <h2>Contact</h2>
        <p>Email <a href={`mailto:${SITE.email}`}>{SITE.email}</a> or message us on WhatsApp for any refund questions.</p>
      </article>
    </SiteLayout>
  );
}
