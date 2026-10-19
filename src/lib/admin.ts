/**
 * Whether the signed-in user counts as an admin for UI purposes only — right
 * now, that means seeing the "Add Demo Data" button.
 *
 * This is NOT a security boundary. It is a client-side `NEXT_PUBLIC_*` value,
 * so it is visible to anyone who opens devtools, and "Add Demo Data" only
 * ever inserts rows the signed-in user already owns (ordinary
 * pantry_items writes, gated by the same row-level security as everything
 * else). Hiding the button for everyone but the project owner keeps it out
 * of a stranger's way; it does not — and does not need to — stop them from
 * calling the same insert by hand.
 */
export function isAdminEmail(email: string | null | undefined, adminEmailsEnv: string | undefined): boolean {
  if (!email || !adminEmailsEnv) return false;
  const target = email.trim().toLowerCase();
  if (!target) return false;
  return adminEmailsEnv
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(target);
}
