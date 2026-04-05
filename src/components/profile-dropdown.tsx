"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { LogOut, Settings, Users, ChevronDown, Bell, Loader2 } from "lucide-react";

export function ProfileDropdown() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [savingCircle, setSavingCircle] = useState(false);
  const [sharingCircle, setSharingCircle] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (!user) {
    return (
      <button
        onClick={() => router.push("/login")}
        className="text-xs font-semibold bg-foreground text-background px-4 py-1.5 rounded-full hover:opacity-90 transition-opacity"
      >
        Sign In
      </button>
    );
  }

  // Derive display name and initials from Supabase user object
  const fullName: string = user.user_metadata?.full_name || user.email?.split("@")[0] || "User";
  const firstName = fullName.split(" ")[0];
  const initials = fullName.charAt(0).toUpperCase();
  const email = user.email || "";
  const initialCircleCode = String(user.user_metadata?.accountability_circle || "").toUpperCase();
  const [circleCode, setCircleCode] = useState(initialCircleCode);

  useEffect(() => {
    setCircleCode(initialCircleCode);
  }, [initialCircleCode]);

  const handleSignOut = async () => {
    setSigningOut(true);
    setOpen(false);
    await signOut();
    router.push("/login");
  };

  const showComingSoon = (feature: string) => {
    setOpen(false);
    toast("Coming Soon", { description: `${feature} will be available in the next update.` });
  };

  const normalizeCircleCode = (raw: string) => {
    const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
    return cleaned.slice(0, 16);
  };

  const generateCircleCode = () => {
    const base = `${firstName.slice(0, 4).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    setCircleCode(normalizeCircleCode(base));
  };

  const saveCircleCode = async () => {
    const normalized = normalizeCircleCode(circleCode);
    if (!normalized) {
      toast("Circle code required", { description: "Enter or generate a circle code to continue." });
      return;
    }

    setSavingCircle(true);
    const { error } = await supabase.auth.updateUser({
      data: {
        ...user.user_metadata,
        accountability_circle: normalized,
      },
    });
    setSavingCircle(false);

    if (error) {
      toast("Save failed", { description: error.message });
      return;
    }

    setCircleCode(normalized);
    toast("Circle updated", { description: `You are now in circle ${normalized}.` });
  };

  const shareCircleCode = async () => {
    const normalized = normalizeCircleCode(circleCode);
    if (!normalized) {
      toast("No circle code", { description: "Set a circle code first." });
      return;
    }

    const message = `Join my Nutri-Trust accountability circle with code: ${normalized}`;
    setSharingCircle(true);

    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: "Nutri-Trust Circle Invite",
          text: message,
        });
      } else if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(message);
        toast("Invite copied", { description: "Circle invite message copied to clipboard." });
      } else {
        toast("Share unavailable", { description: `Use this code: ${normalized}` });
      }
    } catch {
      toast("Share canceled", { description: "You can still copy and send the circle code manually." });
    } finally {
      setSharingCircle(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 bg-foreground/5 border border-border hover:border-foreground/20 rounded-full pl-1 pr-3 py-1 transition-all"
      >
        <div className="w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-bold shrink-0">
          {initials}
        </div>
        <span className="text-sm font-medium text-foreground max-w-20 truncate">{firstName}</span>
        <ChevronDown size={14} className={`text-foreground/50 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-card border border-border rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {/* User Info */}
          <div className="px-4 py-3 border-b border-border">
            <p className="font-semibold text-sm text-foreground">{fullName}</p>
            <p className="text-xs text-foreground/50 mt-0.5 truncate">{email}</p>
          </div>

          {/* Menu Items */}
          <div className="p-1.5">
            <div className="rounded-xl border border-border bg-background p-3 mb-1.5">
              <div className="flex items-center gap-2 mb-2">
                <Users size={14} className="text-foreground/60" />
                <p className="text-xs font-bold uppercase tracking-widest text-foreground/60">Accountability Circle</p>
              </div>
              <p className="text-[11px] text-foreground/50 mb-2 leading-relaxed">
                Share one circle code with family/friends to compare rescued food daily.
              </p>
              <input
                type="text"
                value={circleCode}
                onChange={(e) => setCircleCode(normalizeCircleCode(e.target.value))}
                placeholder="e.g., HOME1234"
                className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs font-semibold tracking-wide focus:outline-none focus:border-foreground/30"
              />
              <div className="grid grid-cols-3 gap-2 mt-2">
                <button
                  onClick={generateCircleCode}
                  className="rounded-lg border border-border bg-card text-[11px] font-semibold py-2 hover:bg-foreground/5 transition-colors"
                >
                  Generate
                </button>
                <button
                  onClick={saveCircleCode}
                  disabled={savingCircle}
                  className="rounded-lg bg-foreground text-background text-[11px] font-semibold py-2 hover:opacity-90 disabled:opacity-60 transition-opacity"
                >
                  {savingCircle ? "Saving" : "Save"}
                </button>
                <button
                  onClick={() => { void shareCircleCode(); }}
                  disabled={sharingCircle}
                  className="rounded-lg border border-border bg-card text-[11px] font-semibold py-2 hover:bg-foreground/5 disabled:opacity-60 transition-colors"
                >
                  {sharingCircle ? "Sharing" : "Share"}
                </button>
              </div>
            </div>
            <button onClick={() => showComingSoon("Notification Preferences")} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-foreground/80 hover:bg-foreground/5 rounded-xl transition-colors text-left">
              <Bell size={15} className="text-foreground/50" /> Notification Preferences
            </button>
            <button onClick={() => showComingSoon("Account Settings")} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-foreground/80 hover:bg-foreground/5 rounded-xl transition-colors text-left">
              <Settings size={15} className="text-foreground/50" /> Account Settings
            </button>
          </div>

          {/* Sign Out */}
          <div className="p-1.5 border-t border-border">
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-danger hover:bg-danger/5 rounded-xl transition-colors text-left disabled:opacity-60"
            >
              {signingOut ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={15} />}
              {signingOut ? "Signing Out..." : "Sign Out"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
