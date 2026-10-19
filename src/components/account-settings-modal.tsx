"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Settings, Loader2, Check, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth-context";
import { CONTACT_EMAIL } from "@/lib/contact";
import {
  PASSWORD_MIN_LENGTH,
  friendlyAuthError,
  normaliseEmail,
  validateEmail,
  validateName,
  validateNewPassword,
} from "@/lib/auth-validation";

interface AccountSettingsModalProps {
  onClose: () => void;
}

type FieldKey = "name" | "email" | "password";

/** A labelled field with its own input, validation, and Save button — one
 * field saves at a time, so a mistake in the password box can't accidentally
 * also submit a half-typed name. */
function Field({
  label,
  help,
  children,
  onSave,
  canSave,
  saving,
  saved,
  error,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
  onSave: () => void;
  canSave: boolean;
  saving: boolean;
  saved: boolean;
  error: string | null;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-semibold uppercase tracking-widest text-foreground/50">{label}</label>
        {saved && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-safe-strong">
            <Check size={11} /> Saved
          </span>
        )}
      </div>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">{children}</div>
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave || saving}
          className="min-h-11 px-4 shrink-0 rounded-xl bg-foreground text-background text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity flex items-center justify-center"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : "Save"}
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      {help && !error && <p className="text-[11px] text-foreground/45 leading-relaxed">{help}</p>}
    </div>
  );
}

export function AccountSettingsModal({ onClose }: AccountSettingsModalProps) {
  const { user } = useAuth();
  const currentName = String(user?.user_metadata?.full_name || "");
  const currentEmail = user?.email || "";
  // Supabase's own identities array says what this account can sign in with;
  // a session cached before it existed falls back to app_metadata.provider.
  // A password means nothing on a Google-only account, so that UI is hidden
  // rather than shown and left to fail.
  const hasEmailIdentity = user?.identities
    ? user.identities.some((i) => i.provider === "email")
    : user?.app_metadata?.provider !== "google";

  const [name, setName] = useState(currentName);
  const [email, setEmail] = useState(currentEmail);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [saving, setSaving] = useState<FieldKey | null>(null);
  const [saved, setSaved] = useState<FieldKey | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<FieldKey, string | null>>({ name: null, email: null, password: null });

  const [deleteRequested, setDeleteRequested] = useState(false);

  const markSaved = (field: FieldKey) => {
    setSaved(field);
    setTimeout(() => setSaved((f) => (f === field ? null : f)), 1500);
  };

  const saveName = async () => {
    const problem = validateName(name);
    setFieldErrors((e) => ({ ...e, name: problem }));
    if (problem) return;
    setSaving("name");
    const { error } = await supabase.auth.updateUser({ data: { full_name: name.trim() } });
    setSaving(null);
    if (error) {
      setFieldErrors((e) => ({ ...e, name: friendlyAuthError(error.message) }));
      return;
    }
    markSaved("name");
  };

  const saveEmail = async () => {
    const problem = validateEmail(email);
    setFieldErrors((e) => ({ ...e, email: problem }));
    if (problem) return;
    const clean = normaliseEmail(email);
    if (clean === currentEmail.toLowerCase()) return;
    setSaving("email");
    const { error } = await supabase.auth.updateUser({ email: clean });
    setSaving(null);
    if (error) {
      setFieldErrors((e) => ({ ...e, email: friendlyAuthError(error.message) }));
      return;
    }
    markSaved("email");
  };

  const savePassword = async () => {
    const problem = validateNewPassword(password) ?? (password !== confirmPassword ? "Those two passwords don't match." : null);
    setFieldErrors((e) => ({ ...e, password: problem }));
    if (problem) return;
    setSaving("password");
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(null);
    if (error) {
      setFieldErrors((e) => ({ ...e, password: friendlyAuthError(error.message) }));
      return;
    }
    setPassword("");
    setConfirmPassword("");
    markSaved("password");
  };

  const inputClass =
    "w-full min-h-11 bg-background border border-border rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-1 focus:ring-foreground/20";

  return createPortal(
    <div className="fixed inset-0 z-70 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="neu-panel w-full max-w-sm rounded-3xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Settings size={16} className="text-foreground/60" />
            <h3 className="font-bold text-sm tracking-tight">Account Settings</h3>
          </div>
          <button
            onClick={onClose}
            title="Close account settings"
            aria-label="Close account settings"
            className="w-11 h-11 flex items-center justify-center rounded-full bg-foreground/10 hover:bg-foreground/20 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-4 space-y-5 overflow-y-auto">
          <Field
            label="Display Name"
            onSave={() => { void saveName(); }}
            canSave={name.trim() !== currentName.trim()}
            saving={saving === "name"}
            saved={saved === "name"}
            error={fieldErrors.name}
          >
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setFieldErrors((er) => ({ ...er, name: null })); }}
              placeholder="Your name"
              maxLength={50}
              className={inputClass}
            />
          </Field>

          {hasEmailIdentity ? (
            <Field
              label="Email Address"
              help="We'll send a confirmation link to the new address — it only changes once you click it."
              onSave={() => { void saveEmail(); }}
              canSave={normaliseEmail(email) !== currentEmail.toLowerCase()}
              saving={saving === "email"}
              saved={saved === "email"}
              error={fieldErrors.email}
            >
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setFieldErrors((er) => ({ ...er, email: null })); }}
                placeholder="name@example.com"
                className={inputClass}
              />
            </Field>
          ) : (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-foreground/50">Email Address</p>
              <p className="text-sm text-foreground/70">{currentEmail}</p>
              <p className="text-[11px] text-foreground/45">Managed by your Google account.</p>
            </div>
          )}

          {hasEmailIdentity && (
            <Field
              label="New Password"
              help={`At least ${PASSWORD_MIN_LENGTH} characters, with a letter and a number.`}
              onSave={() => { void savePassword(); }}
              canSave={password.length > 0 && confirmPassword.length > 0}
              saving={saving === "password"}
              saved={saved === "password"}
              error={fieldErrors.password}
            >
              <div className="space-y-2">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setFieldErrors((er) => ({ ...er, password: null })); }}
                  placeholder="New password"
                  autoComplete="new-password"
                  className={inputClass}
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setFieldErrors((er) => ({ ...er, password: null })); }}
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  className={inputClass}
                />
              </div>
            </Field>
          )}

          <div className="pt-3 border-t border-border space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-danger">Danger Zone</p>
            {deleteRequested ? (
              <p className="text-xs text-foreground/60 leading-relaxed">
                Opened an email to {CONTACT_EMAIL}. Send it and we&apos;ll delete your account and data —
                see the Privacy Policy for what that covers.
              </p>
            ) : (
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Account deletion request")}&body=${encodeURIComponent(
                  `Please delete my Nutri-Trust account and all its data.\n\nAccount email: ${currentEmail}`
                )}`}
                onClick={() => setDeleteRequested(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-danger/30 text-danger text-sm font-semibold hover:bg-danger/5 transition-all"
              >
                <Trash2 size={14} />
                Request Account Deletion
              </a>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
