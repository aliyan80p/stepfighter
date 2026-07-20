import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/confirm-dialog";
import { QBANKS, useActiveQbankId } from "@/lib/active-qbank";
import { resetQbank } from "@/lib/qbank.functions";

export const Route = createFileRoute("/_authenticated/account/reset")({
  component: ResetPage,
});

function ResetPage() {
  const activeId = useActiveQbankId();
  const course = QBANKS.find((q) => q.id === activeId) ?? QBANKS[1];
  const resetFn = useServerFn(resetQbank);
  const { confirm, dialog } = useConfirm();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const onReset = async () => {
    const ok = await confirm({
      title: `Reset ${course.name}?`,
      description: (
        <>
          This will <strong>permanently delete</strong> all of your progress for{" "}
          <strong>{course.name}</strong>: every answer attempt, every saved test
          (created, completed, or suspended), and every flagged question in this
          course.
          <br />
          <br />
          Progress in your other courses will <strong>not</strong> be affected.
          This action cannot be undone.
        </>
      ),
      confirmLabel: "Reset QBank",
      cancelLabel: "Cancel",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await resetFn({ data: { qbankId: course.id } });
      await qc.invalidateQueries();
      toast.success(`${course.name} has been reset`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Reset QBank</h1>
          <p className="text-sm text-muted-foreground">
            Clear your attempts, tests, and flags for a single course.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
          <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="text-sm">
              Reset only affects the <strong>currently active course</strong>.
              Switch courses from the top nav to reset a different one.
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">
                Active course
              </div>
              <div className="text-lg font-semibold">{course.name}</div>
            </div>
            <Button
              onClick={onReset}
              disabled={busy}
              className="bg-gradient-to-r from-rose-500 to-red-600 hover:opacity-90 text-white shadow"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              {busy ? "Resetting…" : `Reset ${course.name}`}
            </Button>
          </div>
        </div>
      </div>
      {dialog}
    </div>
  );
}
