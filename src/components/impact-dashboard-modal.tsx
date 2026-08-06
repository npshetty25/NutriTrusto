"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Leaf, Loader2, TrendingDown, Wallet, Cloud, Flame, Activity, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth-context";
import { getImpactEstimate } from "@/lib/impact-estimates";
import { type ItemCategory } from "@/lib/item-category";

interface ImpactDashboardModalProps {
  onClose: () => void;
}

interface OutcomeRow {
  category: string;
  outcome: "used" | "expired";
  removed_at: string;
}

interface ScoreRow {
  health_score: string;
  scanned_at: string;
}

interface LeaderboardRow {
  user_id: string;
  display_name: string;
  items_used: number;
  items_expired: number;
  streak_days: number | null;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function ImpactDashboardModal({ onClose }: ImpactDashboardModalProps) {
  const { user, household } = useAuth();
  const [rows, setRows] = useState<OutcomeRow[] | null>(null);
  const [scoreRows, setScoreRows] = useState<ScoreRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[] | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      const { data, error: fetchError } = await supabase
        .from("item_outcomes")
        .select("category, outcome, removed_at")
        .order("removed_at", { ascending: false })
        .limit(2000);

      if (cancelled) return;

      if (fetchError) {
        setError(
          fetchError.code === "PGRST205" || fetchError.message?.includes("does not exist")
            ? "The impact dashboard isn't set up yet — the required database migration hasn't been run."
            : "Couldn't load your impact stats."
        );
        return;
      }
      setRows((data || []) as OutcomeRow[]);
    })();

    (async () => {
      const { data } = await supabase
        .from("scan_history")
        .select("health_score, scanned_at")
        .not("health_score", "is", null)
        .order("scanned_at", { ascending: true })
        .limit(200);
      if (!cancelled && data) setScoreRows(data as ScoreRow[]);
    })();

    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!user || !household) return;
    let cancelled = false;

    (async () => {
      const { data, error: rpcError } = await supabase.rpc("household_impact_leaderboard");
      if (cancelled) return;
      if (rpcError) {
        setLeaderboard([]);
        return;
      }
      setLeaderboard((data || []) as LeaderboardRow[]);
    })();

    return () => { cancelled = true; };
  }, [user, household]);

  const used = rows?.filter((r) => r.outcome === "used") ?? [];
  const expired = rows?.filter((r) => r.outcome === "expired") ?? [];
  const total = (rows?.length ?? 0);
  const wasteRate = total > 0 ? Math.round((expired.length / total) * 100) : 0;

  const totals = used.reduce(
    (acc, row) => {
      const est = getImpactEstimate((row.category as ItemCategory) || "unknown");
      acc.usd += est.usdPerItem;
      acc.co2 += est.co2KgPerItem;
      return acc;
    },
    { usd: 0, co2: 0 }
  );

  // Personal streak, not a household one — item_outcomes is per-user, not
  // shared across household members (same scoping as shopping_list_items
  // and scan_history), so this counts days since *this account's* most
  // recent wasted item, not the household's combined record.
  const mostRecentExpired = rows?.find((r) => r.outcome === "expired");
  const streakDays = mostRecentExpired
    ? Math.max(0, Math.floor((Date.now() - new Date(mostRecentExpired.removed_at).getTime()) / MS_PER_DAY))
    : null; // null = never logged a wasted item (either brand new, or a perfect record)

  const recentScores = scoreRows
    .map((r) => Number.parseFloat(r.health_score))
    .filter((n) => Number.isFinite(n))
    .slice(-10);
  const avgRecentScore = recentScores.length > 0 ? recentScores.reduce((a, b) => a + b, 0) / recentScores.length : null;
  const avgFirstHalf = recentScores.length >= 4
    ? recentScores.slice(0, Math.floor(recentScores.length / 2)).reduce((a, b) => a + b, 0) / Math.floor(recentScores.length / 2)
    : null;
  const avgSecondHalf = recentScores.length >= 4
    ? recentScores.slice(Math.floor(recentScores.length / 2)).reduce((a, b) => a + b, 0) / Math.ceil(recentScores.length / 2)
    : null;
  const trendDirection = avgFirstHalf !== null && avgSecondHalf !== null
    ? (avgSecondHalf > avgFirstHalf + 0.15 ? "up" : avgSecondHalf < avgFirstHalf - 0.15 ? "down" : "flat")
    : null;

  return createPortal(
    <div className="fixed inset-0 z-70 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Leaf size={16} className="text-safe" />
            <h3 className="font-bold text-sm tracking-tight">Impact Dashboard</h3>
          </div>
          <button
            onClick={onClose}
            title="Close impact dashboard"
            aria-label="Close impact dashboard"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-foreground/10 hover:bg-foreground/20 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-3">
          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2">
              <p className="text-xs text-red-500">{error}</p>
            </div>
          )}

          {!error && rows === null && (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-foreground/40" />
            </div>
          )}

          {!error && rows !== null && total === 0 && (
            <div className="text-center py-8 text-sm text-foreground/50">
              No history yet — this fills in as you use up or remove items from your pantry.
            </div>
          )}

          {!error && rows !== null && total > 0 && (
            <>
              {streakDays !== null && (
                <div className="rounded-2xl bg-foreground text-background p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-background/15 flex items-center justify-center shrink-0">
                    <Flame size={18} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold tracking-tight leading-none">{streakDays} day{streakDays === 1 ? "" : "s"}</p>
                    <p className="text-[11px] text-background/60 mt-0.5">since your last wasted item — your streak, not shared with your household</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-border bg-background p-3">
                  <div className="flex items-center gap-1.5 text-safe mb-1">
                    <TrendingDown size={13} />
                    <span className="text-[10px] uppercase font-semibold tracking-widest text-foreground/50">Items Saved</span>
                  </div>
                  <p className="text-2xl font-bold tracking-tight">{used.length}</p>
                  <p className="text-[11px] text-foreground/45">used before expiry</p>
                </div>
                <div className="rounded-2xl border border-border bg-background p-3">
                  <div className="flex items-center gap-1.5 text-danger mb-1">
                    <TrendingDown size={13} className="rotate-180" />
                    <span className="text-[10px] uppercase font-semibold tracking-widest text-foreground/50">Waste Rate</span>
                  </div>
                  <p className="text-2xl font-bold tracking-tight">{wasteRate}%</p>
                  <p className="text-[11px] text-foreground/45">{expired.length} item(s) expired</p>
                </div>
                <div className="rounded-2xl border border-border bg-background p-3">
                  <div className="flex items-center gap-1.5 text-foreground/70 mb-1">
                    <Wallet size={13} />
                    <span className="text-[10px] uppercase font-semibold tracking-widest text-foreground/50">Est. Saved</span>
                  </div>
                  <p className="text-2xl font-bold tracking-tight">${totals.usd.toFixed(0)}</p>
                  <p className="text-[11px] text-foreground/45">based on category averages</p>
                </div>
                <div className="rounded-2xl border border-border bg-background p-3">
                  <div className="flex items-center gap-1.5 text-foreground/70 mb-1">
                    <Cloud size={13} />
                    <span className="text-[10px] uppercase font-semibold tracking-widest text-foreground/50">CO2 Avoided</span>
                  </div>
                  <p className="text-2xl font-bold tracking-tight">{totals.co2.toFixed(1)}kg</p>
                  <p className="text-[11px] text-foreground/45">estimated</p>
                </div>
              </div>

              <div className="rounded-xl border border-border/70 bg-background p-3">
                <div className="flex items-center justify-between mb-2 text-[10px] uppercase font-semibold tracking-widest text-foreground/45">
                  <span>Used ({used.length})</span>
                  <span>Expired ({expired.length})</span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-danger/20 overflow-hidden flex">
                  <div className="h-full bg-safe" style={{ width: `${100 - wasteRate}%` }} />
                </div>
              </div>

              <p className="text-[11px] text-foreground/40 leading-relaxed px-1">
                Estimates use average per-category prices and carbon footprints, not real receipts — directional, not exact.
              </p>

              {recentScores.length > 0 && (
                <div className="rounded-xl border border-border/70 bg-background p-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5 text-foreground/70">
                      <Activity size={13} />
                      <span className="text-[10px] uppercase font-semibold tracking-widest text-foreground/50">Nutrition Trend</span>
                    </div>
                    {trendDirection && (
                      <span className={`text-[11px] font-bold ${trendDirection === "up" ? "text-safe" : trendDirection === "down" ? "text-danger" : "text-foreground/50"}`}>
                        {trendDirection === "up" ? "Improving" : trendDirection === "down" ? "Declining" : "Steady"}
                      </span>
                    )}
                  </div>
                  <div className="flex items-end gap-1.5 h-16">
                    {recentScores.map((score, i) => (
                      <div key={i} className="flex-1 bg-foreground/10 rounded-sm overflow-hidden flex flex-col justify-end" title={`${score.toFixed(1)}/5.0`}>
                        <div
                          className={`w-full rounded-sm ${score >= 3.5 ? "bg-safe" : score >= 2.5 ? "bg-warning" : "bg-danger"}`}
                          style={{ height: `${Math.max(8, (score / 5) * 100)}%` }}
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-foreground/45 mt-2">
                    Avg {avgRecentScore?.toFixed(1)}/5.0 over last {recentScores.length} scanned item(s) with a health score
                  </p>
                </div>
              )}
            </>
          )}

          {household && leaderboard && leaderboard.length > 0 && (
            <div className="rounded-xl border border-border/70 bg-background p-3">
              <div className="flex items-center gap-1.5 text-foreground/70 mb-3">
                <Users size={13} />
                <span className="text-[10px] uppercase font-semibold tracking-widest text-foreground/50">{household.name} Leaderboard</span>
              </div>
              <div className="space-y-2.5">
                {[...leaderboard]
                  .sort((a, b) => b.items_used - a.items_used)
                  .map((member) => {
                    const memberTotal = member.items_used + member.items_expired;
                    const memberWasteRate = memberTotal > 0 ? Math.round((member.items_expired / memberTotal) * 100) : 0;
                    const isMe = member.user_id === user?.id;
                    return (
                      <div key={member.user_id} className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate">
                            {member.display_name}
                            {isMe && <span className="text-foreground/40 font-normal"> (you)</span>}
                          </p>
                          <p className="text-[11px] text-foreground/45">
                            {member.items_used} saved · {memberWasteRate}% waste rate
                          </p>
                        </div>
                        {member.streak_days !== null && (
                          <div className="flex items-center gap-1 text-[11px] font-bold text-foreground/60 shrink-0">
                            <Flame size={11} />
                            {member.streak_days}d
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
              <p className="text-[11px] text-foreground/40 leading-relaxed mt-3">
                Shared across everyone in {household.name} — only aggregate counts are visible, not individual item history.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
