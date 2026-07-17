"use client";

import { useState } from "react";
import { X, Users, Copy, LogOut, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth-context";

interface HouseholdModalProps {
  onClose: () => void;
}

export function HouseholdModal({ onClose }: HouseholdModalProps) {
  const { user, household, householdLoading, refreshHousehold } = useAuth();
  const [joinCode, setJoinCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    if (!user) return;
    setIsCreating(true);
    setError(null);

    const { error: createError } = await supabase.rpc("create_household", {
      new_name: `${user.user_metadata?.full_name || "My"}'s Household`,
    });

    setIsCreating(false);

    if (createError) {
      setError(
        createError.message?.includes("does not exist")
          ? "Household tables aren't set up yet — the required database migration hasn't been run."
          : "Couldn't create a household. Please try again."
      );
      return;
    }

    await refreshHousehold();
    toast("Household created", { description: "Share your invite code with anyone you want to share your pantry with." });
  };

  const handleJoin = async () => {
    const code = joinCode.trim();
    if (!code) {
      setError("Enter an invite code.");
      return;
    }
    setIsJoining(true);
    setError(null);

    const { error: rpcError } = await supabase.rpc("join_household_by_code", { code });

    setIsJoining(false);

    if (rpcError) {
      setError(
        rpcError.message?.includes("does not exist")
          ? "Household tables aren't set up yet — the required database migration hasn't been run."
          : "Invalid invite code. Double-check and try again."
      );
      return;
    }

    setJoinCode("");
    await refreshHousehold();
    toast("Joined household", { description: "You'll now see this household's shared pantry items." });
  };

  const handleLeave = async () => {
    if (!user || !household) return;
    setIsLeaving(true);
    setError(null);

    const { error: leaveError } = await supabase
      .from("household_members")
      .delete()
      .eq("household_id", household.id)
      .eq("user_id", user.id);

    setIsLeaving(false);

    if (leaveError) {
      setError("Couldn't leave the household. Please try again.");
      return;
    }

    await refreshHousehold();
    toast("Left household", { description: "You're back to your own private pantry." });
  };

  const handleCopyCode = async () => {
    if (!household) return;
    try {
      await navigator.clipboard.writeText(household.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast("Copy failed", { description: `Invite code: ${household.inviteCode}` });
    }
  };

  return (
    <div className="fixed inset-0 z-70 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-card border border-border rounded-3xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-foreground/60" />
            <h3 className="font-bold text-sm tracking-tight">Household Settings</h3>
          </div>
          <button
            onClick={onClose}
            title="Close household settings"
            aria-label="Close household settings"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-foreground/10 hover:bg-foreground/20 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2">
              <p className="text-xs text-red-500">{error}</p>
            </div>
          )}

          {householdLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-foreground/40" />
            </div>
          ) : household ? (
            <>
              <div className="rounded-2xl bg-foreground/5 border border-border/50 p-4 space-y-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-foreground/50 mb-1">Household</p>
                  <p className="text-sm font-bold text-foreground">{household.name}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-foreground/50 mb-1">Invite Code</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono tracking-widest">
                      {household.inviteCode}
                    </code>
                    <button
                      onClick={handleCopyCode}
                      title="Copy invite code"
                      aria-label="Copy invite code"
                      className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg border border-border hover:bg-foreground/5 transition-colors"
                    >
                      {copied ? <Check size={14} className="text-safe" /> : <Copy size={14} />}
                    </button>
                  </div>
                  <p className="text-[11px] text-foreground/45 mt-1.5">Share this code with anyone you want to see and edit the same pantry.</p>
                </div>
              </div>

              <button
                onClick={handleLeave}
                disabled={isLeaving}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-danger/30 text-danger text-sm font-semibold hover:bg-danger/5 disabled:opacity-60 transition-all"
              >
                {isLeaving ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
                Leave Household
              </button>
            </>
          ) : (
            <>
              <p className="text-xs text-foreground/60 leading-relaxed">
                Share your pantry with family or roommates. Create a household to get an invite
                code, or join one someone shared with you.
              </p>

              <button
                onClick={handleCreate}
                disabled={isCreating}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-foreground text-background text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-all"
              >
                {isCreating ? <Loader2 size={14} className="animate-spin" /> : null}
                Create a Household
              </button>

              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[11px] text-foreground/40 uppercase tracking-widest">or</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.trim())}
                  placeholder="Enter invite code"
                  className="flex-1 bg-background border border-border rounded-xl px-3 py-2.5 text-sm font-mono tracking-widest focus:outline-none focus:ring-1 focus:ring-foreground/20"
                />
                <button
                  onClick={handleJoin}
                  disabled={isJoining}
                  className="px-4 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-foreground/5 disabled:opacity-60 transition-all shrink-0"
                >
                  {isJoining ? <Loader2 size={14} className="animate-spin" /> : "Join"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
