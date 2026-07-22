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

        <h2>4. Subscription Services</h2>
        <p>Subscriptions are activated after payment confirmation via WhatsApp, email or supported channels. Current plans are listed on the Pricing page. All subscriptions are prepaid for the stated duration and do not auto-renew. Users must manually purchase a new plan to continue access after expiry.</p>

        <h2>5. Free Trial</h2>
        <p>New accounts receive an 8-day free trial for evaluation. Trials do not require payment and end automatically. We encourage every user to make full use of the trial before subscribing.</p>

        <h2>6. Refunds</h2>
        <p>Refund requests may be submitted within 24 hours of the initial subscription. Eligibility requires contacting customer service with a clear explanation. Refund decisions are at StepFighter's discretion and are generally not available beyond this 24-hour window. Cancellation during an active subscription does not qualify for a refund unless covered by this policy. See our <a href="/refund">Refund Policy</a> for complete details.</p>

        <h2>7. Intellectual Property</h2>
        <p>StepFighter owns the platform, software, algorithms, analytics, user interface, and the curated compilation of study materials. The question banks and media were sourced from licensed material supplied by the account owner, decrypted and imported at the owner's direction, then corrected, categorized, and reorganized by StepFighter's AI-assisted tooling. This curated content and platform output are protected. You may not copy, reproduce, distribute, publish, upload, post, transmit, reverse engineer, scrape, or resell any content or platform code without prior written permission.</p>

        <h2>8. Prohibited Conduct</h2>
        <ul>
          <li>Reverse engineering, scraping, or downloading questions in bulk</li>
          <li>Sharing account credentials or unauthorized account sharing</li>
          <li>Reproducing content on other platforms or study groups</li>
          <li>Uploading malicious code or attempting to breach security</li>
        </ul>

        <h2>9. Content Accuracy</h2>
        <p>We strive to keep content accurate and current, but medical knowledge evolves continuously. Content is updated regularly without prior notice. User feedback is welcome and helps improve accuracy.</p>

        <h2>10. Disclaimer</h2>
        <p>The Service is provided "as is" for educational and self-assessment purposes only. StepFighter is an independent study platform and is not a substitute for accredited medical education, clinical training, or professional medical judgment. Score predictions are estimates and do not guarantee any exam outcome. Use the Service as a supplement to your curriculum, not a replacement for it.</p>

        <h2>11. Limitation of Liability</h2>
        <p>To the maximum extent permitted by law, StepFighter is not liable for indirect, incidental, or consequential damages. Total liability is limited to the amount you paid in the preceding 12 months. We are not liable for temporary downtime caused by maintenance or technical issues.</p>

        <h2>12. Termination</h2>
        <p>We may suspend or terminate accounts for violations of these Terms, unauthorized account sharing, or actions that compromise platform integrity. Terminated accounts are not entitled to refunds.</p>

        <h2>13. Changes</h2>
        <p>We may update these Terms from time to time. Continued use of the Service after changes constitutes acceptance.</p>

        <h2>14. Contact</h2>
        <p>Questions? Email <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.</p>
      </article>
    </SiteLayout>
  );
}
