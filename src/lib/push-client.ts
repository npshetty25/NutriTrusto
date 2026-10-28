import { supabase } from "@/lib/supabase";

/**
 * The browser side of reminders while the app is closed. Offered only where it
 * can work: a browser with Web Push, a configured public key, and (checked by
 * the caller) the push_subscriptions table. On an iPhone it works only for the
 * app added to the Home Screen, iOS 16.4 or later; elsewhere the permission
 * prompt is simply unavailable and the switch is not shown.
 */
export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export const pushSupported = () =>
  typeof window !== "undefined" &&
  !!VAPID_PUBLIC_KEY &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

/** The key as the bytes the Push API wants. */
export function keyToBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const padded = base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const b64 = (buf: ArrayBuffer | null) =>
  buf ? btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : "";

/** Whether this browser is already subscribed. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export type EnableResult = "enabled" | "denied" | "unsupported" | "failed";

/** Asks permission (this must come from a tap), subscribes, and stores the subscription for this account. */
export async function enableReminders(userId: string): Promise<EnableResult> {
  if (!pushSupported()) return "unsupported";
  try {
    if ((await Notification.requestPermission()) !== "granted") return "denied";
    const reg = await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(VAPID_PUBLIC_KEY) }));
    const { error } = await supabase.from("push_subscriptions").upsert(
      { user_id: userId, endpoint: sub.endpoint, p256dh: b64(sub.getKey("p256dh")), auth: b64(sub.getKey("auth")) },
      { onConflict: "endpoint" }
    );
    if (error) {
      await sub.unsubscribe();
      return "failed";
    }
    return "enabled";
  } catch {
    return "failed";
  }
}

export async function disableReminders(): Promise<boolean> {
  try {
    const sub = await currentSubscription();
    if (!sub) return true;
    const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
    return !error;
  } catch {
    return false;
  }
}
