// Site-wide brand + course catalog. Update WhatsApp/email + prices here.
export const SITE = {
  brand: "StepFighter",
  tagline: "Sharper prep. Sharper score.",
  whatsapp: "923000000000", // intl format, no +
  email: "support@stepfighter.app",
  telegram: "stepfighter", // t.me/<handle>
  currencyNote: "USD / PKR — regional payment methods confirmed on WhatsApp",
};

export const waLink = (message: string) =>
  `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(message)}`;

export const NAV_LINKS = [
  { to: "/", label: "Home" },
  { to: "/qbank", label: "QBank" },
  { to: "/features", label: "Features" },
  { to: "/pricing", label: "Pricing" },
  { to: "/about", label: "About" },
  { to: "/faq", label: "FAQ" },
  { to: "/contact", label: "Contact" },
] as const;

// Per-course subscription model (USMLE Fighter style — pick the Step you need,
// or grab the Combo for all three).
export type Duration = "6mo" | "12mo";

export type Course = {
  id: "step1" | "step2ck" | "step3" | "combo";
  name: string;
  short: string;
  blurb: string;
  tagline: string;
  extras: string[];
  price: Record<Duration, { usd: number; pkr: number }>;
};

export const COURSES: Course[] = [
  {
    id: "step1",
    name: "USMLE Step 1",
    short: "Step 1",
    blurb: "Foundational science woven into clinical vignettes — pathology, pharm, micro, physio, biochem.",
    tagline: "Foundational science",
    extras: ["Step 1 self-assessments (SA1–SA4)", "Full NBME 9–31 score calibration", "AI performance dashboard"],
    price: { "6mo": { usd: 30, pkr: 8100 }, "12mo": { usd: 45, pkr: 12500 } },
  },
  {
    id: "step2ck",
    name: "USMLE Step 2 CK",
    short: "Step 2 CK",
    blurb: "Clinical reasoning, management and wards-level judgment across every core rotation.",
    tagline: "Clinical mastery",
    extras: ["Step 2 CK self-assessments (SA1–SA9)", "CMS specialty forms", "Ambulatory + inpatient coverage"],
    price: { "6mo": { usd: 30, pkr: 8100 }, "12mo": { usd: 49, pkr: 13500 } },
  },
  {
    id: "step3",
    name: "USMLE Step 3",
    short: "Step 3",
    blurb: "FIP + ACM practice for the final licensing exam — clinic, ER and inpatient scenarios.",
    tagline: "Final licensing",
    extras: ["Step 3 SA1 + SA2 assessments", "CCS-style case reasoning", "Biostatistics + ethics drills"],
    price: { "6mo": { usd: 30, pkr: 8100 }, "12mo": { usd: 45, pkr: 12500 } },
  },
  {
    id: "combo",
    name: "All-Steps Combo",
    short: "Combo",
    blurb: "Every question, every form, every Step — the full StepFighter library in one subscription.",
    tagline: "Full library",
    extras: ["Step 1 + Step 2 CK + Step 3", "All self-assessment forms", "All CMS forms", "Priority WhatsApp support"],
    price: { "6mo": { usd: 60, pkr: 16200 }, "12mo": { usd: 99, pkr: 26500 } },
  },
];

export const durationLabel: Record<Duration, string> = {
  "6mo": "6 Months",
  "12mo": "12 Months",
};
