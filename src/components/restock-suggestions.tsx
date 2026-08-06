"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth-context";

interface RestockSuggestionsProps {
  currentItemNames: string[];
}

interface Suggestion {
  name: string;
  avgIntervalDays: number;
  daysSinceLastScan: number;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function RestockSuggestions({ currentItemNames }: RestockSuggestionsProps) {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("scan_history")
        .select("product_name, scanned_at")
        .order("scanned_at", { ascending: true })
        .limit(500);

      if (cancelled || error || !data) return;

      // Group scans of the same product by exact name match (case-insensitive) —
      // needs at least two scans of the same product to have an interval to
      // learn from at all.
      const byProduct = new Map<string, number[]>();
      for (const row of data as { product_name: string; scanned_at: string }[]) {
        const key = row.product_name.trim().toLowerCase();
        const ts = new Date(row.scanned_at).getTime();
        if (Number.isNaN(ts)) continue;
        if (!byProduct.has(key)) byProduct.set(key, []);
        byProduct.get(key)!.push(ts);
      }

      const now = Date.now();
      const results: Suggestion[] = [];

      for (const [key, timestamps] of byProduct.entries()) {
        if (timestamps.length < 2) continue;

        const sorted = [...timestamps].sort((a, b) => a - b);
        const intervals: number[] = [];
        for (let i = 1; i < sorted.length; i++) {
          intervals.push((sorted[i] - sorted[i - 1]) / MS_PER_DAY);
        }
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        if (avgInterval < 1) continue; // too frequent to be a meaningful pattern

        const daysSinceLastScan = (now - sorted[sorted.length - 1]) / MS_PER_DAY;

        const alreadyInPantry = currentItemNames.some(
          (n) => n.toLowerCase().includes(key) || key.includes(n.toLowerCase())
        );
        if (alreadyInPantry) continue;

        // Surface it a bit before it's strictly "due", so it's a heads-up,
        // not a reminder that's already late.
        if (daysSinceLastScan >= avgInterval * 0.8) {
          results.push({
            name: key,
            avgIntervalDays: Math.round(avgInterval),
            daysSinceLastScan: Math.round(daysSinceLastScan),
          });
        }
      }

      results.sort((a, b) => (b.daysSinceLastScan - b.avgIntervalDays) - (a.daysSinceLastScan - a.avgIntervalDays));
      setSuggestions(results.slice(0, 3));
    })();

    return () => { cancelled = true; };
  }, [user, currentItemNames]);

  if (suggestions.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 mb-4">
      <div className="flex items-center gap-2 mb-2">
        <RefreshCw size={14} className="text-foreground/60" />
        <h4 className="font-semibold text-sm">Running Low?</h4>
      </div>
      <div className="space-y-1.5">
        {suggestions.map((s) => (
          <p key={s.name} className="text-xs text-foreground/70 capitalize">
            You usually buy <span className="font-semibold text-foreground">{s.name}</span> every ~{s.avgIntervalDays} day(s) — it&apos;s been {s.daysSinceLastScan}.
          </p>
        ))}
      </div>
    </div>
  );
}
