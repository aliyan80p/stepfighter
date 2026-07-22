import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  getAdminAnalytics, isCurrentUserAdmin,
  listUsers, deleteUser, updateEntitlement, setAdminRole,
  listFeedback, deleteFeedback,
  getQuestionForAdmin, updateQuestion,
  type AdminUserRow,
} from "@/lib/admin.functions";
import {
  Users, TrendingUp, CreditCard, Clock, ShieldAlert, Activity,
  Search, Trash2, Pencil, MessageSquare, BarChart3, UserCog,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminDashboard,
});

const COLORS = ["#f59e0b","#3b82f6","#10b981","#ef4444","#8b5cf6","#ec4899","#06b6d4","#84cc16","#f97316","#a3a3a3"];
const QBANK_OPTIONS = [
  { id: "1", label: "Step 2 CK" },
  { id: "2", label: "Step 1" },
  { id: "3", label: "Step 3" },
];

function AdminDashboard() {
  const navigate = useNavigate();
  const checkAdmin = useServerFn(isCurrentUserAdmin);
  const adminQ = useQuery({ queryKey: ["is-admin"], queryFn: () => checkAdmin() });
  const isAdmin = adminQ.data?.admin;

  useEffect(() => {
    if (adminQ.isSuccess && !isAdmin) navigate({ to: "/dashboard" });
  }, [adminQ.isSuccess, isAdmin, navigate]);

  if (adminQ.isLoading) return <div className="p-8 text-muted-foreground text-sm">Checking access…</div>;
  if (adminQ.isSuccess && !isAdmin) {
    return (
      <div className="p-8 max-w-md">
        <div className="flex items-center gap-2 text-destructive font-semibold mb-2">
          <ShieldAlert className="h-5 w-5" /> Not authorized
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Admin</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage users, entitlements, feedback and questions.</p>
      </div>
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview"><BarChart3 className="h-4 w-4 mr-1" />Overview</TabsTrigger>
          <TabsTrigger value="users"><UserCog className="h-4 w-4 mr-1" />Users</TabsTrigger>
          <TabsTrigger value="feedback"><MessageSquare className="h-4 w-4 mr-1" />Feedback</TabsTrigger>
          <TabsTrigger value="questions"><Pencil className="h-4 w-4 mr-1" />Questions</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><OverviewTab /></TabsContent>
        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="feedback"><FeedbackTab /></TabsContent>
        <TabsContent value="questions"><QuestionsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------- Overview ----------------
function OverviewTab() {
  const fetchAnalytics = useServerFn(getAdminAnalytics);
  const { data, isLoading, error } = useQuery({ queryKey: ["admin-analytics"], queryFn: () => fetchAnalytics() });
  if (isLoading) return <div className="text-muted-foreground text-sm">Loading analytics…</div>;
  if (error) return <div className="text-destructive text-sm">Failed to load: {(error as Error).message}</div>;
  if (!data) return null;
  const k = data.kpis;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Kpi icon={Users} label="Total Users" value={k.totalUsers} />
        <Kpi icon={TrendingUp} label="Signups (7d)" value={k.signups7d} sub={`${k.signups30d} in 30d`} />
        <Kpi icon={Clock} label="Active Trials" value={k.activeTrials} tone="amber" />
        <Kpi icon={CreditCard} label="Paid" value={k.paid} tone="green" />
        <Kpi icon={ShieldAlert} label="Expired" value={k.expired} tone="red" />
        <Kpi icon={TrendingUp} label="Conversion" value={`${(k.conversionRate*100).toFixed(1)}%`} />
        <Kpi icon={Activity} label="Attempts (7d)" value={k.attempts7d.toLocaleString()} />
        <Kpi icon={Activity} label="Tests (7d)" value={k.tests7d} />
      </div>
      <Card><CardHeader><CardTitle>Signups — 30 days</CardTitle></CardHeader><CardContent className="h-72">
        <ResponsiveContainer><LineChart data={data.signupsByDay}>
          <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" tick={{fontSize:11}} tickFormatter={v=>v.slice(5)} />
          <YAxis allowDecimals={false} tick={{fontSize:11}} /><Tooltip />
          <Line type="monotone" dataKey="count" stroke="#f59e0b" strokeWidth={2} dot={false} />
        </LineChart></ResponsiveContainer>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Attempts by QBank</CardTitle></CardHeader><CardContent className="h-80">
        <ResponsiveContainer><BarChart data={data.attemptsByDay}>
          <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" tick={{fontSize:11}} tickFormatter={v=>v.slice(5)} />
          <YAxis tick={{fontSize:11}} /><Tooltip /><Legend />
          <Bar dataKey="step1" stackId="a" fill="#3b82f6" name="Step 1" />
          <Bar dataKey="step2" stackId="a" fill="#f59e0b" name="Step 2 CK" />
          <Bar dataKey="step3" stackId="a" fill="#10b981" name="Step 3" />
        </BarChart></ResponsiveContainer>
      </CardContent></Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card><CardHeader><CardTitle>QBank access</CardTitle></CardHeader><CardContent className="h-72">
          <ResponsiveContainer><BarChart data={data.qbankAccess}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="qbank" tick={{fontSize:11}} />
            <YAxis allowDecimals={false} tick={{fontSize:11}} /><Tooltip /><Legend />
            <Bar dataKey="trial" fill="#f59e0b" name="Trial" /><Bar dataKey="paid" fill="#10b981" name="Paid" />
          </BarChart></ResponsiveContainer>
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Top countries</CardTitle></CardHeader><CardContent className="h-72">
          <ResponsiveContainer><PieChart>
            <Pie data={data.countries} dataKey="count" nameKey="country" outerRadius={90} label={{fontSize:11}}>
              {data.countries.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]} />)}
            </Pie><Tooltip />
          </PieChart></ResponsiveContainer>
        </CardContent></Card>
      </div>
    </div>
  );
}

// ---------------- Users ----------------
function UsersTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listUsers);
  const delFn = useServerFn(deleteUser);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<AdminUserRow | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-users", q],
    queryFn: () => listFn({ data: { search: q, limit: 100 } }),
  });

  const delM = useMutation({
    mutationFn: (userId: string) => delFn({ data: { userId } }),
    onSuccess: () => { toast.success("User deleted"); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" /> Users
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e)=>{e.preventDefault(); setQ(search);}} className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by email…" value={search} onChange={(e)=>setSearch(e.target.value)} className="pl-9" />
          </div>
          <Button type="submit" variant="secondary">Search</Button>
        </form>

        {isLoading ? <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground border-b">
                <tr>
                  <th className="py-2 pr-2">Email</th><th className="pr-2">Name</th>
                  <th className="pr-2">Plan</th><th className="pr-2">Expires</th>
                  <th className="pr-2">QBanks</th><th className="pr-2">Admin</th>
                  <th className="pr-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(data?.rows ?? []).map(u => {
                  const expires = u.plan === "paid" ? u.paid_until : u.trial_ends_at;
                  return (
                    <tr key={u.id} className="border-b hover:bg-muted/30">
                      <td className="py-2 pr-2 font-mono text-xs">{u.email}</td>
                      <td className="pr-2">{u.display_name ?? u.full_name ?? "—"}</td>
                      <td className="pr-2"><PlanBadge plan={u.plan} /></td>
                      <td className="pr-2 text-xs">{expires ? new Date(expires).toLocaleDateString() : "—"}</td>
                      <td className="pr-2 text-xs">{u.qbank_access.join(", ") || "—"}</td>
                      <td className="pr-2">{u.is_admin ? "✓" : ""}</td>
                      <td className="pr-2 text-right space-x-1 whitespace-nowrap">
                        <Button size="sm" variant="outline" onClick={()=>setEditing(u)}><Pencil className="h-3 w-3" /></Button>
                        <Button size="sm" variant="outline" onClick={()=>{
                          if (confirm(`Delete ${u.email}? This cannot be undone.`)) delM.mutate(u.id);
                        }}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                      </td>
                    </tr>
                  );
                })}
                {!data?.rows.length && <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No users found.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
      {editing && <EditUserDialog user={editing} onClose={()=>{setEditing(null); refetch();}} />}
    </Card>
  );
}

function PlanBadge({ plan }: { plan: string | null }) {
  const cls = plan === "paid" ? "bg-emerald-100 text-emerald-700"
    : plan === "trial" ? "bg-amber-100 text-amber-700"
    : "bg-slate-100 text-slate-600";
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{plan ?? "none"}</span>;
}

function EditUserDialog({ user, onClose }: { user: AdminUserRow; onClose: () => void }) {
  const updateFn = useServerFn(updateEntitlement);
  const roleFn = useServerFn(setAdminRole);
  const [plan, setPlan] = useState<"trial"|"paid"|"expired">((user.plan as any) ?? "trial");
  const [trialEnds, setTrialEnds] = useState(user.trial_ends_at?.slice(0,10) ?? "");
  const [paidUntil, setPaidUntil] = useState(user.paid_until?.slice(0,10) ?? "");
  const [qbanks, setQbanks] = useState<string[]>(user.qbank_access);
  const [isAdmin, setIsAdmin] = useState(user.is_admin);
  const [saving, setSaving] = useState(false);

  const toggleQ = (id: string) => setQbanks(qbanks.includes(id) ? qbanks.filter(x=>x!==id) : [...qbanks, id]);

  const save = async () => {
    setSaving(true);
    try {
      await updateFn({ data: {
        userId: user.id, plan,
        trial_ends_at: trialEnds ? new Date(trialEnds).toISOString() : null,
        paid_until: paidUntil ? new Date(paidUntil).toISOString() : null,
        qbank_access: qbanks,
      }});
      if (isAdmin !== user.is_admin) {
        await roleFn({ data: { userId: user.id, admin: isAdmin } });
      }
      toast.success("Saved");
      onClose();
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };

  const extend = (days: number) => {
    const base = new Date();
    base.setDate(base.getDate() + days);
    const iso = base.toISOString().slice(0,10);
    if (plan === "paid") setPaidUntil(iso); else setTrialEnds(iso);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Edit {user.email}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Plan</Label>
            <div className="flex gap-2 mt-1">
              {(["trial","paid","expired"] as const).map(p=>(
                <Button key={p} type="button" size="sm" variant={plan===p?"default":"outline"} onClick={()=>setPlan(p)}>{p}</Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Trial ends</Label><Input type="date" value={trialEnds} onChange={(e)=>setTrialEnds(e.target.value)} /></div>
            <div><Label className="text-xs">Paid until</Label><Input type="date" value={paidUntil} onChange={(e)=>setPaidUntil(e.target.value)} /></div>
          </div>
          <div className="flex flex-wrap gap-1">
            {[7,30,90,180,365].map(d=>(
              <Button key={d} type="button" size="sm" variant="outline" onClick={()=>extend(d)}>+{d}d</Button>
            ))}
          </div>
          <div>
            <Label>QBank access</Label>
            <div className="space-y-2 mt-1">
              {QBANK_OPTIONS.map(o=>(
                <label key={o.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={qbanks.includes(o.id)} onCheckedChange={()=>toggleQ(o.id)} /> {o.label}
                </label>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm border-t pt-3">
            <Checkbox checked={isAdmin} onCheckedChange={(v)=>setIsAdmin(!!v)} /> Grant admin role
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving?"Saving…":"Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Feedback ----------------
function FeedbackTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listFeedback);
  const delFn = useServerFn(deleteFeedback);
  const { data, isLoading } = useQuery({ queryKey: ["admin-feedback"], queryFn: () => listFn({ data: {} }) });
  const delM = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin-feedback"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5" /> Feedback</CardTitle></CardHeader>
      <CardContent>
        {isLoading ? <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div> : (
          <div className="space-y-3">
            {(data?.rows ?? []).map(f=>(
              <div key={f.id} className="border rounded-md p-3 space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex gap-2 items-center">
                    <span className="font-mono">{f.email ?? f.user_id.slice(0,8)}</span>
                    {f.is_technical && <span className="px-1.5 rounded bg-blue-100 text-blue-700">technical</span>}
                    {f.qbank_id && <span>QB {f.qbank_id}</span>}
                    {f.question_id && <span>Q #{f.question_id}</span>}
                    <span>{new Date(f.created_at).toLocaleString()}</span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={()=>{if(confirm("Delete this feedback?")) delM.mutate(f.id);}}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
                <p className="text-sm whitespace-pre-wrap">{f.message}</p>
              </div>
            ))}
            {!data?.rows.length && <div className="text-center text-muted-foreground py-8 text-sm">No feedback yet.</div>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------- Questions ----------------
function QuestionsTab() {
  const getFn = useServerFn(getQuestionForAdmin);
  const updFn = useServerFn(updateQuestion);
  const [qbankId, setQbankId] = useState("1");
  const [qid, setQid] = useState("");
  const [loaded, setLoaded] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [explanation, setExplanation] = useState("");
  const [correct, setCorrect] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!qid) return;
    try {
      const q = await getFn({ data: { qbank_id: Number(qbankId), id: Number(qid) } });
      if (!q) { toast.error("Question not found"); setLoaded(null); return; }
      setLoaded(q); setTitle(q.title ?? ""); setQuestion(q.question); setExplanation(q.explanation ?? "");
      setCorrect(q.correct_answer?.toString() ?? "");
    } catch (e) { toast.error((e as Error).message); }
  };

  const save = async () => {
    if (!loaded) return;
    setSaving(true);
    try {
      await updFn({ data: {
        qbank_id: loaded.qbank_id, id: loaded.id,
        title, question, explanation,
        correct_answer: correct === "" ? null : Number(correct),
      }});
      toast.success("Question updated");
    } catch (e) { toast.error((e as Error).message); } finally { setSaving(false); }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Pencil className="h-5 w-5" /> Edit Question</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 items-end flex-wrap">
          <div>
            <Label className="text-xs">QBank</Label>
            <select value={qbankId} onChange={(e)=>setQbankId(e.target.value)} className="border rounded h-9 px-2 text-sm block">
              {QBANK_OPTIONS.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs">Question ID</Label>
            <Input value={qid} onChange={(e)=>setQid(e.target.value)} className="w-32" placeholder="e.g. 10670" />
          </div>
          <Button onClick={load}>Load</Button>
        </div>
        {loaded && (
          <div className="space-y-3 border-t pt-4">
            <div><Label>Title</Label><Input value={title} onChange={(e)=>setTitle(e.target.value)} /></div>
            <div><Label>Question</Label><Textarea value={question} onChange={(e)=>setQuestion(e.target.value)} rows={8} /></div>
            <div><Label>Explanation</Label><Textarea value={explanation} onChange={(e)=>setExplanation(e.target.value)} rows={8} /></div>
            <div className="max-w-xs"><Label>Correct answer index</Label><Input type="number" value={correct} onChange={(e)=>setCorrect(e.target.value)} /></div>
            <Button onClick={save} disabled={saving}>{saving?"Saving…":"Save changes"}</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------- misc ----------------
function Kpi({ icon: Icon, label, value, sub, tone }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string | number; sub?: string; tone?: "amber"|"green"|"red";
}) {
  const t = tone==="amber"?"text-amber-500":tone==="green"?"text-emerald-500":tone==="red"?"text-red-500":"text-foreground";
  return (
    <Card><CardContent className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${t}`} />
      </div>
      <div className={`mt-2 text-2xl font-bold ${t}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </CardContent></Card>
  );
}
