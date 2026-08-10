"use client";

import { useCallback, useSyncExternalStore } from "react";
import { Toaster } from "sonner";

/**
 * Sonner's theme="system" reads prefers-color-scheme only, so choosing Dark
 * from the profile menu on a light-OS device left every toast rendering as a
 * white card over the dark app — the same class of bug as the `dark:` variant
 * fix in globals.css. This watches the class the theme toggle actually sets
 * and hands sonner a resolved value.
 *
 * useSyncExternalStore rather than useEffect + setState: the theme class is
 * external state that already exists before React mounts (layout.tsx sets it
 * in a blocking script to avoid a flash), so subscribing to it is the honest
 * description of what is happening.
 */
const subscribe = (onChange: () => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onChange);

  return () => {
    observer.disconnect();
    media.removeEventListener("change", onChange);
  };
};

const getSnapshot = (): "light" | "dark" => {
  const root = document.documentElement;
  if (root.classList.contains("dark")) return "dark";
  if (root.classList.contains("light")) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

export function AppToaster() {
  // The server has no window, and the theme class is only known in the
  // browser, so the server snapshot is the neutral default.
  const getServerSnapshot = useCallback((): "light" | "dark" => "light", []);
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <Toaster
      position="top-center"
      theme={theme}
      style={{ zIndex: 45 }}
      toastOptions={{ className: "border-foreground/10 rounded-2xl" }}
    />
  );
}
