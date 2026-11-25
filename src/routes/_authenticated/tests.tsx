import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listTests, deleteTest, renameTest } from "@/lib/qbank.functions";
import { useActiveQbankId } from "@/lib/active-qbank";
import { useConfirm } from "@/components/confirm-dialog";

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
  FileText, Trash2, Pencil, ArrowUpDown, Search, MoreVertical, Copy,
  PlayCircle, Rocket, BarChart3, Plus, Eye, CheckCircle2, PauseCircle, ClipboardList,
} from "lucide-react";
import { toast } from "sonner";
import { TableSkeleton } from "@/components/loader";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tests")({
  component: TestsList,
});

type SortKey = "name" | "score" | "date" | "mode" | "status" | "qs";
type StatusFilter = "all" | "completed" | "suspended" | "not_started";

function TestsList() {
  const fn = useServerFn(listTests);
  const delFn = useServerFn(deleteTest);
  const renFn = useServerFn(renameTest);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const qbankId = useActiveQbankId();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const { data, isLoading } = useQuery({
    queryKey: ["tests", qbankId],
    queryFn: () => fn({ data: { qbankId } }),
    staleTime: 30_000,
  });

  const [renaming, setRenaming] = useState<{ id: number; name: string } | null>(null);
  const [pageSize, setPageSize] = useState(25);
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
      const name = (t as any).name && String((t as any).name).trim()
        ? String((t as any).name)
        : `Custom Quiz #${t.id}`;
      return { ...t, answered, scorePct, status: st, name };
    });
  }, [data]);

  const filtered = useMemo(() => {
    let out = rows;
    if (status !== "all") out = out.filter((r) => r.status === status);
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          String(r.id).includes(q) ||
          r.subjectNames.join(" ").toLowerCase().includes(q),
      );
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

  const totals = useMemo(() => {
    const completedRows = rows.filter((r) => r.status === "completed");
    const avgScore = completedRows.length
      ? Math.round(completedRows.reduce((s, r) => s + r.scorePct, 0) / completedRows.length)
      : null;
    return {
      saved: rows.length,
      completed: completedRows.length,
      suspended: rows.filter((r) => r.status === "suspended").length,
      avgScore,
    };
  }, [rows]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortAsc((v) => !v);
    else { setSortKey(k); setSortAsc(true); }
  };

  const onDelete = async (id: number, name: string) => {
    const ok = await confirm({
      title: "Delete this test?",
      description: `"${name}" and all of its attempts will be permanently removed.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    await delFn({ data: { testId: id } });
    toast.success("Test deleted");
    qc.invalidateQueries({ queryKey: ["tests"] });
  };

  return (
    <div className="sf-fluid-page space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Previous Tests</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Resume suspended blocks, review completed tests, and track block scores.
          </p>
        </div>
        <Button asChild className="gap-1.5">
          <Link to="/new-test">
            <Plus className="h-4 w-4" /> New Quiz
          </Link>
        </Button>
      </div>

      {/* Compact KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={ClipboardList} tone="blue" label="Saved Tests" value={String(totals.saved)} />
        <KpiCard icon={CheckCircle2} tone="emerald" label="Completed" value={String(totals.completed)} />
        <KpiCard icon={PauseCircle} tone="amber" label="Suspended" value={String(totals.suspended)} />
        <KpiCard icon={BarChart3} tone="violet" label="Avg Completed" value={totals.avgScore != null ? `${totals.avgScore}%` : "—"} />
      </div>

      {/* Unified Compact Toolbar */}
      <div className="rounded-xl border border-border bg-card p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: "all", label: "All" },
              { id: "completed", label: "Completed" },
              { id: "suspended", label: "Suspended" },
              { id: "not_started", label: "Not Started" },
            ] as { id: StatusFilter; label: string }[]
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatus(f.id)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors",
                status === f.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border text-muted-foreground hover:text-foreground hover:bg-accent/50",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 flex-1 sm:flex-initial justify-end">
          <div className="relative flex-1 sm:w-60 sm:flex-initial">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8 h-8 text-xs"
              placeholder="Search name, ID, subject…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
            <SelectTrigger className="w-[82px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 25, 50, 100].map((n) => (
                <SelectItem key={n} value={String(n)}>{n} rows</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Data Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="bg-muted/40 border-b border-border hidden md:grid grid-cols-[2.2fr_1fr_0.95fr_0.75fr_0.9fr_1.1fr_0.65fr_1.6fr] gap-3 px-4 py-2.5 text-xs font-semibold text-muted-foreground">
          <SortHeader label="Test" k="name" sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} />
          <SortHeader label="Score" k="score" sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} />
          <SortHeader label="Date" k="date" sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} />
          <SortHeader label="Mode" k="mode" sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} />
          <SortHeader label="Status" k="status" sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} />
          <div>Subjects</div>
          <SortHeader label="Qs" k="qs" sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} />
          <div className="text-right">Actions</div>
        </div>

        <div className="divide-y divide-border">
          {isLoading && <div className="p-4"><TableSkeleton rows={6} /></div>}
          {!isLoading && filtered.length === 0 && (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No tests match your filter.{" "}
              <Link to="/new-test" className="text-primary font-medium underline underline-offset-2">
                Generate a new quiz
              </Link>
              .
            </div>
          )}
          {filtered.map((r) => {
            const d = new Date(r.created_at);
            const scoreColor =
              r.scorePct >= 70 ? "bg-emerald-500" : r.scorePct >= 50 ? "bg-amber-500" : "bg-rose-500";
            return (
              <div
                key={r.id}
                className="flex flex-col gap-3 md:grid md:grid-cols-[2.2fr_1fr_0.95fr_0.75fr_0.9fr_1.1fr_0.65fr_1.6fr] md:gap-3 px-4 py-3 md:items-center hover:bg-muted/25 transition-colors"
              >
                {/* Name & ID */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm truncate" title={r.name}>{r.name}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                    ID #{r.id} · {r.answered}/{r.total} answered
                  </div>
                </div>

                {/* Score */}
                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-bold tabular-nums">{r.scorePct}%</span>
                    <span className="text-[10.5px] text-muted-foreground tabular-nums">
                      {r.right_count}/{r.total}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={cn("h-full rounded-full", scoreColor)} style={{ width: `${r.scorePct}%` }} />
                  </div>
                </div>

                {/* Date */}
                <div className="text-xs leading-tight">
                  <div className="font-medium text-foreground">{d.toLocaleDateString()}</div>
                  <div className="text-muted-foreground mt-0.5">
                    {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>

                {/* Mode */}
                <div>
                  <Pill tone="mode">{r.mode === "practice" ? "Tutor" : "Exam"}</Pill>
                </div>

                {/* Status */}
                <div>
                  {r.status === "completed" && <Pill tone="success">Completed</Pill>}
                  {r.status === "suspended" && <Pill tone="warn">Suspended</Pill>}
                  {r.status === "not_started" && <Pill tone="muted">Not Started</Pill>}
                </div>

                {/* Subjects */}
                <div className="text-xs text-muted-foreground truncate" title={r.subjectNames.join(", ")}>
                  {r.subjectNames.length > 1
                    ? `${r.subjectNames[0]} +${r.subjectNames.length - 1}`
                    : r.subjectNames[0] ?? "—"}
                </div>

                {/* Qs */}
                <div className="text-sm font-semibold tabular-nums">{r.total}</div>

                {/* Actions */}
                <div className="flex items-center md:justify-end gap-1.5 flex-wrap">
                  {r.status === "suspended" && (
                    <Button
                      size="sm"
                      className="h-7 px-2.5 text-xs gap-1"
                      onClick={() => navigate({ to: "/test/$id", params: { id: String(r.id) } })}
                    >
                      <PlayCircle className="h-3.5 w-3.5" /> Resume
                    </Button>
                  )}
                  {r.status === "not_started" && (
                    <Button
                      size="sm"
                      className="h-7 px-2.5 text-xs gap-1"
                      onClick={() => navigate({ to: "/test/$id", params: { id: String(r.id) } })}
                    >
                      <Rocket className="h-3.5 w-3.5" /> Start
                    </Button>
                  )}
                  {r.status === "completed" && (
                    <Button
                      size="sm"
                      variant="default"
                      className="h-7 px-2.5 text-xs gap-1"
                      onClick={() => navigate({ to: "/test/$id", params: { id: String(r.id) } })}
                    >
                      <Eye className="h-3.5 w-3.5" /> Review
                    </Button>
                  )}
                  {r.answered > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2.5 text-xs gap-1"
                      onClick={() => navigate({ to: "/test-results/$id", params: { id: String(r.id) } })}
                    >
                      <FileText className="h-3.5 w-3.5" /> Results
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        title="More actions"
                        className="h-7 w-7 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={() =>
                          navigate({ to: "/test-results/$id", params: { id: String(r.id) }, search: { tab: "analysis" } as any })
                        }
                      >
                        <BarChart3 className="h-3.5 w-3.5 mr-2" /> Analysis
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setRenaming({ id: r.id, name: r.name })}>
                        <Pencil className="h-3.5 w-3.5 mr-2" /> Rename quiz
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => {
                          const ids = (r.question_ids as number[]) ?? [];
                          navigator.clipboard.writeText(ids.join(", "));
                          toast.success(`Copied ${ids.length} question IDs`);
                        }}
                      >
                        <Copy className="h-3.5 w-3.5 mr-2" /> Copy question IDs
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() => onDelete(r.id, r.name)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete quiz
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rename dialog */}
      <Dialog open={!!renaming} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Quiz</DialogTitle>
          </DialogHeader>
          <Input
            value={renaming?.name ?? ""}
            onChange={(e) => renaming && setRenaming({ ...renaming, name: e.target.value })}
            placeholder="Quiz name"
            onKeyDown={async (e) => {
              if (e.key === "Enter" && renaming?.name.trim()) {
                await renFn({ data: { testId: renaming.id, name: renaming.name.trim() } });
                toast.success("Quiz renamed");
                qc.invalidateQueries({ queryKey: ["tests"] });
                setRenaming(null);
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)}>Cancel</Button>
            <Button
              disabled={!renaming?.name.trim()}
              onClick={async () => {
                if (!renaming?.name.trim()) return;
                await renFn({ data: { testId: renaming.id, name: renaming.name.trim() } });
                toast.success("Quiz renamed");
                qc.invalidateQueries({ queryKey: ["tests"] });
                setRenaming(null);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmDialog}
    </div>
  );
}

function KpiCard({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: any;
  tone: "blue" | "emerald" | "amber" | "violet";
  label: string;
  value: string;
}) {
  const toneClass = {
    blue: "bg-blue-500/12 text-blue-600 dark:text-blue-400",
    emerald: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
    amber: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
    violet: "bg-violet-500/12 text-violet-600 dark:text-violet-400",
  }[tone];
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
      <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", toneClass)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
        <div className="text-xl font-bold tabular-nums leading-tight mt-0.5">{value}</div>
      </div>
    </div>
  );
}

function SortHeader({
  label, k, sortKey, sortAsc, onSort,
}: {
  label: string; k: SortKey; sortKey: SortKey; sortAsc: boolean; onSort: (k: SortKey) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSort(k)}
      className="flex items-center gap-1 hover:text-foreground transition-colors text-left"
    >
      <span>{label}</span>
      <ArrowUpDown className={cn("h-3 w-3", sortKey === k ? "text-primary opacity-100" : "opacity-45")} />
      {sortKey === k && <span className="text-[10px] text-primary">{sortAsc ? "↑" : "↓"}</span>}
    </button>
  );
}

function Pill({ tone, children }: { tone: "mode" | "success" | "warn" | "muted"; children: React.ReactNode }) {
  const cls = {
    mode: "bg-primary/10 text-primary border-primary/20",
    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25",
    warn: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25",
    muted: "bg-muted text-muted-foreground border-border",
  }[tone];
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold", cls)}>
      {children}
    </span>
  );
}
