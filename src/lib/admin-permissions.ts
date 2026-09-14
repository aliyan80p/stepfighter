/** Permission keys an admin account can be granted. Client-safe constants. */
export const ADMIN_PERMISSIONS = [
  { key: "analytics", label: "Overview & analytics", description: "View site statistics and charts" },
  { key: "users", label: "Users & access", description: "Search users, change plans and course access, delete accounts" },
  { key: "feedback", label: "Feedback", description: "Read and delete user feedback" },
  { key: "questions", label: "Questions", description: "Create, edit and delete questions and answers" },
  { key: "content", label: "Courses & library", description: "Courses, subjects, systems and library articles" },
  { key: "bulk", label: "Bulk import / export", description: "Upload question files and export questions" },
  { key: "admins", label: "Manage admins", description: "Promote accounts and set what each admin can do" },
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number]["key"];

export const ALL_ADMIN_PERMISSIONS: AdminPermission[] = ADMIN_PERMISSIONS.map((p) => p.key);

export type AdminAccess = {
  admin: boolean;
  isSuper: boolean;
  permissions: AdminPermission[];
};

export function can(access: AdminAccess | undefined, perm: AdminPermission): boolean {
  if (!access?.admin) return false;
  return access.isSuper || access.permissions.includes(perm);
}
