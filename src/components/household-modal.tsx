"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Users, Copy, LogOut, Loader2, Check, Share2, Pencil, RefreshCw, UserMinus, Crown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth-context";
import {
  bringMyItemsIn,
  inviteLink,
  isAlreadyInHousehold,
  isMissingFunction,
  leaveHousehold,
  newInviteCode,
  removeMember,
  renameHousehold,
} from "@/lib/household";

interface HouseholdModalProps {
  onClose: () => void;
  /** Pre-fills the join field, from an invite link (?join=CODE). */
  initialJoinCode?: string;
}

const MIGRATION_MISSING = "Household tables aren't set up yet — the required database migration hasn't been run.";
const ALREADY_IN_ONE = "You're already in a household. Leave it first to join or start another.";

/**
 * Share a pantry with the people you live with.
 *
 * A household has one pantry. Everything in it is visible to every member,
 * and anyone can edit or use it up. Joining or creating one moves what you
 * already own into it, and anything you add afterwards goes in on its own.
 * Leaving takes your own items back with you.
 */
export function HouseholdModal({ onClose, initialJoinCode = "" }: HouseholdModalProps) {
  const { user, household, householdLoading, refreshHousehold, householdMembers, householdV2Ready } = useAuth();
  const [joinCode, setJoinCode] = useState(initialJoinCode);
  const [newName, setNewName] = useState("");
  // "create" | "join" | "leave" | "rename" | "code", or a member's id while removing them.
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<null | "code" | "link">(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  const defaultName = user?.user_metadata?.full_name ? `${user.user_metadata.full_name}'s Household` : "My Household";
  const me = householdMembers.find((m) => m.userId === user?.id);
  const iCreatedIt = !!me?.isCreator;

  const afterEntering = async (householdId: string | null) => {
    if (user && householdId) await bringMyItemsIn(user.id, householdId);
    await refreshHousehold();
  };

  const handleCreate = async () => {
    if (!user) return;
    setBusy("create");
    setError(null);
    const { data: created, error: createError } = await supabase.rpc("create_household", {
      // "My's Household" is what a nameless profile used to get.
      new_name: newName.trim() || defaultName,
    });
    setBusy(null);

    if (createError) {
      setError(
        isMissingFunction(createError)
          ? MIGRATION_MISSING
          : isAlreadyInHousehold(createError)
            ? ALREADY_IN_ONE
            : "Couldn't create a household. Please try again."
      );
      return;
    }
    toast("Household created", { description: "Your pantry is now the household's. Share the invite link with the people you live with." });
    const row = Array.isArray(created) ? (created[0] as { id?: string } | undefined) : undefined;
    await afterEntering(row?.id ?? null);
  };

  const handleJoin = async () => {
    const code = joinCode.trim();
    if (!code) {
      setError("Enter an invite code.");
      return;
    }
    setBusy("join");
    setError(null);
    const { data: joinedId, error: rpcError } = await supabase.rpc("join_household_by_code", { code });
    setBusy(null);

    if (rpcError) {
      setError(
        isMissingFunction(rpcError)
          ? MIGRATION_MISSING
          : isAlreadyInHousehold(rpcError)
            ? ALREADY_IN_ONE
            : "Invalid invite code. Double-check and try again."
      );
      return;
    }

    setJoinCode("");
    toast("Joined household", { description: "You and your housemates now share one pantry. Your own items moved in with you." });
    await afterEntering(typeof joinedId === "string" ? joinedId : null);
  };

  const handleLeave = async () => {
    if (!user || !household) return;
    setBusy("leave");
    setError(null);
    const ok = await leaveHousehold(user.id, household.id);
    setBusy(null);
    if (!ok) {
      setError("Couldn't leave the household. Please try again.");
      return;
    }
    setConfirmLeave(false);
    await refreshHousehold();
    toast("Left household", { description: "Your own items came with you. You're back to your private pantry." });
  };

  const handleRename = async () => {
    if (!household) return;
    const name = nameDraft.trim();
    if (!name || name.length > 100) {
      setError("Give the household a name of up to 100 characters.");
      return;
    }
    setBusy("rename");
    setError(null);
    const ok = await renameHousehold(household.id, name);
    setBusy(null);
    if (!ok) {
      setError("Couldn't rename the household. Please try again.");
      return;
    }
    setEditingName(false);
    await refreshHousehold();
  };

  const handleNewCode = async () => {
    setBusy("code");
    setError(null);
    const code = await newInviteCode();
    setBusy(null);
    if (!code) {
      setError("Couldn't make a new code. Please try again.");
      return;
    }
    await refreshHousehold();
    toast("New invite code", { description: "The old code and link no longer work." });
  };

  const handleRemove = async (memberId: string, name: string) => {
    setBusy(memberId);
    setError(null);
    const ok = await removeMember(memberId);
    setBusy(null);
    if (!ok) {
      setError(`Couldn't remove ${name}. Please try again.`);
      return;
    }
    await refreshHousehold();
    toast(`${name} removed`, { description: "Their own items went back to their private pantry." });
  };

  const copy = async (what: "code" | "link") => {
    if (!household) return;
    const text = what === "code" ? household.inviteCode : inviteLink(household.inviteCode);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast("Copy failed", { description: what === "code" ? `Invite code: ${household.inviteCode}` : text });
    }
  };

  const shareLink = async () => {
    if (!household) return;
    const url = inviteLink(household.inviteCode);
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: `Join ${household.name} on Nutri-Trust`, text: "Share our pantry on Nutri-Trust:", url });
        return;
      } catch {
        // Cancelled, or not allowed here: fall back to copying.
      }
    }
    await copy("link");
  };

  const label = "text-[11px] font-semibold uppercase tracking-widest text-foreground/55";
  const quiet = "min-h-11 px-3 rounded-xl border border-border text-xs font-semibold hover:bg-foreground/5 disabled:opacity-60 transition-colors inline-flex items-center justify-center gap-1.5";

  // Portal into <body> — see the identical comment in scan-history-modal.tsx.
  // This can be opened from inside ProfileDropdown, which lives inside the
  // page's <header backdrop-blur-sm>; without the portal, "fixed" here would
  // resolve relative to that header instead of the viewport.
  return createPortal(
    <div className="fixed inset-0 z-70 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="household-title"
        className="neu-panel w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[92dvh] flex flex-col"
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-safe/15 text-safe flex items-center justify-center">
              <Users size={17} />
            </span>
            <div>
              <h3 id="household-title" className="font-bold text-sm tracking-tight">Household</h3>
              <p className="text-[11px] text-foreground/55">One pantry for everyone you live with</p>
            </div>
          </div>
          <button
            onClick={onClose}
            title="Close household settings"
            aria-label="Close household settings"
            className="w-11 h-11 flex items-center justify-center rounded-full bg-foreground/10 hover:bg-foreground/20 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto">
          {error && (
            <div role="alert" className="rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2">
              <p className="text-xs text-red-500">{error}</p>
            </div>
          )}

          {householdLoading && !household ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-foreground/40" />
            </div>
          ) : household ? (
            <>
              {/* Name */}
              <div className="space-y-1.5">
                <p className={label}>Household</p>
                {editingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      id="household-name"
                      aria-label="Household name"
                      value={nameDraft}
                      maxLength={100}
                      onChange={(e) => setNameDraft(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleRename()}
                      autoFocus
                      className="flex-1 min-h-11 bg-background border border-border rounded-xl px-3 text-base focus:outline-none focus:ring-1 focus:ring-foreground/20"
                    />
                    <button onClick={handleRename} disabled={busy === "rename"} className="min-h-11 px-4 rounded-xl bg-foreground text-background text-xs font-semibold disabled:opacity-60">
                      {busy === "rename" ? <Loader2 size={14} className="animate-spin" /> : "Save"}
                    </button>
                    <button onClick={() => setEditingName(false)} className={quiet}>Cancel</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-bold tracking-tight text-foreground flex-1 min-w-0 truncate">{household.name}</p>
                    <button
                      onClick={() => { setNameDraft(household.name); setEditingName(true); }}
                      aria-label="Rename household"
                      title="Rename household"
                      className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl hover:bg-foreground/5"
                    >
                      <Pencil size={14} className="text-foreground/60" />
                    </button>
                  </div>
                )}
              </div>

              {/* Invite */}
              <div className="rounded-2xl bg-foreground/5 border border-border/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className={label}>Invite someone</p>
                  {householdV2Ready && iCreatedIt && (
                    <button onClick={handleNewCode} disabled={busy === "code"} className="text-[11px] font-semibold text-foreground/60 hover:text-foreground inline-flex items-center gap-1 min-h-8">
                      {busy === "code" ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                      New code
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-background border border-border rounded-lg px-3 py-2.5 text-base font-mono tracking-[0.2em] text-center">
                    {household.inviteCode}
                  </code>
                  <button
                    onClick={() => copy("code")}
                    title="Copy invite code"
                    aria-label="Copy invite code"
                    className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg border border-border hover:bg-foreground/5 transition-colors"
                  >
                    {copied === "code" ? <Check size={14} className="text-safe" /> : <Copy size={14} />}
                  </button>
                </div>
                <button onClick={shareLink} className="w-full min-h-11 rounded-xl bg-foreground text-background text-sm font-semibold inline-flex items-center justify-center gap-2 hover:opacity-90">
                  {copied === "link" ? <Check size={14} /> : <Share2 size={14} />}
                  {copied === "link" ? "Link copied" : "Share invite link"}
                </button>
                <p className="text-[11px] text-foreground/50 leading-relaxed">
                  Anyone with this code can see and edit the shared pantry. Only send it to people you live with.
                </p>
              </div>

              {/* Members */}
              {householdMembers.length > 0 && (
                <div className="space-y-2">
                  <p className={label}>{householdMembers.length} {householdMembers.length === 1 ? "member" : "members"}</p>
                  <ul className="space-y-1.5">
                    {householdMembers.map((m) => {
                      const isMe = m.userId === user?.id;
                      return (
                        <li key={m.userId} className="flex items-center gap-3 rounded-xl px-3 py-2 bg-foreground/3">
                          <span aria-hidden className="w-8 h-8 shrink-0 rounded-full bg-safe/15 text-safe text-xs font-bold flex items-center justify-center">
                            {m.displayName.trim().charAt(0).toUpperCase() || "?"}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{isMe ? `${m.displayName} (you)` : m.displayName}</p>
                            {m.isCreator && (
                              <p className="text-[11px] text-foreground/55 inline-flex items-center gap-1"><Crown size={11} /> Created this household</p>
                            )}
                          </div>
                          {iCreatedIt && !isMe && (
                            <button
                              onClick={() => handleRemove(m.userId, m.displayName)}
                              disabled={busy === m.userId}
                              aria-label={`Remove ${m.displayName}`}
                              title={`Remove ${m.displayName}`}
                              className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl text-foreground/50 hover:text-danger hover:bg-danger/5"
                            >
                              {busy === m.userId ? <Loader2 size={14} className="animate-spin" /> : <UserMinus size={15} />}
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Leave */}
              {confirmLeave ? (
                <div className="rounded-2xl border border-danger/30 p-4 space-y-3">
                  <p className="text-sm font-semibold">Leave {household.name}?</p>
                  <p className="text-xs text-foreground/65 leading-relaxed">
                    Items you added come back to your private pantry. Items others added stay with the household.
                  </p>
                  <div className="flex gap-2">
                    <button onClick={handleLeave} disabled={busy === "leave"} className="flex-1 min-h-11 rounded-xl bg-danger text-white text-xs font-semibold disabled:opacity-60 inline-flex items-center justify-center gap-1.5">
                      {busy === "leave" ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
                      Yes, leave
                    </button>
                    <button onClick={() => setConfirmLeave(false)} className={quiet}>Stay</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmLeave(true)}
                  className="w-full flex items-center justify-center gap-2 min-h-11 rounded-xl border border-danger/30 text-danger text-sm font-semibold hover:bg-danger/5 transition-all"
                >
                  <LogOut size={14} />
                  Leave Household
                </button>
              )}
            </>
          ) : (
            <>
              <ul className="space-y-2 text-xs text-foreground/70">
                <li className="flex gap-2"><Check size={14} className="text-safe shrink-0 mt-0.5" /> Everyone sees the same pantry and the same expiry alerts.</li>
                <li className="flex gap-2"><Check size={14} className="text-safe shrink-0 mt-0.5" /> Anyone can add, edit or use up an item.</li>
                <li className="flex gap-2"><Check size={14} className="text-safe shrink-0 mt-0.5" /> The items you already have move in with you. Leave, and they come back.</li>
              </ul>

              <div className="space-y-2">
                <label htmlFor="new-household-name" className={label}>Start a household</label>
                <input
                  id="new-household-name"
                  value={newName}
                  maxLength={100}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={defaultName}
                  className="w-full min-h-11 bg-background border border-border rounded-xl px-3 text-base focus:outline-none focus:ring-1 focus:ring-foreground/20"
                />
                <button
                  onClick={handleCreate}
                  disabled={busy === "create"}
                  className="w-full flex items-center justify-center gap-2 min-h-11 rounded-xl bg-foreground text-background text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-all"
                >
                  {busy === "create" ? <Loader2 size={14} className="animate-spin" /> : null}
                  Create a Household
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[11px] text-foreground/40 uppercase tracking-widest">or join one</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="household-join-code"
                  type="text"
                  aria-label="Invite code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="Enter invite code"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className="flex-1 min-w-0 min-h-11 bg-background border border-border rounded-xl px-3 py-2.5 text-base font-mono tracking-widest focus:outline-none focus:ring-1 focus:ring-foreground/20"
                />
                <button
                  onClick={handleJoin}
                  disabled={busy === "join"}
                  className="min-h-11 px-4 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-foreground/5 disabled:opacity-60 transition-all shrink-0"
                >
                  {busy === "join" ? <Loader2 size={14} className="animate-spin" /> : "Join"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
