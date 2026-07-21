// Site-wide contact + brand constants. Update WhatsApp/email here.
export const SITE = {
  brand: "StepFighter",
  tagline: "Your Gateway to USMLE Success",
  whatsapp: "923000000000", // intl format, no +
  email: "support@stepfighter.app",
  currencyNote: "PKR / USD accepted via WhatsApp checkout",
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
