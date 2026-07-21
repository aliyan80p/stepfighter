import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminAnalytics, isCurrentUserAdmin } from "@/lib/admin.functions";
import { Users, TrendingUp, CreditCard, Clock, ShieldAlert, Activity } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminDashboard,
});

const COLORS = ["#f59e0b", "#3b82f6", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#a3a3a3"];

function AdminDashboard() {
  const navigate = useNavigate();
  const checkAdmin = useServerFn(isCurrentUserAdmin);
  const fetchAnalytics = useServerFn(getAdminAnalytics);

  const adminQ = useQuery({ queryKey: ["is-admin"], queryFn: () => checkAdmin() });
  const isAdmin = adminQ.data?.admin;

  useEffect(() => {
    if (adminQ.isSuccess && !isAdmin) navigate({ to: "/dashboard" });
  }, [adminQ.isSuccess, isAdmin, navigate]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: () => fetchAnalytics(),
    enabled: !!isAdmin,
  });

  if (adminQ.isLoading) {
    return <div className="p-8 text-muted-foreground text-sm">Checking access…</div>;
  }
  if (adminQ.isSuccess && !isAdmin) {
    return (
      <div className="p-8 max-w-md">
        <div className="flex items-center gap-2 text-destructive font-semibold mb-2">
          <ShieldAlert className="h-5 w-5" /> Not authorized
        </div>
        <p className="text-sm text-muted-foreground">This dashboard is restricted to admins.</p>
      </div>
    );
  }

  if (isLoading) return <div className="p-8 text-muted-foreground text-sm">Loading analytics…</div>;
  if (error) return <div className="p-8 text-destructive text-sm">Failed to load: {(error as Error).message}</div>;
  if (!data) return null;

  const k = data.kpis;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Admin Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">Signups, trials, conversions, and QBank usage.</p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Kpi icon={Users} label="Total Users" value={k.totalUsers} />
        <Kpi icon={TrendingUp} label="Signups (7d)" value={k.signups7d} sub={`${k.signups30d} in 30d`} />
        <Kpi icon={Clock} label="Active Trials" value={k.activeTrials} tone="amber" />
        <Kpi icon={CreditCard} label="Paid" value={k.paid} tone="green" />
        <Kpi icon={ShieldAlert} label="Expired" value={k.expired} tone="red" />
        <Kpi
          icon={TrendingUp}
          label="Conversion"
          value={`${(k.conversionRate * 100).toFixed(1)}%`}
          sub="paid / (paid+expired)"
        />
        <Kpi icon={Activity} label="Attempts (7d)" value={k.attempts7d.toLocaleString()} />
        <Kpi icon={Activity} label="Tests (7d)" value={k.tests7d} />
      </div>

      {/* Signups over time */}
      <Card>
        <CardHeader><CardTitle>Signups — last 30 days</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.signupsByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Line type="monotone" dataKey="count" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Attempts by QBank */}
      <Card>
        <CardHeader><CardTitle>Attempts by QBank — last 30 days</CardTitle></CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.attemptsByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Legend />
              <Bar dataKey="step1" stackId="a" fill="#3b82f6" name="Step 1" />
              <Bar dataKey="step2" stackId="a" fill="#f59e0b" name="Step 2 CK" />
              <Bar dataKey="step3" stackId="a" fill="#10b981" name="Step 3" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* QBank access + Countries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>QBank access — trial vs paid</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.qbankAccess}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="qbank" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Legend />
                <Bar dataKey="trial" fill="#f59e0b" name="Trial" />
                <Bar dataKey="paid" fill="#10b981" name="Paid" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Top countries</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.countries} dataKey="count" nameKey="country" outerRadius={90} label={{ fontSize: 11 }}>
                  {data.countries.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  tone?: "amber" | "green" | "red";
}) {
  const toneClass =
    tone === "amber" ? "text-amber-500" : tone === "green" ? "text-emerald-500" : tone === "red" ? "text-red-500" : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
          <Icon className={`h-4 w-4 ${toneClass}`} />
        </div>
        <div className={`mt-2 text-2xl font-bold ${toneClass}`}>{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}
