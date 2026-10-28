"use client";

import { useEffect, useState } from "react";
import { Loader2, BellRing } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth-context";
import { currentSubscription, disableReminders, enableReminders, pushSupported } from "@/lib/push-client";

type State = "checking" | "off" | "on" | "unavailable";

/**
 * "Remind me even when the app is closed". Renders nothing where it cannot work:
 * no Web Push in this browser, no public key configured, or the push table not
 * created yet. On an iPhone it needs the app added to the Home Screen first.
 */
export function ClosedAppReminders() {
  const { user } = useAuth();
  const supported = pushSupported();
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!supported || !user) return;
    let cancelled = false;
    (async () => {
      const table = await supabase.from("push_subscriptions").select("id").limit(1);
      if (cancelled) return;
      if (table.error) return setState("unavailable");
      const sub = await currentSubscription();
      if (!cancelled) setState(sub ? "on" : "off");
    })();
    return () => { cancelled = true; };
  }, [supported, user]);

  if (!supported || !user || state === "unavailable") return null;

  const turnOn = async () => {
    setBusy(true);
    setMessage(null);
    const result = await enableReminders(user.id);
    setBusy(false);
    if (result === "enabled") setState("on");
    else if (result === "denied") setMessage("Notifications are blocked for this site. Allow them in your browser's settings, then try again.");
    else setMessage("Couldn't turn that on. Please try again.");
  };

  const turnOff = async () => {
    setBusy(true);
    setMessage(null);
    const ok = await disableReminders();
    setBusy(false);
    if (ok) setState("off");
    else setMessage("Couldn't turn that off. Please try again.");
  };

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-foreground/50 mb-2">When the app is closed</p>
      <p className="text-xs text-foreground/60 leading-relaxed mb-2">
        A message each morning about what needs eating that day, even if the app isn&apos;t open. Only on this device.
      </p>
      <button
        type="button"
        onClick={() => { void (state === "on" ? turnOff() : turnOn()); }}
        disabled={busy || state === "checking"}
        aria-pressed={state === "on"}
        className={`w-full min-h-11 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60 ${
          state === "on" ? "bg-foreground text-background" : "neu-raised-sm text-foreground/80"
        }`}
      >
        {busy || state === "checking" ? <Loader2 size={14} className="animate-spin" /> : <BellRing size={14} />}
        {state === "on" ? "On for this device" : "Remind me on this device"}
      </button>
      {message && <p role="alert" className="mt-1.5 text-[11px] text-danger-strong">{message}</p>}
    </div>
  );
}
