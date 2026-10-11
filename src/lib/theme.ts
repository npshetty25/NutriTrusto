export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "theme";

export const getStoredTheme = (): ThemePreference => {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
};

export const applyTheme = (theme: ThemePreference) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  if (theme !== "system") root.classList.add(theme);
};

const listeners = new Set<() => void>();

/**
 * Subscription for useSyncExternalStore, so a component can read the stored
 * preference without a setState-in-effect after hydration. Notifies on this
 * tab's own setTheme() and on another tab changing localStorage.
 */
export const subscribeTheme = (onChange: () => void) => {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) onChange();
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
};

export const setTheme = (theme: ThemePreference) => {
  if (typeof window === "undefined") return;
  if (theme === "system") {
    window.localStorage.removeItem(STORAGE_KEY);
  } else {
    window.localStorage.setItem(STORAGE_KEY, theme);
  }
  applyTheme(theme);
  listeners.forEach((notify) => notify());
};

// Inlined into a <script> tag in layout.tsx so the correct theme class
// is applied before first paint (no flash of the wrong theme).
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');var r=document.documentElement;if(t==='light'||t==='dark'){r.classList.add(t);}}catch(e){}})();`;
