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
