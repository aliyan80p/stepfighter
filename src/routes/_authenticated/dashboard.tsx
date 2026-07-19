import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getDashboardStats } from "@/lib/qbank.functions";
import { useActiveQbankId } from "@/lib/active-qbank";
import { Button } from "@/components/ui/button";
import { BookOpen, CheckCircle2, XCircle, MinusCircle, HelpCircle, User, Percent, BarChart3, Flag, ArrowRightLeft, RefreshCw, Repeat, FilePlus2, FileCheck2, PauseCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const fn = useServerFn(getDashboardStats);
  const qbankId = useActiveQbankId();
  const { data, isLoading } = useQuery({ queryKey: ["dashboard", qbankId], queryFn: () => fn({ data: { qbankId } }) });


  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Welcome banner */}
        <div className="rounded-2xl bg-card border border-border p-5 flex flex-wrap items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary text-primary-foreground grid place-items-center">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-primary">Welcome Back!</h1>
              <p className="text-sm text-muted-foreground">Here's an overview of your learning progress</p>
            </div>
          </div>
          <div className="text-sm px-4 py-2 rounded-lg border border-border bg-background">
            Today, {today}
          </div>
        </div>

        {/* Top stat row */}
        {isLoading || !data ? (
          <div className="grid gap-4 md:grid-cols-4">
            {[0,1,2,3].map((i) => <div key={i} className="h-24 rounded-2xl border border-border animate-pulse bg-card" />)}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-4">
            <MiniStat icon={BookOpen} tone="blue" label="Total Questions" value={data.totalQuestions.toLocaleString()} />
            <MiniStat icon={CheckCircle2} tone="green" label="Total Correct" value={data.correctAttempts.toLocaleString()} />
            <MiniStat icon={Percent} tone="amber" label="Accuracy" value={`${data.accuracy}%`} />
            <MiniStat icon={BarChart3} tone="violet" label="QBank Used" value={`${data.usedPct}%`} />
          </div>
        )}

        {/* QBank Performance */}
        <div>
          <h2 className="text-lg font-semibold">QBank Performance</h2>
          <p className="text-sm text-muted-foreground mb-4">Track your question bank progress and accuracy</p>

          {data && (
            <div className="grid gap-4 md:grid-cols-2">
              {/* Usage donut */}
              <div className="rounded-2xl bg-card border border-border p-5 shadow-sm">
                <div className="font-semibold">QBank Usage</div>
                <div className="text-xs text-muted-foreground mb-4">Counts each unique question ID once, even if repeated</div>
                <div className="flex items-center gap-6">
                  <Donut
                    size={160}
                    segments={[
                      { value: data.correctAttempts, color: "hsl(142 71% 45%)" },
                      { value: data.incorrectAttempts, color: "hsl(0 84% 60%)" },
                      { value: data.unused, color: "hsl(217 91% 60%)" },
                    ]}
                    center={<div className="text-center"><div className="text-2xl font-bold">{data.usedPct}%</div><div className="text-[10px] text-muted-foreground uppercase">Used</div></div>}
                  />
                  <div className="flex-1 space-y-3">
                    <Row icon={HelpCircle} tone="blue" label="Total Questions" value={data.totalQuestions} />
                    <Row icon={User} tone="rose" label="Used Questions" value={data.answered} />
                    <Row icon={MinusCircle} tone="sky" label="Unused Questions" value={data.unused} />
                  </div>
                </div>
              </div>

              {/* Your Score */}
              <div className="rounded-2xl bg-card border border-border p-5 shadow-sm">
                <div className="font-semibold">Your Score</div>
                <div className="text-xs text-muted-foreground mb-4">Counts every answer attempt, so repeated attempts count</div>
                <div className="space-y-3">
                  <Row icon={CheckCircle2} tone="green" label="Total Correct" sub="Updated in real-time" value={data.correctAttempts} />
                  <Row icon={XCircle} tone="rose" label="Total Incorrect" sub="Updated in real-time" value={data.incorrectAttempts} />
                  <Row icon={MinusCircle} tone="sky" label="Total Omitted" sub="Updated in real-time" value={data.omittedAttempts} />
                </div>
              </div>

              {/* Total Correct donut */}
              <div className="rounded-2xl bg-card border border-border p-5 shadow-sm flex flex-col items-center">
                <div className="font-semibold mb-4">Total Correct</div>
                <Donut
                  size={160}
                  segments={[
                    { value: data.correctAttempts, color: "hsl(142 71% 45%)" },
                    { value: Math.max(data.totalAttempts - data.correctAttempts, 0), color: "hsl(0 0% 88%)" },
                  ]}
                  center={<div className="text-center"><div className="text-2xl font-bold">{data.correctPct}%</div><div className="text-[10px] text-muted-foreground">correct</div></div>}
                />
              </div>

              {/* Total Used donut */}
              <div className="rounded-2xl bg-card border border-border p-5 shadow-sm flex flex-col items-center">
                <div className="font-semibold mb-4">Total Used</div>
                <Donut
                  size={160}
                  segments={[
                    { value: data.answered, color: "hsl(217 91% 60%)" },
                    { value: Math.max(data.unused, 0), color: "hsl(0 0% 88%)" },
                  ]}
                  center={<div className="text-center"><div className="text-2xl font-bold">{data.usedPct}%</div><div className="text-[10px] text-muted-foreground">used</div></div>}
                />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg"><Link to="/new-test">Start New Test</Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/tests">Test History</Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/bookmarks"><Flag className="h-4 w-4 mr-2" />Flagged ({data?.bookmarks ?? 0})</Link></Button>
        </div>
      </div>
    </div>
  );
}

const TONES: Record<string, { bg: string; text: string; pill: string }> = {
  blue:   { bg: "bg-blue-100",   text: "text-blue-600",   pill: "bg-blue-500 text-white" },
  green:  { bg: "bg-green-100",  text: "text-green-600",  pill: "bg-green-500 text-white" },
  amber:  { bg: "bg-amber-100",  text: "text-amber-600",  pill: "bg-amber-500 text-white" },
  violet: { bg: "bg-violet-100", text: "text-violet-600", pill: "bg-violet-500 text-white" },
  rose:   { bg: "bg-rose-100",   text: "text-rose-600",   pill: "bg-rose-500 text-white" },
  sky:    { bg: "bg-sky-100",    text: "text-sky-600",    pill: "bg-sky-500 text-white" },
};

function MiniStat({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: keyof typeof TONES }) {
  const t = TONES[tone];
  return (
    <div className="rounded-2xl bg-card border border-border p-4 flex items-center gap-3 shadow-sm">
      <div className={`h-11 w-11 rounded-xl ${t.bg} ${t.text} grid place-items-center`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-2xl font-bold leading-tight">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, sub, value, tone }: { icon: any; label: string; sub?: string; value: number; tone: keyof typeof TONES }) {
  const t = TONES[tone];
  return (
    <div className="flex items-center gap-3">
      <div className={`h-9 w-9 rounded-lg ${t.bg} ${t.text} grid place-items-center shrink-0`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{label}</div>
        {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
      </div>
      <div className={`px-3 py-1 rounded-full text-sm font-semibold ${t.pill}`}>{value.toLocaleString()}</div>
    </div>
  );
}

function Donut({ size, segments, center }: { size: number; segments: { value: number; color: string }[]; center?: React.ReactNode }) {
  const stroke = 16;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let acc = 0;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="hsl(0 0% 92%)" strokeWidth={stroke} />
        {segments.map((s, i) => {
          const len = (s.value / total) * circ;
          const el = (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={`${len} ${circ - len}`}
              strokeDashoffset={-acc}
              strokeLinecap="butt"
            />
          );
          acc += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center">{center}</div>
    </div>
  );
}
