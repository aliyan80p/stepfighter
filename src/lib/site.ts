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
  qcount: string;
  extras: string[];
  price: Record<Duration, { usd: number; pkr: number }>;
};

export const COURSES: Course[] = [
  {
    id: "step1",
    name: "USMLE Step 1",
    short: "Step 1",
    blurb: "Foundational science woven into clinical vignettes — pathology, pharm, micro, physio, biochem.",
    qcount: "5,200+ questions",
    extras: ["4 Step 1 self-assessments (SA1–SA4)", "Full NBME 9–31 score calibration", "AI performance dashboard"],
    price: { "6mo": { usd: 29, pkr: 7900 }, "12mo": { usd: 45, pkr: 12500 } },
  },
  {
    id: "step2ck",
    name: "USMLE Step 2 CK",
    short: "Step 2 CK",
    blurb: "Clinical reasoning, management and wards-level judgment across every core rotation.",
    qcount: "6,800+ questions",
    extras: ["9 Step 2 CK self-assessments (SA1–SA9)", "22 CMS specialty forms", "Ambulatory + inpatient coverage"],
    price: { "6mo": { usd: 35, pkr: 9500 }, "12mo": { usd: 49, pkr: 13500 } },
  },
  {
    id: "step3",
    name: "USMLE Step 3",
    short: "Step 3",
    blurb: "FIP + ACM practice for the final licensing exam — clinic, ER and inpatient scenarios.",
    qcount: "4,000+ questions",
    extras: ["Step 3 SA1 + SA2 assessments", "CCS-style case reasoning", "Biostatistics + ethics drills"],
    price: { "6mo": { usd: 29, pkr: 7900 }, "12mo": { usd: 45, pkr: 12500 } },
  },
  {
    id: "combo",
    name: "All-Steps Combo",
    short: "Combo",
    blurb: "Every question, every form, every Step — the full StepFighter library in one subscription.",
    qcount: "16,000+ questions",
    extras: ["Step 1 + Step 2 CK + Step 3", "All 40+ self-assessment forms", "All 22 CMS forms", "Priority WhatsApp support"],
    price: { "6mo": { usd: 69, pkr: 18500 }, "12mo": { usd: 99, pkr: 26500 } },
  },
];

export const durationLabel: Record<Duration, string> = {
  "6mo": "6 Months",
  "12mo": "12 Months",
};
