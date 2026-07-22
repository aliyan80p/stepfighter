import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { SITE } from "@/lib/site";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — StepFighter" },
      { name: "description", content: "StepFighter terms of service governing use of our Step 1, 2 CK & 3 QBank platform." },
      { property: "og:title", content: "Terms of Service — StepFighter" },
      { property: "og:description", content: "Terms of service for StepFighter board prep." },
    ],
  }),
  component: Terms,
});

function Terms() {
  return (
    <SiteLayout>
      <article className="max-w-3xl mx-auto px-4 py-16 prose prose-slate">
        <h1 className="text-3xl font-bold text-[#0d2b4e]">Terms of Service</h1>
        <p className="text-sm text-slate-500">Last updated: {new Date().toLocaleDateString()}</p>
        <p>This page is maintained by the StepFighter team to describe the terms governing use of the StepFighter platform (the "Service") at stepfighter.app.</p>

        <h2>1. Acceptance of Terms</h2>
        <p>By creating an account or using the Service, you agree to these Terms. If you do not agree, do not use the Service.</p>

        <h2>2. The Service</h2>
        <p>StepFighter provides a subscription-based online medical board prep platform including question banks, self-assessments, explanations and analytics. Content is provided for educational purposes only and is not medical advice.</p>

        <h2>3. Accounts</h2>
        <p>You must provide accurate information when creating an account. You are responsible for keeping your credentials confidential and for all activity under your account. Accounts are for individual use — sharing credentials or reselling access is prohibited and results in immediate termination without refund.</p>

        <h2>4. Subscriptions & Payment</h2>
        <p>Subscriptions are activated after payment confirmation via WhatsApp, email or supported channels. Prices are listed on the Pricing page. All subscriptions are prepaid for the stated duration and do not auto-renew.</p>

        <h2>5. Free Trial</h2>
        <p>New accounts receive an 8-day free trial with limited access. Trials do not require payment and end automatically.</p>

        <h2>6. Refunds</h2>
        <p>All sales are final. Due to the digital nature of our content, we do not offer refunds once a subscription has been purchased and delivered. We encourage every user to make full use of the free trial before subscribing. See our <a href="/refund">Refund Policy</a> for complete details.</p>

        <h2>7. Intellectual Property</h2>
        <p>StepFighter owns the platform, software, algorithms, analytics, user interface, and the curated compilation of study materials. The question banks and media were sourced from licensed material supplied by the account owner, decrypted and imported at the owner's direction, then corrected, categorized, and reorganized by StepFighter's AI-assisted tooling. This curated content and platform output are protected. You may not copy, reproduce, distribute, publish, upload, post, transmit, reverse engineer, scrape, or resell any content or platform code without prior written permission.</p>

        <h2>8. Prohibited Conduct</h2>
        <ul>
          <li>Reverse engineering, scraping, or downloading questions in bulk</li>
          <li>Sharing account credentials</li>
          <li>Reproducing content on other platforms or study groups</li>
          <li>Uploading malicious code or attempting to breach security</li>
        </ul>

        <h2>9. Disclaimer</h2>
        <p>The Service is provided "as is" for educational and self-assessment purposes only. StepFighter is an independent study platform and is not a substitute for accredited medical education, clinical training, or professional medical judgment. Score predictions are estimates and do not guarantee any exam outcome. Use the Service as a supplement to your curriculum, not a replacement for it.</p>

        <h2>10. Limitation of Liability</h2>
        <p>To the maximum extent permitted by law, StepFighter is not liable for indirect, incidental, or consequential damages. Total liability is limited to the amount you paid in the preceding 12 months.</p>

        <h2>11. Changes</h2>
        <p>We may update these Terms from time to time. Continued use of the Service after changes constitutes acceptance.</p>

        <h2>12. Contact</h2>
        <p>Questions? Email <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.</p>
      </article>
    </SiteLayout>
  );
}
