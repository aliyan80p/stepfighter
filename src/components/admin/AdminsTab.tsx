import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ShieldCheck, Trash2, UserPlus } from "lucide-react";
import {
  ADMIN_PERMISSIONS, ADMIN_PERMISSION_LABELS, listAdmins, grantAdminAccess, revokeAdminAccess,
  listQbanks, type AdminPermission, type AdminAccessRow,
} from "@/lib/admin-content.functions";

type Course = { id: number; name: string };

export function AdminsTab({ isSuper }: { isSuper: boolean }) {
  const listFn = useServerFn(listAdmins);
  const grantFn = useServerFn(grantAdminAccess);
  const revokeFn = useServerFn(revokeAdminAccess);
  const qbanksFn = useServerFn(listQbanks);

  const q = useQuery({ queryKey: ["admin-admins"], queryFn: () => listFn() });
  const coursesQ = useQuery({ queryKey: ["admin-qbanks"], queryFn: () => qbanksFn() });
  const courses: Course[] = coursesQ.data?.rows ?? [];

  const [email, setEmail] = useState("");
  const [newPerms, setNewPerms] = useState<AdminPermission[]>(["analytics"]);
  const [newScope, setNewScope] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

  const toggle = (list: AdminPermission[], p: AdminPermission) =>
    list.includes(p) ? list.filter((x) => x !== p) : [...list, p];

  const add = async () => {
    setBusy(true);
    try {
      await grantFn({ data: { email, isSuper: false, permissions: newPerms, qbankScope: newScope } });
      toast.success("Sub-admin added");
      setEmail("");
      q.refetch();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  const savePerms = async (row: AdminAccessRow, perms: AdminPermission[], scope: number[]) => {
    try {
      await grantFn({
        data: { userId: row.user_id, isSuper: row.is_super, permissions: perms, qbankScope: scope },
      });
      toast.success("Access updated");
      q.refetch();
    } catch (e) { toast.error((e as Error).message); }
  };

  const remove = async (row: AdminAccessRow) => {
    if (!confirm(`Remove all admin access for ${row.email ?? row.user_id}?`)) return;
    try {
      await revokeFn({ data: { userId: row.user_id } });
      toast.success("Access removed");
      q.refetch();
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" /> Add a sub-admin</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[240px]">
              <Label className="text-xs">Account email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="person@example.com" />
            </div>
            <Button onClick={add} disabled={busy || !email.trim()}>
              {busy ? "Adding…" : "Give access"}
            </Button>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {ADMIN_PERMISSIONS.map((p) => (
              <label key={p} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={newPerms.includes(p)}
                  onCheckedChange={() => setNewPerms((cur) => toggle(cur, p))}
                />
                {ADMIN_PERMISSION_LABELS[p]}
              </label>
            ))}
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Courses they may work on</Label>
            <div className="flex flex-wrap gap-3">
              {courses.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={newScope.includes(c.id)}
                    onCheckedChange={() =>
                      setNewScope((cur) =>
                        cur.includes(c.id) ? cur.filter((x) => x !== c.id) : [...cur, c.id],
                      )
                    }
                  />
                  {c.name}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Leave all unticked to allow every course.
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            The person must already have an account. They only see the sections you tick.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Current admins</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {q.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
          {(q.data?.rows ?? []).map((row) => (
            <AdminRow
              key={row.user_id}
              row={row}
              courses={courses}
              canEdit={isSuper || !row.is_super}
              onSave={savePerms}
              onRemove={remove}
            />
          ))}
          {!q.isLoading && !q.data?.rows.length && (
            <div className="text-sm text-muted-foreground">No admins yet.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AdminRow({
  row, courses, canEdit, onSave, onRemove,
}: {
  row: AdminAccessRow;
  courses: Course[];
  canEdit: boolean;
  onSave: (row: AdminAccessRow, perms: AdminPermission[], scope: number[]) => void;
  onRemove: (row: AdminAccessRow) => void;
}) {
  const [perms, setPerms] = useState<AdminPermission[]>(row.permissions);
  const [scope, setScope] = useState<number[]>(row.qbank_scope ?? []);
  const sorted = (a: (string | number)[]) => JSON.stringify([...a].sort());
  const dirty =
    sorted(perms) !== sorted(row.permissions) || sorted(scope) !== sorted(row.qbank_scope ?? []);

  return (
    <div className="border rounded-md p-3 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <div className="text-sm font-medium">{row.email ?? row.user_id}</div>
          <div className="text-xs text-muted-foreground">
            {row.is_super ? "Full access (super admin)" : "Sub-admin"}
          </div>
        </div>
        {canEdit && (
          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onRemove(row)}>
            <Trash2 className="h-4 w-4 mr-1" /> Remove
          </Button>
        )}
      </div>

      {!row.is_super && (
        <>
          <div className="grid sm:grid-cols-2 gap-2">
            {ADMIN_PERMISSIONS.map((p) => (
              <label key={p} className="flex items-center gap-2 text-sm">
                <Checkbox
                  disabled={!canEdit}
                  checked={perms.includes(p)}
                  onCheckedChange={() =>
                    setPerms((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]))
                  }
                />
                {ADMIN_PERMISSION_LABELS[p]}
              </label>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 pt-1">
            {courses.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  disabled={!canEdit}
                  checked={scope.includes(c.id)}
                  onCheckedChange={() =>
                    setScope((cur) =>
                      cur.includes(c.id) ? cur.filter((x) => x !== c.id) : [...cur, c.id],
                    )
                  }
                />
                {c.name}
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {scope.length ? "Limited to the ticked courses." : "Every course."}
          </p>

          {dirty && canEdit && (
            <Button size="sm" onClick={() => onSave(row, perms, scope)}>Save access</Button>
          )}
        </>
      )}
    </div>
  );
}
