import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { getPeerRanking } from "@/lib/performance.functions";
import { QBANKS, useActiveQbankId } from "@/lib/active-qbank";
import { Trophy, Users, Target, ListChecks } from "lucide-react";

export const Route = createFileRoute("/_authenticated/performance/peer-ranking")({
  component: PeerRankingPage,
});

type Opt = { key: string; label: string; qbankId: number; sources?: string[] };
const STEP1_NBMES = [25, 26, 27, 28, 30, 31, 32, 33];
const STEP2_NBMES = [8, 9, 10, 11, 12, 13, 14, 15, 16];
const STEP2_CMS = [
  { tag: "EM", specialty: "Emergency Medicine", forms: [1, 2, 3] },
  { tag: "FM", specialty: "Family Medicine", forms: [2, 3, 5] },
  { tag: "IM", specialty: "Internal Medicine", forms: [5, 6, 7, 8, 9, 10] },
  { tag: "NEU", specialty: "Neurology", forms: [5, 6, 7, 8, 9] },
  { tag: "OBG", specialty: "Ob/Gyn", forms: [5, 6, 7, 8, 9, 10] },
  { tag: "PEDS", specialty: "Pediatrics", forms: [5, 6, 7, 8, 9] },
  { tag: "PSY", specialty: "Psychiatry", forms: [5, 6, 7, 8] },
  { tag: "SUR", specialty: "Surgery", forms: [5, 6, 7, 8, 9] },
];
const qbId = (slug: string) => QBANKS.find((q) => q.slug === slug)?.id ?? 1;
function buildOptions(): Opt[] {
  const out: Opt[] = [];
  const s1 = qbId("step1");
  out.push({ key: "step1-uw", label: "UWorld Step 1", qbankId: s1, sources: ["main"] });
  for (const n of [1, 2, 3]) out.push({ key: `step1-sa${n}`, label: `Step 1 SA ${n}`, qbankId: s1, sources: [`SA${n}`] });
  for (const n of STEP1_NBMES) out.push({ key: `step1-nbme${n}`, label: `Step 1 NBME ${n}`, qbankId: s1, sources: [`NBME${n}`] });
  const s2 = qbId("step2");
  out.push({ key: "step2-uw", label: "UWorld Step 2 CK", qbankId: s2, sources: ["main"] });
  for (const n of [1, 2, 3]) out.push({ key: `step2-sa${n}`, label: `Step 2 SA ${n}`, qbankId: s2, sources: [`SA${n}`] });
  for (const n of STEP2_NBMES) out.push({ key: `step2-nbme${n}`, label: `Step 2 NBME ${n}`, qbankId: s2, sources: [`NBME${n}`] });
  for (const cms of STEP2_CMS) out.push({ key: `step2-cms-${cms.tag}`, label: `CMS ${cms.specialty}`, qbankId: s2, sources: cms.forms.map((n) => `CMS_${cms.tag}${n}`) });
  const s3 = qbId("step3");
  out.push({ key: "step3-uw", label: "UWorld Step 3", qbankId: s3, sources: ["main"] });
  for (const n of [1, 2, 3]) out.push({ key: `step3-sa${n}`, label: `Step 3 SA ${n}`, qbankId: s3, sources: [`SA${n}`] });
  return out;
}
const OPTIONS = buildOptions();

function PeerRankingPage() {
  const fn = useServerFn(getPeerRanking);
  const activeQbankId = useActiveQbankId();
  const activeSlug = QBANKS.find((q) => q.id === activeQbankId)?.slug ?? "step2";
  const filtered = useMemo(() => OPTIONS.filter((o) => o.key.startsWith(`${activeSlug}-`)), [activeSlug]);
  const [optKey, setOptKey] = useState(`${activeSlug}-uw`);
  useEffect(() => {
    if (!filtered.some((o) => o.key === optKey)) setOptKey(filtered[0]?.key ?? `${activeSlug}-uw`);
  }, [activeSlug, filtered, optKey]);
  const opt = filtered.find((o) => o.key === optKey) ?? filtered[0];

  const { data, isLoading, error } = useQuery({
    queryKey: ["peer-rank", opt.qbankId, opt.sources?.join(",") ?? "all"],
    queryFn: () => fn({ data: { qbankId: opt.qbankId, sources: opt.sources } }),
  });

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Peer Ranking</h1>
          <p className="text-sm text-muted-foreground">Compare your performance with all other users on this QBank (anonymized)</p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm text-muted-foreground">QBank</label>
          <select value={optKey} onChange={(e) => setOptKey(e.target.value)} className="rounded-md border border-border bg-background px-3 py-2 text-sm min-w-[260px]">
            {filtered.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </div>

        {error ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{(error as Error).message}</div>
        ) : isLoading || !data ? (
          <div className="grid gap-4 md:grid-cols-3">
            {[0,1,2].map((i) => <div key={i} className="h-32 rounded-2xl border border-border animate-pulse bg-card" />)}
          </div>
        ) : data.totalPeers <= 1 ? (
          <div className="rounded-2xl bg-card border border-border p-10 text-center">
            <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <div className="font-semibold">Not enough peers yet</div>
            <div className="text-sm text-muted-foreground">Peer ranking activates once at least 2 users have attempted this QBank.</div>
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <BigTile from="from-emerald-500" to="to-emerald-600" icon={Target} label="Your Accuracy" value={`${data.you.accuracy}%`} sub={`Top ${100 - data.percentile.accuracy}%`} />
              <BigTile from="from-blue-500" to="to-blue-600" icon={ListChecks} label="Questions Answered" value={data.you.answered.toLocaleString()} sub={`Top ${100 - data.percentile.answered}%`} />
              <BigTile from="from-amber-500" to="to-amber-600" icon={Users} label="Peers Compared" value={data.totalPeers.toLocaleString()} sub="active users" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <MetricRow label="Accuracy" you={`${data.you.accuracy}%`} peer={`${data.peers.avgAccuracy}%`} median={`${data.peers.medianAccuracy}%`} percentile={data.percentile.accuracy} />
              <MetricRow label="Questions Answered" you={data.you.answered.toLocaleString()} peer={data.peers.avgAnswered.toLocaleString()} percentile={data.percentile.answered} />
            </div>

            <div className="rounded-2xl bg-card border border-border p-5 shadow-sm">
              <div className="font-semibold flex items-center gap-2"><Trophy className="h-4 w-4" /> Accuracy Distribution</div>
              <div className="text-xs text-muted-foreground mb-4">Number of users per accuracy bracket. Your bracket is highlighted.</div>
              <DistChart bins={data.distribution} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function BigTile({ from, to, icon: Icon, label, value, sub }: { from: string; to: string; icon: any; label: string; value: string; sub?: string }) {
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${from} ${to} text-white p-6 shadow-sm`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-3xl font-extrabold leading-none">{value}</div>
          <div className="text-sm font-medium mt-1 opacity-90">{label}</div>
        </div>
        <Icon className="h-8 w-8 opacity-80" />
      </div>
      {sub && <div className="mt-3 text-xs bg-white/20 rounded-full px-2 py-1 inline-block">{sub}</div>}
    </div>
  );
}

function MetricRow({ label, you, peer, median, percentile }: { label: string; you: string; peer: string; median?: string; percentile: number }) {
  return (
    <div className="rounded-2xl bg-card border border-border p-5 shadow-sm">
      <div className="font-semibold mb-3">{label}</div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3">
          <div className="text-xs text-muted-foreground">You</div>
          <div className="text-xl font-bold text-emerald-600">{you}</div>
        </div>
        <div className="rounded-lg bg-muted p-3">
          <div className="text-xs text-muted-foreground">Peer avg</div>
          <div className="text-xl font-bold">{peer}</div>
        </div>
        <div className="rounded-lg bg-muted p-3">
          <div className="text-xs text-muted-foreground">{median ? "Median" : "Percentile"}</div>
          <div className="text-xl font-bold">{median ?? `${percentile}%`}</div>
        </div>
      </div>
      <div className="mt-4">
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>0th</span><span>You beat {percentile}% of peers</span><span>100th</span>
        </div>
        <div className="h-3 rounded-full bg-muted overflow-hidden relative">
          <div className="absolute left-0 top-0 h-full bg-gradient-to-r from-emerald-500 to-emerald-400" style={{ width: `${percentile}%` }} />
          <div className="absolute top-0 h-full w-0.5 bg-foreground" style={{ left: `${percentile}%` }} />
        </div>
      </div>
    </div>
  );
}

function DistChart({ bins }: { bins: { label: string; count: number; you: boolean }[] }) {
  const max = Math.max(1, ...bins.map((b) => b.count));
  return (
    <div className="flex items-end gap-2 h-48">
      {bins.map((b) => (
        <div key={b.label} className="flex-1 flex flex-col items-center gap-1">
          <div className="text-[10px] text-muted-foreground">{b.count}</div>
          <div className="w-full rounded-t-md transition-all" style={{
            height: `${(b.count / max) * 140}px`,
            background: b.you ? "hsl(142 71% 45%)" : "hsl(217 91% 60% / 0.6)",
          }} />
          <div className={`text-[10px] ${b.you ? "font-semibold text-emerald-600" : "text-muted-foreground"}`}>{b.label}</div>
        </div>
      ))}
    </div>
  );
}
