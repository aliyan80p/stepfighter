import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const qb = () => z.number().int().min(1);

// ============ Performance Graphs ============
export const getPerformanceGraphs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      qbankId: qb(),
      sources: z.array(z.string()).optional(),
      days: z.number().int().min(7).max(365).default(90),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const since = new Date(Date.now() - data.days * 86_400_000);

    // Resolve question set if sources filter is active
    let sourceQIds: number[] | null = null;
    if (data.sources && data.sources.length) {
      const { data: qs } = await supabase
        .from("questions")
        .select("id,subject_id,system_id")
        .eq("qbank_id", data.qbankId)
        .in("source", data.sources)
        .limit(50000);
      sourceQIds = (qs ?? []).map((r) => r.id);
    }

    let atq = supabase
      .from("attempts")
      .select("question_id,is_correct,selected_answer,created_at,time_seconds")
      .eq("user_id", userId)
      .eq("qbank_id", data.qbankId)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: true })
      .limit(50000);
    if (sourceQIds) {
      if (!sourceQIds.length) atq = atq.eq("question_id", -1);
      else atq = atq.in("question_id", sourceQIds);
    }
    const { data: attempts, error } = await atq;
    if (error) throw new Error(error.message);

    // question -> subject/system map (only for attempted qs)
    const attemptedIds = Array.from(new Set((attempts ?? []).map((a) => a.question_id)));
    let qMeta: { id: number; subject_id: number | null; system_id: number | null }[] = [];
    if (attemptedIds.length) {
      const { data: qs } = await supabase
        .from("questions")
        .select("id,subject_id,system_id")
        .eq("qbank_id", data.qbankId)
        .in("id", attemptedIds)
        .limit(50000);
      qMeta = qs ?? [];
    }
    const [{ data: subjects }, { data: systems }] = await Promise.all([
      supabase.from("subjects").select("id,name").eq("qbank_id", data.qbankId),
      supabase.from("systems").select("id,name").eq("qbank_id", data.qbankId),
    ]);
    const subjectName = new Map((subjects ?? []).map((s) => [s.id, s.name]));
    const systemName = new Map((systems ?? []).map((s) => [s.id, s.name]));
    const qSubject = new Map(qMeta.map((q) => [q.id, q.subject_id]));
    const qSystem = new Map(qMeta.map((q) => [q.id, q.system_id]));

    // Daily buckets
    const dayMap = new Map<string, { correct: number; incorrect: number; omitted: number; total: number }>();
    for (let i = 0; i < data.days; i++) {
      const d = new Date(Date.now() - (data.days - 1 - i) * 86_400_000);
      const key = d.toISOString().slice(0, 10);
      dayMap.set(key, { correct: 0, incorrect: 0, omitted: 0, total: 0 });
    }
    // Subject / system tallies
    const subjAgg = new Map<number, { correct: number; total: number }>();
    const sysAgg = new Map<number, { correct: number; total: number }>();
    let totalTime = 0, timeSamples = 0;

    for (const a of attempts ?? []) {
      const key = new Date(a.created_at).toISOString().slice(0, 10);
      const bucket = dayMap.get(key);
      if (bucket) {
        bucket.total++;
        if (a.selected_answer == null) bucket.omitted++;
        else if (a.is_correct) bucket.correct++;
        else bucket.incorrect++;
      }
      if (a.time_seconds != null) { totalTime += a.time_seconds; timeSamples++; }
      const sid = qSubject.get(a.question_id) ?? null;
      const syid = qSystem.get(a.question_id) ?? null;
      if (sid != null) {
        const x = subjAgg.get(sid) ?? { correct: 0, total: 0 };
        x.total++; if (a.is_correct) x.correct++;
        subjAgg.set(sid, x);
      }
      if (syid != null) {
        const x = sysAgg.get(syid) ?? { correct: 0, total: 0 };
        x.total++; if (a.is_correct) x.correct++;
        sysAgg.set(syid, x);
      }
    }

    const daily = Array.from(dayMap.entries()).map(([date, v]) => ({
      date,
      ...v,
      pct: v.total ? Math.round((v.correct / v.total) * 1000) / 10 : 0,
    }));

    // Cumulative unique-question count over time
    const seen = new Set<number>();
    const cumulative: { date: string; answered: number }[] = [];
    const byDate = new Map<string, number[]>();
    for (const a of attempts ?? []) {
      const key = new Date(a.created_at).toISOString().slice(0, 10);
      const arr = byDate.get(key) ?? [];
      arr.push(a.question_id);
      byDate.set(key, arr);
    }
    for (const { date } of daily) {
      const ids = byDate.get(date) ?? [];
      for (const id of ids) seen.add(id);
      cumulative.push({ date, answered: seen.size });
    }

    const subjectBreakdown = Array.from(subjAgg.entries()).map(([id, v]) => ({
      id, name: subjectName.get(id) ?? `Subject ${id}`,
      correct: v.correct, total: v.total,
      pct: v.total ? Math.round((v.correct / v.total) * 1000) / 10 : 0,
    })).sort((a, b) => b.total - a.total);

    const systemBreakdown = Array.from(sysAgg.entries()).map(([id, v]) => ({
      id, name: systemName.get(id) ?? `System ${id}`,
      correct: v.correct, total: v.total,
      pct: v.total ? Math.round((v.correct / v.total) * 1000) / 10 : 0,
    })).sort((a, b) => b.total - a.total);

    return {
      daily, cumulative, subjectBreakdown, systemBreakdown,
      totalAttempts: attempts?.length ?? 0,
      avgTimeSec: timeSamples ? Math.round(totalTime / timeSamples) : 0,
    };
  });

// ============ Peer Ranking ============
// Aggregates across all users; uses admin client for cross-user reads.
export const getPeerRanking = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ qbankId: qb(), sources: z.array(z.string()).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let sourceQIds: number[] | null = null;
    if (data.sources && data.sources.length) {
      const { data: qs } = await supabaseAdmin
        .from("questions")
        .select("id")
        .eq("qbank_id", data.qbankId)
        .in("source", data.sources)
        .limit(50000);
      sourceQIds = (qs ?? []).map((r) => r.id);
    }

    let q = supabaseAdmin
      .from("attempts")
      .select("user_id,question_id,is_correct,selected_answer")
      .eq("qbank_id", data.qbankId)
      .limit(500000);
    if (sourceQIds) {
      if (!sourceQIds.length) q = q.eq("question_id", -1);
      else q = q.in("question_id", sourceQIds);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const perUser = new Map<string, { correct: number; total: number; unique: Set<number> }>();
    for (const r of rows ?? []) {
      const u = perUser.get(r.user_id) ?? { correct: 0, total: 0, unique: new Set<number>() };
      u.total++;
      if (r.is_correct) u.correct++;
      u.unique.add(r.question_id);
      perUser.set(r.user_id, u);
    }

    const stats = Array.from(perUser.entries()).map(([uid, v]) => ({
      uid,
      accuracy: v.total ? v.correct / v.total : 0,
      answered: v.unique.size,
      attempts: v.total,
    }));
    const totalPeers = stats.length;

    const you = perUser.get(userId);
    const yourAccuracy = you && you.total ? you.correct / you.total : 0;
    const yourAnswered = you ? you.unique.size : 0;
    const yourAttempts = you?.total ?? 0;

    // percentile: fraction of peers you beat (0..100)
    const beatOn = (val: number, key: "accuracy" | "answered" | "attempts") =>
      totalPeers > 1
        ? Math.round((stats.filter((s) => s.uid !== userId && s[key] < val).length / (totalPeers - 1)) * 100)
        : 0;

    const meanAccuracy = totalPeers ? stats.reduce((a, s) => a + s.accuracy, 0) / totalPeers : 0;
    const meanAnswered = totalPeers ? stats.reduce((a, s) => a + s.answered, 0) / totalPeers : 0;
    const meanAttempts = totalPeers ? stats.reduce((a, s) => a + s.attempts, 0) / totalPeers : 0;

    const sortedAcc = [...stats].sort((a, b) => a.accuracy - b.accuracy);
    const median = totalPeers ? sortedAcc[Math.floor(totalPeers / 2)].accuracy : 0;

    // Distribution bins (accuracy 0-100 in 10% bins)
    const bins = Array.from({ length: 10 }, (_, i) => ({
      label: `${i * 10}-${(i + 1) * 10}%`,
      count: 0,
      you: false,
    }));
    for (const s of stats) {
      const idx = Math.min(9, Math.floor(s.accuracy * 10));
      bins[idx].count++;
    }
    const yourBin = Math.min(9, Math.floor(yourAccuracy * 10));
    if (totalPeers) bins[yourBin].you = true;

    return {
      totalPeers,
      you: {
        accuracy: Math.round(yourAccuracy * 1000) / 10,
        answered: yourAnswered,
        attempts: yourAttempts,
      },
      peers: {
        avgAccuracy: Math.round(meanAccuracy * 1000) / 10,
        medianAccuracy: Math.round(median * 1000) / 10,
        avgAnswered: Math.round(meanAnswered),
        avgAttempts: Math.round(meanAttempts),
      },
      percentile: {
        accuracy: beatOn(yourAccuracy, "accuracy"),
        answered: beatOn(yourAnswered, "answered"),
        attempts: beatOn(yourAttempts, "attempts"),
      },
      distribution: bins,
    };
  });

// ============ Peer Ranking by Category (Subjects / Systems) ============
export const getPeerCategoryBreakdown = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ qbankId: qb(), sources: z.array(z.string()).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Resolve question set + subject/system mapping
    let qQuery = supabaseAdmin
      .from("questions")
      .select("id,subject_id,system_id")
      .eq("qbank_id", data.qbankId)
      .limit(100000);
    if (data.sources?.length) qQuery = qQuery.in("source", data.sources);
    const { data: qs, error: qErr } = await qQuery;
    if (qErr) throw new Error(qErr.message);

    const qSubject = new Map<number, number | null>();
    const qSystem = new Map<number, number | null>();
    const ids: number[] = [];
    for (const q of qs ?? []) {
      qSubject.set(q.id, q.subject_id);
      qSystem.set(q.id, q.system_id);
      ids.push(q.id);
    }

    if (!ids.length) return { subjects: [], systems: [] };

    let aQuery = supabaseAdmin
      .from("attempts")
      .select("user_id,question_id,is_correct")
      .eq("qbank_id", data.qbankId)
      .in("question_id", ids)
      .limit(500000);
    const { data: rows, error: aErr } = await aQuery;
    if (aErr) throw new Error(aErr.message);

    // per (category, user) totals
    type Agg = Map<number, Map<string, { c: number; t: number }>>;
    const subjAgg: Agg = new Map();
    const sysAgg: Agg = new Map();
    const bump = (agg: Agg, catId: number | null, uid: string, correct: boolean) => {
      if (catId == null) return;
      let m = agg.get(catId);
      if (!m) { m = new Map(); agg.set(catId, m); }
      const x = m.get(uid) ?? { c: 0, t: 0 };
      x.t++; if (correct) x.c++;
      m.set(uid, x);
    };
    for (const r of rows ?? []) {
      bump(subjAgg, qSubject.get(r.question_id) ?? null, r.user_id, !!r.is_correct);
      bump(sysAgg, qSystem.get(r.question_id) ?? null, r.user_id, !!r.is_correct);
    }

    const [{ data: subjectsRows }, { data: systemsRows }] = await Promise.all([
      supabaseAdmin.from("subjects").select("id,name").eq("qbank_id", data.qbankId),
      supabaseAdmin.from("systems").select("id,name").eq("qbank_id", data.qbankId),
    ]);
    const subjectName = new Map((subjectsRows ?? []).map((s) => [s.id, s.name]));
    const systemName = new Map((systemsRows ?? []).map((s) => [s.id, s.name]));

    const build = (agg: Agg, names: Map<number, string>) => {
      const out: { id: number; name: string; you: number | null; peer: number; peerCount: number }[] = [];
      for (const [catId, m] of agg.entries()) {
        const you = m.get(userId);
        const peers = Array.from(m.entries()).filter(([uid]) => uid !== userId);
        if (!peers.length && !you) continue;
        const peerAvg = peers.length
          ? peers.reduce((a, [, v]) => a + (v.t ? v.c / v.t : 0), 0) / peers.length
          : 0;
        out.push({
          id: catId,
          name: names.get(catId) ?? `#${catId}`,
          you: you && you.t ? Math.round((you.c / you.t) * 1000) / 10 : null,
          peer: Math.round(peerAvg * 1000) / 10,
          peerCount: peers.length,
        });
      }
      return out.sort((a, b) => a.name.localeCompare(b.name));
    };

    return { subjects: build(subjAgg, subjectName), systems: build(sysAgg, systemName) };
  });

// ============ Performance Charts (per-test scores) ============
export const getPerformanceCharts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ qbankId: qb(), sources: z.array(z.string()).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Optionally resolve question set for source filter
    let sourceQIds: Set<number> | null = null;
    if (data.sources?.length) {
      const { data: qs } = await supabase
        .from("questions")
        .select("id")
        .eq("qbank_id", data.qbankId)
        .in("source", data.sources)
        .limit(100000);
      sourceQIds = new Set((qs ?? []).map((r) => r.id));
    }

    const { data: tests, error } = await supabase
      .from("tests")
      .select("id,name,question_ids,right_count,wrong_count,done,created_at")
      .eq("user_id", userId)
      .eq("qbank_id", data.qbankId)
      .eq("done", true)
      .order("created_at", { ascending: true })
      .limit(2000);
    if (error) throw new Error(error.message);

    const rows = (tests ?? [])
      .filter((t) => {
        if (!sourceQIds) return true;
        const qids = (t.question_ids ?? []) as number[];
        return qids.some((id) => sourceQIds!.has(id));
      })
      .map((t) => {
        const qids = (t.question_ids ?? []) as number[];
        const total = qids.length || 1;
        const score = Math.round(((t.right_count ?? 0) / total) * 1000) / 10;
        return {
          id: Number(t.id),
          name: t.name ?? `Test ${t.id}`,
          date: (t.created_at as string).slice(0, 10),
          score,
        };
      });

    return { tests: rows };
  });

// ============ AI Test Analysis ============
export const getAiTestAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ testId: z.number().int().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: test, error: e1 } = await supabase
      .from("tests")
      .select("id,qbank_id,name,question_ids,mode,done,right_count,wrong_count,created_at")
      .eq("id", data.testId)
      .eq("user_id", userId)
      .single();
    if (e1 || !test) throw new Error(e1?.message ?? "Test not found");

    const qIds = (test.question_ids ?? []) as number[];
    if (!qIds.length) throw new Error("Test has no questions");

    const [{ data: attempts }, { data: qs }, { data: subjects }, { data: systems }] = await Promise.all([
      supabase.from("attempts").select("question_id,is_correct,selected_answer,time_seconds")
        .eq("user_id", userId).eq("test_id", test.id),
      supabase.from("questions").select("id,subject_id,system_id,title")
        .eq("qbank_id", test.qbank_id).in("id", qIds).limit(200),
      supabase.from("subjects").select("id,name").eq("qbank_id", test.qbank_id),
      supabase.from("systems").select("id,name").eq("qbank_id", test.qbank_id),
    ]);
    const subjectName = new Map((subjects ?? []).map((s) => [s.id, s.name]));
    const systemName = new Map((systems ?? []).map((s) => [s.id, s.name]));
    const qById = new Map((qs ?? []).map((q) => [q.id, q]));

    const bySubject = new Map<string, { correct: number; total: number }>();
    const bySystem = new Map<string, { correct: number; total: number }>();
    let totalTime = 0, timeSamples = 0, correct = 0, incorrect = 0, omitted = 0;
    for (const a of attempts ?? []) {
      const q = qById.get(a.question_id);
      const sName = q?.subject_id != null ? subjectName.get(q.subject_id) ?? "Unknown" : "Unknown";
      const syName = q?.system_id != null ? systemName.get(q.system_id) ?? "Unknown" : "Unknown";
      const sx = bySubject.get(sName) ?? { correct: 0, total: 0 };
      sx.total++; if (a.is_correct) sx.correct++;
      bySubject.set(sName, sx);
      const syx = bySystem.get(syName) ?? { correct: 0, total: 0 };
      syx.total++; if (a.is_correct) syx.correct++;
      bySystem.set(syName, syx);
      if (a.time_seconds != null) { totalTime += a.time_seconds; timeSamples++; }
      if (a.selected_answer == null) omitted++;
      else if (a.is_correct) correct++; else incorrect++;
    }

    const subjRows = Array.from(bySubject.entries()).map(([name, v]) => ({
      name, ...v, pct: v.total ? Math.round((v.correct / v.total) * 100) : 0,
    }));
    const sysRows = Array.from(bySystem.entries()).map(([name, v]) => ({
      name, ...v, pct: v.total ? Math.round((v.correct / v.total) * 100) / 1 : 0,
    }));

    const totalAns = correct + incorrect + omitted;
    const summary = {
      name: test.name,
      mode: test.mode,
      total: qIds.length,
      answered: totalAns,
      correct, incorrect, omitted,
      accuracy: totalAns ? Math.round((correct / totalAns) * 100) : 0,
      avgTimeSec: timeSamples ? Math.round(totalTime / timeSamples) : 0,
      subjects: subjRows.sort((a, b) => a.pct - b.pct),
      systems: sysRows.sort((a, b) => a.pct - b.pct),
    };

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const prompt = `You are a USMLE tutor. Analyze this test result and produce a concise, personalized study plan in Markdown.

Test: ${summary.name ?? "Untitled"}  (mode: ${summary.mode})
Score: ${summary.correct}/${summary.total} answered = ${summary.accuracy}% correct
Incorrect: ${summary.incorrect} | Omitted: ${summary.omitted}
Avg time per question: ${summary.avgTimeSec}s

Subject accuracy (weakest first):
${summary.subjects.map((s) => `- ${s.name}: ${s.correct}/${s.total} (${s.pct}%)`).join("\n")}

System accuracy (weakest first):
${summary.systems.map((s) => `- ${s.name}: ${s.correct}/${s.total} (${s.pct}%)`).join("\n")}

Return sections:
1. **Overall Snapshot** (2–3 sentences)
2. **Top 3 Strengths** (bullets, with subject/system names)
3. **Top 3 Weaknesses** (bullets, with subject/system names)
4. **Timing Insight** (1–2 sentences on pacing given ${summary.avgTimeSec}s avg)
5. **Study Plan for the Next 7 Days** (numbered list, concrete, actionable)
6. **Recommended Resources** (short list — First Aid chapters, UWorld topics, videos)

Keep it under 350 words. Be direct and specific.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-3.5-flash",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      if (resp.status === 429) throw new Error("AI rate limit reached. Please try again in a moment.");
      if (resp.status === 402) throw new Error("Workspace AI credits exhausted. Please add credits.");
      throw new Error(`AI error (${resp.status}): ${text.slice(0, 200)}`);
    }
    const json = await resp.json() as { choices?: { message?: { content?: string } }[] };
    const analysis = json.choices?.[0]?.message?.content ?? "No analysis generated.";

    return { summary, analysis };
  });

// ============ Improvements Required (AI Study Plan) ============

async function loadAttemptContext(supabase: any, userId: string, qbankId: number) {
  const [{ data: attempts }, { data: questions }, { data: subjects }, { data: systems }, { data: tests }] = await Promise.all([
    supabase.from("attempts").select("question_id,is_correct,selected_answer,created_at,test_id")
      .eq("user_id", userId).eq("qbank_id", qbankId).order("created_at", { ascending: true }).limit(200000),
    supabase.from("questions").select("id,subject_id,system_id,topic").eq("qbank_id", qbankId).limit(200000),
    supabase.from("subjects").select("id,name").eq("qbank_id", qbankId),
    supabase.from("systems").select("id,name").eq("qbank_id", qbankId),
    supabase.from("tests").select("id,name,question_ids,right_count,wrong_count,done,created_at,study_plan_index")
      .eq("user_id", userId).eq("qbank_id", qbankId).order("created_at", { ascending: true }).limit(5000),
  ]);
  return {
    attempts: attempts ?? [],
    questions: questions ?? [],
    subjectName: new Map<number, string>((subjects ?? []).map((s: any) => [s.id, s.name])),
    systemName: new Map<number, string>((systems ?? []).map((s: any) => [s.id, s.name])),
    tests: tests ?? [],
  };
}

/**
 * Latest attempt per question. Uses the last selected/omitted attempt to compute
 * overall accuracy and category breakdowns.
 */
function latestByQuestion(attempts: any[]) {
  const map = new Map<number, any>();
  for (const a of attempts) map.set(a.question_id, a);
  return Array.from(map.values());
}

export const getImprovementsOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ qbankId: qb() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { attempts, questions, subjectName, systemName, tests } = await loadAttemptContext(supabase, userId, data.qbankId);

    const qSub = new Map<number, number | null>(questions.map((q: any) => [q.id, q.subject_id]));
    const qSys = new Map<number, number | null>(questions.map((q: any) => [q.id, q.system_id]));

    const latest = latestByQuestion(attempts);
    const answered = latest.filter((a) => a.selected_answer != null);
    const correct = answered.filter((a) => a.is_correct).length;
    const overallPct = answered.length ? Math.round((correct / answered.length) * 100) : 0;

    // Subject accuracy
    const subjAgg = new Map<number, { c: number; t: number }>();
    const sysAgg = new Map<number, { c: number; t: number }>();
    const subjSys = new Map<number, Map<number, { c: number; t: number }>>();
    for (const a of answered) {
      const sid = qSub.get(a.question_id) ?? null;
      const syid = qSys.get(a.question_id) ?? null;
      if (sid != null) {
        const x = subjAgg.get(sid) ?? { c: 0, t: 0 };
        x.t++; if (a.is_correct) x.c++;
        subjAgg.set(sid, x);
        if (syid != null) {
          let m = subjSys.get(sid); if (!m) { m = new Map(); subjSys.set(sid, m); }
          const y = m.get(syid) ?? { c: 0, t: 0 };
          y.t++; if (a.is_correct) y.c++;
          m.set(syid, y);
        }
      }
      if (syid != null) {
        const x = sysAgg.get(syid) ?? { c: 0, t: 0 };
        x.t++; if (a.is_correct) x.c++;
        sysAgg.set(syid, x);
      }
    }

    const subjRows = Array.from(subjAgg.entries())
      .filter(([, v]) => v.t >= 3)
      .map(([id, v]) => ({ id, name: subjectName.get(id) ?? `Subject ${id}`, pct: Math.round((v.c / v.t) * 100), total: v.t }))
      .sort((a, b) => a.pct - b.pct);

    const under40 = subjRows.filter((s) => s.pct < 40).slice(0, 3);
    const weakList = under40.length
      ? under40
      : subjRows.filter((s) => s.pct <= 90).slice(0, 3);

    const weakAreas = weakList.map((s) => {
      const sysMap = subjSys.get(s.id);
      let weakestSystem = "—";
      if (sysMap) {
        const rows = Array.from(sysMap.entries())
          .filter(([, v]) => v.t >= 2)
          .map(([id, v]) => ({ id, pct: v.c / v.t }))
          .sort((a, b) => a.pct - b.pct);
        if (rows.length) weakestSystem = systemName.get(rows[0].id) ?? "—";
      }
      return { subject: s.name, subjectId: s.id, weakestSystem, pct: s.pct };
    });

    // Per-test scores (chronological)
    const perfOverTime = tests
      .filter((t: any) => t.done)
      .map((t: any) => {
        const total = (t.question_ids ?? []).length || 1;
        return {
          testId: Number(t.id),
          name: t.name ?? `Test ${t.id}`,
          pct: Math.round(((t.right_count ?? 0) / total) * 100),
          date: (t.created_at as string).slice(0, 10),
        };
      });

    // Trend: recent half vs earlier half
    let trendDelta: number | null = null;
    if (perfOverTime.length >= 4) {
      const half = Math.floor(perfOverTime.length / 2);
      const earlier = perfOverTime.slice(0, half);
      const recent = perfOverTime.slice(perfOverTime.length - half);
      const avg = (arr: any[]) => arr.reduce((a, r) => a + r.pct, 0) / arr.length;
      trendDelta = Math.round((avg(recent) - avg(earlier)) * 10) / 10;
    }

    return { overallPct, totalAnswered: answered.length, weakAreas, perfOverTime, trendDelta };
  });

export const getCategoryStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    qbankId: qb(),
    kind: z.enum(["subject", "system", "topic"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { attempts, questions, subjectName, systemName } = await loadAttemptContext(supabase, userId, data.qbankId);
    const qMeta = new Map<number, any>(questions.map((q: any) => [q.id, q]));
    const latest = latestByQuestion(attempts).filter((a) => a.selected_answer != null);

    const agg = new Map<string, { c: number; t: number }>();
    for (const a of latest) {
      const q = qMeta.get(a.question_id);
      if (!q) continue;
      let key: string | null = null;
      if (data.kind === "subject") key = q.subject_id != null ? (subjectName.get(q.subject_id) ?? null) : null;
      else if (data.kind === "system") key = q.system_id != null ? (systemName.get(q.system_id) ?? null) : null;
      else key = q.topic ?? null;
      if (!key) continue;
      const x = agg.get(key) ?? { c: 0, t: 0 };
      x.t++; if (a.is_correct) x.c++;
      agg.set(key, x);
    }
    const rows = Array.from(agg.entries())
      .map(([name, v]) => ({ name, count: v.t, pct: Math.round((v.c / v.t) * 1000) / 10 }))
      .sort((a, b) => b.pct - a.pct);
    return { rows };
  });

export const getStudyPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ qbankId: qb() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { attempts, questions, subjectName, tests } = await loadAttemptContext(supabase, userId, data.qbankId);

    const qSub = new Map<number, number | null>(questions.map((q: any) => [q.id, q.subject_id]));
    const latest = latestByQuestion(attempts);
    const answered = latest.filter((a) => a.selected_answer != null);

    // Find weakest subjects (same rule as overview)
    const subjAgg = new Map<number, { c: number; t: number }>();
    for (const a of answered) {
      const sid = qSub.get(a.question_id) ?? null;
      if (sid == null) continue;
      const x = subjAgg.get(sid) ?? { c: 0, t: 0 };
      x.t++; if (a.is_correct) x.c++;
      subjAgg.set(sid, x);
    }
    const subjRanked = Array.from(subjAgg.entries())
      .filter(([, v]) => v.t >= 3)
      .map(([id, v]) => ({ id, pct: v.c / v.t }))
      .sort((a, b) => a.pct - b.pct);
    const weakSubjectIds = new Set(subjRanked.slice(0, 6).map((s) => s.id));

    // Wrong-answered questions in weak subjects (deterministic order by q id)
    const wrongIds = Array.from(new Set(
      answered
        .filter((a) => !a.is_correct)
        .map((a) => a.question_id)
        .filter((qid) => {
          const sid = qSub.get(qid) ?? null;
          return sid != null && weakSubjectIds.has(sid);
        })
    )).sort((a, b) => a - b);

    // Chunk into up to 5 quizzes of 40
    const CHUNK = 40, MAX = 5;
    const quizzes: {
      index: number;
      questionIds: number[];
      subjects: string[];
      unlocked: boolean;
      completedTestId: number | null;
      score: number | null;
    }[] = [];

    const completedByIndex = new Map<number, any>();
    for (const t of tests as any[]) {
      if (t.study_plan_index && t.done) completedByIndex.set(t.study_plan_index, t);
    }

    for (let i = 0; i < MAX; i++) {
      const slice = wrongIds.slice(i * CHUNK, (i + 1) * CHUNK);
      if (!slice.length) break;
      const subjNames = new Set<string>();
      for (const qid of slice) {
        const sid = qSub.get(qid);
        if (sid != null) subjNames.add(subjectName.get(sid) ?? `Subject ${sid}`);
      }
      const prevDone = i === 0 || completedByIndex.has(i);
      const completed = completedByIndex.get(i + 1);
      quizzes.push({
        index: i + 1,
        questionIds: slice,
        subjects: Array.from(subjNames),
        unlocked: prevDone,
        completedTestId: completed ? Number(completed.id) : null,
        score: completed ? Math.round(((completed.right_count ?? 0) / (slice.length || 1)) * 100) : null,
      });
    }

    const totalQuestions = quizzes.reduce((a, q) => a + q.questionIds.length, 0);
    return { quizzes, totalQuestions };
  });

export const generatePerformancePrediction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    qbankId: qb(),
    overallPct: z.number(),
    studyPlanTotal: z.number(),
  }).parse(d))
  .handler(async ({ data }) => {
    // Deterministic fallback: current + (70 - current) * (planTotal weight)
    const deterministic = () => {
      const target = 70;
      const gap = Math.max(0, target - data.overallPct);
      // assume plan covers ~30% of what's needed to reach target
      const predicted = Math.min(95, Math.round(data.overallPct + gap * 0.5 + Math.min(15, data.studyPlanTotal / 20)));
      return `Your current overall score is **${data.overallPct}%**. Your study plan contains **${data.studyPlanTotal}** questions covering your weakest subjects. If you score at least **70%** on these quizzes, your overall score is predicted to reach **${predicted}%**.`;
    };

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { text: deterministic() };

    try {
      const prompt = `A USMLE student's current overall accuracy is ${data.overallPct}%. Their personalized study plan has ${data.studyPlanTotal} questions from their weakest subjects. Write ONE short paragraph (max 40 words) predicting their overall score if they answer 70% of the study-plan questions correctly. Use this exact structure, bolding key numbers with markdown: "Your current overall score is **${data.overallPct}%**. Your study plan contains **${data.studyPlanTotal}** questions covering your weakest subjects. If you score at least **70%** on these quizzes, your overall score is predicted to reach **X%**." Replace X with a realistic single integer prediction.`;
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
        body: JSON.stringify({
          model: "google/gemini-3.5-flash",
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!resp.ok) return { text: deterministic() };
      const json = await resp.json() as { choices?: { message?: { content?: string } }[] };
      const text = json.choices?.[0]?.message?.content?.trim();
      return { text: text || deterministic() };
    } catch {
      return { text: deterministic() };
    }
  });


// ============ Self-Assessment Report ============
export const getAssessmentReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ qbankId: qb(), sources: z.array(z.string()).min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Resolve questions for this assessment
    const { data: qs } = await supabase
      .from("questions")
      .select("id,subject_id,system_id")
      .eq("qbank_id", data.qbankId)
      .in("source", data.sources)
      .limit(50000);
    const qids = (qs ?? []).map((r: any) => r.id);
    const totalQuestions = qids.length;

    if (!totalQuestions) {
      return {
        totalQuestions: 0, totalCorrect: 0, totalIncorrect: 0, totalOmitted: 0,
        scorePct: 0, passingPct: 65,
        percentile: 0, peerCount: 0,
        chance: "borderline" as const,
        answerChanges: { correctToCorrect: 0, correctToIncorrect: 0, incorrectToCorrect: 0, incorrectToIncorrect: 0 },
        subjectBreakdown: [] as any[], systemBreakdown: [] as any[],
      };
    }

    // User's attempts on these questions (chronological)
    const { data: attempts } = await supabase
      .from("attempts")
      .select("question_id,is_correct,selected_answer,created_at")
      .eq("user_id", userId).eq("qbank_id", data.qbankId)
      .in("question_id", qids)
      .order("created_at", { ascending: true })
      .limit(100000);
    const rows = attempts ?? [];

    // Latest attempt per question -> correct/incorrect/omitted
    const latest = new Map<number, any>();
    for (const a of rows) latest.set(a.question_id, a);
    let correct = 0, incorrect = 0;
    for (const a of latest.values()) {
      if (a.selected_answer == null) continue;
      if (a.is_correct) correct++; else incorrect++;
    }
    const attemptedQuestionCount = Array.from(latest.values()).filter((a) => a.selected_answer != null).length;
    const omitted = totalQuestions - attemptedQuestionCount;
    const scorePct = totalQuestions ? Math.round((correct / totalQuestions) * 100) : 0;

    // Answer changes across chronological attempts per question
    const byQ = new Map<number, any[]>();
    for (const a of rows) {
      if (!byQ.has(a.question_id)) byQ.set(a.question_id, []);
      byQ.get(a.question_id)!.push(a);
    }
    let cc = 0, ci = 0, ic = 0, ii = 0;
    for (const arr of byQ.values()) {
      const answered = arr.filter((x) => x.selected_answer != null);
      for (let i = 1; i < answered.length; i++) {
        const prev = answered[i - 1], cur = answered[i];
        if (prev.is_correct && cur.is_correct) cc++;
        else if (prev.is_correct && !cur.is_correct) ci++;
        else if (!prev.is_correct && cur.is_correct) ic++;
        else ii++;
      }
    }

    // Peer scores on same source (all users)
    const { data: peerAtt } = await supabase
      .from("attempts")
      .select("user_id,question_id,is_correct,selected_answer,created_at")
      .eq("qbank_id", data.qbankId)
      .in("question_id", qids)
      .order("created_at", { ascending: true })
      .limit(500000);
    const perUserLatest = new Map<string, Map<number, any>>();
    for (const a of (peerAtt ?? []) as any[]) {
      let m = perUserLatest.get(a.user_id);
      if (!m) { m = new Map(); perUserLatest.set(a.user_id, m); }
      m.set(a.question_id, a);
    }
    const peerScores: number[] = [];
    for (const m of perUserLatest.values()) {
      let c = 0;
      for (const a of m.values()) if (a.selected_answer != null && a.is_correct) c++;
      peerScores.push(c / totalQuestions);
    }
    const myScore = correct / totalQuestions;
    const below = peerScores.filter((s) => s < myScore).length;
    const percentile = peerScores.length ? Math.round((below / peerScores.length) * 10000) / 100 : 0;

    // Chance of passing
    let chance: "low" | "borderline" | "high" | "very-high" = "borderline";
    if (scorePct >= 85) chance = "very-high";
    else if (scorePct >= 65) chance = "high";
    else if (scorePct >= 50) chance = "borderline";
    else chance = "low";

    // Breakdowns
    const [{ data: subs }, { data: sysm }] = await Promise.all([
      supabase.from("subjects").select("id,name").eq("qbank_id", data.qbankId),
      supabase.from("systems").select("id,name").eq("qbank_id", data.qbankId),
    ]);
    const subjName = new Map<number, string>((subs ?? []).map((s: any) => [s.id, s.name]));
    const sysName = new Map<number, string>((sysm ?? []).map((s: any) => [s.id, s.name]));
    const qMeta = new Map<number, any>((qs ?? []).map((q: any) => [q.id, q]));
    const subjAgg = new Map<number, { c: number; t: number }>();
    const sysAgg = new Map<number, { c: number; t: number }>();
    for (const a of latest.values()) {
      if (a.selected_answer == null) continue;
      const q = qMeta.get(a.question_id); if (!q) continue;
      if (q.subject_id != null) {
        const x = subjAgg.get(q.subject_id) ?? { c: 0, t: 0 };
        x.t++; if (a.is_correct) x.c++;
        subjAgg.set(q.subject_id, x);
      }
      if (q.system_id != null) {
        const x = sysAgg.get(q.system_id) ?? { c: 0, t: 0 };
        x.t++; if (a.is_correct) x.c++;
        sysAgg.set(q.system_id, x);
      }
    }
    const subjectBreakdown = Array.from(subjAgg.entries()).map(([id, v]) => ({
      name: subjName.get(id) ?? `Subject ${id}`, correct: v.c, total: v.t, pct: Math.round((v.c / v.t) * 100),
    })).sort((a, b) => a.pct - b.pct);
    const systemBreakdown = Array.from(sysAgg.entries()).map(([id, v]) => ({
      name: sysName.get(id) ?? `System ${id}`, correct: v.c, total: v.t, pct: Math.round((v.c / v.t) * 100),
    })).sort((a, b) => a.pct - b.pct);

    return {
      totalQuestions, totalCorrect: correct, totalIncorrect: incorrect, totalOmitted: omitted,
      scorePct, passingPct: 65,
      percentile, peerCount: peerScores.length,
      chance,
      answerChanges: { correctToCorrect: cc, correctToIncorrect: ci, incorrectToCorrect: ic, incorrectToIncorrect: ii },
      subjectBreakdown, systemBreakdown,
    };
  });
