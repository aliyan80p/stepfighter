import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getDashboardStats } from "@/lib/qbank.functions";
import { useActiveQbankId, QBANKS } from "@/lib/active-qbank";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { DashboardSkeleton } from "@/components/loader";
import { toast } from "sonner";
import {
  BookOpen, CheckCircle2, XCircle, MinusCircle, HelpCircle, User, Percent,
  BarChart3, Flag, ArrowRightLeft, RefreshCw, Repeat, FilePlus2, FileCheck2,
  PauseCircle, Plus, History, Calendar, TrendingUp,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const qc = useQueryClient();
  const fn = useServerFn(getDashboardStats);
  const qbankId = useActiveQbankId();
  const activeBank = QBANKS.find((q) => q.id === qbankId);
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", qbankId],
    queryFn: () => fn({ data: { qbankId } }),
    staleTime: 30_000,
  });

  const { data: profileGoal } = useQuery({
    queryKey: ["profile-exam-goal"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data: p } = await supabase
        .from("profiles")
        .select("target_exam,target_date")
        .eq("id", u.user.id)
        .maybeSingle();
      return p;
    },
    staleTime: 5 * 60 * 1000,
  });

  const [editingDate, setEditingDate] = useState(false);
  const [dateDraft, setDateDraft] = useState("");
  const [savingDate, setSavingDate] = useState(false);

  const saveTargetDate = async () => {
    setSavingDate(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { error } = await supabase
        .from("profiles")
        .update({ target_date: dateDraft || null, target_exam: activeBank?.name ?? null })
        .eq("id", u.user.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["profile-exam-goal"] });
      setEditingDate(false);
      toast.success(dateDraft ? "Exam date saved" : "Exam date cleared");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save exam date");
    } finally {
      setSavingDate(false);
    }
  };

  const targetDateStr = profileGoal?.target_date ?? null;
  const daysLeft = targetDateStr
    ? Math.ceil((new Date(`${targetDateStr}T00:00:00`).getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000)
    : null;
  const dailyPace = daysLeft && daysLeft > 0 && data ? Math.ceil(data.unused / daysLeft) : null;

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="sf-fluid-page space-y-5">
        {/* Clinical Studio Command Header */}
        <div className="rounded-xl bg-card border border-border p-5 flex flex-wrap items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-primary text-primary-foreground grid place-items-center shrink-0">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Study Dashboard</h1>
                {activeBank && (
                  <span className="rounded-full bg-primary/12 text-primary px-2.5 py-0.5 text-xs font-semibold">
                    {activeBank.name}
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{today}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" className="gap-1.5">
              <Link to="/new-test">
                <Plus className="h-4 w-4" /> Generate Quiz
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link to="/tests">
                <History className="h-3.5 w-3.5" /> Previous Tests
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link to="/bookmarks">
                <Flag className="h-3.5 w-3.5" /> Flagged ({data?.bookmarks ?? 0})
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link to="/self-assessments/score-predictor">
                <TrendingUp className="h-3.5 w-3.5" /> Score Predictor
              </Link>
            </Button>
          </div>
        </div>

        {/* Exam Countdown & Daily Study Pace Strip */}
        <div className="rounded-xl bg-card border border-border px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
              <Calendar className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              {daysLeft != null && daysLeft > 0 ? (
                <>
                  <div className="text-xs sm:text-sm font-semibold">
                    <span className="text-primary tabular-nums">{daysLeft} days</span> until {profileGoal?.target_exam || activeBank?.name || "Exam Day"}
                    <span className="text-muted-foreground font-normal ml-1.5">({new Date(`${targetDateStr}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })})</span>
                  </div>
                  {dailyPace != null && data && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Recommended pace: <span className="font-semibold text-foreground tabular-nums">{dailyPace} unused Qs/day</span> to finish all {data.unused.toLocaleString()} remaining questions
                    </div>
                  )}
                </>
              ) : daysLeft != null && daysLeft <= 0 ? (
                <div className="text-xs sm:text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  Exam date reached ({targetDateStr}) — update your target date for your next exam!
                </div>
              ) : (
                <>
                  <div className="text-xs sm:text-sm font-semibold">Set Your Target Exam Date</div>
                  <div className="text-xs text-muted-foreground">Track your countdown and daily questions needed to finish 100% of the QBank</div>
                </>
              )}
            </div>
          </div>

          {editingDate ? (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateDraft}
                onChange={(e) => setDateDraft(e.target.value)}
                className="h-8 rounded-md border border-border bg-background px-2 text-xs"
              />
              <Button size="sm" className="h-8 text-xs" disabled={savingDate} onClick={saveTargetDate}>
                Save
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditingDate(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs shrink-0"
              onClick={() => {
                setDateDraft(targetDateStr ?? "");
                setEditingDate(true);
              }}
            >
              {targetDateStr ? "Change Date" : "Set Exam Date"}
            </Button>
          )}
        </div>

        {/* Top KPI Row */}
        {isLoading || !data ? (
          <DashboardSkeleton />
        ) : (
          <>
            <div className="sf-stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MiniStat icon={BookOpen} tone="blue" label="Total Questions" value={data.totalQuestions.toLocaleString()} />
              <MiniStat icon={CheckCircle2} tone="green" label="Total Correct" value={data.correctAttempts.toLocaleString()} />
              <MiniStat icon={Percent} tone="amber" label="Overall Accuracy" value={`${data.correctPct}%`} />
              <MiniStat icon={BarChart3} tone="violet" label="QBank Completed" value={`${data.usedPct}%`} />
            </div>

            {/* QBank Performance Studio Grid */}
            <div className="grid gap-4 lg:grid-cols-2">
              {/* QBank Usage */}
              <div className="rounded-xl bg-card border border-border p-5 shadow-sm">
                <div className="font-semibold text-sm">QBank Usage</div>
                <div className="text-xs text-muted-foreground mb-4">Unique questions answered out of total pool</div>
                <div className="flex flex-col sm:flex-row items-center gap-5">
                  <Donut
                    size={150}
                    segments={[
                      { value: data.correctAttempts, color: "hsl(142 71% 45%)" },
                      { value: data.incorrectAttempts, color: "hsl(0 84% 60%)" },
                      { value: data.unused, color: "hsl(217 91% 60%)" },
                    ]}
                    center={
                      <div className="text-center">
                        <div className="text-2xl font-bold tabular-nums">{data.usedPct}%</div>
                        <div className="text-[10px] text-muted-foreground uppercase">Used</div>
                      </div>
                    }
                  />
                  <div className="flex-1 min-w-0 w-full space-y-2.5">
                    <Row icon={HelpCircle} tone="blue" label="Total Questions" value={data.totalQuestions} />
                    <Row icon={User} tone="violet" label="Used Questions" value={data.answered} />
                    <Row icon={MinusCircle} tone="sky" label="Unused Questions" value={data.unused} />
                  </div>
                </div>
              </div>

              {/* Overall Accuracy */}
              <div className="rounded-xl bg-card border border-border p-5 shadow-sm">
                <div className="font-semibold text-sm">Score Breakdown</div>
                <div className="text-xs text-muted-foreground mb-4">Cumulative accuracy across all submitted attempts</div>
                <div className="flex flex-col sm:flex-row items-center gap-5">
                  <Donut
                    size={150}
                    segments={[
                      { value: data.correctAttempts, color: "hsl(142 71% 45%)" },
                      { value: Math.max(data.totalAttempts - data.correctAttempts, 0), color: "hsl(0 0% 80%)" },
                    ]}
                    center={
                      <div className="text-center">
                        <div className="text-2xl font-bold tabular-nums">{data.correctPct}%</div>
                        <div className="text-[10px] text-muted-foreground uppercase">Correct</div>
                      </div>
                    }
                  />
                  <div className="flex-1 min-w-0 w-full space-y-2.5">
                    <Row icon={CheckCircle2} tone="green" label="Total Correct" value={data.correctAttempts} />
                    <Row icon={XCircle} tone="rose" label="Total Incorrect" value={data.incorrectAttempts} />
                    <Row icon={MinusCircle} tone="sky" label="Total Omitted" value={data.omittedAttempts} />
                  </div>
                </div>
              </div>

              {/* Answer Changes */}
              <div className="rounded-xl bg-card border border-border p-5 shadow-sm">
                <div className="font-semibold text-sm">Answer Changes</div>
                <div className="text-xs text-muted-foreground mb-4">How your answers shifted on repeated questions</div>
                <div className="space-y-2.5">
                  <Row icon={CheckCircle2} tone="green" label="Correct to Correct" value={data.answerChanges.correctToCorrect ?? 0} />
                  <Row icon={ArrowRightLeft} tone="rose" label="Correct to Incorrect" value={data.answerChanges.correctToIncorrect} />
                  <Row icon={RefreshCw} tone="green" label="Incorrect to Correct" value={data.answerChanges.incorrectToCorrect} />
                  <Row icon={Repeat} tone="amber" label="Incorrect to Incorrect" value={data.answerChanges.incorrectToIncorrect} />
                </div>
              </div>

              {/* Test Activity */}
              <div className="rounded-xl bg-card border border-border p-5 shadow-sm">
                <div className="font-semibold text-sm">Test Activity</div>
                <div className="text-xs text-muted-foreground mb-4">Blocks created, finished, and paused in this QBank</div>
                <div className="space-y-2.5">
                  <Row icon={FilePlus2} tone="blue" label="Tests Created" value={data.testCount.created} />
                  <Row icon={FileCheck2} tone="green" label="Tests Completed" value={data.testCount.completed} />
                  <Row icon={PauseCircle} tone="amber" label="Suspended Tests" value={data.testCount.suspended} />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const TONES: Record<string, { bg: string; text: string; pill: string }> = {
  blue:   { bg: "bg-blue-500/12",   text: "text-blue-600 dark:text-blue-400",     pill: "bg-blue-600 text-white" },
  green:  { bg: "bg-emerald-500/12", text: "text-emerald-600 dark:text-emerald-400", pill: "bg-emerald-600 text-white" },
  amber:  { bg: "bg-amber-500/12",  text: "text-amber-600 dark:text-amber-400",   pill: "bg-amber-600 text-white" },
  violet: { bg: "bg-violet-500/12", text: "text-violet-600 dark:text-violet-400", pill: "bg-violet-600 text-white" },
  rose:   { bg: "bg-rose-500/12",   text: "text-rose-600 dark:text-rose-400",     pill: "bg-rose-600 text-white" },
  sky:    { bg: "bg-sky-500/12",    text: "text-sky-600 dark:text-sky-400",       pill: "bg-sky-600 text-white" },
};

function MiniStat({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: keyof typeof TONES }) {
  const t = TONES[tone];
  return (
    <div className="rounded-xl bg-card border border-border p-4 flex items-center gap-3 shadow-sm">
      <div className={`h-10 w-10 rounded-lg grid place-items-center shrink-0 ${t.bg} ${t.text}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
        <div className="text-xl font-bold tabular-nums leading-tight mt-0.5">{value}</div>
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone: keyof typeof TONES }) {
  const t = TONES[tone];
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={`h-7 w-7 rounded-md grid place-items-center shrink-0 ${t.bg} ${t.text}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="text-xs sm:text-sm font-medium truncate">{label}</div>
      </div>
      <span className={`px-2 py-0.5 rounded-md text-xs font-semibold tabular-nums shrink-0 ${t.pill}`}>
        {value.toLocaleString()}
      </span>
    </div>
  );
}

function Donut({ size = 150, segments, center }: { size?: number; segments: { value: number; color: string }[]; center: React.ReactNode }) {
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  let offset = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" className="text-muted/50" strokeWidth={stroke} />
        {total > 0 && segments.map((seg, i) => {
          const len = (Math.max(0, seg.value) / total) * c;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={stroke}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center">{center}</div>
    </div>
  );
}
