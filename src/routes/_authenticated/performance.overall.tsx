import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { getDashboardStats } from "@/lib/qbank.functions";
import { QBANKS } from "@/lib/active-qbank";
import { CheckCircle2, XCircle, MinusCircle, HelpCircle, User, ArrowRightLeft, RefreshCw, Repeat, FilePlus2, FileCheck2, PauseCircle, ClipboardList } from "lucide-react";

export const Route = createFileRoute("/_authenticated/performance/overall")({
  component: OverallPerformance,
});

// ---- QBank option catalogue (mirrors new-test.tsx) ----
type Opt = { key: string; label: string; qbankId: number; sources?: string[] };

const STEP1_NBMES = [25, 26, 27, 28, 30, 31, 32, 33];
const STEP2_NBMES = [8, 9, 10, 11, 12, 13, 14, 15, 16];
const STEP2_CMS: Array<{ specialty: string; tag: string; forms: number[] }> = [
  { specialty: "Emergency Medicine", tag: "EM",   forms: [1, 2, 3] },
  { specialty: "Family Medicine",    tag: "FM",   forms: [2, 3, 5] },
  { specialty: "Internal Medicine",  tag: "IM",   forms: [5, 6, 7, 8, 9, 10] },
  { specialty: "Neurology",          tag: "NEU",  forms: [5, 6, 7, 8, 9] },
  { specialty: "Ob/Gyn",             tag: "OBG",  forms: [5, 6, 7, 8, 9, 10] },
  { specialty: "Pediatrics",         tag: "PEDS", forms: [5, 6, 7, 8, 9] },
  { specialty: "Psychiatry",         tag: "PSY",  forms: [5, 6, 7, 8] },
  { specialty: "Surgery",            tag: "SUR",  forms: [5, 6, 7, 8, 9] },
];

const qbId = (slug: string) => QBANKS.find((q) => q.slug === slug)?.id ?? 1;

function buildOptions(): Opt[] {
  const out: Opt[] = [];

  // Step 1
  const s1 = qbId("step1");
  out.push({ key: "step1-uw", label: "UWorld Step 1", qbankId: s1, sources: ["main"] });
  for (const n of [1, 2, 3]) out.push({ key: `step1-sa${n}`, label: `Step 1 Self Assessment ${n}`, qbankId: s1, sources: [`SA${n}`] });
  for (const n of STEP1_NBMES) out.push({ key: `step1-nbme${n}`, label: `Step 1 NBME ${n}`, qbankId: s1, sources: [`NBME${n}`] });

  // Step 2
  const s2 = qbId("step2");
  out.push({ key: "step2-uw", label: "UWorld Step 2 CK", qbankId: s2, sources: ["main"] });

  for (const n of [1, 2, 3]) out.push({ key: `step2-sa${n}`, label: `Step 2 CK Self Assessment ${n}`, qbankId: s2, sources: [`SA${n}`] });
  for (const n of STEP2_NBMES) out.push({ key: `step2-nbme${n}`, label: `Step 2 CK NBME ${n}`, qbankId: s2, sources: [`NBME${n}`] });
  for (const cms of STEP2_CMS) {
    const forms = cms.forms;
    const label = `CMS ${cms.specialty} Forms (${forms.join(",")})`;
    out.push({ key: `step2-cms-${cms.tag}`, label, qbankId: s2, sources: forms.map((n) => `CMS_${cms.tag}${n}`) });
  }

  // Step 3
  const s3 = qbId("step3");
  out.push({ key: "step3-uw", label: "UWorld Step 3", qbankId: s3, sources: ["main"] });
  for (const n of [1, 2, 3]) out.push({ key: `step3-sa${n}`, label: `Step 3 Self Assessment ${n}`, qbankId: s3, sources: [`SA${n}`] });

  return out;
}

const OPTIONS = buildOptions();

function OverallPerformance() {
  const fn = useServerFn(getDashboardStats);
  const [tab, setTab] = useState<"overall" | "analysis">("overall");
  const [optKey, setOptKey] = useState<string>("step2-uw");
  const opt = useMemo(() => OPTIONS.find((o) => o.key === optKey) ?? OPTIONS[0], [optKey]);

  const { data, isLoading } = useQuery({
    queryKey: ["perf-overall", opt.qbankId, opt.sources?.join(",") ?? "all"],
    queryFn: () => fn({ data: { qbankId: opt.qbankId, sources: opt.sources } }),
  });

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Tabs */}
        <div className="flex justify-center">
          <div className="inline-flex rounded-full bg-muted/60 p-1">
            <button
              className={`px-6 py-2 text-sm font-semibold rounded-full transition-colors ${tab === "overall" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              onClick={() => setTab("overall")}
            >Overall</button>
            <button
              className={`px-6 py-2 text-sm font-semibold rounded-full transition-colors ${tab === "analysis" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              onClick={() => setTab("analysis")}
            >Analysis</button>
          </div>
        </div>

        {/* Filter dropdown */}
        <div className="flex items-center gap-3">
          <label className="text-sm text-muted-foreground">Filter by QBank</label>
          <select
            value={optKey}
            onChange={(e) => setOptKey(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm min-w-[280px]"
          >
            <optgroup label="Overview">
              {OPTIONS.filter((o) => o.key === "all").map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </optgroup>
            <optgroup label="USMLE Step 1">
              {OPTIONS.filter((o) => o.key.startsWith("step1")).map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </optgroup>
            <optgroup label="USMLE Step 2 CK">
              {OPTIONS.filter((o) => o.key.startsWith("step2") && !o.key.startsWith("step2-cms")).map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </optgroup>
            <optgroup label="CMS Forms (Step 2 CK)">
              {OPTIONS.filter((o) => o.key.startsWith("step2-cms")).map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </optgroup>
            <optgroup label="USMLE Step 3">
              {OPTIONS.filter((o) => o.key.startsWith("step3")).map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </optgroup>
          </select>
        </div>

        {tab === "analysis" ? (
          <div className="rounded-2xl bg-card border border-border p-10 text-center text-muted-foreground">
            Detailed analysis coming soon.
          </div>
        ) : (
          <>
            {/* Top gradient tiles */}
            {isLoading || !data ? (
              <div className="grid gap-4 md:grid-cols-3">
                {[0,1,2].map((i) => <div key={i} className="h-28 rounded-2xl border border-border animate-pulse bg-card" />)}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                <BigTile from="from-blue-500" to="to-blue-600" icon={ClipboardList} label="Total Tests" value={data.testCount.created} />
                <BigTile from="from-emerald-500" to="to-emerald-600" icon={FileCheck2} label="Tests Completed" value={data.testCount.completed} />
                <BigTile from="from-rose-500" to="to-rose-600" icon={PauseCircle} label="Tests Suspended" value={data.testCount.suspended} />
              </div>
            )}

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
                    <Row icon={CheckCircle2} tone="green" label="Total Correct" value={data.correctAttempts} />
                    <Row icon={XCircle} tone="rose" label="Total Incorrect" value={data.incorrectAttempts} />
                    <Row icon={MinusCircle} tone="sky" label="Total Omitted" value={data.omittedAttempts} />
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

            {data && (
              <div className="grid gap-4 md:grid-cols-2">
                {/* Answer Changes */}
                <div className="rounded-2xl bg-card border border-border p-5 shadow-sm">
                  <div className="font-semibold">Answer Changes</div>
                  <div className="text-xs text-muted-foreground mb-4">Detailed breakdown of attempts</div>
                  <div className="space-y-3">
                    <Row icon={CheckCircle2} tone="green" label="Correct to Correct" value={data.answerChanges.correctToCorrect ?? 0} />
                    <Row icon={ArrowRightLeft} tone="rose" label="Correct to Incorrect" value={data.answerChanges.correctToIncorrect} />
                    <Row icon={RefreshCw} tone="sky" label="Incorrect to Correct" value={data.answerChanges.incorrectToCorrect} />
                    <Row icon={Repeat} tone="violet" label="Incorrect to Incorrect" value={data.answerChanges.incorrectToIncorrect} />
                  </div>
                </div>

                {/* Test Count */}
                <div className="rounded-2xl bg-card border border-border p-5 shadow-sm">
                  <div className="font-semibold">Test Count</div>
                  <div className="text-xs text-muted-foreground mb-4">Your test activity for this selection</div>
                  <div className="space-y-3">
                    <Row icon={FilePlus2} tone="blue" label="Tests Created" value={data.testCount.created} />
                    <Row icon={FileCheck2} tone="green" label="Tests Completed" value={data.testCount.completed} />
                    <Row icon={PauseCircle} tone="amber" label="Suspended Tests" value={data.testCount.suspended} />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
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

function BigTile({ from, to, icon: Icon, label, value }: { from: string; to: string; icon: any; label: string; value: number }) {
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${from} ${to} text-white p-6 shadow-sm flex items-center justify-between`}>
      <div>
        <div className="text-4xl font-extrabold leading-none">{value.toLocaleString()}</div>
        <div className="text-sm font-medium mt-1 opacity-90">{label}</div>
      </div>
      <Icon className="h-8 w-8 opacity-80" />
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
