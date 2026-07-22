// Site-wide brand + course catalog. Update WhatsApp/email + prices here.
export const SITE = {
  brand: "StepFighter",
  tagline: "Sharper prep. Sharper score.",
  whatsapp: "923000000000", // intl format, no +
  email: "support@stepfighter.com",
  telegram: "stepfighter", // t.me/<handle>
  currencyNote: "USD — regional payment methods confirmed on WhatsApp",
};

export const waLink = (message: string) =>
  `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(message)}`;

export const NAV_LINKS = [
  { to: "/", label: "Home" },
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
  price: Record<Duration, { usd: number }>;
};

const PLAN_FEATURES = [
  "AI‑Powered Study Plans & Performance Analysis",
  "Unlimited Quiz Resets & Custom Quizzes",
  "Flashcards (Manual)",
  "Integrated Medical Library",
  "Peer Ranking & Progress Tracking",
  "Free Updates During Subscription",
  "WhatsApp & Email Support",
];

export const COURSES: Course[] = [
  {
    id: "step1",
    name: "USMLE Step 1",
    short: "Step 1",
    blurb: "Board-style questions for Step 1.",
    tagline: "Step 1 QBank",
    extras: PLAN_FEATURES,
    price: { "6mo": { usd: 30 }, "12mo": { usd: 50 } },
  },
  {
    id: "step2ck",
    name: "USMLE Step 2 CK",
    short: "Step 2 CK",
    blurb: "Board-style questions for Step 2 CK.",
    tagline: "Step 2 CK QBank",
    extras: PLAN_FEATURES,
    price: { "6mo": { usd: 30 }, "12mo": { usd: 50 } },
  },
  {
    id: "step3",
    name: "USMLE Step 3",
    short: "Step 3",
    blurb: "Board-style questions for Step 3.",
    tagline: "Step 3 QBank",
    extras: PLAN_FEATURES,
    price: { "6mo": { usd: 30 }, "12mo": { usd: 50 } },
  },
  {
    id: "combo",
    name: "Combo Plan",
    short: "Combo",
    blurb: "Every question, every form, every Step — the full StepFighter library in one subscription.",
    tagline: "Full library",
    extras: ["Step 1 + Step 2 CK + Step 3 — full access", ...PLAN_FEATURES],
    price: { "6mo": { usd: 60 }, "12mo": { usd: 99 } },
  },
];

export const durationLabel: Record<Duration, string> = {
  "6mo": "6 Months",
  "12mo": "12 Months",
};
