import { Link } from "@tanstack/react-router";
import { Menu, X, MessageCircle, Mail } from "lucide-react";
import { useState, type ReactNode } from "react";
import { NAV_LINKS, SITE, waLink } from "@/lib/site";

export function SiteLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-white text-slate-800" style={{ fontFamily: "Verdana, Geneva, sans-serif" }}>
      <div className="min-h-screen bg-white text-slate-800" style={{ fontFamily: "Verdana, Geneva, sans-serif" }}>


      {/* Nav */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-md bg-[#1a4b7c] text-white grid place-items-center font-bold">SF</div>
            <div>
              <div className="text-[#1a4b7c] font-bold text-lg leading-none">StepFighter</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-widest">USMLE Prep</div>
            </div>
          </Link>
          <nav className="hidden lg:flex items-center gap-7 text-sm font-semibold text-slate-700">
            {NAV_LINKS.map((l) => (
              <Link key={l.to} to={l.to} className="hover:text-[#1a4b7c] transition-colors" activeProps={{ className: "text-[#1a4b7c]" }}>
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="hidden lg:flex items-center gap-2">
            <Link to="/auth" className="px-4 py-2 text-sm font-semibold text-[#1a4b7c] hover:bg-slate-100 rounded-md">Sign in</Link>
            <Link to="/auth" search={{ mode: "signup" }} className="px-4 py-2 text-sm font-bold bg-[#1a4b7c] text-white rounded-md hover:bg-[#0d2b4e]">
              Get Started
            </Link>
          </div>
          <button onClick={() => setOpen(!open)} className="lg:hidden p-2 text-slate-700" aria-label="Menu">
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
        {open && (
          <div className="lg:hidden border-t border-slate-200 bg-white">
            <div className="px-4 py-3 flex flex-col gap-2">
              {NAV_LINKS.map((l) => (
                <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="py-2 text-sm font-semibold text-slate-700">
                  {l.label}
                </Link>
              ))}
              <div className="flex gap-2 pt-2 border-t border-slate-200 mt-2">
                <Link to="/auth" onClick={() => setOpen(false)} className="flex-1 py-2 text-center text-sm font-semibold text-[#1a4b7c] border border-slate-300 rounded-md">Sign in</Link>
                <Link to="/auth" search={{ mode: "signup" }} onClick={() => setOpen(false)} className="flex-1 py-2 text-center text-sm font-bold bg-[#1a4b7c] text-white rounded-md">Get Started</Link>
              </div>
            </div>
          </div>
        )}
      </header>

      <main>{children}</main>

      {/* Footer */}
      <footer className="bg-[#0d2b4e] text-slate-300 mt-20">
        <div className="max-w-7xl mx-auto px-4 py-14 grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-9 w-9 rounded-md bg-amber-400 text-[#0d2b4e] grid place-items-center font-bold">SF</div>
              <span className="text-white font-bold text-lg">StepFighter</span>
            </div>
            <p className="text-sm text-slate-400 max-w-md leading-relaxed">
              A high-yield USMLE preparation platform built by physicians for IMGs and US medical students.
              Board-style questions across Step 1, Step 2 CK, and Step 3 with NBME-style self-assessments.
            </p>
            <div className="mt-6 flex gap-3">
              <a href={waLink("Hi, I'd like to know more about StepFighter plans.")} target="_blank" rel="noreferrer"
                 className="inline-flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white text-sm font-bold rounded-md hover:opacity-90">
                <MessageCircle className="h-4 w-4" /> WhatsApp Us
              </a>
              <a href={`mailto:${SITE.email}`} className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 text-white text-sm font-bold rounded-md hover:bg-white/20">
                <Mail className="h-4 w-4" /> Email
              </a>
            </div>
          </div>
          <div>
            <h5 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">Explore</h5>
            <ul className="space-y-2 text-sm">
              {NAV_LINKS.map((l) => (
                <li key={l.to}><Link to={l.to} className="hover:text-amber-300">{l.label}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <h5 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">Legal</h5>
            <ul className="space-y-2 text-sm">
              <li><Link to="/terms" className="hover:text-amber-300">Terms of Service</Link></li>
              <li><Link to="/privacy" className="hover:text-amber-300">Privacy Policy</Link></li>
              <li><Link to="/refund" className="hover:text-amber-300">Refund Policy</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="max-w-7xl mx-auto px-4 py-5 text-xs text-slate-400 text-center md:text-left">
            <span>© {new Date().getFullYear()} StepFighter. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
