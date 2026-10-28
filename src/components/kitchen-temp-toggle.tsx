"use client";

import { useState } from "react";
import { Snowflake, Thermometer, Sun, Loader2, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth-context";
import { asKitchenTemp, KITCHEN_COUNTER_C, type KitchenTemp } from "@/lib/temperature";

const OPTIONS: { id: KitchenTemp; label: string; hint: string; icon: typeof Sun }[] = [
  { id: "cool", label: "Cool", hint: `AC on or winter, about ${KITCHEN_COUNTER_C.cool} °C`, icon: Snowflake },
  { id: "normal", label: "Normal", hint: `A typical kitchen, ${KITCHEN_COUNTER_C.normal} °C`, icon: Thermometer },
  { id: "hot", label: "Hot", hint: `Summer without AC, about ${KITCHEN_COUNTER_C.hot} °C`, icon: Sun },
];

/** How warm the kitchen counter is. Applies to items added from now on; fridge and freezer ignore it. */
export function KitchenTempToggle() {
  const { user } = useAuth();
  const current = asKitchenTemp(user?.user_metadata?.kitchen_temp);
  const [saving, setSaving] = useState<KitchenTemp | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);

  const choose = async (value: KitchenTemp) => {
    if (value === current || saving) return;
    setSaving(value);
    setError(false);
    const { error: updateError } = await supabase.auth.updateUser({ data: { kitchen_temp: value } });
    setSaving(null);
    if (updateError) {
      setError(true);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="px-3 py-2">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-foreground/50">Kitchen</p>
        {saved && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-safe-strong">
            <Check size={11} /> Saved
          </span>
        )}
      </div>
      <div role="group" aria-label="Kitchen temperature" className="flex items-center gap-1 bg-foreground/5 p-1 rounded-full border border-border/50">
        {OPTIONS.map(({ id, label, hint, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => { void choose(id); }}
            disabled={saving !== null}
            title={hint}
            aria-pressed={current === id}
            className={`flex-1 min-h-11 flex items-center justify-center gap-1.5 py-1.5 rounded-full text-[11px] font-bold transition-all disabled:opacity-60 ${
              current === id ? "bg-card text-foreground shadow-sm" : "text-foreground/50 hover:text-foreground/80"
            }`}
          >
            {saving === id ? <Loader2 size={12} className="animate-spin" /> : <Icon size={12} />}
            {label}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] leading-relaxed text-foreground/45">For things kept out of the fridge. Applies to items you add from now on.</p>
      {error && <p className="mt-1.5 text-[11px] text-danger-strong">Could not save that. Check your connection and try again.</p>}
    </div>
  );
}
