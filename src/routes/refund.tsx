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
      <article className="max-w-3xl mx-auto px-4 py-16 prose prose-slate">
        <h1 className="text-3xl font-bold text-[#0d2b4e]">Refund Policy</h1>
        <p className="text-sm text-slate-500">Last updated: {new Date().toLocaleDateString()}</p>

        <p>
          At StepFighter, we are committed to providing high-quality digital study content to our customers. As part of our dedication to transparency and clarity in our services, we have established the following refund policy:
        </p>

        <h2>1. Digital Content Nature</h2>
        <p>
          The products and services offered by StepFighter primarily consist of digital content, including but not limited to software, question banks, audio files, video files, online courses, and subscription-based services. These items are intangible and non-returnable once accessed or downloaded.
        </p>

        <h2>2. No Refunds</h2>
        <p>
          Due to the nature of digital content, we do not offer refunds for purchases made through our platform. Once a digital product has been purchased and delivered to the customer, it is considered consumed, and the transaction is final.
        </p>

        <h2>3. Free Trial</h2>
        <p>
          We understand the importance of ensuring customer satisfaction. To facilitate this, we offer an 8-day free trial that allows users to explore and experience a portion of our content before making a purchase. This enables users to assess the quality and relevance of our offerings and make informed decisions before subscribing.
        </p>

        <h2>4. Access and Delivery</h2>
        <p>
          Upon completion of a purchase, customers are granted immediate access to the digital content through their account on our platform. This access allows users to stream or use the content as per the terms of their purchase.
        </p>

        <h2>5. Exceptional Circumstances</h2>
        <p>
          In rare cases where there are technical issues or errors on our part that prevent customers from accessing the purchased digital content, we will make every effort to resolve the issue promptly. This may include providing alternative access methods or issuing credits for future purchases.
        </p>

        <h2>6. Customer Support</h2>
        <p>
          Our customer support team is available to assist users with any questions or concerns regarding their purchases. While we do not offer refunds for digital content, we strive to provide excellent customer service and resolve any issues to the best of our ability.
        </p>

        <h2>7. Terms of Service Agreement</h2>
        <p>
          By completing a purchase on our platform, customers agree to abide by our Terms of Service, which include the no-refund policy for digital content. We encourage users to review these terms carefully before making a purchase.
        </p>

        <h2>8. Policy Updates</h2>
        <p>
          StepFighter reserves the right to update or modify this refund policy at any time without prior notice. Any changes to the policy will be effective immediately upon posting on our website.
        </p>

        <h2>Contact Us</h2>
        <p>
          If you have any questions or concerns regarding our refund policy for digital content, please don't hesitate to contact our customer support team at{" "}
          <a href={`mailto:${SITE.email}`}>{SITE.email}</a>{" "}
          or message us on{" "}
          <a href={waLink("Hi, I have a question about the StepFighter refund policy.")} target="_blank" rel="noreferrer">
            WhatsApp
          </a>.
        </p>
      </article>
    </SiteLayout>
  );
}
