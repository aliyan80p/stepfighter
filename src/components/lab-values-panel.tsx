import { useMemo, useState } from "react";
import { X, Search } from "lucide-react";
import { LAB_TABS, type LabTabKey } from "@/data/lab-values";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * USMLE-Fighter–style Lab Values panel — a right-side sliding drawer with
 * 4 tabs (Blood / Serum / CSF / Urine & BMI), an SI Reference toggle, and
 * a search field that filters the visible rows.
 */
export function LabValuesPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<LabTabKey>("Blood");
  const [showSI, setShowSI] = useState(false);
  const [query, setQuery] = useState("");

  const activeTab = LAB_TABS.find((t) => t.key === tab)!;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeTab.rows;
    return activeTab.rows.filter((row) => {
      if (row.analyte.toLowerCase().includes(q)) return true;
      if (row.subgroups.some((s) => s.toLowerCase().includes(q))) return true;
      if (row.conventional.some((s) => s.toLowerCase().includes(q))) return true;
      if (row.si.some((s) => s.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [activeTab.rows, query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[190] flex" onClick={onClose}>
      <div className="flex-1 bg-black/40" />
      <aside
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:w-[560px] max-w-full h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
      >
        {/* Header */}
        <header
          className="px-4 py-3 text-white shrink-0 flex items-center justify-between"
          style={{ backgroundColor: "#1a4b7c" }}
        >
          <div>
            <div className="text-sm font-bold tracking-wide">Lab Values</div>
            <div className="text-[11px] opacity-80">NBME reference intervals</div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-[12px] cursor-pointer select-none">
              <span>SI</span>
              <span
                className={cn(
                  "relative inline-flex h-4 w-8 items-center rounded-full transition-colors",
                  showSI ? "bg-sky-400" : "bg-white/25",
                )}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={showSI}
                  onChange={(e) => setShowSI(e.target.checked)}
                />
                <span
                  className={cn(
                    "inline-block h-3 w-3 rounded-full bg-white transition-transform",
                    showSI ? "translate-x-4" : "translate-x-0.5",
                  )}
                />
              </span>
            </label>
            <button
              onClick={onClose}
              aria-label="Close lab values"
              className="h-8 w-8 rounded flex items-center justify-center hover:bg-white/15"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Tabs */}
        <div className="border-b bg-slate-50 shrink-0 flex overflow-x-auto qbank-nav-scroll">
          {LAB_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                t.key === tab
                  ? "border-[#1a4b7c] text-[#1a4b7c]"
                  : "border-transparent text-slate-500 hover:text-slate-800",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="px-3 py-2 shrink-0 border-b bg-white">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-8 h-9"
              placeholder="Search analytes…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-[11px] uppercase tracking-wider text-slate-600 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Analyte</th>
                <th className="text-left px-3 py-2 font-semibold">Reference range</th>
                {showSI && <th className="text-left px-3 py-2 font-semibold">SI</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={showSI ? 3 : 2} className="px-3 py-6 text-center text-slate-500">
                    No matches for &ldquo;{query}&rdquo;.
                  </td>
                </tr>
              )}
              {filtered.map((row, i) => (
                <tr key={`${row.analyte}-${i}`} className="border-b last:border-b-0 align-top">
                  <td className="px-3 py-2 font-medium text-slate-800">
                    <div>{row.analyte}</div>
                    {row.subgroups.length > 0 && (
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {row.subgroups.map((s, j) => (
                          <div key={j}>{s}</div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-700 whitespace-pre-line">
                    {row.conventional.join("\n")}
                  </td>
                  {showSI && (
                    <td className="px-3 py-2 text-slate-600 whitespace-pre-line">
                      {row.si.join("\n")}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </aside>
    </div>
  );
}
