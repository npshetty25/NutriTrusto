/**
 * Checks run on the login form before anything is sent to Supabase.
 *
 * These make mistakes visible early and keep junk out of the sign-up form.
 * They are NOT the security boundary: a script can call Supabase directly, so
 * the real rules (email confirmation, minimum password length) must also be
 * switched on in the Supabase dashboard.
 */

export const PASSWORD_MIN_LENGTH = 8;
const NAME_MAX_LENGTH = 50;

// Practical, not RFC-complete: something@something.tld, no spaces, a 2+ letter
// top-level domain. Rejects "a@b", "a@b.c", "a b@c.com".
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i;

// Letters from any script (so Hindi or Tamil names work), spaces, and . ' -
const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u;

export const normaliseEmail = (email: string) => email.trim().toLowerCase();

export function validateEmail(email: string): string | null {
  const value = normaliseEmail(email);
  if (!value) return "Enter your email address.";
  if (!EMAIL_PATTERN.test(value)) return "That doesn't look like a valid email address.";
  return null;
}

export function validateName(name: string): string | null {
  const value = name.trim();
  if (!value) return "Please enter your name.";
  if (value.length < 2) return "Your name needs at least 2 letters.";
  if (value.length > NAME_MAX_LENGTH) return `Please keep your name under ${NAME_MAX_LENGTH} characters.`;
  if (!NAME_PATTERN.test(value)) return "Your name can only contain letters, spaces, and . ' -";
  return null;
}

/** Rules for a NEW password. Signing in only checks that one was typed. */
export function validateNewPassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Use at least one letter and one number.";
  if (/^\s|\s$/.test(password)) return "Your password can't start or end with a space.";
  return null;
}

/** Supabase's error messages, reworded for people. Unknown ones pass through. */
export function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("email not confirmed")) return "Please confirm your email first. Check your inbox for the link.";
  if (m.includes("invalid login credentials")) return "Wrong email or password.";
  if (m.includes("already registered") || m.includes("already been registered") || m.includes("user already exists"))
    return "An account with this email already exists. Sign in instead.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many attempts. Please wait a minute and try again.";
  if (m.includes("password should be")) return message; // Supabase's own password policy, already readable
  return message;
}
