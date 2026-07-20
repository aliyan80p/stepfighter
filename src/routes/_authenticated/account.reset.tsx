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
        <div className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-full bg-orange-500 text-white flex items-center justify-center shadow">
            <RotateCcw className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold text-rose-600">Reset Options</h1>
          <p className="text-sm text-muted-foreground">
            Clear your data and start fresh. Please proceed with caution.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
          <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-900">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="text-sm">
              <strong>Warning:</strong> This action cannot be undone.
            </div>
          </div>

          <ul className="list-disc pl-5 space-y-2 text-sm rounded-lg bg-muted/40 p-4">
            <li>
              Resetting will <strong>DELETE ALL</strong> data for{" "}
              <strong>{course.name}</strong>: attempts, tests (created, completed,
              or suspended), and flagged questions.
            </li>
            <li className="text-rose-600 font-medium">
              Progress in your other courses will not be affected.
            </li>
          </ul>

          <div className="flex justify-center pt-2">
            <Button
              onClick={onReset}
              disabled={busy}
              className="bg-gradient-to-r from-rose-500 to-red-600 hover:opacity-90 text-white shadow px-8"
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
