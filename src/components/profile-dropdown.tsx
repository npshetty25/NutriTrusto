"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { toast } from "sonner";
import { LogOut, Settings, Users, ChevronDown, Bell, Loader2 } from "lucide-react";

export function ProfileDropdown() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
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

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 bg-foreground/5 border border-border hover:border-foreground/20 rounded-full pl-1 pr-3 py-1 transition-all"
      >
        <div className="w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-bold shrink-0">
          {initials}
        </div>
        <span className="text-sm font-medium text-foreground max-w-[80px] truncate">{firstName}</span>
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
            <button onClick={() => showComingSoon("Household Settings")} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-foreground/80 hover:bg-foreground/5 rounded-xl transition-colors text-left">
              <Users size={15} className="text-foreground/50" /> Household Settings
            </button>
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
