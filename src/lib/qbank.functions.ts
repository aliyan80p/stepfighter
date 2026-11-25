import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertQbankAccess } from "@/lib/entitlements.functions";
import { z } from "zod";


const qb = () => z.number().int().positive().default(1);

export const listQbanks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("qbanks").select("id,slug,name").order("id");
    return data ?? [];
  });

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ qbankId: qb(), sources: z.array(z.string()).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const qbankId = data.qbankId;
    const sources = data.sources && data.sources.length ? data.sources : undefined;

    // If sources filter is active, resolve the question id set for those sources within this qbank.
    let sourceQIdSet: Set<number> | null = null;
    if (sources) {
      const qrows = await fetchAllQuestionRows(supabase, "id", { qbankId, sources });
      sourceQIdSet = new Set(qrows.map((r: any) => r.id as number));
    }

    const questionsCountQ = sources
      ? supabase.from("questions").select("id", { count: "exact", head: true }).eq("qbank_id", qbankId).in("source", sources)
      : supabase.from("questions").select("id", { count: "exact", head: true }).eq("qbank_id", qbankId);

    // Paginate user attempts in 1,000-row chunks to avoid PostgREST's 1,000-row cap
    // and avoid passing thousands of sourceQIds into an `.in()` URL query string.
    const fetchAllUserAttempts = async () => {
      const out: any[] = [];
      const PAGE = 1000;
      for (let from = 0; ; from += PAGE) {
        const { data: batch, error } = await supabase
          .from("attempts")
          .select("is_correct,question_id,selected_answer,created_at")
          .eq("user_id", userId)
          .eq("qbank_id", qbankId)
          .order("created_at", { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const rows = batch ?? [];
        out.push(...rows);
        if (rows.length < PAGE) break;
      }
      return out;
    };

    const fetchBookmarksCount = async () => {
      if (!sourceQIdSet) {
        const { count } = await supabase
          .from("bookmarks")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("qbank_id", qbankId);
        return count ?? 0;
      }
      if (sourceQIdSet.size === 0) return 0;
      const { data: bms } = await supabase
        .from("bookmarks")
        .select("question_id")
        .eq("user_id", userId)
        .eq("qbank_id", qbankId);
      return (bms ?? []).filter((b: any) => sourceQIdSet!.has(b.question_id)).length;
    };

    const testsQ = supabase.from("tests").select("id,done,name,question_ids").eq("user_id", userId).eq("qbank_id", qbankId);

    const [countRes, { data: subjectsRaw }, questionMeta, allAttempts, bookmarks, { data: testsRaw }] = await Promise.all([
      questionsCountQ,
      supabase.from("subjects").select("id,name,count").eq("qbank_id", qbankId).order("id"),
      // Only fetch per-question subject mapping when a source filter is active.
      // Otherwise the pre-computed `subjects.count` column is accurate and avoids
      // scanning every row in the qbank on each dashboard load.
      sources
        ? fetchAllQuestionRows(supabase, "id,subject_id", { qbankId, sources })
        : Promise.resolve(null as any),
      fetchAllUserAttempts(),
      fetchBookmarksCount(),
      testsQ,
    ]);
    const attempts = sourceQIdSet
      ? allAttempts.filter((a: any) => sourceQIdSet!.has(a.question_id))
      : allAttempts;
    let subjects: { id: number; name: string; count: number }[];
    if (questionMeta) {
      const subjectCounts = new Map<number, number>();
      for (const q of questionMeta) {
        if (q.subject_id != null) subjectCounts.set(q.subject_id, (subjectCounts.get(q.subject_id) ?? 0) + 1);
      }
      subjects = (subjectsRaw ?? []).map((s) => ({ ...s, count: subjectCounts.get(s.id) ?? 0 }));
    } else {
      subjects = (subjectsRaw ?? []).map((s) => ({ ...s, count: s.count ?? 0 }));
    }
    const totalQ = countRes?.count ?? subjects.reduce((sum, s) => sum + (s.count ?? 0), 0);


    const uniqueDone = new Set((attempts ?? []).map((a) => a.question_id)).size;
    const correct = (attempts ?? []).filter((a) => a.is_correct).length;
    const incorrect = (attempts ?? []).filter((a) => a.is_correct === false && a.selected_answer != null).length;
    const omitted = (attempts ?? []).filter((a) => a.selected_answer == null).length;
    const total = (attempts ?? []).length;

    // Answer changes: for questions attempted more than once, compare each attempt to the previous one
    const perQ = new Map<number, { correct: boolean; answered: boolean }[]>();
    for (const a of attempts ?? []) {
      const arr = perQ.get(a.question_id) ?? [];
      arr.push({ correct: !!a.is_correct, answered: a.selected_answer != null });
      perQ.set(a.question_id, arr);
    }
    let c2c = 0, c2i = 0, i2c = 0, i2i = 0;
    for (const arr of perQ.values()) {
      for (let i = 1; i < arr.length; i++) {
        const prev = arr[i - 1], cur = arr[i];
        if (!prev.answered || !cur.answered) continue;
        if (prev.correct && cur.correct) c2c++;
        else if (prev.correct && !cur.correct) c2i++;
        else if (!prev.correct && cur.correct) i2c++;
        else if (!prev.correct && !cur.correct) i2i++;
      }
    }

    // Filter tests by source using actual question_ids intersection (works for "main" UWorld tests too)
    let testsFiltered = testsRaw ?? [];
    if (sources && sourceQIdSet) {
      testsFiltered = testsFiltered.filter((t: any) => {
        const qids: number[] = Array.isArray(t.question_ids) ? t.question_ids : [];
        if (qids.length > 0) {
          return qids.some((id) => sourceQIdSet!.has(id));
        }
        const nm: string = t.name ?? "";
        return sources.some((s) => nm.startsWith(`${s} Block #`) || nm.startsWith(`${s} `));
      });
    }
    const testsCreated = testsFiltered.length;
    const testsCompleted = testsFiltered.filter((t: any) => t.done).length;
    const testsSuspended = testsCreated - testsCompleted;

    return {
      totalQuestions: totalQ ?? 0,
      subjects: subjects ?? [],
      answered: uniqueDone,
      unused: Math.max(0, (totalQ ?? 0) - uniqueDone),
      totalAttempts: total,
      correctAttempts: correct,
      incorrectAttempts: incorrect,
      omittedAttempts: omitted,
      accuracy: total ? Math.round((correct / total) * 100) : 0,
      usedPct: totalQ ? Math.round((uniqueDone / totalQ) * 1000) / 10 : 0,
      correctPct: total ? Math.round((correct / total) * 1000) / 10 : 0,
      bookmarks: bookmarks ?? 0,
      answerChanges: { correctToCorrect: c2c, correctToIncorrect: c2i, incorrectToCorrect: i2c, incorrectToIncorrect: i2i },
      testCount: { created: testsCreated, completed: testsCompleted, suspended: testsSuspended },
    };
  });


export const getFilters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ qbankId: qb(), sources: z.array(z.string()).default([]) }).parse(d))
  .handler(async ({ data, context }) => {
    const qbankId = data.qbankId;
    const [{ data: subjectsRaw }, { data: systemsRaw }, qs] = await Promise.all([
      context.supabase.from("subjects").select("id,name").eq("qbank_id", qbankId).order("name"),
      context.supabase.from("systems").select("id,name").eq("qbank_id", qbankId).order("name"),
      fetchAllQuestionRows(context.supabase, "id,title,subject_id,system_id", { qbankId, sources: data.sources }),
    ]);

    const subjectCounts = new Map<number, number>();
    const systemCounts = new Map<number, number>();
    const topicMap = new Map<string, { name: string; count: number; subjectIds: Set<number>; systemIds: Set<number> }>();
    for (const q of qs) {
      if (q.subject_id != null) subjectCounts.set(q.subject_id, (subjectCounts.get(q.subject_id) ?? 0) + 1);
      if (q.system_id != null) systemCounts.set(q.system_id, (systemCounts.get(q.system_id) ?? 0) + 1);
      const name = (q.title ?? "").trim();
      if (!name) continue;
      const t = topicMap.get(name) ?? { name, count: 0, subjectIds: new Set<number>(), systemIds: new Set<number>() };
      t.count++;
      if (q.subject_id != null) t.subjectIds.add(q.subject_id);
      if (q.system_id != null) t.systemIds.add(q.system_id);
      topicMap.set(name, t);
    }
    const subjects = (subjectsRaw ?? []).map((s) => ({ ...s, count: subjectCounts.get(s.id) ?? 0 }));
    const systems = (systemsRaw ?? []).map((s) => ({ ...s, count: systemCounts.get(s.id) ?? 0 }));
    const topics = Array.from(topicMap.values())
      .map((t) => ({ name: t.name, count: t.count, subjectIds: Array.from(t.subjectIds), systemIds: Array.from(t.systemIds) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const questionMeta = qs.map((q) => ({
      id: q.id as number,
      title: (q.title ?? "").trim(),
      subjectId: q.subject_id as number | null,
      systemId: q.system_id as number | null,
    }));
    return { subjects, systems, topics, questionMeta, totalQuestions: questionMeta.length };
  });

const DifficultySchema = z.enum(["all", "easy", "medium", "hard"]).default("all");

const CreateTestInput = z.object({
  qbankId: qb(),
  subjectIds: z.array(z.number()).default([]),
  systemIds: z.array(z.number()).default([]),
  topicNames: z.array(z.string()).default([]),
  sources: z.array(z.string()).default([]),
  count: z.number().min(1).max(50).default(20),
  mode: z.enum(["practice", "test"]).default("practice"),
  timed: z.boolean().default(false),
  scope: z.enum(["all", "unused", "incorrect", "correct", "omitted", "marked"]).default("all"),
  difficulty: DifficultySchema,
  name: z.string().trim().max(120).optional(),
});

async function filterIdsByDifficulty(
  supabase: any,
  qbankId: number,
  ids: number[],
  difficulty: "all" | "easy" | "medium" | "hard",
): Promise<number[]> {
  if (difficulty === "all" || !ids.length) return ids;
  const matched: number[] = [];
  for (let i = 0; i < ids.length; i += 1000) {
    const chunk = ids.slice(i, i + 1000);
    const { data: rows, error } = await supabase
      .from("questions")
      .select("id,ppl_taken,corr_taken")
      .eq("qbank_id", qbankId)
      .in("id", chunk);
    if (error) throw error;
    for (const r of rows ?? []) {
      const ppl = Number(r.ppl_taken ?? 0);
      const corr = Number(r.corr_taken ?? 0);
      if (ppl <= 0 || (ppl === 100 && corr <= 1)) continue;
      const pct = (corr / ppl) * 100;
      if (difficulty === "easy" && pct >= 70) matched.push(r.id);
      else if (difficulty === "medium" && pct >= 45 && pct < 70) matched.push(r.id);
      else if (difficulty === "hard" && pct < 45) matched.push(r.id);
    }
  }
  return matched;
}

export const createTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateTestInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertQbankAccess(supabase, userId, data.qbankId);
    const { data: picked, error: pickErr } = await supabase.rpc("pick_question_ids", {
      p_qbank_id: data.qbankId,
      p_sources: data.sources.length ? data.sources : undefined,
      p_subject_ids: data.subjectIds.length ? data.subjectIds : undefined,
      p_system_ids: data.systemIds.length ? data.systemIds : undefined,
      p_topic_names: data.topicNames.length ? data.topicNames : undefined,
      p_scope: data.scope,
      p_count: data.difficulty === "all" ? data.count : 10000,
    });
    if (pickErr) throw pickErr;
    let ids = (picked as number[] | null) ?? [];
    if (data.difficulty !== "all") {
      ids = shuffle(await filterIdsByDifficulty(supabase, data.qbankId, ids, data.difficulty)).slice(0, data.count);
    }
    if (!ids.length) throw new Error("No questions match those filters.");
    return await insertTest(supabase, userId, ids, data);
  });

export const createCustomTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    qbankId: qb(),
    questionIds: z.array(z.number().int().positive()).min(1).max(500),
    mode: z.enum(["practice", "test"]).default("practice"),
    timed: z.boolean().default(false),
    name: z.string().optional(),
    studyPlanIndex: z.number().int().min(1).max(50).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertQbankAccess(supabase, userId, data.qbankId);
    const uniq = Array.from(new Set(data.questionIds));
    const { data: found, error } = await supabase.from("questions").select("id").eq("qbank_id", data.qbankId).in("id", uniq);
    if (error) throw error;
    const validIds = (found ?? []).map((r: any) => r.id as number);
    if (!validIds.length) throw new Error("None of the provided question IDs were found.");
    const ordered = uniq.filter((id) => validIds.includes(id));
    const insertRow: any = { user_id: userId, question_ids: ordered, mode: data.mode, qbank_id: data.qbankId, timed: !!data.timed };
    if (data.name) insertRow.name = data.name;
    if (data.studyPlanIndex) insertRow.study_plan_index = data.studyPlanIndex;
    const { data: inserted, error: e2 } = await supabase
      .from("tests")
      .insert(insertRow)
      .select("id")
      .single();
    if (e2) throw e2;
    return { id: inserted.id as number, count: ordered.length, skipped: uniq.length - ordered.length };
  });


export const getTestQuestionIds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ testId: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: t, error } = await supabase
      .from("tests").select("question_ids,user_id,qbank_id").eq("id", data.testId).maybeSingle();
    if (error) throw error;
    if (!t) throw new Error("Test not found");
    if (t.user_id !== userId) throw new Error("You don't have access to this test.");
    return { ids: (t.question_ids as number[]) ?? [], qbankId: (t.qbank_id ?? 1) as number };
  });

export const getPoolCount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    qbankId: qb(),
    subjectIds: z.array(z.number()).default([]),
    systemIds: z.array(z.number()).default([]),
    topicNames: z.array(z.string()).default([]),
    sources: z.array(z.string()).default([]),
    scope: z.enum(["all", "unused", "incorrect", "correct", "omitted", "marked"]).default("all"),
    difficulty: DifficultySchema,
  }).parse(d))

  .handler(async ({ data, context }) => {
    const { supabase } = context;
    if (data.difficulty === "all") {
      const { data: count, error } = await supabase.rpc("pool_count", {
        p_qbank_id: data.qbankId,
        p_sources: data.sources.length ? data.sources : undefined,
        p_subject_ids: data.subjectIds.length ? data.subjectIds : undefined,
        p_system_ids: data.systemIds.length ? data.systemIds : undefined,
        p_topic_names: data.topicNames.length ? data.topicNames : undefined,
        p_scope: data.scope,
      });
      if (error) throw error;
      return { count: (count as number | null) ?? 0 };
    }
    const { data: picked, error } = await supabase.rpc("pick_question_ids", {
      p_qbank_id: data.qbankId,
      p_sources: data.sources.length ? data.sources : undefined,
      p_subject_ids: data.subjectIds.length ? data.subjectIds : undefined,
      p_system_ids: data.systemIds.length ? data.systemIds : undefined,
      p_topic_names: data.topicNames.length ? data.topicNames : undefined,
      p_scope: data.scope,
      p_count: 10000,
    });
    if (error) throw error;
    const filtered = await filterIdsByDifficulty(supabase, data.qbankId, (picked as number[] | null) ?? [], data.difficulty);
    return { count: filtered.length };
  });

async function insertTest(supabase: any, userId: string, ids: number[], data: z.infer<typeof CreateTestInput>) {
  await assertQbankAccess(supabase, userId, data.qbankId);
  const insertRow: any = { user_id: userId, question_ids: ids, mode: data.mode, qbank_id: data.qbankId, timed: !!data.timed };
  if (data.name) insertRow.name = data.name;
  const { data: inserted, error } = await supabase
    .from("tests")
    .insert(insertRow)
    .select("id")
    .single();
  if (error) throw error;
  return { id: inserted.id as number };
}


function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type QuestionFilters = {
  qbankId: number;
  subjectIds?: number[];
  systemIds?: number[];
  topicNames?: string[];
  sources?: string[];
};

async function fetchAllQuestionRows(supabase: any, columns: string, filters: QuestionFilters) {
  const pageSize = 1000;
  const rows: any[] = [];
  for (let from = 0; ; from += pageSize) {
    let query = supabase
      .from("questions")
      .select(columns)
      .eq("qbank_id", filters.qbankId)
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (filters.subjectIds?.length) query = query.in("subject_id", filters.subjectIds);
    if (filters.systemIds?.length) query = query.in("system_id", filters.systemIds);
    if (filters.topicNames?.length) query = query.in("title", filters.topicNames);
    if (filters.sources?.length) query = query.in("source", filters.sources);
    const { data, error } = await query;
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}


export const getTest = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.number() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: test, error } = await supabase.from("tests").select("*").eq("id", data.id).eq("user_id", userId).single();
    if (error || !test) throw new Error("Test not found");
    const qbankId = (test.qbank_id ?? 1) as number;
    await assertQbankAccess(supabase, userId, qbankId);
    const { data: questions } = await supabase
      .from("questions")
      .select("id,title,question,explanation,correct_answer,subject_id,system_id,media_name,other_medias,ppl_taken,corr_taken")
      .eq("qbank_id", qbankId)
      .in("id", test.question_ids);
    const { data: answers } = await supabase
      .from("answers")
      .select("id,question_id,answer_index,answer_text,correct_percentage")
      .eq("qbank_id", qbankId)
      .in("question_id", test.question_ids)
      .order("answer_index");
    const { data: attempts } = await supabase
      .from("attempts")
      .select("question_id,selected_answer,is_correct,time_seconds")
      .eq("user_id", userId)
      .eq("test_id", data.id);
    // Prior attempts on the same questions BEFORE this test was created — used for Answer Changes
    const { data: priorAttemptsRaw } = await supabase
      .from("attempts")
      .select("question_id,is_correct,selected_answer,created_at")
      .eq("user_id", userId)
      .eq("qbank_id", qbankId)
      .in("question_id", test.question_ids as number[])
      .lt("created_at", test.created_at)
      .order("created_at", { ascending: false });
    const priorByQ: Record<number, { is_correct: boolean; selected_answer: number | null }> = {};
    for (const p of priorAttemptsRaw ?? []) {
      if (priorByQ[p.question_id] === undefined) {
        priorByQ[p.question_id] = { is_correct: !!p.is_correct, selected_answer: p.selected_answer };
      }
    }
    let c2i = 0, i2c = 0, i2i = 0;
    for (const a of attempts ?? []) {
      const prior = priorByQ[a.question_id];
      if (!prior || prior.selected_answer == null || a.selected_answer == null) continue;
      if (prior.is_correct && !a.is_correct) c2i++;
      else if (!prior.is_correct && a.is_correct) i2c++;
      else if (!prior.is_correct && !a.is_correct) i2i++;
    }
    const { data: bookmarks } = await supabase.from("bookmarks").select("question_id").eq("user_id", userId).eq("qbank_id", qbankId).in("question_id", test.question_ids);
    const [{ data: subjects }, { data: systems }, { data: refsRaw }] = await Promise.all([
      supabase.from("subjects").select("id,name").eq("qbank_id", qbankId),
      supabase.from("systems").select("id,name").eq("qbank_id", qbankId),
      supabase
        .from("refs")
        .select("id,question_id,ref_title,ref_link,ref_type")
        .eq("qbank_id", qbankId)
        .in("question_id", test.question_ids as number[])
        .order("id"),
    ]);
    const libTitles = Array.from(
      new Set(
        (refsRaw ?? [])
          .filter((r) => r.ref_type === 18 && r.ref_title)
          .map((r) => r.ref_title!.trim()),
      ),
    );
    const libDocByTitle = new Map<string, number>();
    if (libTitles.length > 0) {
      const { data: libDocs } = await supabase
        .from("library_docs")
        .select("id,title")
        .eq("qbank_id", 2)
        .in("title", libTitles);
      for (const d of libDocs ?? []) {
        if (d.title) libDocByTitle.set(d.title.trim().toLowerCase(), d.id);
      }
    }
    const enrichedRefs = (refsRaw ?? []).map((r) => ({
      id: r.id,
      question_id: r.question_id,
      ref_title: r.ref_title,
      ref_link: r.ref_link,
      ref_type: r.ref_type,
      library_doc_id:
        r.ref_type === 18 && r.ref_title
          ? (libDocByTitle.get(r.ref_title.trim().toLowerCase()) ?? null)
          : null,
    }));
    const subjectMap: Record<number, string> = Object.fromEntries((subjects ?? []).map((s) => [s.id, s.name]));
    const systemMap: Record<number, string> = Object.fromEntries((systems ?? []).map((s) => [s.id, s.name]));
    return {
      test,
      qbankId,
      questions: (test.question_ids as number[]).map((id) => (questions ?? []).find((q) => q.id === id)!).filter(Boolean),
      answersByQ: groupBy(answers ?? [], (a) => a.question_id),
      attemptsByQ: Object.fromEntries((attempts ?? []).map((a) => [a.question_id, a])),
      refsByQ: groupBy(enrichedRefs, (r) => r.question_id),
      bookmarkedIds: new Set((bookmarks ?? []).map((b) => b.question_id)),
      subjectMap,
      systemMap,
      answerChanges: { correctToIncorrect: c2i, incorrectToCorrect: i2c, incorrectToIncorrect: i2i },
    };
  });


function groupBy<T, K extends string | number>(arr: T[], fn: (x: T) => K): Record<K, T[]> {
  const out: Record<string, T[]> = {};
  for (const x of arr) {
    const k = String(fn(x));
    (out[k] ??= []).push(x);
  }
  return out as Record<K, T[]>;
}

export const submitAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    testId: z.number(),
    questionId: z.number(),
    selectedIndex: z.number(),
    timeSeconds: z.number().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: t } = await supabase.from("tests").select("qbank_id").eq("id", data.testId).eq("user_id", userId).single();
    const qbankId = ((t?.qbank_id ?? 1) as number);
    const { data: q } = await supabase.from("questions").select("correct_answer").eq("qbank_id", qbankId).eq("id", data.questionId).single();
    if (!q) throw new Error("Question not found");
    const isCorrect = q.correct_answer === data.selectedIndex;
    await supabase.from("attempts").delete().eq("user_id", userId).eq("test_id", data.testId).eq("question_id", data.questionId);
    await supabase.from("attempts").insert({
      user_id: userId, test_id: data.testId, question_id: data.questionId, qbank_id: qbankId,
      selected_answer: data.selectedIndex, is_correct: isCorrect, time_seconds: data.timeSeconds,
    });
    const { data: attempts } = await supabase.from("attempts").select("is_correct").eq("test_id", data.testId).eq("user_id", userId);
    const right = (attempts ?? []).filter((a) => a.is_correct).length;
    const wrong = (attempts ?? []).filter((a) => a.is_correct === false).length;
    await supabase.from("tests").update({ right_count: right, wrong_count: wrong }).eq("id", data.testId).eq("user_id", userId);
    return { isCorrect, correctAnswer: q.correct_answer };
  });

export const toggleBookmark = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ questionId: z.number(), qbankId: qb() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase.from("bookmarks").select("question_id").eq("user_id", userId).eq("qbank_id", data.qbankId).eq("question_id", data.questionId).maybeSingle();
    if (existing) {
      await supabase.from("bookmarks").delete().eq("user_id", userId).eq("qbank_id", data.qbankId).eq("question_id", data.questionId);
      return { bookmarked: false };
    }
    await supabase.from("bookmarks").insert({ user_id: userId, question_id: data.questionId, qbank_id: data.qbankId });
    return { bookmarked: true };
  });

export const finishTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ testId: z.number() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase.from("tests").update({ done: true }).eq("id", data.testId).eq("user_id", userId);
    return { ok: true };
  });

export const listTests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ qbankId: qb() }).parse(d))
  .handler(async ({ data, context }) => {
    const qbankId = data.qbankId;
    const { data: tests } = await context.supabase
      .from("tests")
      .select("id,mode,question_ids,right_count,wrong_count,done,created_at,name,qbank_id")
      .eq("user_id", context.userId)
      .eq("qbank_id", qbankId)
      .order("created_at", { ascending: false })
      .limit(500);
    const allQIds = Array.from(new Set((tests ?? []).flatMap((t) => t.question_ids as number[])));
    const [qsRes, subjRes] = await Promise.all([
      allQIds.length
        ? context.supabase.from("questions").select("id,subject_id").eq("qbank_id", qbankId).in("id", allQIds)
        : Promise.resolve({ data: [] as { id: number; subject_id: number | null }[] }),
      context.supabase.from("subjects").select("id,name").eq("qbank_id", qbankId),
    ]);
    const subjMap = new Map<number, string>(((subjRes.data ?? []) as { id: number; name: string }[]).map((s) => [s.id, s.name]));
    const qSubj = new Map<number, number | null>(((qsRes.data ?? []) as { id: number; subject_id: number | null }[]).map((q) => [q.id, q.subject_id]));
    return (tests ?? []).map((t) => {
      const ids = t.question_ids as number[];
      const subjIds = new Set<number>();
      for (const id of ids) {
        const s = qSubj.get(id);
        if (s != null) subjIds.add(s);
      }
      const subjectNames = Array.from(subjIds).map((id) => subjMap.get(id) ?? "").filter(Boolean);
      return { ...t, total: ids.length, subjectNames };
    });
  });

export const deleteTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ testId: z.number() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase.from("attempts").delete().eq("user_id", userId).eq("test_id", data.testId);
    await supabase.from("tests").delete().eq("user_id", userId).eq("id", data.testId);
    return { ok: true };
  });

export const suspendTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ testId: z.number() }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("tests").update({ done: false }).eq("id", data.testId).eq("user_id", context.userId);
    return { ok: true };
  });

export const renameTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ testId: z.number(), name: z.string().trim().min(1).max(120) }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("tests").update({ name: data.name }).eq("id", data.testId).eq("user_id", context.userId);
    return { ok: true };
  });

export const listBookmarks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ qbankId: qb() }).parse(d))
  .handler(async ({ data, context }) => {
    const qbankId = data.qbankId;
    const { data: bm } = await context.supabase.from("bookmarks").select("question_id,created_at").eq("user_id", context.userId).eq("qbank_id", qbankId).order("created_at", { ascending: false });
    const ids = (bm ?? []).map((b) => b.question_id);
    if (!ids.length) return [];
    const { data: qs } = await context.supabase.from("questions").select("id,title,subject_id,system_id").eq("qbank_id", qbankId).in("id", ids);
    return (bm ?? []).map((b) => ({ ...b, question: (qs ?? []).find((q) => q.id === b.question_id) }));
  });

export const searchQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ query: z.string().default(""), qbankId: qb() }).parse(d))
  .handler(async ({ data, context }) => {
    const q = data.query.trim();
    if (!q) return { results: [], total: 0, truncated: false };
    const { supabase } = context;
    const qbankId = data.qbankId;
    const LIMIT = 200;

    const idTokens = q.split(/[\s,]+/).map((s) => Number(s)).filter((n) => Number.isFinite(n) && n > 0);
    const isPureIds = idTokens.length > 0 && q.split(/[\s,]+/).every((s) => /^\d+$/.test(s.trim()) || s.trim() === "");

    let rows: any[] = [];
    if (isPureIds) {
      // ID lookups first try the active qbank; if nothing matches, fall back
      // across any qbank the user can read via RLS so IDs from sibling banks
      // still resolve.
      const { data: r } = await supabase
        .from("questions")
        .select("id,title,question,explanation,correct_answer,subject_id,system_id,qbank_id,ppl_taken,corr_taken")
        .eq("qbank_id", qbankId)
        .in("id", idTokens.slice(0, LIMIT));
      rows = r ?? [];
      if (rows.length === 0) {
        const { data: r2 } = await supabase
          .from("questions")
          .select("id,title,question,explanation,correct_answer,subject_id,system_id,qbank_id,ppl_taken,corr_taken")
          .in("id", idTokens.slice(0, LIMIT));
        rows = r2 ?? [];
      }
    } else {
      const like = `%${q.replace(/[%_]/g, (m) => "\\" + m)}%`;
      // Quote the pattern so commas/parens in the query cannot break out of
      // the PostgREST `or=` filter expression and inject extra conditions.
      const quoted = `"${like.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
      const { data: r } = await supabase
        .from("questions")
        .select("id,title,question,explanation,correct_answer,subject_id,system_id,qbank_id,ppl_taken,corr_taken")
        .eq("qbank_id", qbankId)
        .or(`title.ilike.${quoted},question.ilike.${quoted}`)
        .limit(LIMIT + 1);
      rows = r ?? [];
    }
    const truncated = rows.length > LIMIT;
    rows = rows.slice(0, LIMIT);
    const ids = rows.map((r) => r.id);
    const qbankIds = Array.from(new Set(rows.map((r) => r.qbank_id as number))).filter((n) => n != null);
    const bankIdsForLookups = qbankIds.length ? qbankIds : [qbankId];
    const [{ data: answers }, { data: subjects }, { data: systems }, { data: bookmarks }] = await Promise.all([
      ids.length
        ? supabase.from("answers").select("qbank_id,question_id,answer_index,answer_text,correct_percentage").in("qbank_id", bankIdsForLookups).in("question_id", ids).order("answer_index")
        : Promise.resolve({ data: [] as any[] }),
      supabase.from("subjects").select("id,name").in("qbank_id", bankIdsForLookups),
      supabase.from("systems").select("id,name").in("qbank_id", bankIdsForLookups),
      ids.length
        ? supabase.from("bookmarks").select("qbank_id,question_id").eq("user_id", context.userId).in("qbank_id", bankIdsForLookups).in("question_id", ids)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const subjMap: Record<number, string> = Object.fromEntries((subjects ?? []).map((s: any) => [s.id, s.name]));
    const sysMap: Record<number, string> = Object.fromEntries((systems ?? []).map((s: any) => [s.id, s.name]));
    const bmSet = new Set((bookmarks ?? []).map((b: any) => `${b.qbank_id}:${b.question_id}`));
    const ansByQ: Record<string, { answer_index: number; answer_text: string; correct_percentage: number | null }[]> = {};
    for (const a of answers ?? []) {
      const key = `${a.qbank_id}:${a.question_id}`;
      (ansByQ[key] ??= []).push({
        answer_index: a.answer_index,
        answer_text: a.answer_text,
        correct_percentage: a.correct_percentage ?? null,
      });
    }
    const results = rows.map((r) => ({
      id: r.id as number,
      qbankId: (r.qbank_id ?? qbankId) as number,
      title: r.title as string,
      question: r.question as string,
      explanation: (r.explanation ?? "") as string,
      correctAnswer: r.correct_answer as number,
      pplTaken: (r.ppl_taken ?? null) as number | null,
      corrTaken: (r.corr_taken ?? null) as number | null,
      isBookmarked: bmSet.has(`${r.qbank_id ?? qbankId}:${r.id}`),
      subject: r.subject_id != null ? subjMap[r.subject_id] ?? "" : "",
      system: r.system_id != null ? sysMap[r.system_id] ?? "" : "",
      answers: ansByQ[`${r.qbank_id ?? qbankId}:${r.id}`] ?? [],
    }));
    return { results, total: results.length, truncated };
  });

// ==================== Self Assessments ====================
const BLOCK_SIZE = 20;

export const listAssessmentBlocks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ qbankId: qb(), source: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const rows = await fetchAllQuestionRows(supabase, "id", { qbankId: data.qbankId, sources: [data.source] });
    const ids = rows.map((r) => r.id as number).sort((a, b) => a - b);
    const blocks: { blockIndex: number; questionIds: number[] }[] = [];
    for (let i = 0; i < ids.length; i += BLOCK_SIZE) {
      blocks.push({ blockIndex: blocks.length + 1, questionIds: ids.slice(i, i + BLOCK_SIZE) });
    }
    const namePrefix = `${data.source} Block #`;
    const { data: tests } = await supabase
      .from("tests")
      .select("id,name,done,right_count,wrong_count,current_index,created_at,question_ids")
      .eq("user_id", userId)
      .eq("qbank_id", data.qbankId)
      .like("name", `${namePrefix}%`)
      .order("created_at", { ascending: false });
    const byBlock = new Map<number, any>();
    for (const t of tests ?? []) {
      const m = (t.name ?? "").match(/#(\d+)$/);
      if (!m) continue;
      const b = parseInt(m[1], 10);
      if (!byBlock.has(b)) byBlock.set(b, t);
    }
    return blocks.map((b) => ({
      ...b,
      test: byBlock.get(b.blockIndex)
        ? {
            id: byBlock.get(b.blockIndex).id as number,
            done: !!byBlock.get(b.blockIndex).done,
            right: byBlock.get(b.blockIndex).right_count as number,
            wrong: byBlock.get(b.blockIndex).wrong_count as number,
            createdAt: byBlock.get(b.blockIndex).created_at as string,
          }
        : null,
    }));
  });

export const startAssessmentBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ qbankId: qb(), source: z.string().min(1), blockIndex: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertQbankAccess(supabase, userId, data.qbankId);
    const name = `${data.source} Block #${data.blockIndex}`;
    const { data: existing } = await supabase
      .from("tests")
      .select("id,done")
      .eq("user_id", userId)
      .eq("qbank_id", data.qbankId)
      .eq("name", name)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing && !existing.done) return { id: existing.id as number };
    if (existing && existing.done) return { id: existing.id as number, review: true };

    const rows = await fetchAllQuestionRows(supabase, "id", { qbankId: data.qbankId, sources: [data.source] });
    const ids = rows.map((r) => r.id as number).sort((a, b) => a - b);
    const start = (data.blockIndex - 1) * BLOCK_SIZE;
    const slice = ids.slice(start, start + BLOCK_SIZE);
    if (!slice.length) throw new Error("Block is empty");
    const { data: inserted, error } = await supabase
      .from("tests")
      .insert({ user_id: userId, qbank_id: data.qbankId, question_ids: slice, mode: "test", timed: true, name })
      .select("id")
      .single();
    if (error) throw error;
    return { id: inserted.id as number };
  });

export const resetAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ qbankId: qb(), source: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const namePrefix = `${data.source} Block #`;
    const { data: tests } = await supabase
      .from("tests").select("id,question_ids")
      .eq("user_id", userId).eq("qbank_id", data.qbankId).like("name", `${namePrefix}%`);
    const testIds = (tests ?? []).map((t: any) => t.id);
    const qIds = Array.from(new Set((tests ?? []).flatMap((t: any) => t.question_ids ?? []))) as number[];
    if (qIds.length) {
      await supabase.from("attempts").delete().eq("user_id", userId).eq("qbank_id", data.qbankId).in("question_id", qIds);
    }
    if (testIds.length) {
      await supabase.from("tests").delete().in("id", testIds);
    }
    return { ok: true, deleted: testIds.length };
  });

export const RESET_LIMIT_PER_QBANK = 5;

export const getResetInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ qbankId: qb() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { count } = await supabase
      .from("qbank_resets")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("qbank_id", data.qbankId);
    const used = count ?? 0;
    return { used, limit: RESET_LIMIT_PER_QBANK, remaining: Math.max(0, RESET_LIMIT_PER_QBANK - used) };
  });

export const resetQbank = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ qbankId: qb() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { qbankId } = data;
    const { count } = await supabase
      .from("qbank_resets")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("qbank_id", qbankId);
    const used = count ?? 0;
    if (used >= RESET_LIMIT_PER_QBANK) {
      throw new Error(`Reset limit reached. You have used all ${RESET_LIMIT_PER_QBANK} resets for this course.`);
    }
    const [attempts, tests, bookmarks] = await Promise.all([
      supabase.from("attempts").delete().eq("user_id", userId).eq("qbank_id", qbankId),
      supabase.from("tests").delete().eq("user_id", userId).eq("qbank_id", qbankId),
      supabase.from("bookmarks").delete().eq("user_id", userId).eq("qbank_id", qbankId),
    ]);
    const err = attempts.error || tests.error || bookmarks.error;
    if (err) throw err;
    const { error: logErr } = await supabase.from("qbank_resets").insert({ user_id: userId, qbank_id: qbankId });
    if (logErr) throw logErr;
    const remaining = Math.max(0, RESET_LIMIT_PER_QBANK - (used + 1));
    return { ok: true, used: used + 1, limit: RESET_LIMIT_PER_QBANK, remaining };
  });

