"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { getStoredTheme, setTheme, type ThemePreference } from "@/lib/theme";

const OPTIONS: { id: ThemePreference; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Light", icon: Sun },
  { id: "system", label: "System", icon: Monitor },
  { id: "dark", label: "Dark", icon: Moon },
];

export function ThemeToggle() {
  const [active, setActive] = useState<ThemePreference>("system");

  useEffect(() => {
    setActive(getStoredTheme());
  }, []);

  const handleSelect = (theme: ThemePreference) => {
    setActive(theme);
    setTheme(theme);
  };

  return (
    <div className="px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-foreground/50 mb-2">Appearance</p>
      <div className="flex items-center gap-1 bg-foreground/5 p-1 rounded-full border border-border/50">
        {OPTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => handleSelect(id)}
            title={label}
            aria-label={`${label} theme`}
            aria-pressed={active === id}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-full text-[11px] font-bold transition-all ${
              active === id ? "bg-card text-foreground shadow-sm" : "text-foreground/50 hover:text-foreground/80"
            }`}
          >
            <Icon size={12} /> {label}
          </button>
        ))}
      </div>
    </div>
  );
}
