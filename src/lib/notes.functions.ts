import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getNote = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ questionId: z.number().int() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("question_notes")
      .select("id,content,updated_at")
      .eq("user_id", userId)
      .eq("question_id", data.questionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row ?? null;
  });

export const saveNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      questionId: z.number().int(),
      qbankId: z.number().int().optional(),
      content: z.string().max(10000),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("question_notes")
      .upsert(
        {
          user_id: userId,
          question_id: data.questionId,
          qbank_id: data.qbankId ?? null,
          content: data.content,
        },
        { onConflict: "user_id,question_id" },
      )
      .select("id,content,updated_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listNotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: notes, error } = await supabase
      .from("question_notes")
      .select("id,question_id,qbank_id,content,updated_at,created_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    if (!notes || notes.length === 0) return [];

    const qIds = Array.from(new Set(notes.map((n) => n.question_id)));
    const { data: questions } = await supabase
      .from("questions")
      .select("id,qbank_id,subject_id,system_id")
      .in("id", qIds);

    const qMap = new Map((questions ?? []).map((q) => [Number(q.id), q]));

    const subjectKeys = Array.from(
      new Set((questions ?? []).map((q) => `${q.qbank_id}:${q.subject_id}`)),
    );
    const systemKeys = Array.from(
      new Set((questions ?? []).map((q) => `${q.qbank_id}:${q.system_id}`)),
    );

    const [{ data: subjects }, { data: systems }, { data: qbanks }] = await Promise.all([
      supabase.from("subjects").select("id,name,qbank_id"),
      supabase.from("systems").select("id,name,qbank_id"),
      supabase.from("qbanks").select("id,name"),
    ]);
    const subjMap = new Map((subjects ?? []).map((s) => [`${s.qbank_id}:${s.id}`, s.name]));
    const sysMap = new Map((systems ?? []).map((s) => [`${s.qbank_id}:${s.id}`, s.name]));
    const qbMap = new Map((qbanks ?? []).map((q) => [Number(q.id), q.name]));
    void subjectKeys; void systemKeys;

    return notes.map((n) => {
      const q = qMap.get(Number(n.question_id));
      return {
        id: n.id,
        questionId: Number(n.question_id),
        qbankId: n.qbank_id ?? q?.qbank_id ?? null,
        qbankName: qbMap.get(Number(n.qbank_id ?? q?.qbank_id ?? 0)) ?? null,
        subject: q ? subjMap.get(`${q.qbank_id}:${q.subject_id}`) ?? null : null,
        system: q ? sysMap.get(`${q.qbank_id}:${q.system_id}`) ?? null : null,
        content: n.content,
        updatedAt: n.updated_at,
      };
    });
  });

export const deleteNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("question_notes")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

