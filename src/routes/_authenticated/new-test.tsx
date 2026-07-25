import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { getFilters, createTest, getPoolCount, createCustomTest, getTestQuestionIds } from "@/lib/qbank.functions";
import { useActiveQbankId, setActiveQbankId, QBANKS as ALL_QBANKS } from "@/lib/active-qbank";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { ChevronUp, Search, Info, Clock, GraduationCap, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/new-test")({
  component: NewTest,
});

type Tab = "courses" | "qbank" | "subjects" | "systems" | "topics";
type Scope = "all" | "unused" | "incorrect" | "correct" | "omitted" | "marked";

const COURSES = ALL_QBANKS.map((q) => ({ id: q.slug, qbankId: q.id, name: q.name }));

type CmsForm = { source: string; formNumber: number; count: number };
type QbankOption = { id: string; qbankId: number; name: string; source: string; count: number; cmsSpecialty?: string; cmsForms?: CmsForm[] };
const STEP1_NBMES = [25, 26, 27, 28, 30, 31, 32, 33];
const STEP2_NBMES = [8, 9, 10, 11, 12, 13, 14, 15, 16];
const NBME_COUNTS: Record<string, number> = {
  NBME25: 200, NBME26: 200, NBME27: 198, NBME28: 200,
  NBME30: 200, NBME31: 200, NBME32: 200, NBME33: 199,
  NBME8: 200, NBME9: 200, NBME10: 200, NBME11: 200, NBME12: 200,
  NBME13: 200, NBME14: 200, NBME15: 200, NBME16: 200,
};
// CMS Clinical Mastery Series forms for Step 2 CK
const STEP2_CMS: Array<{ specialty: string; tag: string; forms: number[] }> = [
  { specialty: "Psychiatry",         tag: "PSY",  forms: [5, 6, 7, 8] },
  { specialty: "Pediatrics",         tag: "PEDS", forms: [5, 6, 7, 8, 9] },
  { specialty: "Surgery",            tag: "SUR",  forms: [5, 6, 7, 8, 9] },
  { specialty: "Neurology",          tag: "NEU",  forms: [5, 6, 7, 8, 9] },
  { specialty: "Internal Medicine",  tag: "IM",   forms: [5, 6, 7, 8, 9, 10] },
  { specialty: "Ob/Gyn",             tag: "OBG",  forms: [5, 6, 7, 8, 9, 10] },
  { specialty: "Family Medicine",    tag: "FM",   forms: [2, 3, 5] },
  { specialty: "Emergency Medicine", tag: "EM",   forms: [1, 2, 3] },
];
const CMS_COUNTS: Record<string, number> = { CMS_IM6: 49 };
const QBANK_OPTIONS: QbankOption[] = ALL_QBANKS.flatMap((q) => {
  if (q.slug === "step1") {
    return [
      { id: "step1:main", qbankId: q.id, name: `UWorld ${q.name}`, source: "main", count: 3659 },
      { id: "step1:SA1", qbankId: q.id, name: "UWorld Self Assessment 1", source: "SA1", count: 160 },
      { id: "step1:SA2", qbankId: q.id, name: "UWorld Self Assessment 2", source: "SA2", count: 159 },
      { id: "step1:SA3", qbankId: q.id, name: "UWorld Self Assessment 3", source: "SA3", count: 158 },
      ...STEP1_NBMES.map((n) => ({
        id: `step1:NBME${n}`, qbankId: q.id, name: `NBME ${n}`,
        source: `NBME${n}`, count: NBME_COUNTS[`NBME${n}`] ?? 200,
      })),
    ];
  }
  if (q.slug === "step2") {
    return [
      { id: "step2:main", qbankId: q.id, name: `UWorld ${q.name}`, source: "main", count: 4089 },
      { id: "step2:SA1", qbankId: q.id, name: "UWorld Self Assessment 1", source: "SA1", count: 157 },
      { id: "step2:SA2", qbankId: q.id, name: "UWorld Self Assessment 2", source: "SA2", count: 159 },
      { id: "step2:SA3", qbankId: q.id, name: "UWorld Self Assessment 3", source: "SA3", count: 160 },
      ...STEP2_NBMES.map((n) => ({
        id: `step2:NBME${n}`, qbankId: q.id, name: `NBME ${n}`,
        source: `NBME${n}`, count: NBME_COUNTS[`NBME${n}`] ?? 200,
      })),
      ...STEP2_CMS.map(({ specialty, tag, forms }) => {
        const cmsForms: CmsForm[] = forms.map((n) => ({
          source: `CMS_${tag}${n}`,
          formNumber: n,
          count: CMS_COUNTS[`CMS_${tag}${n}`] ?? 50,
        }));
        return {
          id: `step2:CMS_${tag}`,
          qbankId: q.id,
          name: `CMS ${specialty} Forms`,
          source: `CMS_${tag}`,
          count: cmsForms.reduce((s, f) => s + f.count, 0),
          cmsSpecialty: specialty,
          cmsForms,
        };
      }),
    ];
  }
  if (q.slug === "step3") {
    return [
      { id: "step3:main", qbankId: q.id, name: `UWorld ${q.name}`, source: "main", count: 2136 },
      { id: "step3:SA1", qbankId: q.id, name: "UWorld Self Assessment 1", source: "SA1", count: 160 },
      { id: "step3:SA2", qbankId: q.id, name: "UWorld Self Assessment 2", source: "SA2", count: 160 },
    ];
  }
  return [{ id: `${q.slug}:main`, qbankId: q.id, name: `UWorld ${q.name}`, source: "main", count: 0 }];
});

const COURSE_TOTALS: Record<number, number> = QBANK_OPTIONS.reduce((acc, o) => {
  acc[o.qbankId] = (acc[o.qbankId] ?? 0) + o.count;
  return acc;
}, {} as Record<number, number>);



function NewTest() {
  const getFn = useServerFn(getFilters);
  const createFn = useServerFn(createTest);
  const createCustomFn = useServerFn(createCustomTest);
  const getTestIdsFn = useServerFn(getTestQuestionIds);
  const poolFn = useServerFn(getPoolCount);
  const navigate = useNavigate();
  const qbankId = useActiveQbankId();

  const [openTab, setOpenTab] = useState<Tab>("courses");
  const [courseIds, setCourseIds] = useState<string[]>([]);
  const [qbankIds, setQbankIds] = useState<string[]>([]);
  const [subjectIds, setSubjectIds] = useState<number[]>([]);
  const [systemIds, setSystemIds] = useState<number[]>([]);
  const [topicNames, setTopicNames] = useState<string[]>([]);
  // For CMS aggregates: which form sources are picked (empty = all forms of the selected specialty)
  const [cmsFormSources, setCmsFormSources] = useState<string[]>([]);

  const selectedQbankOptions = useMemo(
    () => qbankIds.map((id) => QBANK_OPTIONS.find((o) => o.id === id)).filter((o): o is QbankOption => !!o),
    [qbankIds],
  );
  const selectedSources = useMemo(() => {
    const out: string[] = [];
    for (const opt of selectedQbankOptions) {
      if (opt.cmsForms) {
        const picked = opt.cmsForms.filter((f) => cmsFormSources.includes(f.source));
        const use = picked.length ? picked : opt.cmsForms;
        for (const f of use) out.push(f.source);
      } else {
        out.push(opt.source);
      }
    }
    return out;
  }, [selectedQbankOptions, cmsFormSources]);
  const { data } = useQuery({
    queryKey: ["filters", qbankId, selectedSources],
    queryFn: () => getFn({ data: { qbankId, sources: selectedSources } }),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });


  const [scope, setScope] = useState<Scope>("unused");
  const [difficulty, setDifficulty] = useState<number[]>([1, 2, 3, 4, 5]);
  const [mode, setMode] = useState<"practice" | "test">("practice");
  const [timed, setTimed] = useState(false);
  const [count, setCount] = useState(20);
  const [quizName, setQuizName] = useState(() => `Custom Quiz ${new Date().toLocaleString()}`);
  const [loading, setLoading] = useState(false);

  // Quiz Type: standard vs custom
  const [quizType, setQuizType] = useState<"standard" | "custom">("standard");
  const [customTestId, setCustomTestId] = useState("");
  const [customIds, setCustomIds] = useState("");
  const [retrieving, setRetrieving] = useState(false);

  const [subjectSearch, setSubjectSearch] = useState("");
  const [systemSearch, setSystemSearch] = useState("");
  const [topicSearch, setTopicSearch] = useState("");

  // gating
  const hasCourse = courseIds.length > 0;
  const hasQbank = qbankIds.length > 0;
  const hasSubject = subjectIds.length > 0;
  const hasSystem = systemIds.length > 0;

  // CMS aggregates surface forms in the Subjects tab and hide Systems/Topics
  const cmsSelectedOptions = useMemo(
    () => selectedQbankOptions.filter((o) => o.cmsForms && o.cmsSpecialty),
    [selectedQbankOptions],
  );
  const cmsMode = cmsSelectedOptions.length > 0 && cmsSelectedOptions.length === selectedQbankOptions.length;

  const availableTabs: Record<Tab, boolean> = {
    courses: true,
    qbank: hasCourse,
    subjects: hasQbank,
    systems: hasSubject && !cmsMode,
    topics: hasSystem && !cmsMode,
  };

  const questionMeta = data?.questionMeta ?? [];
  const totalStep2 = data?.totalQuestions ?? questionMeta.length;

  // Bounce off hidden tabs & clear irrelevant selections when entering CMS mode
  useEffect(() => {
    if (cmsMode && (openTab === "systems" || openTab === "topics")) setOpenTab("subjects");
    if (cmsMode) {
      if (systemIds.length) setSystemIds([]);
      if (topicNames.length) setTopicNames([]);
      if (subjectIds.length) setSubjectIds([]);
    } else {
      if (cmsFormSources.length) setCmsFormSources([]);
    }
  }, [cmsMode]);

  // Prune cmsFormSources when the underlying CMS selection changes
  useEffect(() => {
    if (!cmsMode) return;
    const valid = new Set(cmsSelectedOptions.flatMap((o) => o.cmsForms!.map((f) => f.source)));
    setCmsFormSources((v) => v.filter((s) => valid.has(s)));
  }, [cmsMode, cmsSelectedOptions]);


  const filteredSystems = useMemo(() => {
    if (!data) return [];
    const counts = new Map<number, number>();
    for (const q of questionMeta) {
      if (q.systemId == null) continue;
      if (hasSubject && (q.subjectId == null || !subjectIds.includes(q.subjectId))) continue;
      counts.set(q.systemId, (counts.get(q.systemId) ?? 0) + 1);
    }
    return data.systems
      .filter((s) => counts.has(s.id))
      .map((s) => ({ ...s, count: counts.get(s.id) ?? 0 }));
  }, [data, questionMeta, subjectIds, hasSubject]);

  // Topics narrowed by selected subjects and systems, counted from individual question rows
  const filteredTopics = useMemo(() => {
    if (!data) return [];
    const counts = new Map<string, number>();
    for (const q of questionMeta) {
      if (!q.title) continue;
      if (hasSubject && (q.subjectId == null || !subjectIds.includes(q.subjectId))) continue;
      if (hasSystem && (q.systemId == null || !systemIds.includes(q.systemId))) continue;
      counts.set(q.title, (counts.get(q.title) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data, questionMeta, subjectIds, systemIds, hasSubject, hasSystem]);

  // Subjects: show global count, but reflect selected systems when present
  const subjectItems = useMemo(() => {
    if (!data) return [];
    if (!hasSystem) return data.subjects.map((s) => ({ ...s, count: s.count ?? 0 }));
    const counts = new Map<number, number>();
    for (const q of questionMeta) {
      if (q.subjectId == null) continue;
      if (q.systemId == null || !systemIds.includes(q.systemId)) continue;
      counts.set(q.subjectId, (counts.get(q.subjectId) ?? 0) + 1);
    }
    return data.subjects.map((s) => ({ ...s, count: counts.get(s.id) ?? 0 }));
  }, [data, questionMeta, systemIds, hasSystem]);

  // pool count
  const { data: pool } = useQuery({
    queryKey: ["pool", qbankId, selectedSources, subjectIds, systemIds, topicNames, scope],
    queryFn: () => poolFn({ data: { qbankId, sources: selectedSources, subjectIds, systemIds, topicNames, scope } }),
    enabled: !!data,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    placeholderData: (prev) => prev,
  });


  const poolCount = pool?.count ?? 0;

  useEffect(() => {
    if (count > poolCount && poolCount > 0) setCount(Math.min(poolCount, 50));
  }, [poolCount]);

  const parseIds = (raw: string) =>
    Array.from(new Set(raw.split(/[^0-9]+/).map((s) => parseInt(s, 10)).filter((n) => Number.isFinite(n) && n > 0)));

  const retrieveFromTestId = async () => {
    const tid = parseInt(customTestId.trim(), 10);
    if (!Number.isFinite(tid) || tid <= 0) return toast.error("Enter a valid Test ID");
    setRetrieving(true);
    try {
      const r = await getTestIdsFn({ data: { testId: tid } });
      if (!r.ids.length) return toast.error("That test has no questions");
      setCustomIds(r.ids.join(","));
      toast.success(`Retrieved ${r.ids.length} question IDs`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to retrieve");
    } finally { setRetrieving(false); }
  };

  const start = async () => {
    if (quizType === "custom") {
      const ids = parseIds(customIds);
      if (!ids.length) return toast.error("Enter at least one question ID");
      setLoading(true);
      try {
        const r = await createCustomFn({ data: { qbankId, questionIds: ids, mode, timed } });
        if (r.skipped > 0) toast.message(`${r.skipped} ID(s) were not found and skipped`);
        navigate({ to: "/test/$id", params: { id: String(r.id) } });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to create test";
        if (msg.includes("ACCESS_DENIED")) { navigate({ to: "/upgrade" }); return; }
        toast.error(msg);
      } finally { setLoading(false); }
      return;
    }
    if (!hasCourse || !hasQbank) return toast.error("Select a course and QBank");
    if (count < 1) return toast.error("Enter a question count");
    setLoading(true);
    try {
      const r = await createFn({ data: { qbankId, sources: selectedSources, subjectIds, systemIds, topicNames, count, mode, timed, scope } });
      navigate({ to: "/test/$id", params: { id: String(r.id) } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create test";
      if (msg.includes("ACCESS_DENIED")) { navigate({ to: "/upgrade" }); return; }
      toast.error(msg);
    } finally { setLoading(false); }

  };


  const difficultyLabel = difficulty.length === 5 ? "Any" : difficulty.slice().sort().join(", ");
  const scopeLabel = ({ all: "All", unused: "Unused", incorrect: "Incorrect", correct: "Correct", omitted: "Omitted", marked: "Marked" } as const)[scope];
  const pct = poolCount > 0 ? Math.min(100, Math.round((count / Math.min(poolCount, 50)) * 100)) : 0;
  const canLaunch = quizType === "custom"
    ? parseIds(customIds).length > 0 && !loading
    : hasCourse && hasQbank && count >= 1 && poolCount > 0 && !loading;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="mx-auto max-w-7xl px-4 md:px-8 py-6 md:py-10">
        {/* Page header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary/80 mb-2">
              <span className="h-px w-8 bg-primary/60" /> Test Composer
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Build a Session</h1>
            <p className="text-muted-foreground mt-1 text-sm">Compose the exact quiz you want to practice.</p>
          </div>
          {quizType === "standard" && (
            <div className="hidden md:flex items-center gap-2 rounded-full border border-border bg-card/60 backdrop-blur px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_hsl(var(--primary))]" />
              <span className="text-xs font-medium">Pool: <b className="tabular-nums">{poolCount}</b> questions</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 lg:gap-8">
          {/* LEFT — configuration */}
          <div className="space-y-5">

            {/* Step 01 — Mode */}
            <Section step="01" title="Testing Mode" subtitle="How do you want to practice?">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ModeTile
                  active={mode === "practice"}
                  onClick={() => setMode("practice")}
                  icon={<GraduationCap className="h-5 w-5" />}
                  title="Tutor Mode"
                  desc="Explanations after each question"
                />
                <ModeTile
                  active={mode === "test"}
                  onClick={() => setMode("test")}
                  icon={<ClipboardCheck className="h-5 w-5" />}
                  title="Exam Mode"
                  desc="Simulate the real testing day"
                />
              </div>
              <button
                onClick={() => setTimed((t) => !t)}
                className={cn(
                  "mt-3 w-full flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all",
                  timed ? "border-primary/60 bg-primary/5" : "border-border hover:border-border/80 hover:bg-accent/30",
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg transition-colors", timed ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-medium text-sm">Timed Session</div>
                    <div className="text-xs text-muted-foreground">Adds ~90s per question countdown</div>
                  </div>
                </div>
                <div className={cn("h-6 w-11 rounded-full transition-colors relative", timed ? "bg-primary" : "bg-muted")}>
                  <div className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-all", timed ? "left-5" : "left-0.5")} />
                </div>
              </button>
            </Section>

            {/* Step 02 — Quiz Type */}
            <Section step="02" title="Quiz Source" subtitle="Standard pool or a specific set of IDs">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="inline-flex rounded-xl border border-border bg-muted/40 p-1">
                  {([
                    { v: "standard", l: "Standard" },
                    { v: "custom", l: "Custom IDs" },
                  ] as const).map((o) => {
                    const active = quizType === o.v;
                    return (
                      <button
                        key={o.v}
                        onClick={() => setQuizType(o.v)}
                        className={cn(
                          "px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                          active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {o.l}
                      </button>
                    );
                  })}
                </div>
                <div className="flex-1 max-w-sm">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Session Label</label>
                  <Input value={quizName} onChange={(e) => setQuizName(e.target.value)} className="h-9 bg-background/60" />
                </div>
              </div>
            </Section>

            {quizType === "custom" && (
              <Section step="03" title="Question IDs" subtitle="Retrieve from a prior test or paste IDs directly">
                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-4 items-start">
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Retrieve by Test ID</label>
                    <div className="flex gap-2">
                      <Input
                        value={customTestId}
                        onChange={(e) => setCustomTestId(e.target.value.replace(/[^0-9]/g, ""))}
                        placeholder="e.g. 4821"
                        className="h-10"
                      />
                      <Button onClick={retrieveFromTestId} disabled={retrieving} variant="secondary" className="h-10">
                        {retrieving ? "…" : "Fetch"}
                      </Button>
                    </div>
                  </div>
                  <div className="hidden md:flex items-center justify-center pt-7">
                    <div className="flex flex-col items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                      <span className="h-6 w-px bg-border" />
                      <span>or</span>
                      <span className="h-6 w-px bg-border" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Paste IDs (comma separated)</label>
                    <textarea
                      value={customIds}
                      onChange={(e) => setCustomIds(e.target.value)}
                      placeholder="1024, 1025, 1026 …"
                      rows={5}
                      className="w-full rounded-lg border border-border bg-background/60 p-3 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    <div className="text-xs text-muted-foreground mt-1">
                      <b className="text-foreground tabular-nums">{parseIds(customIds).length}</b> valid ID{parseIds(customIds).length === 1 ? "" : "s"} detected
                    </div>
                  </div>
                </div>
              </Section>
            )}

            {quizType === "standard" && (
              <>
                {/* Step 03 — Selection Tabs */}
                <Section step="03" title="Scope" subtitle="Course → QBank → Subject → System → Topic">
                  <div className="flex flex-wrap items-center gap-1.5 mb-4 rounded-xl border border-border bg-muted/30 p-1">
                    {(Object.keys(availableTabs) as Tab[]).map((t) => {
                      const enabled = availableTabs[t];
                      const active = openTab === t;
                      return (
                        <button
                          key={t}
                          disabled={!enabled}
                          onClick={() => enabled && setOpenTab(t)}
                          className={cn(
                            "px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium capitalize transition-all",
                            active
                              ? "bg-background text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground",
                            !enabled && "opacity-40 cursor-not-allowed",
                          )}
                        >
                          {t === "qbank" ? "QBank" : t}
                        </button>
                      );
                    })}
                  </div>

                  {openTab === "courses" && (
                    <SelectionList
                      items={COURSES.filter((c) => c.qbankId === qbankId).map((c) => ({ id: c.id, label: c.name, count: COURSE_TOTALS[c.qbankId] ?? 0 }))}
                      selected={courseIds}
                      onToggle={(id) => {
                        const c = COURSES.find((x) => x.id === id);
                        if (!c) return;
                        setCourseIds([c.id]);
                        const autoQbankIds = QBANK_OPTIONS.filter((q) => q.qbankId === c.qbankId).map((q) => q.id);
                        setQbankIds(autoQbankIds);
                        setSubjectIds([]); setSystemIds([]); setTopicNames([]);
                        if (c.qbankId !== qbankId) setActiveQbankId(c.qbankId);
                      }}
                      columns={3}
                      radio
                    />
                  )}
                  {openTab === "qbank" && (
                    <SelectionList
                      items={QBANK_OPTIONS.filter((q) => courseIds.some((cid) => q.qbankId === COURSES.find((c) => c.id === cid)?.qbankId)).map((q) => ({ id: q.id, label: q.name, count: q.count }))}
                      selected={qbankIds}
                      onToggle={(id) => setQbankIds((v) => v.includes(id as string) ? v.filter((x) => x !== id) : [...v, id as string])}
                      columns={3}
                    />
                  )}
                  {openTab === "subjects" && cmsMode && (() => {
                    const formItems = cmsSelectedOptions.flatMap((o) =>
                      o.cmsForms!.map((f) => ({
                        id: f.source,
                        label: cmsSelectedOptions.length > 1
                          ? `${o.cmsSpecialty} — Form ${f.formNumber}`
                          : `Form ${f.formNumber}`,
                        count: f.count,
                      })),
                    );
                    return (
                      <SelectionList
                        items={formItems}
                        selected={cmsFormSources}
                        onToggle={(id) => setCmsFormSources((v) => v.includes(id as string) ? v.filter((x) => x !== id) : [...v, id as string])}
                        search={subjectSearch}
                        onSearch={setSubjectSearch}
                        selectAll={() => setCmsFormSources(formItems.map((i) => i.id))}
                        clearAll={() => setCmsFormSources([])}
                        columns={3}
                      />
                    );
                  })()}
                  {openTab === "subjects" && !cmsMode && (
                    <SelectionList
                      items={subjectItems.filter((s) => (s.count ?? 0) > 0).map((s) => ({ id: s.id, label: s.name, count: s.count ?? 0 }))}
                      selected={subjectIds}
                      onToggle={(id) => setSubjectIds((v) => v.includes(id as number) ? v.filter((x) => x !== id) : [...v, id as number])}
                      search={subjectSearch}
                      onSearch={setSubjectSearch}
                      selectAll={() => setSubjectIds((data?.subjects ?? []).map((s) => s.id))}
                      clearAll={() => setSubjectIds([])}
                      columns={3}
                    />
                  )}
                  {openTab === "systems" && (
                    <SelectionList
                      items={filteredSystems.filter((s) => (s.count ?? 0) > 0).map((s) => ({ id: s.id, label: s.name, count: s.count ?? 0 }))}
                      selected={systemIds}
                      onToggle={(id) => setSystemIds((v) => v.includes(id as number) ? v.filter((x) => x !== id) : [...v, id as number])}
                      search={systemSearch}
                      onSearch={setSystemSearch}
                      selectAll={() => setSystemIds(filteredSystems.map((s) => s.id))}
                      clearAll={() => setSystemIds([])}
                      columns={3}
                    />
                  )}
                  {openTab === "topics" && (
                    <SelectionList
                      items={filteredTopics.map((t) => ({ id: t.name, label: t.name, count: t.count }))}
                      selected={topicNames}
                      onToggle={(id) => setTopicNames((v) => v.includes(id as string) ? v.filter((x) => x !== id) : [...v, id as string])}
                      search={topicSearch}
                      onSearch={setTopicSearch}
                      selectAll={() => setTopicNames(filteredTopics.map((t) => t.name))}
                      clearAll={() => setTopicNames([])}
                      columns={3}
                      scrollable
                    />
                  )}
                </Section>

                {/* Step 04 — Filters */}
                <Section step="04" title="Filters" subtitle="Question set + difficulty tuning">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Question Set</h3>
                      <div className="grid grid-cols-2 gap-y-2.5 gap-x-3">
                        {[
                          { v: "unused", l: "Unused" },
                          { v: "marked", l: "Marked" },
                          { v: "incorrect", l: "Incorrect" },
                          { v: "correct", l: "Correct" },
                          { v: "omitted", l: "Omitted" },
                          { v: "all", l: "All" },
                        ].map((o) => {
                          const active = scope === o.v;
                          return (
                            <button
                              key={o.v}
                              onClick={() => setScope(o.v as Scope)}
                              className={cn(
                                "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-left transition-all",
                                active ? "border-primary bg-primary/10 text-foreground" : "border-border hover:border-border/80 hover:bg-accent/30 text-muted-foreground",
                              )}
                            >
                              <span className={cn("h-2 w-2 rounded-full", active ? "bg-primary" : "bg-muted-foreground/40")} />
                              {o.l}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Difficulty</h3>
                      <div className="relative flex items-end justify-between gap-2 h-24 px-1">
                        <div className="absolute left-0 right-0 bottom-4 h-px bg-border" />
                        {[1, 2, 3, 4, 5].map((n) => {
                          const active = difficulty.includes(n);
                          const h = 20 + n * 12;
                          return (
                            <button
                              key={n}
                              onClick={() => setDifficulty((d) => d.includes(n) ? d.filter((x) => x !== n) : [...d, n])}
                              className="relative flex flex-col items-center gap-1.5 group flex-1"
                            >
                              <div
                                style={{ height: `${h}px` }}
                                className={cn(
                                  "w-full max-w-[36px] rounded-t-md transition-all",
                                  active ? "bg-gradient-to-t from-primary to-primary/70 shadow-[0_0_12px_hsl(var(--primary)/0.35)]" : "bg-muted group-hover:bg-muted-foreground/25",
                                )}
                              />
                              <span className={cn("text-xs font-semibold tabular-nums", active ? "text-primary" : "text-muted-foreground")}>{n}</span>
                            </button>
                          );
                        })}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-2">{difficulty.length === 0 ? "Pick at least one" : `${difficulty.length} level${difficulty.length === 1 ? "" : "s"} selected`}</div>
                    </div>
                  </div>
                </Section>

                {/* Step 05 — Amount */}
                <Section step="05" title="Question Count" subtitle="Up to 50 per session">
                  <div className="flex items-center gap-3 rounded-xl bg-primary/5 border border-primary/20 px-3 py-2 mb-4">
                    <Info className="h-4 w-4 text-primary shrink-0" />
                    <div className="text-xs text-muted-foreground flex-1">Max <b className="text-foreground">50 questions</b> per quiz.</div>
                    <span className="text-[10px] font-bold tracking-wider rounded-full bg-primary text-primary-foreground px-2.5 py-0.5">50 MAX</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min={1}
                      max={Math.max(1, Math.min(50, poolCount))}
                      value={Math.min(count, Math.max(1, Math.min(50, poolCount)))}
                      onChange={(e) => setCount(Math.max(1, Math.min(50, +e.target.value)))}
                      className="flex-1 accent-primary"
                      disabled={poolCount === 0}
                    />
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 min-w-[130px] justify-center">
                      <Input
                        type="number"
                        min={0}
                        max={Math.min(50, poolCount)}
                        value={count}
                        onChange={(e) => setCount(Math.max(0, Math.min(50, +e.target.value)))}
                        className="w-14 h-7 border-0 shadow-none p-0 text-center text-base font-semibold focus-visible:ring-0"
                      />
                      <span className="text-xs text-muted-foreground">/ <b className="text-foreground tabular-nums">{poolCount}</b></span>
                    </div>
                  </div>
                </Section>
              </>
            )}
          </div>

          {/* RIGHT — sticky launch rail */}
          <aside className="lg:sticky lg:top-6 h-fit">
            <div className="rounded-2xl border border-border bg-card/70 backdrop-blur-sm p-5 shadow-lg shadow-primary/5 relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Session</div>
                  <div className="text-sm font-semibold mt-0.5">Ready to launch</div>
                </div>
                <ProgressRing pct={pct} label={String(count)} />
              </div>

              <div className="space-y-2 mb-5">
                <SummaryRow label="Mode" value={mode === "practice" ? "Tutor" : "Exam"} />
                <SummaryRow label="Timer" value={timed ? "On" : "Off"} />
                {quizType === "standard" ? (
                  <>
                    <SummaryRow label="Set" value={scopeLabel} />
                    <SummaryRow label="Difficulty" value={difficultyLabel} />
                    <SummaryRow label="Pool" value={`${poolCount}`} />
                    <SummaryRow label="Count" value={`${count}`} />
                  </>
                ) : (
                  <>
                    <SummaryRow label="Source" value="Custom IDs" />
                    <SummaryRow label="IDs" value={String(parseIds(customIds).length)} />
                  </>
                )}
              </div>

              <Button
                size="lg"
                onClick={start}
                disabled={!canLaunch}
                className="w-full h-11 font-semibold tracking-wide"
              >
                {loading ? "Generating…" : "Launch Session"}
              </Button>
              {quizType === "standard" && !hasCourse && (
                <p className="text-[11px] text-muted-foreground mt-2 text-center">Pick a course to begin</p>
              )}
              {quizType === "standard" && hasCourse && poolCount === 0 && (
                <p className="text-[11px] text-muted-foreground mt-2 text-center">No questions match — loosen filters</p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Section({ step, title, subtitle, children }: { step: string; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="relative rounded-2xl border border-border bg-card/60 backdrop-blur-sm p-5 md:p-6 shadow-sm">
      <div className="flex items-start gap-4 mb-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 text-primary font-mono font-bold text-sm tabular-nums">
          {step}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-base leading-tight">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function ModeTile({ active, onClick, icon, title, desc }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex items-start gap-3 rounded-xl border p-4 text-left transition-all overflow-hidden",
        active ? "border-primary bg-primary/10 shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.35)]" : "border-border hover:border-border/80 hover:bg-accent/30",
      )}
    >
      {active && <span className="absolute right-3 top-3 h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />}
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
        {icon}
      </div>
      <div>
        <div className="font-semibold text-sm">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
      </div>
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

function ProgressRing({ pct, label }: { pct: number; label: string }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const off = c - (Math.max(0, Math.min(100, pct)) / 100) * c;
  return (
    <div className="relative h-14 w-14">
      <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90">
        <circle cx="28" cy="28" r={r} stroke="hsl(var(--muted))" strokeWidth="4" fill="none" />
        <circle
          cx="28" cy="28" r={r}
          stroke="hsl(var(--primary))" strokeWidth="4" fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          className="transition-all duration-300"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums">{label}</div>
    </div>
  );
}

function SelectionList<T extends string | number>({
  items, selected, onToggle, search, onSearch, selectAll, clearAll, columns = 3, scrollable, radio,
}: {
  items: { id: T; label: string; count: number }[];
  selected: T[];
  onToggle: (id: T) => void;
  search?: string;
  onSearch?: (v: string) => void;
  selectAll?: () => void;
  clearAll?: () => void;
  columns?: number;
  scrollable?: boolean;
  radio?: boolean;
}) {
  const filtered = search ? items.filter((i) => i.label.toLowerCase().includes(search.toLowerCase())) : items;
  const allSelected = items.length > 0 && selected.length === items.length;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-3">
        {!radio && selectAll && (
          <button
            onClick={() => (allSelected ? clearAll?.() : selectAll())}
            className="text-[11px] font-semibold uppercase tracking-wider text-primary hover:underline"
          >
            {allSelected ? "Clear all" : "Select all"}
          </button>
        )}
        {onSearch && (
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search" className="pl-8 h-9 bg-background/60" />
          </div>
        )}
        <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
          {selected.length}/{items.length} selected
        </span>
      </div>
      <div className={cn("grid gap-2", scrollable && "max-h-[380px] overflow-y-auto pr-1", columns === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3")}>
        {filtered.map((it) => {
          const isSel = selected.includes(it.id);
          return (
            <button
              key={String(it.id)}
              onClick={() => onToggle(it.id)}
              className={cn(
                "group relative flex items-center gap-2 rounded-lg border pl-3 pr-2 py-2 text-left transition-all text-sm",
                isSel
                  ? "border-primary/60 bg-primary/8 shadow-[inset_3px_0_0_hsl(var(--primary))]"
                  : "border-border hover:border-border/80 hover:bg-accent/30",
              )}
            >
              <span className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                isSel ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
              )}>
                {isSel && <svg viewBox="0 0 12 12" className="h-3 w-3"><path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </span>
              <span className="flex-1 truncate">{it.label}</span>
              <span className={cn(
                "rounded-md text-[11px] font-mono font-semibold px-1.5 py-0.5 min-w-[2.25rem] text-center tabular-nums",
                isSel ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground",
              )}>
                {it.count}
              </span>
            </button>
          );
        })}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground col-span-full py-6 text-center">No items</p>}
      </div>
    </div>
  );
}

