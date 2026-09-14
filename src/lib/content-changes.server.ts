/**
 * Change log for admin content edits.
 *
 * Every edit an admin makes to shared content (questions, library articles,
 * images, subjects, topics, courses) is written here as a pending change so it
 * can later be reviewed and pushed to the live site in one click.
 *
 * Recording must never break the edit itself: failures are swallowed.
 */

export type ChangeEntity =
  | "question"
  | "library"
  | "media"
  | "subject"
  | "system"
  | "topic"
  | "course";

export type ChangeInput = {
  entity: ChangeEntity;
  qbank_id?: number | null;
  ref_id?: number | null;
  ref_key?: string | null;
  action?: "upsert" | "delete";
  label?: string | null;
  changed_by?: string | null;
};

export async function recordChange(supabaseAdmin: any, input: ChangeInput) {
  try {
    await supabaseAdmin.from("content_changes").insert({
      entity: input.entity,
      qbank_id: input.qbank_id ?? null,
      ref_id: input.ref_id ?? null,
      ref_key: input.ref_key ?? null,
      action: input.action ?? "upsert",
      label: input.label ?? null,
      changed_by: input.changed_by ?? null,
    });
  } catch {
    // Logging a change must never fail the edit.
  }
}

export async function recordChanges(supabaseAdmin: any, inputs: ChangeInput[]) {
  if (!inputs.length) return;
  try {
    await supabaseAdmin.from("content_changes").insert(
      inputs.map((input) => ({
        entity: input.entity,
        qbank_id: input.qbank_id ?? null,
        ref_id: input.ref_id ?? null,
        ref_key: input.ref_key ?? null,
        action: input.action ?? "upsert",
        label: input.label ?? null,
        changed_by: input.changed_by ?? null,
      })),
    );
  } catch {
    // Logging a change must never fail the edit.
  }
}
