"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/** Fired by the service-worker script in layout.tsx once a new version has taken over. */
export const UPDATE_READY_EVENT = "nutri-trust-update-ready";

/** Offers a new version with a Reload button; by itself the page reloads only after a minute away. */
export function UpdateReadyToast() {
  useEffect(() => {
    const show = () =>
      toast("A new version is ready", {
        id: "update-ready",
        description: "Reload when you're done, or it updates the next time you come back.",
        duration: Infinity,
        action: { label: "Reload", onClick: () => window.location.reload() },
      });
    if ((window as { __nutriTrustUpdateReady?: boolean }).__nutriTrustUpdateReady) show();
    window.addEventListener(UPDATE_READY_EVENT, show);
    return () => window.removeEventListener(UPDATE_READY_EVENT, show);
  }, []);
  return null;
}
