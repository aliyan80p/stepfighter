import { createFileRoute, useNavigate, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { z } from "zod";
import { AlertCircle, CheckCircle2, Eye, EyeOff, LoaderCircle, Mail } from "lucide-react";
import logoAsset from "@/assets/stepfighter-logo.png.asset.json";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    const { data: prof } = await supabase
      .from("profiles")
      .select("mfa_verified_until")
      .eq("id", data.session.user.id)
      .maybeSingle();
    const until = prof?.mfa_verified_until ? new Date(prof.mfa_verified_until).getTime() : 0;
    throw redirect({ to: until > Date.now() ? "/dashboard" : "/verify-2fa" });
  },
  head: () => ({
    meta: [
      { title: "Sign in — StepFighter" },
      { name: "description", content: "Sign in to StepFighter or start your 8-day free trial." },
    ],
  }),
  validateSearch: z.object({ mode: z.enum(["signin", "signup", "forgot"]).optional() }),
  component: AuthPage,
});

const QBANK_OPTIONS = [
  { slug: "step1", label: "USMLE Step 1" },
  { slug: "step2", label: "USMLE Step 2 CK" },
  { slug: "step3", label: "USMLE Step 3" },
];

function AuthPage() {
  const { mode: initialMode } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">(initialMode === "signup" ? "signup" : "signin");
  const [forgot, setForgot] = useState(initialMode === "forgot");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState("");
  const [selectedQbanks, setSelectedQbanks] = useState<string[]>(["step2"]);
  // Signup allows exactly one course; more can be added later from the dashboard.
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [verifySent, setVerifySent] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (initialMode === "forgot") {
      setForgot(true);
    } else if (initialMode === "signup" || initialMode === "signin") {
      setForgot(false);
      setMode(initialMode);
    }
  }, [initialMode]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const selectQbank = (slug: string) => setSelectedQbanks([slug]);

  const switchMode = (next: "signin" | "signup") => {
    setMode(next);
    setForgot(false);
    setFormError(null);
    setUnconfirmedEmail(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setUnconfirmedEmail(null);
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setFormError("Please enter your email address.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        if (!fullName.trim()) throw new Error("Please enter your full name");
        if (password.length < 8) throw new Error("Password must be at least 8 characters");
        if (selectedQbanks.length === 0) throw new Error("Select at least one QBank");
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
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
          setVerifySent(cleanEmail);
          setResendCooldown(60);
        } else {
          toast.success("Account created");
          navigate({ to: "/dashboard" });
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (error) throw error;

        // Check MFA verification status BEFORE navigating so already-verified users
        // go straight to /dashboard without flashing the 2FA verification screen.
        let mfaVerified = false;
        if (data.user) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("mfa_verified_until")
            .eq("id", data.user.id)
            .maybeSingle();
          const until = prof?.mfa_verified_until ? new Date(prof.mfa_verified_until).getTime() : 0;
          mfaVerified = until > Date.now();
        }
        navigate({ to: mfaVerified ? "/dashboard" : "/verify-2fa" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setFormError(msg);
      if (/email not confirmed/i.test(msg)) {
        setUnconfirmedEmail(cleanEmail);
      }
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const resendConfirmation = async (targetEmail: string) => {
    if (resending || resendCooldown > 0) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: targetEmail,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      setResendCooldown(60);
      toast.success("Confirmation email resent — check your inbox.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not resend confirmation email");
    } finally {
      setResending(false);
    }
  };

  const sendResetEmail = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setFormError("Enter your email first.");
      toast.error("Enter your email first");
      return;
    }
    setFormError(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setResetSent(cleanEmail);
      setResendCooldown(60);
      toast.success("Reset link sent — check your email.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not send reset email";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (verifySent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-6 flex flex-col items-center gap-2">
            <img src={logoAsset.url} alt="StepFighter" className="h-14 w-14 object-contain" />
            <span className="text-lg font-bold text-primary">StepFighter</span>
          </Link>
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="h-1 bg-primary" />
            <div className="p-6 sm:p-8 text-center">
              <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 grid place-items-center mb-4">
                <CheckCircle2 className="h-7 w-7 text-primary" />
              </div>
              <h1 className="text-2xl font-semibold">Check your inbox</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                We sent a verification link to{" "}
                <span className="font-medium text-foreground">{verifySent}</span>. Click it to
                activate your account and start your 8-day free trial.
              </p>
              <div className="mt-6 space-y-2.5">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={resending || resendCooldown > 0}
                  onClick={() => resendConfirmation(verifySent)}
                >
                  {resendCooldown > 0
                    ? `Resend link in ${resendCooldown}s`
                    : resending
                    ? "Sending…"
                    : "Resend verification email"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setVerifySent(null);
                    switchMode("signin");
                  }}
                >
                  Back to sign in
                </Button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Wrong email?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setVerifySent(null);
                    switchMode("signup");
                  }}
                  className="underline hover:text-foreground"
                >
                  Try a different address
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (resetSent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-6 flex flex-col items-center gap-2">
            <img src={logoAsset.url} alt="StepFighter" className="h-14 w-14 object-contain" />
            <span className="text-lg font-bold text-primary">StepFighter</span>
          </Link>
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="h-1 bg-primary" />
            <div className="p-6 sm:p-8 text-center">
              <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 grid place-items-center mb-4">
                <Mail className="h-7 w-7 text-primary" />
              </div>
              <h1 className="text-2xl font-semibold">Reset link sent</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                If an account exists for{" "}
                <span className="font-medium text-foreground">{resetSent}</span>, you'll receive a
                password reset link shortly. Check your spam folder if it doesn't appear.
              </p>
              <div className="mt-6 space-y-2.5">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={loading || resendCooldown > 0}
                  onClick={() => sendResetEmail()}
                >
                  {resendCooldown > 0
                    ? `Resend link in ${resendCooldown}s`
                    : loading
                    ? "Sending…"
                    : "Resend reset link"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setResetSent(null);
                    setForgot(false);
                    setFormError(null);
                  }}
                >
                  Back to sign in
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        <Link to="/" className="flex flex-col items-center mb-6 gap-2">
          <img src={logoAsset.url} alt="StepFighter" className="h-14 w-14 object-contain" />
          <span className="text-lg font-bold text-primary">StepFighter</span>
        </Link>

        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="h-1 bg-primary" />
          <div className="p-6 sm:p-8">
            {!forgot && (
              <div className="mb-5 grid grid-cols-2 rounded-lg bg-muted p-1 text-sm">
                <button
                  type="button"
                  onClick={() => switchMode("signin")}
                  className={`rounded-md py-1.5 font-medium transition-colors ${
                    mode === "signin"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("signup")}
                  className={`rounded-md py-1.5 font-medium transition-colors ${
                    mode === "signup"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Create account
                </button>
              </div>
            )}

            <h1 className="text-xl font-semibold">
              {forgot ? "Reset password" : mode === "signup" ? "Start your free trial" : "Welcome back"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {forgot
                ? "Enter your account email and we'll send you a link to set a new password."
                : mode === "signup"
                ? "8 days free. No card required."
                : "Sign in to continue your USMLE prep."}
            </p>

            {formError && (
              <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs text-destructive space-y-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
                {unconfirmedEmail && (
                  <button
                    type="button"
                    disabled={resending || resendCooldown > 0}
                    onClick={() => resendConfirmation(unconfirmedEmail)}
                    className="ml-6 font-medium underline hover:no-underline disabled:opacity-50"
                  >
                    {resendCooldown > 0
                      ? `Resend confirmation in ${resendCooldown}s`
                      : resending
                      ? "Sending…"
                      : "Resend confirmation email"}
                  </button>
                )}
              </div>
            )}

            {forgot ? (
              <form onSubmit={sendResetEmail} className="space-y-4 mt-5">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    placeholder="you@example.com"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <LoaderCircle className="h-4 w-4 animate-spin" /> Sending…
                    </span>
                  ) : (
                    "Send reset link"
                  )}
                </Button>
                <button
                  type="button"
                  className="w-full text-sm text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setForgot(false);
                    setFormError(null);
                  }}
                >
                  Back to sign in
                </button>
              </form>
            ) : (
              <form onSubmit={submit} className="space-y-4 mt-5">
                {mode === "signup" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Full name</Label>
                    <Input
                      id="name"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      autoComplete="name"
                      placeholder="Dr. Sarah Khan"
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    placeholder="you@example.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    {mode === "signin" && (
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() => {
                          setForgot(true);
                          setFormError(null);
                        }}
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {mode === "signup" && (
                    <p className="text-xs text-muted-foreground">
                      At least 8 characters. Common leaked passwords are blocked.
                    </p>
                  )}
                </div>

                {mode === "signup" && (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="country">Country (optional)</Label>
                      <Input
                        id="country"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        placeholder="e.g. Pakistan"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Choose your QBank</Label>
                      <p className="text-xs text-muted-foreground">
                        Pick one to start. You can add more courses later from your dashboard.
                      </p>
                      <div className="grid gap-2 pt-0.5">
                        {QBANK_OPTIONS.map((q) => {
                          const on = selectedQbanks[0] === q.slug;
                          return (
                            <label
                              key={q.slug}
                              className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer text-sm transition-colors ${
                                on
                                  ? "border-primary bg-primary/5 font-medium"
                                  : "border-input hover:border-primary/40"
                              }`}
                            >
                              <input
                                type="radio"
                                name="qbank"
                                checked={on}
                                onChange={() => selectQbank(q.slug)}
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
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      {mode === "signup" ? "Creating account…" : "Signing in…"}
                    </span>
                  ) : mode === "signup" ? (
                    "Create account"
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
