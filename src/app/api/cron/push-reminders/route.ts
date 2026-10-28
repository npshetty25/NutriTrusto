import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { createRequestContext } from "@/lib/server-logger";
import { runReminders, type PushSub, type ReminderSender, type ReminderStore } from "@/lib/push-job";
import type { ReminderRow } from "@/lib/push-reminder";

/**
 * The morning reminder job, called once a day by Vercel Cron (vercel.json).
 *
 * It needs five values in Vercel's environment and will not run without all of
 * them, so deploying this file changes nothing until they are set:
 *   CRON_SECRET                 Vercel sends it as a bearer token to cron calls
 *   SUPABASE_SERVICE_ROLE_KEY   reads every account's pantry; never in the repo
 *   VAPID_PRIVATE_KEY           signs the push messages
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_SUBJECT (a mailto: address)
 */
const need = () => ({
  cron: process.env.CRON_SECRET,
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  service: process.env.SUPABASE_SERVICE_ROLE_KEY,
  vapidPrivate: process.env.VAPID_PRIVATE_KEY,
  vapidPublic: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  subject: process.env.VAPID_SUBJECT,
});

function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  const log = createRequestContext("api/cron/push-reminders");
  const env = need();

  // Not configured is not an error to retry: say so, and do nothing.
  if (!env.cron || !env.url || !env.service || !env.vapidPrivate || !env.vapidPublic || !env.subject) {
    log.warn("Reminders are not configured");
    return NextResponse.json({ success: false, error: "Reminders are not configured" }, { status: 503 });
  }

  const header = req.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token || !sameSecret(token, env.cron)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const db = createClient(env.url, env.service, { auth: { persistSession: false, autoRefreshToken: false } });
  webpush.setVapidDetails(env.subject, env.vapidPublic, env.vapidPrivate);

  const store: ReminderStore = {
    async dueSubscriptions(today) {
      const { data, error } = await db
        .from("push_subscriptions")
        .select("id, user_id, endpoint, p256dh, auth")
        .or(`last_sent_on.is.null,last_sent_on.lt.${today}`);
      if (error) throw error;
      return (data ?? []) as PushSub[];
    },
    async prefsFor(userId) {
      const { data, error } = await db.auth.admin.getUserById(userId);
      if (error) throw error;
      const m = data.user?.user_metadata ?? {};
      return {
        notifications_enabled: m.notifications_enabled as boolean | undefined,
        notify_days_before: m.notify_days_before as number | undefined,
        dietary_preference: m.dietary_preference as string | undefined,
      };
    },
    async pantryFor(userId) {
      const members = await db.from("household_members").select("household_id").eq("user_id", userId);
      if (members.error) throw members.error;
      const households = (members.data ?? []).map((m) => m.household_id as string);
      const filter = households.length ? `user_id.eq.${userId},household_id.in.(${households.join(",")})` : `user_id.eq.${userId}`;
      const { data, error } = await db.from("pantry_items").select("*").or(filter);
      if (error) throw error;
      return (data ?? []) as ReminderRow[];
    },
    async markSent(ids, today) {
      await db.from("push_subscriptions").update({ last_sent_on: today }).in("id", ids);
    },
    async remove(ids) {
      await db.from("push_subscriptions").delete().in("id", ids);
    },
  };

  const sender: ReminderSender = {
    async send(sub, reminder) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(reminder),
          { TTL: 6 * 60 * 60 }
        );
        return "ok";
      } catch (error) {
        const status = (error as { statusCode?: number })?.statusCode;
        return status === 404 || status === 410 ? "gone" : "error";
      }
    },
  };

  try {
    const summary = await runReminders(store, sender);
    log.info("Reminders sent", { ...summary });
    return NextResponse.json({ success: true, ...summary });
  } catch (error) {
    log.error("Reminder job failed", { message: error instanceof Error ? error.message : "Unknown" });
    return NextResponse.json({ success: false, error: "The reminder job failed" }, { status: 500 });
  }
}
