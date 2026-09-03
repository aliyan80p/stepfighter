import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — StepFighter" },
      { name: "description", content: "Set a new password for your StepFighter account." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [status, setStatus] = useState<"checking" | "ready" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Recovery links arrive in three shapes depending on project settings:
    //  - hash tokens (#access_token=...)  -> picked up automatically by the client
    //  - PKCE code (?code=...)            -> needs exchangeCodeForSession
    //  - token_hash (?token_hash=...)     -> needs verifyOtp
    let cancelled = false;
    const check = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const tokenHash = url.searchParams.get("token_hash");
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const hasHashTokens = !!hash.get("access_token");
      try {
        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        } else if (tokenHash) {
          await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
        }
      } catch {
        // fall through: session check below decides what the user sees
      }
      // Hash-token links are consumed asynchronously by the client; poll briefly
      // so a valid link never flashes the "invalid" state.
      const deadline = Date.now() + (hasHashTokens ? 6000 : 2500);
      while (!cancelled) {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          if (!cancelled) setStatus("ready");
          return;
        }
        if (Date.now() > deadline) break;
        await new Promise((r) => setTimeout(r, 250));
      }
      if (!cancelled) setStatus("invalid");
    };
    check();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setStatus("ready");
    });
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
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated — signing you in.");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="block text-center mb-6">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold">SF</span>
        </Link>
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-xl font-semibold">
            {status === "ready" ? "Set a new password" : "Reset your password"}
          </h1>
          {status === "checking" ? (
            <p className="mt-4 text-sm text-muted-foreground">Verifying your reset link…</p>
          ) : status === "invalid" ? (
            <p className="mt-4 text-sm text-muted-foreground">
              This link is invalid or has expired. Request a new one from the{" "}
              <Link to="/auth" className="underline hover:text-foreground">sign-in page</Link>.
            </p>
          ) : (

            <form onSubmit={submit} className="space-y-3 mt-4">
              <div>
                <Label htmlFor="pw">New password</Label>
                <Input id="pw" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
              </div>
              <div>
                <Label htmlFor="pw2">Confirm password</Label>
                <Input id="pw2" type="password" minLength={8} required value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Updating…" : "Update password"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
