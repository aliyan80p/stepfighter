import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { SITE } from "@/lib/site";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — StepFighter" },
      { name: "description", content: "How StepFighter collects, uses and protects your personal information." },
      { property: "og:title", content: "Privacy Policy — StepFighter" },
      { property: "og:description", content: "How StepFighter handles your data." },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <SiteLayout>
      <article className="max-w-3xl mx-auto px-4 py-16 prose prose-slate">
        <h1 className="text-3xl font-bold text-[#0d2b4e]">Privacy Policy</h1>
        <p className="text-sm text-slate-500">Last updated: {new Date().toLocaleDateString()}</p>
        <p>This page is maintained by the StepFighter team to describe how we collect, use and protect information on the StepFighter platform.</p>

        <h2>Information We Collect</h2>
        <ul>
          <li><b>Account info:</b> name, email address, target exam, target date, medical school (optional)</li>
          <li><b>Usage data:</b> questions answered, scores, time spent, feature usage</li>
          <li><b>Support communications:</b> messages sent via WhatsApp or email</li>
        </ul>

        <h2>How We Use Information</h2>
        <ul>
          <li>Provide and improve the Service</li>
          <li>Generate personal performance analytics and score predictions</li>
          <li>Communicate about your subscription and support</li>
          <li>Detect and prevent fraud or credential sharing</li>
        </ul>

        <h2>How We Share Information</h2>
        <p>We do not sell your personal information. We share limited information only with service providers required to run the platform (hosting, database, analytics) and only under confidentiality agreements.</p>

        <h2>Data Security</h2>
        <p>We use encryption in transit (HTTPS/TLS) and at rest. Passwords are hashed. Access to production systems is limited to authorized personnel.</p>

        <h2>Retention</h2>
        <p>Account and performance data is retained while your account is active and for a reasonable period afterward to enable reactivation. You can request deletion by emailing us.</p>

        <h2>Your Rights</h2>
        <p>You may request access, correction or deletion of your data at any time by emailing <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.</p>

        <h2>Cookies</h2>
        <p>We use minimal cookies for authentication and session management. We do not use third-party advertising cookies.</p>

        <h2>Children</h2>
        <p>The Service is not directed to individuals under 16. We do not knowingly collect information from children.</p>

        <h2>Changes</h2>
        <p>We may update this policy. Material changes will be announced via email or in-app notice.</p>

        <h2>Contact</h2>
        <p>Email <a href={`mailto:${SITE.email}`}>{SITE.email}</a> with any privacy questions.</p>
      </article>
    </SiteLayout>
  );
}
