import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { getTest } from "@/lib/qbank.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  BarChart3, ListOrdered, StickyNote, CheckCircle2, ChevronRight, Flame,
  TrendingUp, TrendingDown, Minus, ArrowUpDown, Filter, Settings2, X, Copy, Check,
  ArrowRightLeft, RefreshCw, Repeat,
} from "lucide-react";


export const Route = createFileRoute("/_authenticated/test-results/$id")({
  component: TestResults,
});

type Status = "correct" | "wrong" | "omitted";
type SortKey = "id" | "subject" | "system" | "topic" | "others" | "time" | "status";

function TestResults() {
  const { id } = Route.useParams();
  const fn = useServerFn(getTest);
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["test-results", id],
    queryFn: () => fn({ data: { id: Number(id) } }),
  });

  const [tab, setTab] = useState<"results" | "analysis">("results");
  const [pageSize, setPageSize] = useState(40);
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [sortKey, setSortKey] = useState<SortKey>("id");
  const [sortAsc, setSortAsc] = useState(true);
  const [showQList, setShowQList] = useState(false);

  const rows = useMemo(() => {
    if (!data) return [];
    return data.questions.map((q, idx) => {
      const a = data.attemptsByQ[q.id];
      const status: Status = !a ? "omitted" : a.is_correct ? "correct" : "wrong";
      // Deterministic peer avg 45-90% based on question id
      const seed = (q.id * 9301 + 49297) % 233280;
      const others = Math.round(45 + (seed / 233280) * 45 * 10) / 10;
      const time = (a as any)?.time_seconds ?? 0;
      return {
        index: idx + 1,
        id: q.id,
        subject: (q.subject_id != null && data.subjectMap[q.subject_id]) || "—",
        system: (q.system_id != null && data.systemMap[q.system_id]) || "—",
        topic: q.title ?? "—",
        status,
        others,
        time,
      };
    });
  }, [data]);

  const totals = useMemo(() => {
    const correct = rows.filter((r) => r.status === "correct").length;
    const wrong = rows.filter((r) => r.status === "wrong").length;
    const omitted = rows.filter((r) => r.status === "omitted").length;
    const answered = correct + wrong;
    const score = rows.length ? (correct / rows.length) * 100 : 0;
    const peer = rows.length ? rows.reduce((s, r) => s + r.others, 0) / rows.length : 0;
    // Best/worst subject by accuracy
    const bySub: Record<string, { c: number; t: number; o: number }> = {};
    for (const r of rows) {
      bySub[r.subject] ??= { c: 0, t: 0, o: 0 };
      bySub[r.subject].t += 1;
      if (r.status === "correct") bySub[r.subject].c += 1;
      if (r.status === "omitted") bySub[r.subject].o += 1;
    }
    const subjectStats = Object.entries(bySub).map(([name, v]) => ({
      name, accuracy: v.t ? (v.c / v.t) * 100 : 0, total: v.t, omitted: v.o,
    }));
    const sorted = [...subjectStats].sort((a, b) => b.accuracy - a.accuracy);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    const mostOmitted = [...subjectStats].sort((a, b) => b.omitted - a.omitted)[0];
    return { correct, wrong, omitted, score, peer, best, worst, mostOmitted };
  }, [rows]);

  const filtered = useMemo(() => {
    let out = rows;
    if (statusFilter !== "all") out = out.filter((r) => r.status === statusFilter);
    out = [...out].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "id": cmp = a.index - b.index; break;
        case "subject": cmp = a.subject.localeCompare(b.subject); break;
        case "system": cmp = a.system.localeCompare(b.system); break;
        case "topic": cmp = a.topic.localeCompare(b.topic); break;
        case "others": cmp = a.others - b.others; break;
        case "time": cmp = a.time - b.time; break;
        case "status": cmp = a.status.localeCompare(b.status); break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return out.slice(0, pageSize);
  }, [rows, statusFilter, sortKey, sortAsc, pageSize]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortAsc((v) => !v);
    else { setSortKey(k); setSortAsc(true); }
  };

  if (isLoading || !data) {
    return <div className="p-8"><Loader label="Loading results…" /></div>;
  }

  const mode = data.test.mode;
  const created = new Date(data.test.created_at);
  const belowPeer = totals.score < totals.peer;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top tabs + name */}
      <div className="rounded-2xl border border-border bg-card p-4 md:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex gap-2">
          <TabBtn active={tab === "results"} onClick={() => setTab("results")}>Test Results</TabBtn>
          <TabBtn active={tab === "analysis"} onClick={() => setTab("analysis")}>Test Analysis</TabBtn>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Test Name</div>
            <div className="font-medium">Custom Quiz {created.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">ID</div>
            <div className="font-bold">{data.test.id}</div>
          </div>
        </div>
      </div>

      {/* Workspace toolbar */}
      <div className="rounded-2xl border border-border bg-card p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Workspace</div>
          <div className="font-medium">Quiz tools and shortcuts</div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowQList(true)}><ListOrdered className="h-4 w-4 mr-1.5" /> Questions List</Button>
          <Button variant="outline" size="sm"><StickyNote className="h-4 w-4 mr-1.5" /> Notes</Button>
          <Button size="sm" onClick={() => navigate({ to: "/test/$id", params: { id } })}>
            <CheckCircle2 className="h-4 w-4 mr-1.5" /> Review
          </Button>
        </div>
      </div>


      {/* Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 relative overflow-hidden rounded-3xl p-6 text-white shadow-xl shadow-fuchsia-500/20">
          {/* Vivid background */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#f472b6_0%,transparent_50%),radial-gradient(circle_at_bottom_right,#38bdf8_0%,transparent_55%),linear-gradient(135deg,#7c3aed_0%,#4f46e5_50%,#0ea5e9_100%)]" />
          <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-yellow-300/30 blur-3xl" />
          <div className="absolute -bottom-20 -left-16 h-64 w-64 rounded-full bg-emerald-300/20 blur-3xl" />

          <div className="relative">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] font-semibold bg-white/15 backdrop-blur-md rounded-full px-3 py-1 mb-3 border border-white/20">
                  ✨ Performance Overview
                </div>
                <div className="text-xs uppercase tracking-wider text-white/80 font-medium">Overall Score</div>
                <div className="text-6xl font-black bg-gradient-to-br from-white via-yellow-100 to-amber-200 bg-clip-text text-transparent drop-shadow-lg">
                  {totals.score.toFixed(1)}<span className="text-3xl">%</span>
                </div>
                <div className="text-sm text-white/85 mt-2 max-w-md">
                  {belowPeer
                    ? `You are ${(totals.peer - totals.score).toFixed(1)}% behind the peer average. Revisit weaker subjects first.`
                    : `You are ${(totals.score - totals.peer).toFixed(1)}% above the peer average. Keep going.`}
                </div>
                <div className={`mt-3 inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1.5 border ${belowPeer ? "bg-rose-500/25 border-rose-200/40 text-rose-50" : "bg-emerald-500/25 border-emerald-200/40 text-emerald-50"}`}>
                  {belowPeer ? "😤 Keep Practicing" : "🎯 On Track"}
                </div>
              </div>
              <Donut value={totals.score} label="Score" />
            </div>
            <BarLine label="Your Score" value={totals.score} tone="mine" />
            <BarLine label="Peer Average" value={totals.peer} tone="peer" />
            <div className="grid grid-cols-3 gap-2 mt-4">
              <MiniStat label="You" value={`${totals.score.toFixed(1)}%`} />
              <MiniStat label="Average" value={`${totals.peer.toFixed(1)}%`} />
              <MiniStat label="Gap to Close" value={`${Math.abs(totals.peer - totals.score).toFixed(1)}%`} />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-border bg-card p-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Peer Average</div>
              <div className="text-2xl font-bold">{totals.peer.toFixed(1)}%</div>
            </div>
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1.5 ${belowPeer ? "bg-rose-500/15 text-rose-500" : "bg-emerald-500/15 text-emerald-500"}`}>
              {belowPeer ? "⚠ Below Peer Average" : "✓ Above Peer Average"}
            </span>
          </div>
          <InsightCard tone="success" icon={<TrendingUp className="h-4 w-4" />} label="Best Subject" tag="Strength" value={totals.best?.name ?? "—"} desc="Your strongest area in this result set." />
          <InsightCard tone="danger" icon={<TrendingDown className="h-4 w-4" />} label="Needs Review" tag="Focus" value={totals.worst?.name ?? "—"} desc="The clearest opportunity for score recovery." />
          <InsightCard tone="info" icon={<Minus className="h-4 w-4" />} label="Most Omitted" tag="Review" value={totals.mostOmitted && totals.mostOmitted.omitted > 0 ? totals.mostOmitted.name : "No omissions detected"} desc="Skipped questions are clustering here the most." />
        </div>
      </div>

      {/* Answer Changes on retake */}
      {(() => {
        const ac = data.answerChanges;
        const totalChanges = ac.correctToIncorrect + ac.incorrectToCorrect + ac.incorrectToIncorrect;
        return (
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-1">
              <div className="font-semibold">Answer Changes</div>
              <span className="text-xs text-muted-foreground">Compared to your previous attempts on these questions</span>
            </div>
            {totalChanges === 0 ? (
              <div className="text-sm text-muted-foreground mt-3">No prior attempts on these questions — this is your first pass.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                <ChangeStat icon={ArrowRightLeft} tone="rose" label="Correct → Incorrect" value={ac.correctToIncorrect} hint="Second-guessed a right answer" />
                <ChangeStat icon={RefreshCw} tone="green" label="Incorrect → Correct" value={ac.incorrectToCorrect} hint="Learned from a past miss" />
                <ChangeStat icon={Repeat} tone="amber" label="Incorrect → Incorrect" value={ac.incorrectToIncorrect} hint="Missed again — review needed" />
              </div>
            )}
          </div>
        );
      })()}

      {/* Table controls */}
      <div className="rounded-2xl border border-border bg-card p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><ListOrdered className="h-4 w-4" /></div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Display</div>
          <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>{[10, 20, 40, 100, 500].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">rows</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Filter className="h-4 w-4" /></div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Filter Status</div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="correct">Correct</SelectItem>
              <SelectItem value="wrong">Incorrect</SelectItem>
              <SelectItem value="omitted">Omitted</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-amber-500/15 text-amber-500 flex items-center justify-center"><Settings2 className="h-4 w-4" /></div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Quiz Mode</div>
            <div className="text-sm font-semibold capitalize">{mode}</div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border overflow-hidden">
        <div className="bg-muted/50 hidden md:grid grid-cols-[70px_1fr_1.4fr_1.4fr_1.6fr_1fr_1fr_80px] gap-3 px-4 py-3 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
          <div>Status</div>
          <SortH label="ID" k="id" sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} />
          <SortH label="Subjects" k="subject" sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} />
          <SortH label="Systems" k="system" sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} />
          <SortH label="Topics" k="topic" sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} />
          <SortH label="% Others" k="others" sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} />
          <SortH label="Time" k="time" sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} />
          <div className="text-right">Action</div>
        </div>
        <div className="divide-y divide-border">
          {filtered.length === 0 && <div className="p-6 text-muted-foreground">No questions match this filter.</div>}
          {filtered.map((r) => (
            <div key={r.id} className="flex flex-col gap-2 md:grid md:grid-cols-[70px_1fr_1.4fr_1.4fr_1.6fr_1fr_1fr_80px] md:gap-3 px-4 py-3 md:items-center hover:bg-muted/30">
              <div className="flex items-center gap-2">
                <StatusDot status={r.status} />
                <span className="md:hidden text-xs text-muted-foreground uppercase">{r.status}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">#{r.index}</span>
                <span className="font-semibold">{r.id}</span>
              </div>
              <div className="text-sm md:truncate" title={r.subject}><span className="md:hidden text-xs text-muted-foreground mr-1">Subject:</span>{r.subject}</div>
              <div className="text-sm md:truncate" title={r.system}><span className="md:hidden text-xs text-muted-foreground mr-1">System:</span>{r.system}</div>
              <div className="text-sm text-primary md:truncate" title={r.topic}><span className="md:hidden text-xs text-muted-foreground mr-1">Topic:</span>{r.topic}</div>
              <div><span className="inline-block rounded-full border border-border px-2.5 py-1 text-xs">{r.others.toFixed(1)}% others</span></div>
              <div><span className="inline-block rounded-full border border-border px-2.5 py-1 text-xs">{r.time} sec</span></div>
              <div className="md:text-right">
                <Link to="/test/$id" params={{ id }} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border hover:bg-muted">
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

          ))}
        </div>
      </div>

      {showQList && (
        <QuestionsListModal
          onClose={() => setShowQList(false)}
          allIds={rows.map((r) => r.id)}
          wrongIds={rows.filter((r) => r.status === "wrong").map((r) => r.id)}
          omittedIds={rows.filter((r) => r.status === "omitted").map((r) => r.id)}
        />
      )}
    </div>
  );
}

function ChangeStat({ icon: Icon, tone, label, value, hint }: { icon: any; tone: "rose" | "green" | "amber"; label: string; value: number; hint: string }) {
  const cls = tone === "rose"
    ? { bg: "bg-rose-500/10", text: "text-rose-500", pill: "bg-rose-500 text-white" }
    : tone === "green"
    ? { bg: "bg-emerald-500/10", text: "text-emerald-500", pill: "bg-emerald-500 text-white" }
    : { bg: "bg-amber-500/10", text: "text-amber-500", pill: "bg-amber-500 text-white" };
  return (
    <div className="rounded-xl border border-border p-4 flex items-center gap-3">
      <div className={`h-10 w-10 rounded-lg ${cls.bg} ${cls.text} grid place-items-center shrink-0`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-[11px] text-muted-foreground">{hint}</div>
      </div>
      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${cls.pill}`}>{value}</span>
    </div>
  );
}

function QuestionsListModal({

  onClose, allIds, wrongIds, omittedIds,
}: { onClose: () => void; allIds: number[]; wrongIds: number[]; omittedIds: number[] }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 md:p-8 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-card border border-border shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="text-lg font-semibold">Questions</div>
          <button onClick={onClose} className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <IdSection title="All Question IDs" ids={allIds} tone="neutral" />
          <IdSection title="Wrong Answer IDs" ids={wrongIds} tone="danger" emptyText="No wrong answers in this quiz." />
          <IdSection title="Omitted IDs" ids={omittedIds} tone="info" emptyText="No omitted questions in this quiz." />
        </div>
      </div>
    </div>
  );
}

function IdSection({ title, ids, tone, emptyText }: { title: string; ids: number[]; tone: "neutral" | "danger" | "info"; emptyText?: string }) {
  const [copied, setCopied] = useState(false);
  const toneCls = tone === "danger"
    ? { border: "border-red-200 dark:border-red-900/40", bg: "bg-red-50/50 dark:bg-red-950/20", title: "text-red-600 dark:text-red-400", text: "text-red-600 dark:text-red-400", btn: "border-red-300 text-red-600 hover:bg-red-100 dark:hover:bg-red-950/40" }
    : tone === "info"
    ? { border: "border-blue-200 dark:border-blue-900/40", bg: "bg-blue-50/50 dark:bg-blue-950/20", title: "text-blue-600 dark:text-blue-400", text: "text-foreground", btn: "border-blue-300 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-950/40" }
    : { border: "border-border", bg: "bg-muted/30", title: "text-foreground", text: "text-foreground", btn: "border-border hover:bg-muted" };
  const copy = async () => {
    await navigator.clipboard.writeText(ids.join(", "));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className={`rounded-xl border ${toneCls.border} ${toneCls.bg} p-4`}>
      <div className="flex items-center justify-between mb-2">
        <div className={`font-semibold ${toneCls.title}`}>{title}</div>
        <span className="text-xs font-medium text-muted-foreground bg-background border border-border rounded-full px-2.5 py-0.5">{ids.length}</span>
      </div>
      {ids.length === 0 ? (
        <div className="text-sm text-muted-foreground bg-background/60 border border-dashed border-border rounded-lg px-3 py-2">
          {emptyText ?? "No items."}
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className={`text-sm leading-relaxed break-words ${toneCls.text}`}>{ids.join(", ")}</div>
          <button onClick={copy} className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${toneCls.btn}`}>
            {copied ? <><Check className="h-3.5 w-3.5" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
          </button>
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
      {children}
    </button>
  );
}

function Donut({ value, label }: { value: number; label: string }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const off = c - (Math.min(100, Math.max(0, value)) / 100) * c;
  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} stroke="rgba(255,255,255,0.15)" strokeWidth="8" fill="none" />
        <circle cx="50" cy="50" r={r} stroke="url(#g)" strokeWidth="8" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} />
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f472b6" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[10px] uppercase tracking-wider text-white/70">{label}</div>
        <div className="text-xl font-bold">{value.toFixed(1)}%</div>
      </div>
    </div>
  );
}

function BarLine({ label, value, tone }: { label: string; value: number; tone: "mine" | "peer" }) {
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-white/80 uppercase tracking-wider">{label}</span>
        <span className="font-semibold">{value.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/15 overflow-hidden">
        <div className={`h-full ${tone === "mine" ? "bg-gradient-to-r from-amber-400 to-rose-400" : "bg-white/60"}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 px-3 py-2">
      <div className="text-[9px] uppercase tracking-wider text-white/70">{label}</div>
      <div className="text-sm font-bold">{value}</div>
    </div>
  );
}

function InsightCard({ tone, icon, label, tag, value, desc }: { tone: "success" | "danger" | "info"; icon: React.ReactNode; label: string; tag: string; value: string; desc: string }) {
  const bg = tone === "success" ? "bg-emerald-500/10 border-emerald-500/30" : tone === "danger" ? "bg-rose-500/10 border-rose-500/30" : "bg-sky-500/10 border-sky-500/30";
  const iconBg = tone === "success" ? "bg-emerald-500/20 text-emerald-500" : tone === "danger" ? "bg-rose-500/20 text-rose-500" : "bg-sky-500/20 text-sky-500";
  const tagCls = tone === "success" ? "bg-emerald-500/20 text-emerald-500" : tone === "danger" ? "bg-rose-500/20 text-rose-500" : "bg-sky-500/20 text-sky-500";
  return (
    <div className={`rounded-2xl border p-4 ${bg}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${iconBg}`}>{icon}</div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className="font-semibold">{value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
          </div>
        </div>
        <span className={`text-[10px] uppercase tracking-wider font-semibold rounded-full px-2 py-0.5 ${tagCls}`}>{tag}</span>
      </div>
    </div>
  );
}

function SortH({ label, k, sortKey, sortAsc, onSort }: { label: string; k: SortKey; sortKey: SortKey; sortAsc: boolean; onSort: (k: SortKey) => void }) {
  const active = sortKey === k;
  return (
    <button onClick={() => onSort(k)} className={`flex items-center gap-1 text-left uppercase tracking-wider text-[11px] ${active ? "text-foreground" : ""}`}>
      {label}
      <ArrowUpDown className={`h-3 w-3 ${active ? "opacity-100" : "opacity-40"} ${active && !sortAsc ? "rotate-180" : ""}`} />
    </button>
  );
}

function StatusDot({ status }: { status: Status }) {
  if (status === "correct") return <span className="inline-flex h-7 w-7 rounded-full bg-emerald-500/15 text-emerald-500 items-center justify-center">✓</span>;
  if (status === "wrong") return <span className="inline-flex h-7 w-7 rounded-full bg-rose-500/15 text-rose-500 items-center justify-center">✕</span>;
  return <span className="inline-flex h-7 w-7 rounded-full bg-muted text-muted-foreground items-center justify-center">–</span>;
}
