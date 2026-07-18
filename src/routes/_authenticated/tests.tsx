import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listTests, deleteTest, suspendTest, renameTest } from "@/lib/qbank.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  FileText, BarChart3, Trash2, Pencil, ArrowUpDown, Search, Filter, ListOrdered, MoreVertical, Copy,
} from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/imd-qbank-logo.png";

export const Route = createFileRoute("/_authenticated/tests")({
  component: TestsList,
});

type SortKey = "name" | "score" | "date" | "mode" | "status" | "qs";
type StatusFilter = "all" | "completed" | "suspended" | "not_started";

function TestsList() {
  const fn = useServerFn(listTests);
  const delFn = useServerFn(deleteTest);
  const susFn = useServerFn(suspendTest);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["tests"], queryFn: () => fn() });

  const [pageSize, setPageSize] = useState(5);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState(false);

  const rows = useMemo(() => {
    return (data ?? []).map((t) => {
      const answered = t.right_count + t.wrong_count;
      const total = (t.question_ids as number[])?.length ?? answered;
      const scorePct = total ? Math.round((t.right_count / total) * 100) : 0;
      const st: "completed" | "suspended" | "not_started" =
        t.done ? "completed" : answered > 0 ? "suspended" : "not_started";
      const name = `Custom Quiz ${new Date(t.created_at).toLocaleString()}`;
      return { ...t, answered, scorePct, status: st, name };
    });
  }, [data]);

  const filtered = useMemo(() => {
    let out = rows;
    if (status !== "all") out = out.filter((r) => r.status === status);
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter((r) => r.name.toLowerCase().includes(q) || r.subjectNames.join(" ").toLowerCase().includes(q));
    }
    out = [...out].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name": cmp = a.name.localeCompare(b.name); break;
        case "score": cmp = a.scorePct - b.scorePct; break;
        case "date": cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); break;
        case "mode": cmp = a.mode.localeCompare(b.mode); break;
        case "status": cmp = a.status.localeCompare(b.status); break;
        case "qs": cmp = a.total - b.total; break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return out.slice(0, pageSize);
  }, [rows, status, search, sortKey, sortAsc, pageSize]);

  const totals = useMemo(() => ({
    saved: rows.length,
    completed: rows.filter((r) => r.status === "completed").length,
    suspended: rows.filter((r) => r.status === "suspended").length,
  }), [rows]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortAsc((v) => !v);
    else { setSortKey(k); setSortAsc(true); }
  };

  const onDelete = async (id: number) => {
    if (!confirm("Delete this test?")) return;
    await delFn({ data: { testId: id } });
    toast.success("Test deleted");
    qc.invalidateQueries({ queryKey: ["tests"] });
  };
  const onSuspend = async (id: number) => {
    await susFn({ data: { testId: id } });
    toast.success("Test suspended");
    qc.invalidateQueries({ queryKey: ["tests"] });
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header banner */}
      <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Previous Tests</h1>
              <p className="text-sm text-muted-foreground max-w-2xl">
                Review every saved attempt, continue suspended quizzes, and open results without losing any table tools.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <StatCard label="Saved Tests" value={totals.saved} />
            <StatCard label="Completed" value={totals.completed} accent="success" />
            <StatCard label="Suspended" value={totals.suspended} accent="warn" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FilterCard icon={<ListOrdered className="h-4 w-4" />} label="Show Entries">
          <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {[5, 10, 25, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </FilterCard>
        <FilterCard icon={<Filter className="h-4 w-4" />} label="Status">
          <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="not_started">Not Started</SelectItem>
            </SelectContent>
          </Select>
        </FilterCard>
        <FilterCard icon={<Search className="h-4 w-4" />} label="Search">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search quizzes…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </FilterCard>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border overflow-hidden">
        <div className="bg-muted/50 grid grid-cols-[2fr_1fr_1fr_0.8fr_1fr_1.2fr_0.7fr_1.4fr] gap-4 px-4 py-3 text-sm font-medium">
          <SortHeader label="Name" k="name" sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} />
          <SortHeader label="Score" k="score" sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} />
          <SortHeader label="Date" k="date" sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} />
          <SortHeader label="Mode" k="mode" sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} />
          <SortHeader label="Status" k="status" sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} />
          <div className="flex items-center gap-1 text-muted-foreground">Subjects</div>
          <SortHeader label="Qs" k="qs" sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} />
          <div className="text-muted-foreground">Actions</div>
        </div>
        <div className="divide-y divide-border">
          {isLoading && <div className="p-6 text-muted-foreground">Loading…</div>}
          {!isLoading && filtered.length === 0 && (
            <div className="p-6 text-muted-foreground">
              No tests match. <Link to="/new-test" className="text-primary underline">Start a new test</Link>.
            </div>
          )}
          {filtered.map((r) => {
            const d = new Date(r.created_at);
            return (
              <div key={r.id} className="grid grid-cols-[2fr_1fr_1fr_0.8fr_1fr_1.2fr_0.7fr_1.4fr] gap-4 px-4 py-4 items-center hover:bg-muted/30 transition-colors">
                <div>
                  <div className="font-medium text-sm">{r.name}</div>
                  <div className="mt-2 flex gap-1.5">
                    <IconBtn title="Rename" onClick={() => toast.info("Rename coming soon")}><Pencil className="h-3.5 w-3.5" /></IconBtn>
                    <IconBtn title="Suspend" onClick={() => onSuspend(r.id)}><Pause className="h-3.5 w-3.5" /></IconBtn>
                    <IconBtn title="Delete" tone="danger" onClick={() => onDelete(r.id)}><Trash2 className="h-3.5 w-3.5" /></IconBtn>
                  </div>
                </div>
                <div>
                  <div className="text-lg font-bold">{r.scorePct}%</div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-primary to-primary/60" style={{ width: `${r.scorePct}%` }} />
                  </div>
                </div>
                <div>
                  <div className="text-sm">{d.toLocaleDateString()}</div>
                  <div className="text-xs text-muted-foreground">{d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
                <div>
                  <Pill tone="mode">{r.mode}</Pill>
                </div>
                <div>
                  {r.status === "completed" && <Pill tone="success">Completed</Pill>}
                  {r.status === "suspended" && <Pill tone="warn">Suspended</Pill>}
                  {r.status === "not_started" && <Pill tone="muted">Not Started</Pill>}
                </div>
                <div>
                  <Pill tone="muted">{r.subjectNames.length > 1 ? "Multiple" : r.subjectNames[0] ?? "—"}</Pill>
                </div>
                <div>
                  <div className="font-bold">{r.total}</div>
                  <div className="text-xs text-muted-foreground">questions</div>
                </div>
                <div className="flex gap-2">
                  {r.status !== "completed" && r.answered > 0 && (
                    <Button size="sm" variant="outline" onClick={() => navigate({ to: "/test/$id", params: { id: String(r.id) } })}>
                      Resume
                    </Button>
                  )}
                  {r.status === "not_started" && (
                    <Button size="sm" variant="secondary" onClick={() => navigate({ to: "/test/$id", params: { id: String(r.id) } })}>
                      <FileText className="h-3.5 w-3.5 mr-1" /> Start
                    </Button>
                  )}
                  {r.answered > 0 && (
                    <Button size="sm" variant="secondary" onClick={() => navigate({ to: "/test-results/$id", params: { id: String(r.id) } })}>
                      <FileText className="h-3.5 w-3.5 mr-1" /> Results
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => toast.info("Test analysis coming soon")}>
                    <BarChart3 className="h-3.5 w-3.5 mr-1" /> Analysis
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: "success" | "warn" }) {
  const color = accent === "success" ? "text-emerald-500" : accent === "warn" ? "text-amber-500" : "text-primary";
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 min-w-[110px]">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function FilterCard({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        <span className="h-6 w-6 rounded-md bg-primary/10 text-primary flex items-center justify-center">{icon}</span>
        {label}
      </div>
      {children}
    </div>
  );
}

function SortHeader({ label, k, sortKey, sortAsc, onSort }: { label: string; k: SortKey; sortKey: SortKey; sortAsc: boolean; onSort: (k: SortKey) => void }) {
  const active = sortKey === k;
  return (
    <button onClick={() => onSort(k)} className={`flex items-center gap-1 text-left ${active ? "text-foreground" : "text-muted-foreground"}`}>
      {label}
      <ArrowUpDown className={`h-3 w-3 ${active ? "opacity-100" : "opacity-50"} ${active && sortAsc ? "rotate-180" : ""}`} />
    </button>
  );
}

function Pill({ children, tone }: { children: React.ReactNode; tone: "success" | "warn" | "muted" | "mode" }) {
  const cls =
    tone === "success" ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" :
    tone === "warn" ? "bg-amber-500/15 text-amber-500 border-amber-500/30" :
    tone === "mode" ? "bg-orange-500/15 text-orange-500 border-orange-500/30 capitalize" :
    "bg-muted text-muted-foreground border-border";
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>{children}</span>;
}

function IconBtn({ children, onClick, title, tone }: { children: React.ReactNode; onClick: () => void; title: string; tone?: "danger" }) {
  const cls = tone === "danger"
    ? "hover:bg-destructive/10 hover:text-destructive"
    : "hover:bg-muted";
  return (
    <button title={title} onClick={onClick} className={`h-7 w-7 rounded-md border border-border flex items-center justify-center text-muted-foreground transition-colors ${cls}`}>
      {children}
    </button>
  );
}
