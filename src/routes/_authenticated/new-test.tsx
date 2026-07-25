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
import { Loader } from "@/components/loader";
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


  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-6">
      <div className="animate-fade-in">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-[#0d2b4e] via-[#1a4b7c] to-[#38bdf8] bg-clip-text text-transparent">Generate Quiz</h1>
        <p className="text-muted-foreground mt-1">Build a custom practice session</p>
      </div>

      {/* Test Mode */}
      <Card delay={60}>
        <div className="flex items-start gap-3 mb-4">
          <IconBadge><ClipboardCheck className="h-4 w-4" /></IconBadge>
          <div>
            <h2 className="font-semibold">Test Mode</h2>
            <p className="text-xs text-muted-foreground">Choose your preferred testing experience</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <ModeCard active={mode === "practice"} onClick={() => setMode("practice")} icon={<GraduationCap className="h-4 w-4" />} title="Tutor Mode" desc="Learn as you go" />
          <ModeCard active={mode === "test"} onClick={() => setMode("test")} icon={<ClipboardCheck className="h-4 w-4" />} title="Exam Mode" desc="Simulate real exam" />
        </div>
        <button
          onClick={() => setTimed((t) => !t)}
          className="mt-3 w-full flex items-center justify-between rounded-lg border border-border p-4 text-left hover:bg-accent/40"
        >
          <div className="flex items-center gap-3">
            <IconBadge><Clock className="h-4 w-4" /></IconBadge>
            <div>
              <div className="font-medium text-sm">Timed Mode</div>
              <div className="text-xs text-muted-foreground">Add time pressure to your test</div>
            </div>
          </div>
          <div className={cn("h-6 w-11 rounded-full transition-colors relative", timed ? "bg-primary" : "bg-muted")}>
            <div className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-all", timed ? "left-5" : "left-0.5")} />
          </div>
        </button>
      </Card>

      {/* Quiz Type */}
      <Card delay={120}>
        <h2 className="font-semibold mb-3">Quiz Type</h2>
        <div className="rounded-lg border border-border p-3 mb-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-1">Edit Quiz Name</div>
          <Input value={quizName} onChange={(e) => setQuizName(e.target.value)} className="border-0 shadow-none p-0 focus-visible:ring-0 h-auto text-sm" />
        </div>
        <div className="flex flex-wrap gap-2">
          {([
            { v: "standard", l: "Standard" },
            { v: "custom", l: "Custom" },
          ] as const).map((o) => {
            const active = quizType === o.v;
            return (
              <button
                key={o.v}
                onClick={() => setQuizType(o.v)}
                className={cn(
                  "px-5 py-1.5 rounded-full text-sm font-medium border transition-colors",
                  active
                    ? "bg-primary text-primary-foreground border-primary shadow"
                    : "bg-background text-primary border-primary/40 hover:bg-primary/5",
                )}
              >
                {o.l}
              </button>
            );
          })}
        </div>
      </Card>

      {quizType === "custom" && (
        <Card delay={180}>
          <h2 className="font-semibold mb-4">Question ID's</h2>
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-4 items-start">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Retrieve from a Test ID</label>
              <div className="flex gap-2">
                <Input
                  value={customTestId}
                  onChange={(e) => setCustomTestId(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="Test Id"
                  className="h-10"
                />
                <Button onClick={retrieveFromTestId} disabled={retrieving} className="h-10">
                  {retrieving ? "…" : "Retrieve"}
                </Button>
              </div>
            </div>
            <div className="hidden md:flex items-center justify-center pt-6">
              <span className="text-sm font-semibold text-muted-foreground">OR</span>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Paste Question IDs <span className="text-muted-foreground/70">(comma separated)</span>
              </label>
              <textarea
                value={customIds}
                onChange={(e) => setCustomIds(e.target.value)}
                placeholder="e.g. 1024, 1025, 1026"
                rows={5}
                className="w-full rounded-md border border-border bg-background p-3 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <div className="text-xs text-muted-foreground mt-1">
                {parseIds(customIds).length} valid ID{parseIds(customIds).length === 1 ? "" : "s"}
              </div>
            </div>
          </div>
          <Button
            size="lg"
            onClick={start}
            disabled={loading || parseIds(customIds).length === 0}
            className="mt-6 group relative overflow-hidden transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <span className="relative z-10 flex items-center gap-2">
              {loading && <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
              {loading ? "Generating…" : "Generate Test"}
            </span>
          </Button>
        </Card>
      )}

      {quizType === "standard" && (<>


      {/* Tabs / Selection */}
      <Card delay={180}>
        <div className="flex flex-wrap items-center gap-x-1 gap-y-0 border-b border-border mb-4 -mt-2 -mx-6 px-2 sm:px-6">
          {(Object.keys(availableTabs) as Tab[]).map((t) => {
            const enabled = availableTabs[t];
            return (
              <button
                key={t}
                disabled={!enabled}
                onClick={() => enabled && setOpenTab(t)}
                className={cn(
                  "shrink-0 px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium capitalize border-b-2 -mb-px transition-colors",
                  openTab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground",
                  enabled ? "hover:text-foreground cursor-pointer" : "opacity-40 cursor-not-allowed",
                )}
              >
                {t === "qbank" ? "QBank" : t}
              </button>
            );
          })}
          <div className="ml-auto shrink-0 pl-2">
            <button className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground">
              <ChevronUp className="h-4 w-4" />
            </button>
          </div>
        </div>


        {openTab === "courses" && (
          <SelectionList
            items={COURSES.filter((c) => c.qbankId === qbankId).map((c) => ({ id: c.id, label: c.name, count: COURSE_TOTALS[c.qbankId] ?? 0 }))}
            selected={courseIds}
            onToggle={(id) => {
              const c = COURSES.find((x) => x.id === id);
              if (!c) return;
              setCourseIds([c.id]);
              // Auto-select all QBanks belonging to this course so the user can
              // generate a test immediately without visiting the QBank tab.
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
      </Card>

      {/* Question types + Difficulty */}
      <Card delay={240}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h3 className="font-semibold mb-3">Question Types</h3>
            <div className="grid grid-cols-2 gap-y-3">
              {[
                { v: "marked", l: "Marked Questions" },
                { v: "omitted", l: "Omitted Questions" },
                { v: "unused", l: "Unused Questions" },
                { v: "correct", l: "Correct Questions" },
                { v: "incorrect", l: "Incorrect Questions" },
                { v: "all", l: "All" },
              ].map((o) => (
                <label key={o.v} className="flex items-center gap-2 text-sm cursor-pointer transition-colors hover:text-primary">
                  <Checkbox checked={scope === o.v} onCheckedChange={() => setScope(o.v as Scope)} />
                  {o.l}
                </label>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-semibold mb-3">Difficulty</h3>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setDifficulty((d) => d.includes(n) ? d.filter((x) => x !== n) : [...d, n])}
                  className={cn(
                    "h-10 w-10 rounded-md text-sm font-semibold transition-all duration-200 hover:scale-110 active:scale-95",
                    difficulty.includes(n) ? "bg-primary text-primary-foreground shadow-md shadow-primary/30" : "bg-muted text-muted-foreground hover:bg-accent",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Limit + Generate */}
      <Card delay={300}>
        <div className="flex items-center gap-3 rounded-lg border-l-4 border-primary bg-primary/5 p-3 mb-4">
          <Info className="h-4 w-4 text-primary" />
          <div className="text-sm flex-1">
            <span className="text-primary font-semibold text-xs uppercase tracking-wider">Question Limit</span>
            <div>New limit! Now Maximum <b>50 questions</b> per quiz</div>
          </div>
          <span className="text-xs font-semibold rounded-full bg-primary text-primary-foreground px-3 py-1">50 MAX</span>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-border p-4">
          <span className="text-sm">Generate</span>
          <Input
            type="number"
            min={0}
            max={Math.min(50, poolCount)}
            value={count}
            onChange={(e) => setCount(Math.max(0, Math.min(50, +e.target.value)))}
            className="w-20 text-center"
          />
          <span className="text-sm">/ <b>{poolCount}</b> Questions</span>
        </div>
        <Button
          size="lg"
          onClick={start}
          disabled={loading || !hasCourse || !hasQbank || count < 1 || poolCount === 0}
          className="mt-4 group relative overflow-hidden transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:hover:scale-100"
        >
          <span className="relative z-10 flex items-center gap-2">
            {loading && <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
            {loading ? "Generating…" : "Generate Test"}
          </span>
          {!loading && <span aria-hidden className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent group-hover:translate-x-full transition-transform duration-700" />}
        </Button>
      </Card>
      </>)}

      {/* Full-screen generating overlay */}
      {loading && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="rounded-2xl bg-white/95 dark:bg-slate-900/95 shadow-2xl px-10 py-8 border border-white/20">
            <Loader label="Preparing your test" size={72} />
          </div>
        </div>
      )}
    </div>

  );
}

function Card({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <div
      className="rounded-xl border border-border bg-card p-6 shadow-sm animate-fade-in transition-all duration-300 hover:shadow-md hover:border-primary/30"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}
    >
      {children}
    </div>
  );
}
function IconBadge({ children }: { children: React.ReactNode }) {
  return <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary shrink-0 transition-transform hover:scale-110">{children}</div>;
}
function ModeCard({ active, onClick, icon, title, desc }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 rounded-lg border p-4 text-left transition-colors",
        active ? "border-primary bg-primary/10" : "border-border hover:bg-accent/40",
      )}
    >
      <IconBadge>{icon}</IconBadge>
      <div>
        <div className="font-medium text-sm">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </button>
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
      <div className="flex items-center gap-4 mb-3">
        {!radio && selectAll && (
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={allSelected} onCheckedChange={() => (allSelected ? clearAll?.() : selectAll())} />
            Select All
          </label>
        )}
        {onSearch && (
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search" className="pl-8 h-9" />
          </div>
        )}
      </div>
      <div className={cn("grid gap-2", scrollable && "max-h-[380px] overflow-y-auto pr-2", columns === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-3")}>
        {filtered.map((it) => {
          const isSel = selected.includes(it.id);
          return (
            <label
              key={String(it.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg border p-2.5 cursor-pointer transition-colors text-sm",
                isSel ? "border-primary bg-primary/5" : "border-border hover:bg-accent/40",
              )}
            >
              <Checkbox checked={isSel} onCheckedChange={() => onToggle(it.id)} />
              <span className="flex-1 truncate">{it.label}</span>
              <span className="rounded bg-primary text-primary-foreground text-xs font-semibold px-2 py-0.5 min-w-[2rem] text-center">
                {it.count}
              </span>
            </label>
          );
        })}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground col-span-full py-6 text-center">No items</p>}
      </div>
    </div>
  );
}
