import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { ClipboardCheck, Filter, ListChecks, Play, BarChart2, FileText, RotateCcw, Calendar } from "lucide-react";
import { listAssessmentBlocks, startAssessmentBlock, resetAssessment } from "@/lib/qbank.functions";
import { QBANKS, useActiveQbankId } from "@/lib/active-qbank";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/self-assessments/assessments")({
  component: AssessmentsPage,
});

type Assessment = { id: string; label: string; source: string; qbankId: number; total: number };

const ASSESSMENTS: Assessment[] = [
  { id: "step1:SA1", label: "UWorld Self Assessment 1", source: "SA1", qbankId: 2, total: 160 },
  { id: "step1:SA2", label: "UWorld Self Assessment 2", source: "SA2", qbankId: 2, total: 159 },
  { id: "step1:SA3", label: "UWorld Self Assessment 3", source: "SA3", qbankId: 2, total: 158 },
];

function AssessmentsPage() {
  const nav = useNavigate();
  const listFn = useServerFn(listAssessmentBlocks);
  const startFn = useServerFn(startAssessmentBlock);
  const resetFn = useServerFn(resetAssessment);
  const qc = useQueryClient();

  // Only show the course the user has activated in "My Courses"
  const activeQbankId = useActiveQbankId();
  const availableCourses = useMemo(
    () => QBANKS.filter((q) => q.id === activeQbankId),
    [activeQbankId],
  );

  const [courseId, setCourseId] = useState<number>(activeQbankId);
  useEffect(() => setCourseId(activeQbankId), [activeQbankId]);

  const assessmentsForCourse = useMemo(() => ASSESSMENTS.filter((a) => a.qbankId === courseId), [courseId]);
  const [assessmentId, setAssessmentId] = useState<string>(assessmentsForCourse[0]?.id ?? "");
  useEffect(() => {
    if (!assessmentsForCourse.find((a) => a.id === assessmentId)) {
      setAssessmentId(assessmentsForCourse[0]?.id ?? "");
    }
  }, [assessmentsForCourse, assessmentId]);

  const [status, setStatus] = useState<"all" | "not_started" | "suspended" | "completed">("all");

  const current = assessmentsForCourse.find((a) => a.id === assessmentId) ?? assessmentsForCourse[0];

  const today = new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });

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

  const handleStart = async (blockIndex: number) => {
    if (!current) return;
    try {
      const r = await startFn({ data: { qbankId: current.qbankId, source: current.source, blockIndex } });
      nav({ to: "/test/$id", params: { id: String(r.id) } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start block");
    }
  };

  const handleResults = (testId: number) => nav({ to: "/test-results/$id", params: { id: String(testId) } });
  const handleAnalysis = (testId: number) => nav({ to: "/test-results/$id", params: { id: String(testId) } });

  const handleReset = async () => {
    if (!current) return;
    if (!window.confirm(`Reset all progress for ${current.label}? This deletes your attempts and block results.`)) return;
    try {
      await resetFn({ data: { qbankId: current.qbankId, source: current.source } });
      toast.success("Assessment reset");
      qc.invalidateQueries({ queryKey: ["assessment-blocks", current.qbankId, current.source] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reset failed");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-slate-50 to-violet-50 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-indigo-100 bg-white/70 backdrop-blur p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md">
            <ClipboardCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              Self Assessments
            </h1>
            <p className="text-sm text-slate-500">Track and manage your assessment progress</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm">
          <Calendar className="h-4 w-4 text-indigo-500" />
          {today}
        </div>
      </div>

      {/* Filter Options */}
      <div className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
            <Filter className="h-4 w-4" />
          </div>
          <h2 className="text-base font-semibold text-slate-800">Filter Options</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4 items-end">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Course</label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(Number(e.target.value))}
              disabled={availableCourses.length <= 1}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none disabled:bg-slate-50"
            >
              {availableCourses.length === 0 && <option>No active course</option>}
              {availableCourses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Assessment</label>
            <select
              value={assessmentId}
              onChange={(e) => setAssessmentId(e.target.value)}
              disabled={!assessmentsForCourse.length}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none disabled:bg-slate-100"
            >
              {assessmentsForCourse.length === 0 && <option>No assessments available</option>}
              {assessmentsForCourse.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
            >
              <option value="all">All</option>
              <option value="not_started">Not Started</option>
              <option value="suspended">Suspended</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleReset} disabled={!current} className="bg-gradient-to-r from-rose-500 to-red-600 hover:opacity-90 text-white shadow">
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset Assessment
            </Button>
          </div>
        </div>
      </div>

      {/* Blocks */}
      <div className="rounded-2xl border border-indigo-100 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-100 p-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
            <ListChecks className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-800">Assessment Blocks</h2>
            <p className="text-xs text-slate-500">{filteredBlocks.length} block(s) available</p>
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading blocks…</div>
        ) : !current ? (
          <div className="p-8 text-center text-sm text-slate-500">No assessment available for your active course.</div>
        ) : filteredBlocks.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No blocks match the selected filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white">
                  <Th>Block ID</Th>
                  <Th>Date</Th>
                  <Th>Time Alloted</Th>
                  <Th>Time Remaining</Th>
                  <Th>Mode</Th>
                  <Th>Status</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filteredBlocks.map((b) => {
                  const t = b.test;
                  const st = !t ? "Not Started" : t.done ? "Completed" : "Suspended";
                  const stClass = !t ? "text-slate-500" : t.done ? "text-emerald-600" : "text-amber-600";
                  const dateStr = t ? new Date(t.createdAt).toString().replace(/\s\(.*\)$/, "") : "—";
                  return (
                    <tr key={b.blockIndex} className="border-b border-slate-100 last:border-0 hover:bg-indigo-50/40">
                      <Td>
                        <span className="inline-flex items-center rounded-md bg-indigo-100 px-3 py-1 text-indigo-700 text-xs font-semibold">
                          Block #{b.blockIndex}
                        </span>
                      </Td>
                      <Td className="text-slate-600">{dateStr}</Td>
                      <Td><span className="inline-flex rounded-md bg-slate-100 px-3 py-1 text-slate-700 text-xs">30m</span></Td>
                      <Td>
                        <span className="inline-flex rounded-md bg-amber-100 px-3 py-1 text-amber-700 text-xs">
                          {t?.done ? "0m" : "30m"}
                        </span>
                      </Td>
                      <Td>
                        <span className="inline-flex rounded-md bg-violet-100 px-3 py-1 text-violet-700 text-xs">Exam</span>
                      </Td>
                      <Td className={`font-medium ${stClass}`}>{st}</Td>
                      <Td>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handleStart(b.blockIndex)}
                            className="inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-indigo-500 to-violet-600 hover:opacity-90 px-3 py-1.5 text-white text-xs font-medium shadow"
                          >
                            <Play className="h-3 w-3" /> {t ? (t.done ? "Review" : "Resume") : "Start"}
                          </button>
                          <button
                            onClick={() => t && handleResults(t.id)}
                            disabled={!t?.done}
                            className="inline-flex items-center gap-1 rounded-md bg-violet-100 hover:bg-violet-200 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 text-violet-700 text-xs font-medium"
                          >
                            <FileText className="h-3 w-3" /> Results
                          </button>
                          <button
                            onClick={() => t && handleAnalysis(t.id)}
                            disabled={!t?.done}
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-100 hover:bg-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 text-emerald-700 text-xs font-medium"
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
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>;
}
