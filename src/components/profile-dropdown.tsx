"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { toast } from "sonner";
import { LogOut, Settings, Users, ChevronDown, Bell, Loader2, ShoppingCart, History, Leaf, Scale } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { HouseholdModal } from "@/components/household-modal";
import { ScanHistoryModal } from "@/components/scan-history-modal";
import { ImpactDashboardModal } from "@/components/impact-dashboard-modal";
import { AdditiveReferenceModal } from "@/components/additive-reference-modal";

interface ProfileDropdownProps {
  onOpenShoppingList?: () => void;
}

export function ProfileDropdown({ onOpenShoppingList }: ProfileDropdownProps) {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [showHousehold, setShowHousehold] = useState(false);
  const [showScanHistory, setShowScanHistory] = useState(false);
  const [showImpactDashboard, setShowImpactDashboard] = useState(false);
  const [showAdditiveReference, setShowAdditiveReference] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const positionMenu = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMenuPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
  }, []);

  useEffect(() => {
    if (!open) return;

    // The menu is portalled out of this component, so a plain
    // "is the click inside our ref" test would treat every menu click as an
    // outside click and close it instantly. Check both the trigger and the
    // portalled menu.
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    // Fixed positioning is resolved once at open time, so anything that moves
    // the trigger would leave the menu stranded.
    function handleReflow() {
      setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleReflow, true);
    window.addEventListener("resize", handleReflow);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleReflow, true);
      window.removeEventListener("resize", handleReflow);
    };
  }, [open]);

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
    try {
      await signOut();
    } catch {
      // Supabase revokes the session over the network, so this rejects when
      // offline or when the refresh token is already invalid. Either way the
      // user asked to leave — fall through to the redirect rather than
      // stranding them on a signed-in screen with a stuck button.
    } finally {
      setSigningOut(false);
      router.push("/login");
    }
  };

  const showComingSoon = (feature: string) => {
    setOpen(false);
    toast("Coming Soon", { description: `${feature} will be available in the next update.` });
  };

  const toggleOpen = () => {
    if (!open) positionMenu();
    setOpen((v) => !v);
  };

  const itemClass =
    "w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-foreground/80 hover:bg-foreground/5 rounded-xl transition-colors text-left";

  const menu = open && menuPos ? createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label="Profile menu"
      style={{ top: menuPos.top, right: menuPos.right }}
      // Portalled to <body> for the same reason as every modal in this app:
      // the page header sets backdrop-blur, which creates a stacking context,
      // so a z-50 menu nested inside it still paints *behind* the main
      // content below the header. That put Sign Out underneath the inventory
      // search field, where it silently swallowed the click.
      className="fixed w-64 max-h-[80vh] overflow-y-auto bg-card border border-border rounded-2xl shadow-xl z-70 animate-in fade-in slide-in-from-top-2 duration-200"
    >
      <div className="px-4 py-3 border-b border-border">
        <p className="font-semibold text-sm text-foreground">{fullName}</p>
        <p className="text-xs text-foreground/50 mt-0.5 truncate">{email}</p>
      </div>

      <ThemeToggle />

      <div className="p-1.5 border-t border-border">
        <button onClick={() => { setOpen(false); setShowHousehold(true); }} className={itemClass}>
          <Users size={15} className="text-foreground/50" /> Household Settings
        </button>
        {onOpenShoppingList && (
          <button onClick={() => { setOpen(false); onOpenShoppingList(); }} className={itemClass}>
            <ShoppingCart size={15} className="text-foreground/50" /> Shopping List
          </button>
        )}
        <button onClick={() => { setOpen(false); setShowScanHistory(true); }} className={itemClass}>
          <History size={15} className="text-foreground/50" /> Scan History
        </button>
        <button onClick={() => { setOpen(false); setShowImpactDashboard(true); }} className={itemClass}>
          <Leaf size={15} className="text-foreground/50" /> Impact Dashboard
        </button>
        <button onClick={() => { setOpen(false); setShowAdditiveReference(true); }} className={itemClass}>
          <Scale size={15} className="text-foreground/50" /> Additive Reference
        </button>
        <button onClick={() => showComingSoon("Notification Preferences")} className={itemClass}>
          <Bell size={15} className="text-foreground/50" /> Notification Preferences
        </button>
        <button onClick={() => showComingSoon("Account Settings")} className={itemClass}>
          <Settings size={15} className="text-foreground/50" /> Account Settings
        </button>
      </div>

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
    </div>,
    document.body
  ) : null;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={toggleOpen}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 bg-foreground/5 border border-border hover:border-foreground/20 rounded-full pl-1 pr-3 py-1 transition-all"
      >
        <div className="w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-bold shrink-0">
          {initials}
        </div>
        <span className="text-sm font-medium text-foreground max-w-20 truncate">{firstName}</span>
        <ChevronDown size={14} className={`text-foreground/50 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {menu}

      {showHousehold && <HouseholdModal onClose={() => setShowHousehold(false)} />}
      {showScanHistory && <ScanHistoryModal onClose={() => setShowScanHistory(false)} />}
      {showImpactDashboard && <ImpactDashboardModal onClose={() => setShowImpactDashboard(false)} />}
      {showAdditiveReference && <AdditiveReferenceModal onClose={() => setShowAdditiveReference(false)} />}
    </div>
  );
}
