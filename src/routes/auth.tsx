import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { z } from "zod";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — StepFighter" },
      { name: "description", content: "Sign in to StepFighter or start your 8-day free trial." },
    ],
  }),
  validateSearch: z.object({ mode: z.enum(["signin", "signup"]).optional() }),
  component: AuthPage,
});

const QBANK_OPTIONS = [
  { slug: "step1", label: "USMLE Step 1" },
  { slug: "step2", label: "USMLE Step 2 CK" },
  { slug: "step3", label: "USMLE Step 3" },
];

function AuthPage() {
  const { mode: initialMode } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">(initialMode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState("");
  const [selectedQbanks, setSelectedQbanks] = useState<string[]>(["step2"]);
  const [loading, setLoading] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [verifySent, setVerifySent] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const toggleQbank = (slug: string) =>
    setSelectedQbanks((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        if (!fullName.trim()) throw new Error("Please enter your full name");
        if (selectedQbanks.length === 0) throw new Error("Select at least one QBank");
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: fullName.trim(),
              display_name: fullName.trim().split(" ")[0],
              country: country.trim() || null,
              selected_qbanks: selectedQbanks,
            },
          },
        });
        if (error) throw error;
        // If confirmation required, no session is returned
        if (!data.session) {
          setVerifySent(email);
        } else {
          toast.success("Account created");
          navigate({ to: "/dashboard" });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };


  const sendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return toast.error("Enter your email first");
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Reset link sent — check your email.");
      setForgot(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reset email");
    } finally {
      setLoading(false);
    }
  };

  if (verifySent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 grid place-items-center mb-4">
            <CheckCircle2 className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold">Check your inbox</h1>
          <p className="mt-2 text-muted-foreground">
            We sent a verification link to <span className="font-medium text-foreground">{verifySent}</span>.
            Click it to activate your account and start your 8-day free trial.
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            Didn't arrive? Check spam, or{" "}
            <button
              onClick={() => { setVerifySent(null); setMode("signup"); }}
              className="underline hover:text-foreground"
            >
              try a different email
            </button>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        <Link to="/" className="block text-center mb-6">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold">SF</span>
        </Link>
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-xl font-semibold">
            {forgot ? "Reset password" : mode === "signup" ? "Start your free trial" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {forgot
              ? "We'll email you a link to set a new password."
              : mode === "signup"
              ? "8 days free. No card required."
              : "Sign in to continue."}
          </p>

          {!forgot && (
            <>
              <Button type="button" variant="outline" className="w-full mt-5" onClick={google} disabled={loading}>
                Continue with Google
              </Button>
              <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
                <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
              </div>
            </>
          )}

          {forgot ? (
            <form onSubmit={sendResetEmail} className="space-y-3 mt-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>Send reset link</Button>
              <button type="button" className="w-full text-sm text-muted-foreground hover:text-foreground" onClick={() => setForgot(false)}>
                Back to sign in
              </button>
            </form>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              {mode === "signup" && (
                <div>
                  <Label htmlFor="name">Full name</Label>
                  <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
                </div>
              )}
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
                {mode === "signup" && (
                  <p className="mt-1 text-xs text-muted-foreground">At least 8 characters. Common leaked passwords are blocked.</p>
                )}
              </div>

              {mode === "signup" && (
                <>
                  <div>
                    <Label htmlFor="country">Country</Label>
                    <Input id="country" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. Pakistan" />
                  </div>
                  <div>
                    <Label>Choose your QBank(s)</Label>
                    <div className="mt-1.5 grid gap-2">
                      {QBANK_OPTIONS.map((q) => {
                        const on = selectedQbanks.includes(q.slug);
                        return (
                          <label
                            key={q.slug}
                            className={`flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer text-sm transition-colors ${
                              on ? "border-primary bg-primary/5" : "border-input hover:border-primary/40"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={() => toggleQbank(q.slug)}
                              className="h-4 w-4 accent-current"
                            />
                            <span className="flex-1">{q.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
              </Button>

              {mode === "signin" && (
                <button
                  type="button"
                  className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
                  onClick={() => setForgot(true)}
                >
                  Forgot password?
                </button>
              )}
            </form>
          )}

          {!forgot && (
            <button
              type="button"
              className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            >
              {mode === "signup" ? "Have an account? Sign in" : "New here? Start your free trial"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
