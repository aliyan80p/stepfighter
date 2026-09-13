import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { requestLoginOtp, verifyLoginOtp, getMfaStatus } from "@/lib/mfa.functions";
import logoAsset from "@/assets/stepfighter-logo.png.asset.json";
import { isLovablePreviewHost } from "@/lib/preview-host";

export const Route = createFileRoute("/verify-2fa")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    // Lovable test site cannot deliver the code email — go straight in.
    if (isLovablePreviewHost()) throw redirect({ to: "/dashboard" });
  },
  head: () => ({ meta: [{ title: "Verify sign-in — StepFighter" }] }),
  component: Verify2FA,
});

function Verify2FA() {
  const navigate = useNavigate();
  const requestFn = useServerFn(requestLoginOtp);
  const verifyFn = useServerFn(verifyLoginOtp);
  const statusFn = useServerFn(getMfaStatus);

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [masked, setMasked] = useState<string | null>(null);
  const sentOnce = useRef(false);

  // On mount: if already verified, skip. Otherwise send a code once.
  useEffect(() => {
    (async () => {
      try {
        const s = await statusFn();
        if (s.verified) {
          navigate({ to: "/dashboard" });
          return;
        }
      } catch { /* fall through and send */ }
      if (!sentOnce.current) {
        sentOnce.current = true;
        await sendCode(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode(silent = false) {
    setSending(true);
    try {
      const r = await requestFn();
      setMasked(r.maskedEmail);
      setCooldown(60);
      if (!silent) toast.success("New code sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send code");
    } finally {
      setSending(false);
    }
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return;
    setLoading(true);
    try {
      const r = await verifyFn({ data: { code } });
      if (r.ok) {
        toast.success("Verified");
        navigate({ to: "/dashboard" });
      } else {
        toast.error(r.error + (r.remaining ? ` ${r.remaining} attempt(s) left.` : ""));
        setCode("");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
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
          <span className="text-[#1a4b7c] font-bold text-lg">StepFighter</span>
        </div>
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 grid place-items-center mb-4">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-semibold text-center">Two-factor verification</h1>
          <p className="mt-2 text-sm text-muted-foreground text-center">
            We sent a 6-digit code to {masked ? <span className="font-medium text-foreground">{masked}</span> : "your email"}.
            Enter it below to continue.
          </p>

          <form onSubmit={onVerify} className="mt-6 space-y-4">
            <Input
              autoFocus
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="text-center text-2xl tracking-[0.5em] font-mono"
              placeholder="••••••"
            />
            <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
              {loading ? "Verifying…" : "Verify & continue"}
            </Button>
          </form>

          <div className="mt-4 flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => sendCode(false)}
              disabled={sending || cooldown > 0}
              className="text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : sending ? "Sending…" : "Resend code"}
            </button>
            <button type="button" onClick={signOut} className="text-muted-foreground hover:text-foreground">
              Sign out
            </button>
          </div>

          <p className="mt-6 text-xs text-muted-foreground text-center">
            Code expires in 10 minutes. Verification lasts 12 hours per device.
          </p>
        </div>
      </div>
    </div>
  );
}
