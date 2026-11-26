import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import {
  ClipboardCheck, Play, BarChart2, FileText, RotateCcw, Lock,
  CheckCircle2, PauseCircle, Layers, HelpCircle,
} from "lucide-react";
import { listAssessmentBlocks, startAssessmentBlock, resetAssessment } from "@/lib/qbank.functions";
import { QBANKS, useActiveQbankId } from "@/lib/active-qbank";
import { getMyEntitlement, QBANK_ID_TO_SLUG } from "@/lib/entitlements.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirm-dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/self-assessments/assessments")({
  component: AssessmentsPage,
});

type Assessment = { id: string; label: string; source: string; qbankId: number; total: number };

const NBME_COUNTS: Record<string, number> = {
  NBME25: 200, NBME26: 200, NBME27: 198, NBME28: 200, NBME29: 199,
  NBME30: 200, NBME31: 200, NBME32: 200, NBME33: 199,
  NBME8: 200, NBME9: 200, NBME10: 200, NBME11: 200, NBME12: 200,
  NBME13: 200, NBME14: 200, NBME15: 200, NBME16: 200,
};
const STEP2_CMS_FORMS: Array<{ specialty: string; tag: string; forms: number[] }> = [
  { specialty: "Emergency Medicine", tag: "EM",   forms: [1, 2, 3] },
  { specialty: "Family Medicine",    tag: "FM",   forms: [2, 3, 5] },
  { specialty: "Internal Medicine",  tag: "IM",   forms: [5, 6, 7, 8, 9, 10] },
  { specialty: "Neurology",          tag: "NEU",  forms: [5, 6, 7, 8, 9] },
  { specialty: "Ob/Gyn",             tag: "OBG",  forms: [5, 6, 7, 8, 9, 10] },
  { specialty: "Pediatrics",         tag: "PEDS", forms: [5, 6, 7, 8, 9] },
  { specialty: "Psychiatry",         tag: "PSY",  forms: [5, 6, 7, 8] },
  { specialty: "Surgery",            tag: "SUR",  forms: [5, 6, 7, 8, 9] },
];

const ASSESSMENTS: Assessment[] = [
  { id: "step1:SA1", label: "UWorld Self Assessment 1", source: "SA1", qbankId: 2, total: 160 },
  { id: "step1:SA2", label: "UWorld Self Assessment 2", source: "SA2", qbankId: 2, total: 159 },
  { id: "step1:SA3", label: "UWorld Self Assessment 3", source: "SA3", qbankId: 2, total: 158 },
  ...[25, 26, 27, 28, 29, 30, 31, 32, 33].map((n) => ({
    id: `step1:NBME${n}`, label: `NBME ${n}`, source: `NBME${n}`, qbankId: 2, total: NBME_COUNTS[`NBME${n}`],
  })),

  { id: "step2:SA1", label: "UWorld Self Assessment 1", source: "SA1", qbankId: 1, total: 157 },
  { id: "step2:SA2", label: "UWorld Self Assessment 2", source: "SA2", qbankId: 1, total: 159 },
  { id: "step2:SA3", label: "UWorld Self Assessment 3", source: "SA3", qbankId: 1, total: 160 },
  ...[8, 9, 10, 11, 12, 13, 14, 15, 16].map((n) => ({
    id: `step2:NBME${n}`, label: `NBME ${n}`, source: `NBME${n}`, qbankId: 1, total: NBME_COUNTS[`NBME${n}`],
  })),
  ...STEP2_CMS_FORMS.flatMap((c) =>
    c.forms.map((n) => ({
      id: `step2:CMS_${c.tag}${n}`,
      label: `CMS ${c.specialty} Form ${n}`,
      source: `CMS_${c.tag}${n}`,
      qbankId: 1,
      total: c.tag === "IM" && n === 6 ? 49 : 50,
    })),
  ),
  { id: "step3:SA1", label: "UWorld Self Assessment 1", source: "SA1", qbankId: 3, total: 160 },
  { id: "step3:SA2", label: "UWorld Self Assessment 2", source: "SA2", qbankId: 3, total: 160 },
];

function AssessmentsPage() {
  const nav = useNavigate();
  const listFn = useServerFn(listAssessmentBlocks);
  const startFn = useServerFn(startAssessmentBlock);
  const resetFn = useServerFn(resetAssessment);
  const qc = useQueryClient();

  const activeQbankId = useActiveQbankId();
  const activeQbank = QBANKS.find((q) => q.id === activeQbankId) ?? QBANKS[0];
  const entFn = useServerFn(getMyEntitlement);
  const entQ = useQuery({ queryKey: ["my-entitlement"], queryFn: () => entFn(), staleTime: 60_000 });
  const entitledSlugs = entQ.data?.effective_access ?? [];
  const availableCourses = useMemo(
    () => QBANKS.filter((q) => q.id === activeQbankId && (!entitledSlugs.length || entitledSlugs.includes(QBANK_ID_TO_SLUG[q.id]))),
    [entitledSlugs, activeQbankId],
  );

  const [courseId, setCourseId] = useState<number>(activeQbankId);
  useEffect(() => {
    if (!availableCourses.find((c) => c.id === courseId) && availableCourses[0]) {
      setCourseId(availableCourses[0].id);
    }
  }, [availableCourses, courseId]);

  const assessmentsForCourse = useMemo(() => ASSESSMENTS.filter((a) => a.qbankId === courseId), [courseId]);
  const [assessmentId, setAssessmentId] = useState<string>(assessmentsForCourse[0]?.id ?? "");
  useEffect(() => {
    if (!assessmentsForCourse.find((a) => a.id === assessmentId)) {
      setAssessmentId(assessmentsForCourse[0]?.id ?? "");
    }
  }, [assessmentsForCourse, assessmentId]);

  const [status, setStatus] = useState<"all" | "not_started" | "suspended" | "completed">("all");

  const current = assessmentsForCourse.find((a) => a.id === assessmentId) ?? assessmentsForCourse[0];

  const { data: blocks = [], isLoading } = useQuery({
    queryKey: ["assessment-blocks", current?.qbankId, current?.source],
    queryFn: () => listFn({ data: { qbankId: current!.qbankId, source: current!.source } }),
    enabled: !!current,
  });

  const filteredBlocks = useMemo(() => {
    return blocks.filter((b) => {
      const st = !b.test ? "not_started" : b.test.done ? "completed" : "suspended";
      return status === "all" ? true : st === status;
    });
  }, [blocks, status]);

  const completedBlocks = useMemo(
    () => new Set(blocks.filter((b) => b.test?.done).map((b) => b.blockIndex)),
    [blocks],
  );
  const suspendedCount = useMemo(
    () => blocks.filter((b) => b.test && !b.test.done).length,
    [blocks],
  );
  const maxBlockIndex = useMemo(
    () => blocks.reduce((m, b) => Math.max(m, b.blockIndex), 0),
    [blocks],
  );
  const isBlockLocked = (blockIndex: number) => {
    for (let i = 1; i < blockIndex; i++) {
      if (i > maxBlockIndex) break;
      if (!completedBlocks.has(i)) return true;
    }
    return false;
  };

  const handleStart = async (blockIndex: number) => {
    if (!current) return;
    if (isBlockLocked(blockIndex)) {
      toast.error("Complete the previous block before starting this one.");
      return;
    }
    try {
      const r = await startFn({ data: { qbankId: current.qbankId, source: current.source, blockIndex } });
      nav({ to: "/test/$id", params: { id: String(r.id) } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start block");
    }
  };

  const handleResults = (testId: number) => nav({ to: "/test-results/$id", params: { id: String(testId) } });
  const handleAnalysis = (testId: number) => nav({ to: "/test-results/$id", params: { id: String(testId) }, search: { tab: "analysis" } as any });

  const { confirm, dialog: confirmDialog } = useConfirm();

  const handleReset = async () => {
    if (!current) return;
    const ok = await confirm({
      title: `Reset ${current.label}?`,
      description: "All of your attempts and block results for this assessment will be permanently deleted. This cannot be undone.",
      confirmLabel: "Reset Assessment",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await resetFn({ data: { qbankId: current.qbankId, source: current.source } });
      toast.success("Assessment reset");
      qc.invalidateQueries({ queryKey: ["assessment-blocks", current.qbankId, current.source] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reset failed");
    }
  };

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="sf-fluid-page space-y-5">
        {/* Clinical Studio Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b border-border">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Self-Assessments</h1>
              <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                {activeQbank.name}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Simulated NBME &amp; UWorld self-assessment blocks in timed exam mode
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/self-assessments/report"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card text-xs font-medium text-foreground hover:bg-muted/60 transition-colors"
            >
              <BarChart2 className="h-3.5 w-3.5 text-muted-foreground" />
              Assessment Report
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={!current}
              className="h-9 text-xs text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-700"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Reset
            </Button>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <KpiCard icon={Layers} tone="blue" label="Total Blocks" value={String(blocks.length)} />
          <KpiCard icon={CheckCircle2} tone="green" label="Completed" value={String(completedBlocks.size)} />
          <KpiCard icon={PauseCircle} tone="amber" label="In Progress" value={String(suspendedCount)} />
          <KpiCard icon={HelpCircle} tone="violet" label="Total Questions" value={current ? String(current.total) : "—"} />
        </div>

        {/* Selector + Status Filter Bar */}
        <div className="rounded-xl bg-card border border-border p-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <label className="text-xs font-medium text-muted-foreground shrink-0">Assessment</label>
            <select
              value={assessmentId}
              onChange={(e) => setAssessmentId(e.target.value)}
              disabled={!assessmentsForCourse.length}
              className="h-9 min-w-0 flex-1 sm:flex-none sm:min-w-[240px] rounded-lg border border-border bg-background px-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
            >
              {assessmentsForCourse.length === 0 && <option>No assessments available</option>}
              {assessmentsForCourse.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </div>

          <div className="inline-flex rounded-lg bg-muted/60 p-1 gap-0.5 overflow-x-auto max-w-full">
            {([
              { id: "all", label: "All" },
              { id: "not_started", label: "Not Started" },
              { id: "suspended", label: "Suspended" },
              { id: "completed", label: "Completed" },
            ] as const).map((s) => (
              <button
                key={s.id}
                onClick={() => setStatus(s.id)}
                className={cn(
                  "px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap",
                  status === s.id
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Blocks Table */}
        <div className="rounded-xl bg-card border border-border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">{current?.label ?? "Assessment Blocks"}</span>
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {filteredBlocks.length} {filteredBlocks.length === 1 ? "block" : "blocks"}
            </span>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">Loading blocks…</div>
          ) : !current ? (
            <div className="p-8 text-center text-xs text-muted-foreground">No assessment available for your active course.</div>
          ) : filteredBlocks.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">No blocks match the selected filter.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="bg-muted/40 border-b border-border text-muted-foreground">
                    <Th>Block</Th>
                    <Th>Started</Th>
                    <Th>Mode</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredBlocks.map((b) => {
                    const t = b.test;
                    const locked = !t && isBlockLocked(b.blockIndex);
                    const st = locked ? "Locked" : !t ? "Not Started" : t.done ? "Completed" : "Suspended";
                    const stBadge = locked
                      ? "bg-muted text-muted-foreground"
                      : !t
                        ? "bg-muted text-muted-foreground"
                        : t.done
                          ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
                          : "bg-amber-500/12 text-amber-600 dark:text-amber-400";
                    const dateStr = t
                      ? new Date(t.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                      : "—";
                    return (
                      <tr key={b.blockIndex} className="hover:bg-muted/30 transition-colors">
                        <Td>
                          <span className="inline-flex items-center rounded-md bg-primary/10 px-2.5 py-1 text-primary text-xs font-semibold tabular-nums">
                            Block #{b.blockIndex}
                          </span>
                        </Td>
                        <Td className="text-muted-foreground tabular-nums">{dateStr}</Td>
                        <Td>
                          <span className="inline-flex rounded-md bg-violet-500/12 text-violet-600 dark:text-violet-400 px-2 py-0.5 text-[11px] font-semibold">
                            NBME Exam
                          </span>
                        </Td>
                        <Td>
                          <span className={cn("inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold", stBadge)}>
                            {st}
                          </span>
                        </Td>
                        <Td className="text-right">
                          <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleStart(b.blockIndex)}
                              disabled={locked}
                              title={locked ? "Complete the previous block to unlock" : undefined}
                              className={cn(
                                "inline-flex items-center gap-1 h-7 px-3 rounded-md text-xs font-semibold transition-colors",
                                locked
                                  ? "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
                                  : "bg-primary text-primary-foreground hover:bg-primary/90",
                              )}
                            >
                              {locked ? <Lock className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                              {locked ? "Locked" : t ? (t.done ? "Review" : "Resume") : "Start"}
                            </button>
                            <button
                              onClick={() => t && handleResults(t.id)}
                              disabled={!t?.done}
                              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-border bg-background hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium transition-colors"
                            >
                              <FileText className="h-3 w-3" /> Results
                            </button>
                            <button
                              onClick={() => t && handleAnalysis(t.id)}
                              disabled={!t?.done}
                              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold transition-colors"
                            >
                              <BarChart2 className="h-3 w-3" /> Analysis
                            </button>
                          </div>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {confirmDialog}
    </div>
  );
}

const KPI_TONES = {
  blue:   "bg-blue-500/12 text-blue-600 dark:text-blue-400",
  green:  "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
  amber:  "bg-amber-500/12 text-amber-600 dark:text-amber-400",
  violet: "bg-violet-500/12 text-violet-600 dark:text-violet-400",
};

function KpiCard({ icon: Icon, tone, label, value }: { icon: any; tone: keyof typeof KPI_TONES; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card border border-border p-4 flex items-center gap-3">
      <div className={cn("h-10 w-10 rounded-lg grid place-items-center shrink-0", KPI_TONES[tone])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-xl font-bold leading-tight tabular-nums mt-0.5">{value}</div>
      </div>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide", className)}>{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 align-middle", className)}>{children}</td>;
}
