import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { AlertCircle, LoaderCircle, MailCheck, ShieldCheck } from "lucide-react";
import { requestLoginOtp, verifyLoginOtp } from "@/lib/mfa.functions";
import logoAsset from "@/assets/stepfighter-logo.png.asset.json";

export const Route = createFileRoute("/verify-2fa")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });

    // Skip the 2FA screen completely if the account is already verified — prevents
    // flashing the verification prompt and auto-redirecting a couple seconds later.
    const { data: prof } = await supabase
      .from("profiles")
      .select("mfa_verified_until")
      .eq("id", data.user.id)
      .maybeSingle();
    const until = prof?.mfa_verified_until ? new Date(prof.mfa_verified_until).getTime() : 0;
    if (until > Date.now()) {
      throw redirect({ to: "/dashboard" });
    }
  },
  head: () => ({ meta: [{ title: "Verify sign-in — StepFighter" }] }),
  component: Verify2FA,
});

function Verify2FA() {
  const navigate = useNavigate();
  const requestFn = useServerFn(requestLoginOtp);
  const verifyFn = useServerFn(verifyLoginOtp);

  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<"sending" | "ready">("sending");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [masked, setMasked] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const sentOnce = useRef(false);
  const verifyingRef = useRef(false);

  // Send the 6-digit code once on mount (beforeLoad already guaranteed MFA is needed).
  useEffect(() => {
    if (sentOnce.current) return;
    sentOnce.current = true;
    void sendCode(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode(silent = false) {
    setSending(true);
    setSendError(null);
    try {
      const r = await requestFn();
      setMasked(r.maskedEmail);
      setCooldown(60);
      setPhase("ready");
      if (!silent) toast.success("New verification code sent");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not send code";
      setSendError(msg);
      // Extract remaining cooldown seconds if server rate-limited a recent code
      const waitMatch = msg.match(/wait\s+(\d+)s/i);
      if (waitMatch) {
        setCooldown(Number(waitMatch[1]));
      }
      setPhase("ready");
      if (!silent) toast.error(msg);
    } finally {
      setSending(false);
    }
  }

  async function submitCode(rawCode: string) {
    const clean = rawCode.replace(/\D/g, "").slice(0, 6);
    if (clean.length !== 6 || verifyingRef.current) return;
    verifyingRef.current = true;
    setLoading(true);
    setVerifyError(null);
    try {
      const r = await verifyFn({ data: { code: clean } });
      if (r.ok) {
        toast.success("Sign-in verified");
        navigate({ to: "/dashboard" });
      } else {
        const msg = r.error + (r.remaining ? ` ${r.remaining} attempt(s) left.` : "");
        setVerifyError(msg);
        toast.error(msg);
        setCode("");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Verification failed";
      setVerifyError(msg);
      toast.error(msg);
    } finally {
      verifyingRef.current = false;
      setLoading(false);
    }
  }

  function onCodeChange(val: string) {
    const clean = val.replace(/\D/g, "").slice(0, 6);
    setCode(clean);
    if (verifyError) setVerifyError(null);
    if (clean.length === 6) {
      void submitCode(clean);
    }
  }

  function onVerify(e: React.FormEvent) {
    e.preventDefault();
    void submitCode(code);
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6 gap-2">
          <img src={logoAsset.url} alt="StepFighter" className="h-14 w-14 object-contain" />
          <span className="text-lg font-bold text-primary">StepFighter</span>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="h-1 bg-primary" />
          <div className="p-6 sm:p-8">
            {phase === "sending" ? (
              <div className="py-8 text-center" aria-live="polite">
                <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-primary" />
                <h1 className="mt-4 text-xl font-semibold">Sending verification code</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Preparing a one-time 6-digit code for your email…
                </p>
              </div>
            ) : (
              <>
                <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 grid place-items-center mb-4">
                  {masked ? (
                    <MailCheck className="h-6 w-6 text-primary" />
                  ) : (
                    <ShieldCheck className="h-6 w-6 text-primary" />
                  )}
                </div>
                <h1 className="text-xl font-semibold text-center">Two-factor verification</h1>
                <p className="mt-2 text-sm text-muted-foreground text-center">
                  {masked ? (
                    <>
                      We sent a 6-digit code to{" "}
                      <span className="font-medium text-foreground">{masked}</span>. Enter it below to continue.
                    </>
                  ) : (
                    "Enter the 6-digit verification code sent to your email to continue."
                  )}
                </p>

                {sendError && (
                  <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-200">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{sendError}</span>
                  </div>
                )}

                {verifyError && (
                  <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{verifyError}</span>
                  </div>
                )}

                <form onSubmit={onVerify} className="mt-6 space-y-4">
                  <Input
                    autoFocus
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="\d{6}"
                    maxLength={6}
                    value={code}
                    disabled={loading}
                    onChange={(e) => onCodeChange(e.target.value)}
                    className="h-12 text-center text-2xl tracking-[0.5em] font-mono"
                    placeholder="••••••"
                    aria-label="6-digit verification code"
                  />
                  <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
                    {loading ? (
                      <span className="inline-flex items-center gap-2">
                        <LoaderCircle className="h-4 w-4 animate-spin" /> Verifying…
                      </span>
                    ) : (
                      "Verify & continue"
                    )}
                  </Button>
                </form>

                <div className="mt-4 flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => sendCode(false)}
                    disabled={sending || cooldown > 0}
                    className="text-primary hover:underline disabled:opacity-50 disabled:no-underline"
                  >
                    {cooldown > 0 ? `Resend in ${cooldown}s` : sending ? "Sending…" : "Resend code"}
                  </button>
                  <button
                    type="button"
                    onClick={signOut}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Use another account
                  </button>
                </div>

                <p className="mt-6 text-xs text-muted-foreground text-center">
                  Code expires in 10 minutes. You stay verified until you sign out.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
