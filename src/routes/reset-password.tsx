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
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase places tokens in the URL hash when the user arrives from the reset email.
    // The client picks them up automatically and creates a recovery session.
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      setReady(!!data.session);
    };
    check();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    return () => sub.subscription.unsubscribe();
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
          <h1 className="text-xl font-semibold">Reset your password</h1>
          {!ready ? (
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
