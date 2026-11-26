import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle2, Eye, EyeOff, LoaderCircle, LockKeyhole } from "lucide-react";
import logoAsset from "@/assets/stepfighter-logo.png.asset.json";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — StepFighter" },
      { name: "description", content: "Set a new password for your StepFighter account." },
      { property: "og:title", content: "Reset password — StepFighter" },
      { property: "og:description", content: "Set a new password for your StepFighter account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

const USED_LINKS_KEY = "sf_used_recovery_links";

function hashToken(token: string) {
  let h = 5381;
  for (let i = 0; i < token.length; i += 1) h = ((h << 5) + h + token.charCodeAt(i)) | 0;
  return `r${(h >>> 0).toString(36)}`;
}

function readUsedLinks(): string[] {
  try {
    const raw = window.localStorage.getItem(USED_LINKS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function isLinkUsed(id: string | null) {
  if (!id) return false;
  return readUsedLinks().includes(id);
}

function markLinkUsed(id: string | null) {
  if (!id) return;
  try {
    const next = Array.from(new Set([...readUsedLinks(), id])).slice(-25);
    window.localStorage.setItem(USED_LINKS_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — server-side single-use still applies */
  }
}

function ResetPasswordPage() {
  const [status, setStatus] = useState<"checking" | "ready" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const settledRef = useRef(false);
  const linkIdRef = useRef<string | null>(null);
  const navigate = useNavigate();


  useEffect(() => {
    let cancelled = false;
    let recoveryEventReceived = false;
    let resolveRecoveryEvent: (() => void) | undefined;
    const recoveryEvent = new Promise<void>((resolve) => {
      resolveRecoveryEvent = resolve;
    });

    const markReady = () => {
      if (cancelled || settledRef.current) return;
      settledRef.current = true;
      setStatus("ready");
      resolveRecoveryEvent?.();
    };

    // Subscribe before processing the URL so an early PASSWORD_RECOVERY event
    // cannot be missed while the auth client hydrates its session.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // PKCE (?code=) emits SIGNED_IN, implicit hash emits PASSWORD_RECOVERY.
      if (event !== "PASSWORD_RECOVERY" && !(event === "SIGNED_IN" && session)) return;
      if (isLinkUsed(linkIdRef.current)) return;
      recoveryEventReceived = true;
      markReady();
    });

    const processRecoveryLink = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const tokenHash = url.searchParams.get("token_hash");
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const linkError = url.searchParams.get("error_description") ?? hash.get("error_description");
      const linkToken = code ?? tokenHash ?? accessToken;
      linkIdRef.current = linkToken ? hashToken(linkToken) : null;

      try {
        if (linkError) throw new Error(linkError);
        // A recovery link is single-use: once a password has been set with it,
        // re-opening the same link must not reopen the reset form.
        if (isLinkUsed(linkIdRef.current)) throw new Error("Recovery link already used");


        let sessionEstablished = false;
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          sessionEstablished = Boolean(data.session);
        } else if (tokenHash) {
          const { data, error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
          if (error) throw error;
          sessionEstablished = Boolean(data.session);
        } else if (accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          sessionEstablished = Boolean(data.session);
        } else {
          // The auth client may already be consuming an implicit recovery hash.
          // Wait only for the authoritative recovery event; never show an error
          // and then reverse it into the password form.
          await Promise.race([
            recoveryEvent,
            new Promise<void>((resolve) => window.setTimeout(resolve, 5000)),
          ]);
          sessionEstablished = recoveryEventReceived || settledRef.current;
        }

        if (sessionEstablished) {
          markReady();
          window.history.replaceState({}, document.title, "/reset-password");
          return;
        }
      } catch {
        // A genuine exchange/verification failure is handled below.
      }

      if (cancelled || settledRef.current) return;

      // The auth client redeems the link itself (detectSessionInUrl), so our
      // manual exchange can lose the race and fail on an already-used code.
      // Only declare the link dead when no recovery session actually exists.
      if (!isLinkUsed(linkIdRef.current)) {
        try {
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            markReady();
            window.history.replaceState({}, document.title, "/reset-password");
            return;
          }
        } catch {
          /* fall through to the invalid state */
        }
      }

      if (!cancelled && !settledRef.current) {
        settledRef.current = true;
        setStatus("invalid");
      }
    };

    void processRecoveryLink();
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);


  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (password !== confirm) return toast.error("Passwords do not match");
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      markLinkUsed(linkIdRef.current);
      settledRef.current = true;
      toast.success("Password updated — signing you in.");

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

    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex flex-col items-center gap-2">
          <img src={logoAsset.url} alt="StepFighter" className="h-14 w-14 object-contain" />
          <span className="text-lg font-bold text-primary">StepFighter</span>
        </Link>
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="h-1 bg-primary" />
          <div className="p-6 sm:p-8">
          {status === "checking" ? (
            <div className="py-8 text-center" aria-live="polite">
              <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-primary" />
              <h1 className="mt-5 text-xl font-semibold">Securing your reset link</h1>
              <p className="mt-2 text-sm text-muted-foreground">Please wait while we verify your recovery session.</p>
            </div>
          ) : status === "invalid" ? (
            <div className="py-4 text-center" aria-live="polite">
              <LockKeyhole className="mx-auto h-9 w-9 text-muted-foreground" />
              <h1 className="mt-4 text-xl font-semibold">Reset link expired</h1>
              <p className="mt-2 text-sm text-muted-foreground">This reset link is invalid or has expired. Request a fresh link to continue.</p>
              <Button asChild className="mt-6 w-full">
                <Link to="/auth" search={{ mode: "forgot" }}>Request a new reset link</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="mb-6 text-center">
                <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-primary/10">
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                </span>
                <h1 className="mt-4 text-xl font-semibold">Set a new password</h1>
                <p className="mt-1 text-sm text-muted-foreground">Choose a secure password with at least 8 characters.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pw">New password</Label>
                <div className="relative">
                  <Input
                    id="pw"
                    type={showPassword ? "text" : "password"}
                    minLength={8}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
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
                {password.length > 0 && password.length < 8 && (
                  <p className="text-xs text-muted-foreground">
                    {8 - password.length} more character{8 - password.length === 1 ? "" : "s"} needed
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pw2">Confirm password</Label>
                <div className="relative">
                  <Input
                    id="pw2"
                    type={showConfirm ? "text" : "password"}
                    minLength={8}
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                    aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirm.length > 0 && confirm !== password && (
                  <p className="text-xs text-destructive">Passwords do not match</p>
                )}
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={loading || password.length < 8 || password !== confirm}
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <LoaderCircle className="h-4 w-4 animate-spin" /> Updating…
                  </span>
                ) : (
                  "Update password"
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
