"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth-context";
import { PASSWORD_MIN_LENGTH, friendlyAuthError, validateNewPassword } from "@/lib/auth-validation";

/** Where a password-reset email lands: the link has signed the person in, so all that is left is the new password. */
export default function ResetPasswordPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validateNewPassword(password) ?? (password !== confirm ? "Those two passwords don't match." : null);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) {
      setError(friendlyAuthError(updateError.message));
      return;
    }
    toast("Password changed", { description: "You're signed in with your new password." });
    router.replace("/");
  };

  const inputClass = "neu-field w-full rounded-xl px-4 py-3.5 text-base text-foreground placeholder:text-foreground/35";
  const labelClass = "text-[12px] font-semibold uppercase tracking-widest text-foreground/60";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground px-4 py-8">
      <div className="neu-raised w-full max-w-md rounded-[2rem] p-8">
        <div className="flex flex-col items-center text-center mb-6">
          <Image src="/logo.svg" alt="" width={48} height={48} className="h-12 w-12 object-contain mb-3" />
          <h1 className="text-2xl font-bold tracking-tight">Choose a new password</h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 size={22} className="animate-spin text-foreground/40" />
          </div>
        ) : !user ? (
          <div className="text-center space-y-5">
            <p className="text-sm text-foreground/70 leading-relaxed">
              This reset link has expired or has already been used. Ask for a new one from the sign-in page.
            </p>
            <Link
              href="/login"
              className="neu-pressable w-full min-h-12 inline-flex items-center justify-center rounded-xl font-bold text-foreground"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4" noValidate>
            <p className="text-sm text-foreground/65 text-center">
              For <strong className="text-foreground">{user.email}</strong>
            </p>

            <div className="space-y-2">
              <label htmlFor="new-password" className={labelClass}>New password</label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(null); }}
                  className={`${inputClass} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-1 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center text-foreground/50 hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-xs text-foreground/55">At least {PASSWORD_MIN_LENGTH} characters, with a letter and a number.</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="confirm-password" className={labelClass}>Type it again</label>
              <input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => { setConfirm(e.target.value); setError(null); }}
                className={inputClass}
              />
            </div>

            {error && (
              <p role="alert" className="text-xs font-medium text-danger bg-danger/10 border border-danger/20 rounded-xl px-4 py-3">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full min-h-12 bg-foreground text-background font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              Save new password
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
