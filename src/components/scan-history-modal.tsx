"use client";

import { useEffect, useState } from "react";
import { X, History, Loader2, ScanLine, Camera, Keyboard, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth-context";

interface ScanHistoryModalProps {
  onClose: () => void;
}

interface ScanHistoryRow {
  id: string;
  product_name: string;
  source: "barcode" | "receipt" | "manual";
  health_score: string | null;
  scanned_at: string;
}

const sourceIconMap = {
  barcode: ScanLine,
  receipt: Camera,
  manual: Keyboard,
} as const;

const DEFAULT_READDED_DAYS_LEFT = 30;

export function ScanHistoryModal({ onClose }: ScanHistoryModalProps) {
  const { user, household, householdSchemaReady } = useAuth();
  const [rows, setRows] = useState<ScanHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reAddingId, setReAddingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from("scan_history")
        .select("id, product_name, source, health_score, scanned_at")
        .order("scanned_at", { ascending: false })
        .limit(50);

      if (cancelled) return;

      if (fetchError) {
        setError(
          fetchError.message?.includes("does not exist")
            ? "Scan history isn't set up yet — the required database migration hasn't been run."
            : "Couldn't load scan history."
        );
        setLoading(false);
        return;
      }

      setRows((data || []) as ScanHistoryRow[]);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [user]);

  const handleReAdd = async (row: ScanHistoryRow) => {
    if (!user) return;
    setReAddingId(row.id);

    const { error: insertError } = await supabase.from("pantry_items").insert([{
      user_id: user.id,
      ...(householdSchemaReady ? { household_id: household?.id ?? null } : {}),
      name: row.product_name,
      days_left: DEFAULT_READDED_DAYS_LEFT,
      risk: "low",
      purchase_date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    }]);

    setReAddingId(null);

    if (insertError) {
      toast("Couldn't add item", { description: "Please try again." });
      return;
    }

    toast("Added to Pantry", { description: `${row.product_name} added with a ${DEFAULT_READDED_DAYS_LEFT}-day default shelf life.` });
  };

  return (
    <div className="fixed inset-0 z-70 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <History size={16} className="text-foreground/60" />
            <h3 className="font-bold text-sm tracking-tight">Scan History</h3>
          </div>
          <button
            onClick={onClose}
            title="Close scan history"
            aria-label="Close scan history"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-foreground/10 hover:bg-foreground/20 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-2">
          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2">
              <p className="text-xs text-red-500">{error}</p>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-foreground/40" />
            </div>
          )}

          {!loading && !error && rows.length === 0 && (
            <div className="text-center py-8 text-sm text-foreground/50">No scans yet. Scan a barcode or receipt to see it here.</div>
          )}

          {rows.map((row) => {
            const SourceIcon = sourceIconMap[row.source] || ScanLine;
            return (
              <div key={row.id} className="rounded-xl border border-border bg-background px-3 py-2.5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-foreground/6 border border-border flex items-center justify-center text-foreground/70 shrink-0">
                  <SourceIcon size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground truncate">{row.product_name}</p>
                  <p className="text-[11px] text-foreground/50">
                    {new Date(row.scanned_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {row.health_score ? ` · Score ${row.health_score}/5.0` : ""}
                  </p>
                </div>
                <button
                  onClick={() => handleReAdd(row)}
                  disabled={reAddingId === row.id}
                  title="Add back to pantry"
                  aria-label="Add back to pantry"
                  className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg border border-border hover:bg-foreground/5 disabled:opacity-60 transition-colors"
                >
                  {reAddingId === row.id ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
