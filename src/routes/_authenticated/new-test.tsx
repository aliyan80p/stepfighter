import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { getFilters, createTest, getPoolCount, createCustomTest, getTestQuestionIds } from "@/lib/qbank.functions";
import { useActiveQbankId, setActiveQbankId, QBANKS as ALL_QBANKS } from "@/lib/active-qbank";
import { getMyEntitlement } from "@/lib/entitlements.functions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  ChevronUp, Search, Clock, GraduationCap, ClipboardCheck,
  Columns2, LayoutList, PanelTop, Sparkles, SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { TestCreationOverlay } from "@/components/loader";

export const Route = createFileRoute("/_authenticated/new-test")({
  component: NewTest,
});

type Tab = "courses" | "qbank" | "subjects" | "systems" | "topics";
type Scope = "all" | "unused" | "incorrect" | "correct" | "omitted" | "marked";
type Difficulty = "all" | "easy" | "medium" | "hard";
type PageLayout = "studio" | "uworld" | "topbar";

const COURSES = ALL_QBANKS.map((q) => ({ id: q.slug, qbankId: q.id, name: q.name }));

type CmsForm = { source: string; formNumber: number; count: number };
type QbankOption = { id: string; qbankId: number; name: string; source: string; count: number; cmsSpecialty?: string; cmsForms?: CmsForm[] };
const STEP1_NBMES = [25, 26, 27, 28, 29, 30, 31, 32, 33];
const STEP2_NBMES = [8, 9, 10, 11, 12, 13, 14, 15, 16];
const NBME_COUNTS: Record<string, number> = {
  NBME25: 200, NBME26: 200, NBME27: 198, NBME28: 200, NBME29: 199,
  NBME30: 200, NBME31: 200, NBME32: 200, NBME33: 199,
  NBME8: 200, NBME9: 200, NBME10: 200, NBME11: 200, NBME12: 200,
  NBME13: 200, NBME14: 200, NBME15: 200, NBME16: 200,
};
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

const SCOPE_OPTIONS: { v: Scope; l: string; short: string }[] = [
  { v: "unused", l: "Unused", short: "Unused" },
  { v: "incorrect", l: "Incorrect", short: "Incorrect" },
  { v: "marked", l: "Marked", short: "Marked" },
  { v: "all", l: "All", short: "All" },
  { v: "correct", l: "Correct", short: "Correct" },
  { v: "omitted", l: "Omitted", short: "Omitted" },
];

const DIFFICULTY_OPTIONS: { v: Difficulty; l: string; hint: string }[] = [
  { v: "all", l: "All", hint: "Every difficulty" },
  { v: "easy", l: "Easy", hint: "≥70% peer correct" },
  { v: "medium", l: "Medium", hint: "45–69% peer correct" },
  { v: "hard", l: "Hard", hint: "<45% peer correct" },
];

function NewTest() {
  const getFn = useServerFn(getFilters);
  const createFn = useServerFn(createTest);
  const createCustomFn = useServerFn(createCustomTest);
  const getTestIdsFn = useServerFn(getTestQuestionIds);
  const poolFn = useServerFn(getPoolCount);
  const navigate = useNavigate();
  const qbankId = useActiveQbankId();

  const entFn = useServerFn(getMyEntitlement);
  const entQ = useQuery({ queryKey: ["my-entitlement"], queryFn: () => entFn(), staleTime: 60_000 });
  const entitledSlugs = entQ.data?.effective_access ?? [];
  const entitledCourses = useMemo(() => {
    const activeCourse = COURSES.find((c) => c.qbankId === qbankId);
    return activeCourse ? [activeCourse] : [];
  }, [entitledSlugs, qbankId]);

  const [layout, setLayout] = useState<PageLayout>(() => {
    if (typeof window === "undefined") return "studio";
    const saved = window.localStorage.getItem("sf:newTestLayout");
    return saved === "uworld" || saved === "topbar" ? saved : "studio";
  });
  const chooseLayout = (next: PageLayout) => {
    setLayout(next);
    try { window.localStorage.setItem("sf:newTestLayout", next); } catch {}
  };

  const [openTab, setOpenTab] = useState<Tab>("qbank");
  const [selectionOpen, setSelectionOpen] = useState(true);
  const [topicsOpen, setTopicsOpen] = useState(false);
  const [courseIds, setCourseIds] = useState<string[]>([]);
  const [qbankIds, setQbankIds] = useState<string[]>([]);
  const [subjectIds, setSubjectIds] = useState<number[]>([]);
  const [systemIds, setSystemIds] = useState<number[]>([]);
  const [topicNames, setTopicNames] = useState<string[]>([]);
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

  const selectedCourse = useMemo(
    () => COURSES.find((c) => courseIds.includes(c.id)),
    [courseIds],
  );
  const selectedQbankId = selectedCourse?.qbankId ?? qbankId;

  const { data } = useQuery({
    queryKey: ["filters", selectedQbankId, selectedSources],
    queryFn: () => getFn({ data: { qbankId: selectedQbankId, sources: selectedSources } }),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled: qbankIds.length > 0,
  });

  const [scope, setScope] = useState<Scope>("unused");
  const [difficulty, setDifficulty] = useState<Difficulty>("all");
  const [mode, setMode] = useState<"practice" | "test">("practice");
  const [timed, setTimed] = useState(false);
  const [count, setCount] = useState(20);
  const [quizName, setQuizName] = useState("");
  const [loading, setLoading] = useState(false);

  const [quizType, setQuizType] = useState<"standard" | "custom">("standard");
  const [customTestId, setCustomTestId] = useState("");
  const [customIds, setCustomIds] = useState("");
  const [retrieving, setRetrieving] = useState(false);

  const [subjectSearch, setSubjectSearch] = useState("");
  const [systemSearch, setSystemSearch] = useState("");
  const [topicSearch, setTopicSearch] = useState("");

  const hasCourse = courseIds.length > 0;
  const hasQbank = qbankIds.length > 0;
  const hasSubject = subjectIds.length > 0;
  const hasSystem = systemIds.length > 0;

  useEffect(() => {
    if (courseIds.length || entQ.isLoading || entitledCourses.length !== 1) return;
    const c = entitledCourses[0];
    setCourseIds([c.id]);
    setQbankIds([]);
    setSubjectIds([]);
    setSystemIds([]);
    setTopicNames([]);
    setOpenTab("qbank");
    if (c.qbankId !== qbankId) setActiveQbankId(c.qbankId);
  }, [courseIds.length, entQ.isLoading, entitledCourses, qbankId]);

  const cmsSelectedOptions = useMemo(
    () => selectedQbankOptions.filter((o) => o.cmsForms && o.cmsSpecialty),
    [selectedQbankOptions],
  );
  const cmsMode = cmsSelectedOptions.length > 0 && cmsSelectedOptions.length === selectedQbankOptions.length;

  const availableTabs: Record<Tab, boolean> = {
    courses: true,
    qbank: hasCourse,
    subjects: hasQbank,
    systems: hasQbank && !cmsMode,
    topics: (hasSubject || hasSystem) && !cmsMode,
  };

  const questionMeta = data?.questionMeta ?? [];

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

  const { data: pool, isFetching: poolFetching } = useQuery({
    queryKey: ["pool", selectedQbankId, selectedSources, subjectIds, systemIds, topicNames, scope, difficulty],
    queryFn: () =>
      poolFn({
        data: { qbankId: selectedQbankId, sources: selectedSources, subjectIds, systemIds, topicNames, scope, difficulty },
      }),
    enabled: selectedSources.length > 0,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    placeholderData: (prev) => prev,
  });

  const poolCount = selectedSources.length > 0 ? (pool?.count ?? 0) : 0;
  const maxAllowed = Math.min(50, poolCount);

  useEffect(() => {
    if (poolCount > 0 && count > maxAllowed) setCount(maxAllowed);
    if (poolCount > 0 && count === 0) setCount(Math.min(20, maxAllowed));
  }, [poolCount, maxAllowed]);

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
        const r = await createCustomFn({
          data: { qbankId: selectedQbankId, questionIds: ids, mode, timed, name: quizName.trim() || undefined },
        });
        if (r.skipped > 0) toast.message(`${r.skipped} ID(s) were not found and skipped`);
        navigate({ to: "/test/$id", params: { id: String(r.id) } });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to create test";
        if (msg.includes("ACCESS_DENIED")) { navigate({ to: "/upgrade" }); return; }
        toast.error(msg);
      } finally { setLoading(false); }
      return;
    }
    if (!hasCourse || !hasQbank) return toast.error("Select a QBank first");
    if (count < 1 || poolCount === 0) return toast.error("No questions available for these filters");
    setLoading(true);
    try {
      const r = await createFn({
        data: {
          qbankId: selectedQbankId,
          sources: selectedSources,
          subjectIds,
          systemIds,
          topicNames,
          count,
          mode,
          timed,
          scope,
          difficulty,
          name: quizName.trim() || undefined,
        },
      });
      navigate({ to: "/test/$id", params: { id: String(r.id) } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create test";
      if (msg.includes("ACCESS_DENIED")) { navigate({ to: "/upgrade" }); return; }
      toast.error(msg);
    } finally { setLoading(false); }
  };

  const qbankListItems = useMemo(
    () =>
      QBANK_OPTIONS.filter((q) =>
        courseIds.some((cid) => q.qbankId === COURSES.find((c) => c.id === cid)?.qbankId),
      ).map((q) => ({ id: q.id, label: q.name, count: q.count })),
    [courseIds],
  );

  const cmsFormItems = useMemo(
    () =>
      cmsSelectedOptions.flatMap((o) =>
        o.cmsForms!.map((f) => ({
          id: f.source,
          label: cmsSelectedOptions.length > 1 ? `${o.cmsSpecialty} — Form ${f.formNumber}` : `Form ${f.formNumber}`,
          count: f.count,
        })),
      ),
    [cmsSelectedOptions],
  );

  const canGenerate = hasCourse && hasQbank && count >= 1 && poolCount > 0 && !loading;

  /* ---------------- Shared Control Blocks ---------------- */

  const countControl = (compact = false) => {
    const presets = [
      { label: "10", val: Math.min(10, maxAllowed) },
      { label: "20", val: Math.min(20, maxAllowed) },
      { label: "40", val: Math.min(40, maxAllowed) },
      { label: "Max", val: maxAllowed },
    ];
    return (
      <div className={cn("space-y-2.5", compact && "space-y-1.5")}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Questions
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {poolFetching ? "Counting…" : (
              <>
                <b className="text-foreground">{count}</b> / <b>{poolCount.toLocaleString()}</b> available
                <span className="ml-1.5 text-[10px] opacity-75">(50 max)</span>
              </>
            )}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {presets.map((p) => {
            const active = maxAllowed > 0 && count === p.val && (p.label !== "Max" || maxAllowed !== 10 && maxAllowed !== 20 && maxAllowed !== 40);
            return (
              <button
                key={p.label}
                type="button"
                disabled={maxAllowed === 0}
                onClick={() => setCount(Math.max(1, p.val))}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors disabled:opacity-40",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border text-foreground hover:bg-accent",
                )}
              >
                {p.label}
              </button>
            );
          })}
          <Input
            type="number"
            min={0}
            max={maxAllowed}
            value={count}
            onChange={(e) => setCount(Math.max(0, Math.min(Math.max(1, maxAllowed || 50), Number(e.target.value) || 0)))}
            className="w-16 h-7 text-center text-xs ml-auto tabular-nums"
          />
        </div>

        {!compact && (
          <input
            type="range"
            min={maxAllowed > 0 ? 1 : 0}
            max={Math.max(1, maxAllowed)}
            value={Math.min(count, Math.max(1, maxAllowed))}
            disabled={maxAllowed === 0}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-full accent-primary cursor-pointer disabled:opacity-40"
          />
        )}
      </div>
    );
  };

  const modeControl = (compact = false) => (
    <div className={cn("space-y-2.5", compact && "flex flex-wrap items-center gap-2 space-y-0")}>
      <div className={cn("grid grid-cols-2 gap-2", compact && "flex items-center gap-1")}>
        <button
          type="button"
          onClick={() => setMode("practice")}
          className={cn(
            "flex items-center gap-2 rounded-lg border text-left transition-all",
            compact ? "px-3 py-1.5 text-xs font-semibold" : "p-3",
            mode === "practice"
              ? "border-primary bg-primary/10 text-primary shadow-xs"
              : "border-border hover:bg-accent/40 text-foreground",
          )}
        >
          <GraduationCap className="h-4 w-4 shrink-0" />
          <div>
            <div className="font-semibold text-xs sm:text-sm leading-tight">Tutor</div>
            {!compact && <div className="text-[11px] text-muted-foreground">Learn as you go</div>}
          </div>
        </button>
        <button
          type="button"
          onClick={() => setMode("test")}
          className={cn(
            "flex items-center gap-2 rounded-lg border text-left transition-all",
            compact ? "px-3 py-1.5 text-xs font-semibold" : "p-3",
            mode === "test"
              ? "border-primary bg-primary/10 text-primary shadow-xs"
              : "border-border hover:bg-accent/40 text-foreground",
          )}
        >
          <ClipboardCheck className="h-4 w-4 shrink-0" />
          <div>
            <div className="font-semibold text-xs sm:text-sm leading-tight">Exam</div>
            {!compact && <div className="text-[11px] text-muted-foreground">Simulate real block</div>}
          </div>
        </button>
      </div>

      <button
        type="button"
        onClick={() => setTimed((t) => !t)}
        className={cn(
          "flex items-center justify-between gap-2.5 rounded-lg border border-border transition-colors hover:bg-accent/40",
          compact ? "px-3 py-1.5 text-xs font-medium" : "w-full px-3 py-2.5",
        )}
      >
        <span className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="font-medium text-xs sm:text-sm">Timed</span>
          {!compact && timed && count > 0 && (
            <span className="text-[11px] text-muted-foreground">({Math.round((count * 90) / 60)} min)</span>
          )}
        </span>
        <span className={cn("h-5 w-9 rounded-full transition-colors relative shrink-0", timed ? "bg-primary" : "bg-muted")}>
          <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-background shadow transition-all", timed ? "left-4" : "left-0.5")} />
        </span>
      </button>
    </div>
  );

  const scopePills = (
    <div className="flex flex-wrap gap-1.5">
      {SCOPE_OPTIONS.map((o) => {
        const active = scope === o.v;
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => setScope(o.v)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors",
              active
                ? "bg-primary text-primary-foreground border-primary shadow-xs"
                : "bg-background border-border text-muted-foreground hover:text-foreground hover:bg-accent/50",
            )}
          >
            {o.l}
          </button>
        );
      })}
    </div>
  );

  const difficultyPills = (
    <div className="flex flex-wrap gap-1.5">
      {DIFFICULTY_OPTIONS.map((d) => {
        const active = difficulty === d.v;
        return (
          <button
            key={d.v}
            type="button"
            title={d.hint}
            onClick={() => setDifficulty(d.v)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors",
              active
                ? "bg-primary text-primary-foreground border-primary shadow-xs"
                : "bg-background border-border text-muted-foreground hover:text-foreground hover:bg-accent/50",
            )}
          >
            <span>{d.l}</span>
            {d.v !== "all" && (
              <span className={cn("ml-1 text-[10px] font-normal", active ? "text-primary-foreground/80" : "text-muted-foreground")}>
                {d.v === "easy" ? "≥70%" : d.v === "medium" ? "45–69%" : "<45%"}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  const tabbedFilterCard = (
    <Card>
      <div className="flex flex-wrap items-center gap-x-1 gap-y-0 border-b border-border mb-4 -mt-2 -mx-5 sm:-mx-6 px-3 sm:px-6">
        {(Object.keys(availableTabs) as Tab[]).map((t) => {
          const enabled = availableTabs[t];
          const badge =
            t === "qbank" ? qbankIds.length
              : t === "subjects" ? (cmsMode ? cmsFormSources.length : subjectIds.length)
                : t === "systems" ? systemIds.length
                  : t === "topics" ? topicNames.length
                    : 0;
          return (
            <button
              key={t}
              type="button"
              disabled={!enabled}
              onClick={() => enabled && setOpenTab(t)}
              className={cn(
                "shrink-0 inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2.5 text-xs sm:text-sm font-medium capitalize border-b-2 -mb-px transition-colors",
                openTab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground",
                enabled ? "hover:text-foreground cursor-pointer" : "opacity-40 cursor-not-allowed",
              )}
            >
              <span>{t === "qbank" ? "QBank" : t === "subjects" && cmsMode ? "CMS Forms" : t}</span>
              {badge > 0 && (
                <span className="rounded-full bg-primary/15 text-primary px-1.5 py-0.5 text-[10px] font-bold leading-none">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
        <div className="ml-auto shrink-0 pl-2">
          <button
            type="button"
            onClick={() => setSelectionOpen((v) => !v)}
            aria-label={selectionOpen ? "Collapse selection panel" : "Expand selection panel"}
            className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
          >
            <ChevronUp className={cn("h-4 w-4 transition-transform duration-200", !selectionOpen && "rotate-180")} />
          </button>
        </div>
      </div>

      <div className="sf-accordion" data-open={selectionOpen ? "true" : "false"}>
        <div>
          <div key={openTab} className="sf-tab-enter">
            {openTab === "courses" && (
              <SelectionList
                items={entitledCourses.map((c) => ({ id: c.id, label: c.name, count: COURSE_TOTALS[c.qbankId] ?? 0 }))}
                selected={courseIds}
                onToggle={(id) => {
                  const c = COURSES.find((x) => x.id === id);
                  if (!c) return;
                  setCourseIds([c.id]);
                  setQbankIds([]);
                  setSubjectIds([]); setSystemIds([]); setTopicNames([]);
                  if (c.qbankId !== qbankId) setActiveQbankId(c.qbankId);
                  setOpenTab("qbank");
                }}
                columns={3}
                radio
              />
            )}
            {openTab === "qbank" && (
              <SelectionList
                items={qbankListItems}
                selected={qbankIds}
                onToggle={(id) => setQbankIds((v) => v.includes(id as string) ? v.filter((x) => x !== id) : [...v, id as string])}
                columns={3}
              />
            )}
            {openTab === "subjects" && cmsMode && (
              <SelectionList
                items={cmsFormItems}
                selected={cmsFormSources}
                onToggle={(id) => setCmsFormSources((v) => v.includes(id as string) ? v.filter((x) => x !== id) : [...v, id as string])}
                search={subjectSearch}
                onSearch={setSubjectSearch}
                selectAll={() => setCmsFormSources(cmsFormItems.map((i) => i.id))}
                clearAll={() => setCmsFormSources([])}
                columns={3}
              />
            )}
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
          </div>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="sf-fluid-page space-y-5">
      <TestCreationOverlay
        open={loading}
        mode={mode}
        timed={timed}
        questionCount={quizType === "custom" ? parseIds(customIds).length : count}
        quizName={quizName || "Custom Quiz"}
      />

      {/* Unified Header with Standard/Custom + 3-Layout Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Generate Quiz</h1>
            {selectedCourse && (
              <span className="rounded-full bg-primary/12 text-primary px-2.5 py-0.5 text-xs font-semibold">
                {selectedCourse.name}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">Configure your block, filters, and difficulty</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Standard / Custom IDs toggle */}
          <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
            {([
              { v: "standard", l: "Standard" },
              { v: "custom", l: "Custom IDs" },
            ] as const).map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setQuizType(o.v)}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-semibold transition-colors",
                  quizType === o.v
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {o.l}
              </button>
            ))}
          </div>

          {/* 3-Layout Orientation Switcher */}
          {quizType === "standard" && (
            <div className="inline-flex rounded-lg border border-border bg-card p-0.5" title="Switch page layout">
              {([
                { id: "studio", label: "Studio", icon: Columns2 },
                { id: "uworld", label: "UWorld", icon: LayoutList },
                { id: "topbar", label: "Top Bar", icon: PanelTop },
              ] as const).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => chooseLayout(id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors",
                    layout === id
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Custom Question IDs Mode */}
      {quizType === "custom" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-8">
            <Card>
              <h2 className="font-semibold mb-4">Question IDs</h2>
              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-4 items-start">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Retrieve from a Test ID</label>
                  <div className="flex gap-2">
                    <Input
                      value={customTestId}
                      onChange={(e) => setCustomTestId(e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="Test ID"
                      className="h-10"
                    />
                    <Button onClick={retrieveFromTestId} disabled={retrieving} className="h-10">
                      {retrieving ? "…" : "Retrieve"}
                    </Button>
                  </div>
                </div>
                <div className="hidden md:flex items-center justify-center pt-7">
                  <span className="text-xs font-semibold text-muted-foreground">OR</span>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
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
            </Card>
          </div>
          <div className="lg:col-span-4">
            <Card>
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Test Mode</div>
                  {modeControl()}
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Quiz Name (optional)</label>
                  <Input value={quizName} onChange={(e) => setQuizName(e.target.value)} placeholder="e.g. Cardio Missed Review" />
                </div>
                <Button size="lg" onClick={start} disabled={loading || parseIds(customIds).length === 0} className="w-full">
                  {loading ? "Generating…" : `Generate Test (${parseIds(customIds).length})`}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ==================== LAYOUT 1: TWO-COLUMN STUDIO ==================== */}
      {quizType === "standard" && layout === "studio" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left: Filters, Scope & Difficulty */}
          <div className="lg:col-span-8 space-y-5 min-w-0">
            {tabbedFilterCard}

            <Card>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                    Question Mode
                  </div>
                  {scopePills}
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                    Difficulty <span className="font-normal normal-case opacity-75">(by peer accuracy)</span>
                  </div>
                  {difficultyPills}
                </div>
              </div>
            </Card>
          </div>

          {/* Right: Sticky Summary, Mode, Count & Generate */}
          <div className="lg:col-span-4 lg:sticky lg:top-4 space-y-4">
            <Card>
              <div className="space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm">Session Builder</span>
                  </div>
                  <span className="text-xs font-semibold rounded-full bg-primary/12 text-primary px-2.5 py-0.5 tabular-nums">
                    {poolCount.toLocaleString()} match
                  </span>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Test Mode
                  </div>
                  {modeControl()}
                </div>

                <div className="pt-3 border-t border-border">
                  {countControl()}
                </div>

                <div className="pt-3 border-t border-border">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                    Quiz Name <span className="font-normal normal-case opacity-70">(optional)</span>
                  </label>
                  <Input
                    value={quizName}
                    onChange={(e) => setQuizName(e.target.value)}
                    placeholder="Auto-named if left blank"
                    className="h-9 text-sm"
                  />
                </div>

                {/* Live Selection Summary */}
                <div className="rounded-lg bg-muted/50 border border-border p-3 text-xs space-y-1 text-muted-foreground">
                  <div className="flex justify-between">
                    <span>QBanks</span>
                    <span className="font-semibold text-foreground">{qbankIds.length || "None selected"}</span>
                  </div>
                  {!cmsMode && (
                    <div className="flex justify-between">
                      <span>Subjects / Systems</span>
                      <span className="font-semibold text-foreground">
                        {subjectIds.length ? `${subjectIds.length} subj` : "All"} · {systemIds.length ? `${systemIds.length} sys` : "All"}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Mode / Difficulty</span>
                    <span className="font-semibold text-foreground capitalize">
                      {scope} · {difficulty}
                    </span>
                  </div>
                </div>

                <Button size="lg" onClick={start} disabled={!canGenerate} className="w-full gap-2">
                  <Sparkles className="h-4 w-4" />
                  {loading ? "Generating…" : hasQbank ? `Generate Test (${count})` : "Select a QBank First"}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ==================== LAYOUT 2: OFFICIAL UWORLD CREATE TEST ==================== */}
      {quizType === "standard" && layout === "uworld" && (
        <div className="space-y-4">
          {/* Top compact UWorld Test Mode + Question Mode + Difficulty */}
          <Card>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 divide-y lg:divide-y-0 lg:divide-x divide-border">
              <div className="space-y-2.5">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Test Mode</div>
                {modeControl()}
              </div>
              <div className="pt-4 lg:pt-0 lg:pl-5 space-y-2.5">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Question Mode</div>
                {scopePills}
              </div>
              <div className="pt-4 lg:pt-0 lg:pl-5 space-y-2.5">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Difficulty</div>
                {difficultyPills}
              </div>
            </div>
          </Card>

          {/* QBank Selector */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm">1. Select QBank</h2>
              <span className="text-xs text-muted-foreground">{qbankIds.length} selected</span>
            </div>
            <SelectionList
              items={qbankListItems}
              selected={qbankIds}
              onToggle={(id) => setQbankIds((v) => v.includes(id as string) ? v.filter((x) => x !== id) : [...v, id as string])}
              columns={3}
            />
          </Card>

          {/* Subjects & Systems Side-by-Side (classic UWorld orientation!) */}
          {hasQbank && !cmsMode && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-sm">2. Subjects</h2>
                  <span className="text-xs text-muted-foreground">
                    {subjectIds.length ? `${subjectIds.length} selected` : "All included"}
                  </span>
                </div>
                <SelectionList
                  items={subjectItems.filter((s) => (s.count ?? 0) > 0).map((s) => ({ id: s.id, label: s.name, count: s.count ?? 0 }))}
                  selected={subjectIds}
                  onToggle={(id) => setSubjectIds((v) => v.includes(id as number) ? v.filter((x) => x !== id) : [...v, id as number])}
                  search={subjectSearch}
                  onSearch={setSubjectSearch}
                  selectAll={() => setSubjectIds((data?.subjects ?? []).map((s) => s.id))}
                  clearAll={() => setSubjectIds([])}
                  columns={2}
                  scrollable
                />
              </Card>

              <Card>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-sm">3. Systems</h2>
                  <span className="text-xs text-muted-foreground">
                    {systemIds.length ? `${systemIds.length} selected` : "All included"}
                  </span>
                </div>
                <SelectionList
                  items={filteredSystems.filter((s) => (s.count ?? 0) > 0).map((s) => ({ id: s.id, label: s.name, count: s.count ?? 0 }))}
                  selected={systemIds}
                  onToggle={(id) => setSystemIds((v) => v.includes(id as number) ? v.filter((x) => x !== id) : [...v, id as number])}
                  search={systemSearch}
                  onSearch={setSystemSearch}
                  selectAll={() => setSystemIds(filteredSystems.map((s) => s.id))}
                  clearAll={() => setSystemIds([])}
                  columns={2}
                  scrollable
                />
              </Card>
            </div>
          )}

          {/* CMS Forms when CMS selected */}
          {hasQbank && cmsMode && (
            <Card>
              <h2 className="font-semibold text-sm mb-3">2. CMS Forms</h2>
              <SelectionList
                items={cmsFormItems}
                selected={cmsFormSources}
                onToggle={(id) => setCmsFormSources((v) => v.includes(id as string) ? v.filter((x) => x !== id) : [...v, id as string])}
                search={subjectSearch}
                onSearch={setSubjectSearch}
                selectAll={() => setCmsFormSources(cmsFormItems.map((i) => i.id))}
                clearAll={() => setCmsFormSources([])}
                columns={3}
              />
            </Card>
          )}

          {/* Optional expandable Topics */}
          {hasQbank && !cmsMode && filteredTopics.length > 0 && (
            <Card>
              <button
                type="button"
                onClick={() => setTopicsOpen((v) => !v)}
                className="w-full flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-sm">4. Topics (Optional)</h2>
                  {topicNames.length > 0 && (
                    <span className="rounded-full bg-primary/15 text-primary px-2 py-0.5 text-[11px] font-semibold">
                      {topicNames.length} selected
                    </span>
                  )}
                </div>
                <ChevronUp className={cn("h-4 w-4 text-muted-foreground transition-transform", !topicsOpen && "rotate-180")} />
              </button>
              <div className="sf-accordion" data-open={topicsOpen ? "true" : "false"}>
                <div className="pt-4">
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
                </div>
              </div>
            </Card>
          )}

          {/* Bottom UWorld Generate Bar */}
          <Card>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="flex-1 max-w-md">{countControl()}</div>
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  value={quizName}
                  onChange={(e) => setQuizName(e.target.value)}
                  placeholder="Quiz name (optional)"
                  className="w-48 h-10 text-sm"
                />
                <Button size="lg" onClick={start} disabled={!canGenerate} className="min-w-[170px]">
                  {loading ? "Generating…" : `Generate Test (${count})`}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ==================== LAYOUT 3: TOP CONTROL BAR + WIDE FILTER GRID ==================== */}
      {quizType === "standard" && layout === "topbar" && (
        <div className="space-y-4">
          <Card>
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border">
                {modeControl(true)}
                <div className="flex flex-wrap items-center gap-2 ml-auto">
                  <Input
                    value={quizName}
                    onChange={(e) => setQuizName(e.target.value)}
                    placeholder="Quiz name (optional)"
                    className="w-44 h-9 text-xs"
                  />
                  <Button onClick={start} disabled={!canGenerate} className="h-9 px-5 gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    {loading ? "Generating…" : `Generate (${count})`}
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                <div className="lg:col-span-5 space-y-1.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Question Mode</div>
                  {scopePills}
                </div>
                <div className="lg:col-span-4 space-y-1.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Difficulty</div>
                  {difficultyPills}
                </div>
                <div className="lg:col-span-3">
                  {countControl(true)}
                </div>
              </div>
            </div>
          </Card>

          {tabbedFilterCard}
        </div>
      )}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-sm">{children}</div>;
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
      {(selectAll || onSearch) && (
        <div className="flex items-center gap-4 mb-3">
          {!radio && selectAll && (
            <label className="flex items-center gap-2 text-xs sm:text-sm font-medium cursor-pointer shrink-0">
              <Checkbox checked={allSelected} onCheckedChange={() => (allSelected ? clearAll?.() : selectAll())} />
              Select All
            </label>
          )}
          {onSearch && (
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search…" className="pl-8 h-8 text-xs" />
            </div>
          )}
        </div>
      )}
      <div className={cn(scrollable && "max-h-[340px] overflow-y-auto pr-1.5", columns === 2 ? "grid grid-cols-1 sm:grid-cols-2 gap-2" : "sf-auto-grid")}>
        {filtered.map((it) => {
          const isSel = selected.includes(it.id);
          return (
            <label
              key={String(it.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg border p-2.5 cursor-pointer transition-colors text-sm",
                isSel ? "border-primary bg-primary/8 shadow-xs" : "border-border hover:bg-accent/40 hover:border-primary/40",
              )}
            >
              <Checkbox checked={isSel} onCheckedChange={() => onToggle(it.id)} />
              <span className="flex-1 truncate">{it.label}</span>
              <span className="rounded bg-primary/15 text-primary text-xs font-semibold px-2 py-0.5 min-w-[2rem] text-center tabular-nums">
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
