import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ShieldCheck, Crown } from "lucide-react";
import { listAdmins, setAdminAccess, type AdminAccountRow } from "@/lib/admin.functions";
import { ADMIN_PERMISSIONS, type AdminPermission } from "@/lib/admin-permissions";

export function AdminsManager({ canEdit }: { canEdit: boolean }) {
  const fetchAdmins = useServerFn(listAdmins);
  const saveAccess = useServerFn(setAdminAccess);
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Record<string, { is_super: boolean; permissions: string[] }>>({});

  const q = useQuery({ queryKey: ["admin-accounts"], queryFn: () => fetchAdmins() });

  const save = useMutation({
    mutationFn: (v: { userId: string; isSuper: boolean; permissions: string[] }) =>
      saveAccess({ data: v }),
    onSuccess: () => {
      toast.success("Access updated");
      qc.invalidateQueries({ queryKey: ["admin-accounts"] });
      qc.invalidateQueries({ queryKey: ["my-admin-access"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const rowState = (r: AdminAccountRow) =>
    draft[r.user_id] ?? { is_super: r.is_super, permissions: r.permissions as string[] };

  const patch = (id: string, r: AdminAccountRow, next: Partial<{ is_super: boolean; permissions: string[] }>) =>
    setDraft((d) => ({ ...d, [id]: { ...rowState(r), ...next } }));

  if (q.isLoading) return <div className="text-sm text-muted-foreground">Loading admins…</div>;
  if (q.error) return <div className="text-sm text-destructive">{(q.error as Error).message}</div>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Main admins can use every area. For other admins, tick only the areas they should be able to open.
        Promote or remove admins from the Users tab.
      </p>
      {(q.data ?? []).map((r) => {
        const s = rowState(r);
        const dirty =
          s.is_super !== r.is_super ||
          s.permissions.slice().sort().join(",") !== (r.permissions as string[]).slice().sort().join(",");
        return (
          <Card key={r.user_id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                {s.is_super ? <Crown className="h-4 w-4 text-amber-500" /> : <ShieldCheck className="h-4 w-4" />}
                {r.email ?? r.user_id}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Switch
                  checked={s.is_super}
                  disabled={!canEdit}
                  onCheckedChange={(v) => patch(r.user_id, r, { is_super: v })}
                />
                <span className="text-sm">Main admin (full access)</span>
              </div>
              {!s.is_super && (
                <div className="grid sm:grid-cols-2 gap-2">
                  {ADMIN_PERMISSIONS.map((p) => (
                    <label key={p.key} className="flex items-start gap-2 text-sm rounded-md border p-2">
                      <Checkbox
                        className="mt-0.5"
                        disabled={!canEdit}
                        checked={s.permissions.includes(p.key)}
                        onCheckedChange={(v) =>
                          patch(r.user_id, r, {
                            permissions: v
                              ? [...s.permissions, p.key]
                              : s.permissions.filter((x) => x !== (p.key as AdminPermission)),
                          })
                        }
                      />
                      <span>
                        <span className="font-medium">{p.label}</span>
                        <span className="block text-xs text-muted-foreground">{p.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
              {canEdit && (
                <Button
                  size="sm"
                  disabled={!dirty || save.isPending}
                  onClick={() =>
                    save.mutate({ userId: r.user_id, isSuper: s.is_super, permissions: s.permissions })
                  }
                >
                  Save changes
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
      {(q.data ?? []).length === 0 && (
        <div className="text-sm text-muted-foreground">No admin accounts yet.</div>
      )}
    </div>
  );
}
