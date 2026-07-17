"use client";

import { useEffect, useState } from "react";
import { X, ShoppingCart, Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth-context";

interface ShoppingListModalProps {
  onClose: () => void;
}

interface ShoppingListRow {
  id: string;
  name: string;
  source_recipe: string | null;
  checked: boolean;
}

export default function ShoppingListModal({ onClose }: ShoppingListModalProps) {
  const { user } = useAuth();
  const [rows, setRows] = useState<ShoppingListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const fetchList = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from("shopping_list_items")
      .select("id, name, source_recipe, checked")
      .order("checked", { ascending: true })
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(
        fetchError.message?.includes("does not exist")
          ? "Shopping list isn't set up yet — the required database migration hasn't been run."
          : "Couldn't load your shopping list."
      );
      setLoading(false);
      return;
    }

    setRows((data || []) as ShoppingListRow[]);
    setLoading(false);
  };

  useEffect(() => {
    void fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const toggleChecked = async (row: ShoppingListRow) => {
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, checked: !r.checked } : r)));
    await supabase.from("shopping_list_items").update({ checked: !row.checked }).eq("id", row.id);
  };

  const removeItem = async (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    await supabase.from("shopping_list_items").delete().eq("id", id);
  };

  const clearChecked = async () => {
    const checkedIds = rows.filter((r) => r.checked).map((r) => r.id);
    if (checkedIds.length === 0) return;
    setRows((prev) => prev.filter((r) => !r.checked));
    await supabase.from("shopping_list_items").delete().in("id", checkedIds);
  };

  const addItem = async () => {
    const name = newItemName.trim();
    if (!name || !user) return;
    setIsAdding(true);
    const { data, error: insertError } = await supabase
      .from("shopping_list_items")
      .insert([{ user_id: user.id, name }])
      .select("id, name, source_recipe, checked")
      .single();
    setIsAdding(false);

    if (insertError || !data) {
      setError("Couldn't add item. Please try again.");
      return;
    }

    setRows((prev) => [data as ShoppingListRow, ...prev]);
    setNewItemName("");
  };

  const hasChecked = rows.some((r) => r.checked);

  return (
    <div className="fixed inset-0 z-70 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingCart size={16} className="text-foreground/60" />
            <h3 className="font-bold text-sm tracking-tight">Shopping List</h3>
          </div>
          <button
            onClick={onClose}
            title="Close shopping list"
            aria-label="Close shopping list"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-foreground/10 hover:bg-foreground/20 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void addItem(); }}
              placeholder="Add an item..."
              className="flex-1 bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-foreground/20"
            />
            <button
              onClick={() => { void addItem(); }}
              disabled={isAdding || !newItemName.trim()}
              title="Add item"
              aria-label="Add item"
              className="w-10 h-10 shrink-0 flex items-center justify-center rounded-xl bg-foreground text-background disabled:opacity-40 transition-opacity"
            >
              {isAdding ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            </button>
          </div>
        </div>

        <div className="p-4 overflow-y-auto space-y-2 flex-1">
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
            <div className="text-center py-8 text-sm text-foreground/50">Your shopping list is empty.</div>
          )}

          {rows.map((row) => (
            <div key={row.id} className="rounded-xl border border-border bg-background px-3 py-2.5 flex items-center gap-3">
              <button
                onClick={() => toggleChecked(row)}
                title={row.checked ? "Mark as not bought" : "Mark as bought"}
                aria-label={row.checked ? "Mark as not bought" : "Mark as bought"}
                className={`w-5 h-5 shrink-0 rounded-md border flex items-center justify-center transition-colors ${
                  row.checked ? "bg-safe border-safe text-white" : "border-border"
                }`}
              >
                {row.checked && <span className="text-[10px] font-bold">✓</span>}
              </button>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium truncate ${row.checked ? "line-through text-foreground/40" : "text-foreground"}`}>
                  {row.name}
                </p>
                {row.source_recipe && (
                  <p className="text-[11px] text-foreground/45 truncate">From: {row.source_recipe}</p>
                )}
              </div>
              <button
                onClick={() => removeItem(row.id)}
                title="Remove item"
                aria-label="Remove item"
                className="w-7 h-7 shrink-0 flex items-center justify-center rounded-lg hover:bg-danger/10 text-foreground/40 hover:text-danger transition-colors"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>

        {hasChecked && (
          <div className="p-3 border-t border-border shrink-0">
            <button
              onClick={() => { void clearChecked(); }}
              className="w-full py-2.5 rounded-xl border border-border text-xs font-semibold hover:bg-foreground/5 transition-colors"
            >
              Clear checked items
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
