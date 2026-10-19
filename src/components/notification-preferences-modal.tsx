"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Bell, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth-context";

interface NotificationPreferencesModalProps {
  onClose: () => void;
}

/** 1, 2, 3, 5 or 7 days before the app's own estimate runs out. */
export const DAYS_BEFORE_OPTIONS = [1, 2, 3, 5, 7] as const;
export const DEFAULT_NOTIFY_DAYS_BEFORE = 3;

/**
 * What these actually control: the in-app "Expiry Reminder" toast fired from
 * the expiry-nudge effect in page.tsx. There is no email or push channel in
 * this app, so this does not pretend to offer one — it is honestly scoped to
 * the one real notification the app sends, and lets the user turn it off or
 * change how many days of warning it gives.
 *
 * Stored on the auth user (same place dietary_preference already lives),
 * not a profile table — page.tsx reads it straight off `user.user_metadata`.
 */
export function NotificationPreferencesModal({ onClose }: NotificationPreferencesModalProps) {
  const { user } = useAuth();
  const enabled = (user?.user_metadata?.notifications_enabled as boolean | undefined) ?? true;
  const daysBefore = Number(user?.user_metadata?.notify_days_before ?? DEFAULT_NOTIFY_DAYS_BEFORE);

  const [savingField, setSavingField] = useState<"enabled" | "days" | null>(null);
  const [savedField, setSavedField] = useState<"enabled" | "days" | null>(null);
  const [error, setError] = useState(false);

  const save = async (field: "enabled" | "days", data: Record<string, unknown>) => {
    setSavingField(field);
    setError(false);
    const { error: updateError } = await supabase.auth.updateUser({ data });
    setSavingField(null);
    if (updateError) {
      setError(true);
      return;
    }
    setSavedField(field);
    setTimeout(() => setSavedField((f) => (f === field ? null : f)), 1500);
  };

  const setEnabled = (next: boolean) => {
    if (next === enabled || savingField) return;
    void save("enabled", { notifications_enabled: next });
  };

  const setDaysBefore = (next: number) => {
    if (next === daysBefore || savingField) return;
    void save("days", { notify_days_before: next });
  };

  return createPortal(
    <div className="fixed inset-0 z-70 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="neu-panel w-full max-w-sm rounded-3xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-foreground/60" />
            <h3 className="font-bold text-sm tracking-tight">Notification Preferences</h3>
          </div>
          <button
            onClick={onClose}
            title="Close notification preferences"
            aria-label="Close notification preferences"
            className="w-11 h-11 flex items-center justify-center rounded-full bg-foreground/10 hover:bg-foreground/20 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-4 space-y-5">
          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2">
              <p className="text-xs text-red-500">Couldn&apos;t save that. Please try again.</p>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-foreground/50">Expiry Reminders</p>
              {savedField === "enabled" && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-safe-strong">
                  <Check size={11} /> Saved
                </span>
              )}
            </div>
            <p className="text-xs text-foreground/60 leading-relaxed mb-2">
              An on-screen alert when something in your pantry is about to pass its estimate.
            </p>
            <div role="group" aria-label="Expiry reminders" className="flex items-center gap-1 bg-foreground/5 p-1 rounded-full border border-border/50">
              {([true, false] as const).map((value) => (
                <button
                  key={String(value)}
                  type="button"
                  onClick={() => setEnabled(value)}
                  aria-pressed={enabled === value}
                  disabled={savingField === "enabled"}
                  className={`flex-1 min-h-11 flex items-center justify-center rounded-full text-xs font-bold transition-all disabled:opacity-60 ${
                    enabled === value ? "bg-card text-foreground shadow-sm" : "text-foreground/50 hover:text-foreground/80"
                  }`}
                >
                  {value ? "On" : "Off"}
                </button>
              ))}
            </div>
          </div>

          <div className={enabled ? "" : "opacity-50 pointer-events-none"}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-foreground/50">Remind Me</p>
              {savedField === "days" && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-safe-strong">
                  <Check size={11} /> Saved
                </span>
              )}
            </div>
            <p className="text-xs text-foreground/60 leading-relaxed mb-2">
              How many days before an item&apos;s estimated expiry to warn you.
            </p>
            <div role="group" aria-label="Days before expiry to remind me" className="flex items-center gap-1 bg-foreground/5 p-1 rounded-full border border-border/50">
              {DAYS_BEFORE_OPTIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDaysBefore(d)}
                  aria-pressed={daysBefore === d}
                  disabled={!enabled || savingField === "days"}
                  className={`flex-1 min-h-11 flex items-center justify-center rounded-full text-xs font-bold transition-all disabled:opacity-60 ${
                    daysBefore === d ? "bg-card text-foreground shadow-sm" : "text-foreground/50 hover:text-foreground/80"
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-foreground/45 leading-relaxed">
            This app only ever reminds you inside the app itself — there is no email or push
            notification to turn on.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
