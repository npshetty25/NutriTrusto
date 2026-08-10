"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";

type DietPreference = "veg" | "eggtarian" | "non-veg" | "none";
type ItemDietType = "veg" | "egg" | "non-veg";

const NON_VEG_ANIMAL_KEYWORDS = [
  "chicken", "meat", "beef", "pork", "fish", "salmon", "tuna", "mutton", "prawn", "shrimp", "crab", "bacon", "ham", "sausage", "turkey",
  "anchovy", "gelatin", "gelatine", "lard", "pepperoni", "broth", "stock", "oyster", "sardine", "bonito", "worcestershire"
];
const EGG_KEYWORDS = ["egg", "eggs", "albumen", "mayonnaise"];
const NON_VEG_KEYWORDS = [...NON_VEG_ANIMAL_KEYWORDS, ...EGG_KEYWORDS];

const containsEggKeyword = (value: string) => {
  const text = value.toLowerCase();
  return EGG_KEYWORDS.some((kw) => text.includes(kw));
};

const containsAnimalNonVegKeyword = (value: string) => {
  const text = value.toLowerCase();
  return NON_VEG_ANIMAL_KEYWORDS.some((kw) => text.includes(kw));
};

const containsNonVegKeyword = (value: string) => {
  const text = value.toLowerCase();
  return NON_VEG_KEYWORDS.some((kw) => text.includes(kw));
};

const getItemDietType = (value: string): ItemDietType => {
  if (containsAnimalNonVegKeyword(value)) return "non-veg";
  if (containsEggKeyword(value)) return "egg";
  return "veg";
};

const normalizeDietPreference = (value: string): DietPreference => {
  const diet = value.toLowerCase().trim();
  if (diet === "veg" || diet === "vegetarian") return "veg";
  if (diet === "eggtarian" || diet === "eggitarian") return "eggtarian";
  if (diet === "non-veg" || diet === "nonveg") return "non-veg";
  return "none";
};

const isDietConflict = (userDiet: DietPreference, itemDiet: ItemDietType) => {
  if (userDiet === "veg") return itemDiet !== "veg";
  if (userDiet === "eggtarian") return itemDiet === "non-veg";
  return false;
};

const isVegItem = (name: string) => {
  return !containsNonVegKeyword(name);
};

const parsePurchaseDate = (purchaseDate: string) => {
  const parsed = new Date(purchaseDate);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  return new Date();
};

const calculateCurrentDaysLeft = (initialDaysLeft: number, purchaseDate: string) => {
  const boughtOn = parsePurchaseDate(purchaseDate);
  const now = new Date();
  const msDiff = now.getTime() - boughtOn.getTime();
  const daysElapsed = Math.max(0, Math.floor(msDiff / (1000 * 60 * 60 * 24)));
  return Math.max(0, initialDaysLeft - daysElapsed);
};

const deriveRisk = (daysLeft: number): RiskLevel => {
  if (daysLeft <= 4) return "high";
  if (daysLeft <= 13) return "medium";
  return "low";
};

const normalizeLabel = (value: string) => value.replace(/\s+/g, " ").trim();

// Generic, category-appropriate tips — never a fabricated specific
// product name (there's no real per-item nutrition data to base one on).
// Vegetables/fruit/meat/unknown return undefined: they're either already
// whole foods ("Organic/Whole Tomato" makes no sense) or we genuinely
// don't know enough about the item to say anything useful.
const getHealthierAlternativeHint = (category: ItemCategory): string | undefined => {
  switch (category) {
    case "dairy": return "Look for a low-fat or organic dairy option";
    case "grain": return "Choose a whole-grain version";
    case "beverage": return "Watch for added sugar — try an unsweetened version";
    case "bakery": return "Look for a whole-grain or lower-sugar option";
    case "frozen": return "Check the label for versions without added preservatives";
    case "snack": return "Look for a baked or lower-sodium version";
    case "pantry": return "Check the label for a lower-sodium option";
    default: return undefined;
  }
};

const extractMealIngredients = (meal: Record<string, unknown>): string[] => {
  const ingredients: string[] = [];
  for (let i = 1; i <= 20; i += 1) {
    const raw = meal[`strIngredient${i}`];
    if (typeof raw === "string" && raw.trim().length > 0) {
      ingredients.push(normalizeLabel(raw));
    }
  }
  return ingredients;
};

const buildDisplayProductName = ({
  baseName,
  brand,
  quantity,
}: {
  baseName: string;
  brand?: string;
  quantity?: string;
}) => {
  const cleanBase = normalizeLabel(baseName || "");
  const cleanBrand = normalizeLabel(brand || "");
  const cleanQty = normalizeLabel(quantity || "");

  if (!cleanBase) return "";

  const includeBrand =
    cleanBrand && !cleanBase.toLowerCase().includes(cleanBrand.toLowerCase());

  return normalizeLabel(
    [includeBrand ? cleanBrand : "", cleanBase, cleanQty]
      .filter(Boolean)
      .join(" ")
  );
};
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { supabase } from "@/lib/supabase";
import { inferItemCategory, type ItemCategory } from "@/lib/item-category";
import { detectAllergens } from "@/lib/allergens";
import { PantryCard, RiskLevel } from "@/components/pantry-card";
import { ProfileDropdown } from "@/components/profile-dropdown";
import BarcodeScanner from "@/components/barcode-scanner";
import NutritionLabelScanner from "@/components/nutrition-label-scanner";
import ExpiryDateScanner from "@/components/expiry-date-scanner";
import PantryChatModal from "@/components/pantry-chat-modal";
import { RestockSuggestions } from "@/components/restock-suggestions";
import { RecipeModal, type GeneratedRecipe } from "@/components/recipe-modal";
import {
  Camera, BrainCircuit, Loader2, TrendingUp, ScanLine,
  Clock, X, Trash2, Home as HomeIcon, Info, Activity, Zap, AlertTriangle, CheckCircle2, Search, CircleAlert, Bell, Carrot, Apple, Milk, Drumstick, Wheat, CupSoda, Croissant, Snowflake, Candy, Package, ChevronLeft, ChevronRight, CalendarClock, Pencil, Sparkles, RefreshCw, SlidersHorizontal, Leaf, UtensilsCrossed, Check
} from "lucide-react";
import ShoppingListModal from "@/components/shopping-list-modal";
import { CountUp } from "@/components/count-up";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { toast } from "sonner";

interface Item {
  id: string;
  name: string;
  daysLeft: number;
  risk: RiskLevel;
  purchaseDate: string;
  // null/undefined = no real ingredient data for this item (demo data,
  // receipt-scanned items, or scanned before this column existed) —
  // allergen content must be shown as unknown, not assumed safe.
  ingredientsText?: string | null;
  healthScore?: string | null;
}

interface NotificationEntry {
  id: string;
  title: string;
  message: string;
  severity: "high" | "medium" | "low" | "info";
  createdAt: string;
  category: ItemCategory;
}

interface ScannedResultEntry {
  name: string;
  analysis: any;
  itemDiet: ItemDietType;
  // Real ingredient text from Open Food Facts, when actually available —
  // never the "None provided..." placeholder used when no product data
  // was found. See PLACEHOLDER_INGREDIENTS_TEXT below.
  ingredients?: string | null;
}

interface ScannedExpiryEntry {
  daysLeft: number;
  expiryDate: string | null;
  source: "printed_expiry" | "mfd_plus_shelf_life" | "shelf_life_from_today" | "unknown";
  confidence: "high" | "medium" | "low";
}

const DEFAULT_SCANNED_ITEM_DAYS_LEFT = 30;
const PLACEHOLDER_INGREDIENTS_TEXT = "None provided, rely purely on AI general knowledge";

const NOTIFICATIONS_PAGE_SIZE = 8;
const INVENTORY_PAGE_SIZE = 6;

// No fallback items — real users start with an empty pantry.

export default function Home() {
  const { user, loading: authLoading, household, householdSchemaReady, ingredientsSchemaReady, healthScoreSchemaReady } = useAuth();

  // Spread into a pantry_items insert payload. Omits the key entirely
  // (rather than sending null) until we've confirmed the household_id
  // column exists — Postgrest rejects an insert referencing an unknown
  // column outright, so this must never be sent before the migration runs.
  const householdIdField = (): { household_id?: string | null } =>
    householdSchemaReady ? { household_id: household?.id ?? null } : {};

  // Same idea for ingredients_text — see ingredientsSchemaReady in AuthContext.
  const ingredientsTextField = (ingredients: string | null | undefined): { ingredients_text?: string | null } =>
    ingredientsSchemaReady ? { ingredients_text: ingredients ?? null } : {};

  // Same gate for the score column — Postgrest rejects the whole insert if
  // the migration adding it hasn't been run yet.
  const healthScoreField = (score: string | null | undefined): { health_score?: string | null } =>
    healthScoreSchemaReady ? { health_score: score ?? null } : {};
  const router = useRouter();

  const [items, setItems] = useState<Item[]>([]);
  const [dbLoading, setDbLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingRecipe, setIsGeneratingRecipe] = useState(false);
  const [generatedRecipe, setGeneratedRecipe] = useState<GeneratedRecipe | null>(null);
  const [showRecipe, setShowRecipe] = useState(false);
  const [isAddingToShoppingList, setIsAddingToShoppingList] = useState(false);
  const [isVegMode, setIsVegMode] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [isAnalyzingFood, setIsAnalyzingFood] = useState(false);
  const [scannedResult, setScannedResult] = useState<ScannedResultEntry | null>(null);
  const [scannedExpiry, setScannedExpiry] = useState<ScannedExpiryEntry | null>(null);
  const [showExpiryScanner, setShowExpiryScanner] = useState(false);
  const [barcodeRetryPrompt, setBarcodeRetryPrompt] = useState<{ code: string } | null>(null);
  const [showBarcodeRetryOptions, setShowBarcodeRetryOptions] = useState(false);
  const [manualRetryBarcode, setManualRetryBarcode] = useState("");
  const [showLabelScanner, setShowLabelScanner] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [dietConflictPrompt, setDietConflictPrompt] = useState<{ userDiet: DietPreference; itemDiet: ItemDietType; itemName: string } | null>(null);
  const [manualBarcodeEntry, setManualBarcodeEntry] = useState<{ code: string; ingredients: string; categories: string } | null>(null);
  const [manualBarcodeName, setManualBarcodeName] = useState("");
  const [contributeToOFF, setContributeToOFF] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<"all" | RiskLevel>("all");
  const [inventorySortBy, setInventorySortBy] = useState<"expiring" | "freshest" | "name">("expiring");
  // Collapsed by default. Twelve controls used to stand between opening the
  // app and seeing a single item, so on a phone the pantry never appeared
  // above the fold — in a product whose whole job is "show me what's dying".
  const [showFilters, setShowFilters] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showNotificationsPanel, setShowNotificationsPanel] = useState(false);
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  const [notificationPage, setNotificationPage] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [hasMoreNotifications, setHasMoreNotifications] = useState(true);
  const [notificationsInitialized, setNotificationsInitialized] = useState(false);
  const [notificationSeverityFilter, setNotificationSeverityFilter] = useState<"all" | NotificationEntry["severity"]>("all");
  const [notificationSort, setNotificationSort] = useState<"newest" | "urgent">("newest");
  const [isSeedingMockData, setIsSeedingMockData] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editName, setEditName] = useState("");
  const [editDaysLeft, setEditDaysLeft] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [showShoppingList, setShowShoppingList] = useState(false);
  const [showPantryChat, setShowPantryChat] = useState(false);

  const [showReceiptMenu, setShowReceiptMenu] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const invoiceInputRef = useRef<HTMLInputElement>(null);
  const displayedItems = isVegMode ? items.filter(i => isVegItem(i.name)) : items;
  const inventoryFilteredItems = displayedItems.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.trim().toLowerCase());
    const matchesRisk = riskFilter === "all" ? true : item.risk === riskFilter;
    return matchesSearch && matchesRisk;
  });
  const sortedInventoryItems = [...inventoryFilteredItems].sort((a, b) => {
    if (inventorySortBy === "name") return a.name.localeCompare(b.name);
    if (inventorySortBy === "freshest") return b.daysLeft - a.daysLeft;
    return a.daysLeft - b.daysLeft;
  });
  const totalPages = Math.max(1, Math.ceil(sortedInventoryItems.length / INVENTORY_PAGE_SIZE));
  const paginatedItems = sortedInventoryItems.slice((currentPage - 1) * INVENTORY_PAGE_SIZE, currentPage * INVENTORY_PAGE_SIZE);
  const highRiskItems = displayedItems.filter(i => i.risk === "high");
  // Share of items that are not expiring soon. The old formula divided every
  // item's days-left by a fixed 14, so a 6-day staple bought that morning
  // contributed 43% and a perishable-heavy pantry could never score well —
  // the headline number was un-winnable by construction.
  const freshnessScore = displayedItems.length === 0
    ? 0
    : Math.round((displayedItems.filter((i) => i.risk === "low").length / displayedItems.length) * 100);
  // Derived from the same list the Critical Items tile counts. Previously the
  // bell filtered `daysLeft > 0 && <= 3`, which used a different threshold AND
  // dropped already-expired items — the most urgent ones — so the bell and the
  // tile showed different numbers on the same screen.
  const urgentNotificationCount = highRiskItems.length;

  const userDietPreference = normalizeDietPreference(String(user?.user_metadata?.dietary_preference || "none"));

  // Counts only settings that are actually narrowing the list, so the badge
  // on the collapsed Filter button never claims a filter that isn't applied.
  const activeFilterCount =
    (riskFilter !== "all" ? 1 : 0) + (isVegMode ? 1 : 0) + (inventorySortBy !== "expiring" ? 1 : 0);

  const severityRank: Record<NotificationEntry["severity"], number> = { high: 0, medium: 1, low: 2, info: 3 };
  const visibleNotifications = notifications
    .filter((n) => notificationSeverityFilter === "all" || n.severity === notificationSeverityFilter)
    .sort((a, b) => {
      if (notificationSort === "urgent") return severityRank[a.severity] - severityRank[b.severity];
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, riskFilter, isVegMode]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!user) return;

    const refreshItemAgingFromDb = async () => {
      const { data, error } = await supabase
        .from("pantry_items")
        .select("*")
        .order("days_left", { ascending: true });

      if (error || !data) return;

      setItems(
        data.map((row) => {
          const daysLeft = calculateCurrentDaysLeft(row.days_left, row.purchase_date);
          return {
            id: row.id,
            name: row.name,
            daysLeft,
            risk: deriveRisk(daysLeft),
            purchaseDate: row.purchase_date,
            ingredientsText: row.ingredients_text ?? null,
            healthScore: row.health_score ?? null,
          };
        })
      );
    };

    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 0);
    const firstDelay = Math.max(1000, nextMidnight.getTime() - now.getTime());

    let intervalId: ReturnType<typeof setInterval> | undefined;

    const timeoutId = setTimeout(() => {
      void refreshItemAgingFromDb();

      intervalId = setInterval(() => {
        void refreshItemAgingFromDb();
      }, 24 * 60 * 60 * 1000);
    }, firstDelay);

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [user]);

  // Escape closed the recipe modal but not the notifications panel, the edit
  // dialog or any of the scanner sheets — verified live before the fix.
  useEffect(() => {
    const anyOverlayOpen = showNotificationsPanel || showReceiptMenu || !!editingItem;
    if (!anyOverlayOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setShowNotificationsPanel(false);
      setShowReceiptMenu(false);
      setEditingItem(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showNotificationsPanel, showReceiptMenu, editingItem]);

  // "day(s)" is a programmer's plural. It appeared in five user-facing
  // strings while the item card next to them printed "1 day" correctly.
  const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

  const notificationIconMap = {
    vegetable: Carrot,
    fruit: Apple,
    dairy: Milk,
    meat: Drumstick,
    grain: Wheat,
    beverage: CupSoda,
    bakery: Croissant,
    frozen: Snowflake,
    snack: Candy,
    pantry: Package,
    unknown: Package,
  } as const;

  const buildNotificationFromRow = (row: any): NotificationEntry => {
    const currentDays = calculateCurrentDaysLeft(row.days_left, row.purchase_date);
    const createdAt = row.created_at || new Date().toISOString();
    const category = inferItemCategory(String(row.name || ""));

    if (currentDays <= 0) {
      return {
        id: `${row.id}-${createdAt}`,
        title: "Item expired",
        message: `${row.name} has likely spoiled. Remove it or use immediately if still safe.`,
        severity: "high",
        createdAt,
        category,
      };
    }

    if (currentDays <= 3) {
      return {
        id: `${row.id}-${createdAt}`,
        title: "Spoilage warning",
        message: `${row.name} may spoil in ${days(currentDays)}.`,
        severity: "high",
        createdAt,
        category,
      };
    }

    if (currentDays <= 7) {
      return {
        id: `${row.id}-${createdAt}`,
        title: "Use soon",
        message: `${row.name} is still fresh but should be used within ${days(currentDays)}.`,
        severity: "medium",
        createdAt,
        category,
      };
    }

    return {
      id: `${row.id}-${createdAt}`,
      title: "Inventory update",
      message: `${row.name} is in good condition with ${days(currentDays)} left.`,
      severity: "info",
      createdAt,
      category,
    };
  };

  const loadNotifications = async (reset = false) => {
    if (!user || notificationsLoading) return;

    const targetPage = reset ? 0 : notificationPage;
    const from = targetPage * NOTIFICATIONS_PAGE_SIZE;
    const to = from + NOTIFICATIONS_PAGE_SIZE - 1;

    setNotificationsLoading(true);
    const { data, error } = await supabase
      .from("pantry_items")
      .select("id, name, days_left, purchase_date, created_at")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      setInlineError("Could not fetch notifications. Please refresh and try again.");
      setNotificationsLoading(false);
      return;
    }

    const mapped = (data || []).map(buildNotificationFromRow);
    setNotifications(prev => (reset ? mapped : [...prev, ...mapped]));
    setHasMoreNotifications((data || []).length === NOTIFICATIONS_PAGE_SIZE);
    setNotificationPage(reset ? 1 : targetPage + 1);
    setNotificationsLoading(false);
  };

  const handleNotificationPanelToggle = async () => {
    if (showNotificationsPanel) {
      setShowNotificationsPanel(false);
      return;
    }

    setShowNotificationsPanel(true);
    if (!notificationsInitialized) {
      setNotificationsInitialized(true);
      await loadNotifications(true);
    }
  };

  const handleNotificationsScroll = async (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 64;
    if (nearBottom && hasMoreNotifications && !notificationsLoading) {
      await loadNotifications(false);
    }
  };

  // Notifications are derived live from current pantry state (not a stored
  // inbox), so "clear" empties what's shown now rather than dismissing
  // something permanently. Resetting notificationsInitialized means the
  // next time the panel opens it re-fetches — a genuinely still-critical
  // item will reappear, which is correct: it isn't done being critical
  // just because you closed the panel.
  const clearAllNotifications = () => {
    setNotifications([]);
    setHasMoreNotifications(false);
    setNotificationPage(0);
    setNotificationsInitialized(false);
  };

  // ─── Guard + redirect ──────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  // ─── Fetch pantry from Supabase ────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const fetchItems = async () => {
      setDbLoading(true);
      const { data, error } = await supabase
        .from("pantry_items")
        .select("*")
        .order("days_left", { ascending: true });

      if (error) {
        console.warn("Supabase fetch error:", error.message);
        setItems([]);
      } else if (data && data.length > 0) {
        setItems(data.map(row => ({
          id: row.id,
          name: row.name,
          daysLeft: calculateCurrentDaysLeft(row.days_left, row.purchase_date),
          risk: deriveRisk(calculateCurrentDaysLeft(row.days_left, row.purchase_date)),
          purchaseDate: row.purchase_date,
          ingredientsText: row.ingredients_text ?? null,
          healthScore: row.health_score ?? null,
        })));
      } else {
        setItems([]);
      }
      setDbLoading(false);
    };

    fetchItems();

    // ─── Real-time subscription ─────────────────────────────────
    // No `filter` here (unlike a plain per-user filter) so that changes
    // made by other members of a shared household — whose rows have a
    // different user_id — also trigger a refetch. Realtime payloads are
    // still gated by the same RLS policy as the initial SELECT, so this
    // does not broadcast rows this user can't already read.
    const channel = supabase
      .channel("pantry-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "pantry_items" },
        () => fetchItems() // Re-fetch on any change (INSERT, UPDATE, DELETE)
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // ─── Expiry nudge ───────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const t = setTimeout(() => {
      const soonToSpoil = items.filter(i => i.daysLeft > 0 && i.daysLeft <= 3);
      soonToSpoil.forEach((item) => {
        const key = `expiry-notify-${user.id}-${item.id}-${new Date().toDateString()}`;
        if (typeof window !== "undefined" && localStorage.getItem(key)) return;

        // "Got it" used to be a no-op that only dismissed the toast — a
        // button that looks like a decision and takes none. The alarm is
        // about one specific item, so the action offers the one thing that
        // resolves it.
        toast("Expiry Reminder", {
          description: `${item.name} may spoil in ${days(item.daysLeft)}. Use it soon.`,
          action: {
            label: "Cook it",
            onClick: () => {
              setRiskFilter("high");
              setSearchQuery(item.name);
              document.getElementById("inventory-log")?.scrollIntoView({ behavior: "smooth", block: "start" });
            },
          },
        });

        if (typeof window !== "undefined") {
          localStorage.setItem(key, "1");
        }
      });
    }, 4000);
    return () => clearTimeout(t);
  }, [user, items]);

  // ─── Delete item ────────────────────────────────────────────────
  // One removal path, two meanings. The outcome used to be *guessed* from
  // whether days_left was still positive, so an item eaten on its last day
  // and an item found rotten on its last day were recorded identically —
  // and the Impact Dashboard was built on top of that guess. Now the button
  // the user actually pressed decides it.
  const removeItem = async (id: string, outcome: "used" | "expired") => {
    setInlineError(null);
    const itemToUndo = items.find(i => i.id === id);
    if (!itemToUndo) return;

    setItems(prev => prev.filter(i => i.id !== id));
    if (!id.startsWith("seed-")) {
      await supabase.from("pantry_items").delete().eq("id", id);
      if (user) {
        // Best-effort impact-dashboard log — never blocks the removal, and
        // silently no-ops if the migration adding this table hasn't run yet.
        supabase.from("item_outcomes").insert([{
          user_id: user.id,
          name: itemToUndo.name,
          category: inferItemCategory(itemToUndo.name),
          outcome,
          days_left_at_removal: itemToUndo.daysLeft,
        }]).then(() => {}, () => {});
      }
    }

    toast(
      outcome === "used" ? `${itemToUndo.name} used up` : "Item removed",
      {
        description: outcome === "used"
          ? "Saved from the bin. It counts towards your impact."
          : `${itemToUndo.name} was deleted.`,
        action: {
          label: "Undo",
          onClick: async () => {
            setItems(prev => [...prev, itemToUndo]);
            if (!id.startsWith("seed-") && user) {
              const rowToInsert = {
                 id: itemToUndo.id,
                 user_id: user.id,
                 ...householdIdField(),
                 name: itemToUndo.name,
                 days_left: itemToUndo.daysLeft,
                 risk: itemToUndo.risk,
                 purchase_date: itemToUndo.purchaseDate
              };
              await supabase.from("pantry_items").insert([rowToInsert]);
            }
          }
        }
      }
    );
  };

  const deleteItem = (id: string) => removeItem(id, "expired");
  const markItemUsed = (id: string) => removeItem(id, "used");

  // ─── Edit item ──────────────────────────────────────────────────
  const openEditItem = (item: Item) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditDaysLeft(String(item.daysLeft));
  };

  const closeEditItem = () => {
    setEditingItem(null);
    setEditName("");
    setEditDaysLeft("");
  };

  const saveEditItem = async () => {
    if (!editingItem) return;
    const trimmedName = editName.trim();
    if (!trimmedName) {
      setInlineError("Item name can't be empty.");
      return;
    }
    const parsedDaysLeft = Math.round(Number(editDaysLeft));
    if (!Number.isFinite(parsedDaysLeft) || parsedDaysLeft < 0) {
      setInlineError("Enter a valid number of days remaining.");
      return;
    }
    const clampedDaysLeft = Math.max(0, Math.min(3650, parsedDaysLeft));

    setIsSavingEdit(true);
    setInlineError(null);

    // Editing resets the aging clock: purchase_date becomes today, and
    // days_left becomes exactly what the user typed as "days remaining".
    const newPurchaseDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const { error } = await supabase
      .from("pantry_items")
      .update({ name: trimmedName, days_left: clampedDaysLeft, purchase_date: newPurchaseDate, risk: deriveRisk(clampedDaysLeft) })
      .eq("id", editingItem.id);

    setIsSavingEdit(false);

    if (error) {
      setInlineError("Couldn't save changes. Please try again.");
      return;
    }

    setItems(prev => prev.map(i => i.id === editingItem.id
      ? { ...i, name: trimmedName, daysLeft: clampedDaysLeft, risk: deriveRisk(clampedDaysLeft), purchaseDate: newPurchaseDate }
      : i));
    toast("Item updated");
    closeEditItem();
  };

  const addMockInventoryData = async () => {
    if (!user || isSeedingMockData) return;

    setInlineError(null);
    setIsSeedingMockData(true);

    const today = new Date();
    const getPurchaseDate = (daysAgo: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() - daysAgo);
      return d.toISOString();
    };

    // A demo pantry has to look like a real one, which means a spread — not
    // nine perishables all dying at once plus a bag of frozen peas. The old
    // plan put 6 of 10 items at critical, so freshness opened at 10% and
    // every card was red. This spans the whole range across categories
    // (greens, dairy, staples, fruit, ferment, frozen) and picks a random
    // subset, so pressing the button twice does not produce the same pantry.
    const CATALOGUE = [
      // Critical — the items the rescue recipe exists for
      { name: "Palak (Spinach)", shelfLifeDays: 4, purchasedDaysAgo: 3 },
      { name: "Paneer", shelfLifeDays: 5, purchasedDaysAgo: 4 },
      { name: "Coriander Leaves", shelfLifeDays: 4, purchasedDaysAgo: 3 },
      { name: "Curd", shelfLifeDays: 7, purchasedDaysAgo: 6 },
      { name: "Chicken Breast", shelfLifeDays: 3, purchasedDaysAgo: 2 },
      { name: "Mushrooms", shelfLifeDays: 5, purchasedDaysAgo: 4 },
      // Expiring soon
      { name: "Milk", shelfLifeDays: 6, purchasedDaysAgo: 2 },
      { name: "Bhindi (Okra)", shelfLifeDays: 7, purchasedDaysAgo: 3 },
      { name: "Bread", shelfLifeDays: 6, purchasedDaysAgo: 2 },
      { name: "Bananas", shelfLifeDays: 7, purchasedDaysAgo: 3 },
      { name: "Tomatoes", shelfLifeDays: 10, purchasedDaysAgo: 6 },
      { name: "Eggs", shelfLifeDays: 21, purchasedDaysAgo: 16 },
      // Comfortable
      { name: "Carrots", shelfLifeDays: 14, purchasedDaysAgo: 4 },
      { name: "Cabbage", shelfLifeDays: 16, purchasedDaysAgo: 3 },
      { name: "Onions", shelfLifeDays: 30, purchasedDaysAgo: 6 },
      { name: "Potatoes", shelfLifeDays: 28, purchasedDaysAgo: 5 },
      { name: "Ginger", shelfLifeDays: 21, purchasedDaysAgo: 4 },
      { name: "Toor Dal", shelfLifeDays: 180, purchasedDaysAgo: 20 },
      { name: "Basmati Rice", shelfLifeDays: 365, purchasedDaysAgo: 30 },
      { name: "Frozen Peas", shelfLifeDays: 90, purchasedDaysAgo: 12 },
      { name: "Amul Butter", shelfLifeDays: 60, purchasedDaysAgo: 10 },
      { name: "Mango Pickle", shelfLifeDays: 240, purchasedDaysAgo: 40 },
    ];

    // Stratified pick so every demo still has something critical to rescue
    // (the recipe card only appears when it does) without being all red.
    const sample = <T,>(pool: T[], n: number) =>
      [...pool].sort(() => Math.random() - 0.5).slice(0, n);
    const mockPlan = sample(CATALOGUE.slice(0, 6), 3)
      .concat(sample(CATALOGUE.slice(6, 12), 3))
      .concat(sample(CATALOGUE.slice(12), 4));

    const rows = mockPlan.map((entry) => {
      const currentDays = Math.max(0, entry.shelfLifeDays - entry.purchasedDaysAgo);
      return {
        user_id: user.id,
        ...householdIdField(),
        name: entry.name,
        days_left: entry.shelfLifeDays,
        risk: deriveRisk(currentDays),
        purchase_date: getPurchaseDate(entry.purchasedDaysAgo),
      };
    });

    const { data, error } = await supabase
      .from("pantry_items")
      .insert(rows)
      .select("id, name, days_left, purchase_date");

    if (error) {
      setInlineError("Could not insert demo data. Please try again.");
      setIsSeedingMockData(false);
      return;
    }

    const mapped: Item[] = (data || []).map((row) => {
      const daysLeft = calculateCurrentDaysLeft(row.days_left, row.purchase_date);
      return {
        id: row.id,
        name: row.name,
        daysLeft,
        risk: deriveRisk(daysLeft),
        purchaseDate: row.purchase_date,
      };
    });

    setItems((prev) => [...mapped, ...prev]);
    toast("Demo data added", {
      description: `${mapped.length} sample items across every freshness level.`,
    });
    setIsSeedingMockData(false);
  };

  // ─── Recipe generation ──────────────────────────────────────────
  // Recipes are generated from the pantry rather than looked up. The
  // provider's Indian catalogue is 14 dishes (4 of them vegetarian) and its
  // ingredient index has no entry at all for staples like curd, so a lookup
  // could not reliably use the food that is actually about to spoil — which
  // is the only reason this feature exists. Generation also removes a whole
  // class of failure: one of the provider's Indian videos is already a dead
  // link after a copyright takedown.
  const generateRecipe = async (avoidTitles: string[] = []) => {
    if (isGeneratingRecipe) return;

    // Most urgent first. Everything else is context the model may draw on.
    const candidates = [...displayedItems].sort((a, b) => a.daysLeft - b.daysLeft);
    if (candidates.length === 0) {
      toast("Nothing to cook with", { description: "Add a few items to your pantry first." });
      return;
    }

    setIsGeneratingRecipe(true);
    setInlineError(null);

    try {
      const res = await fetch("/api/find-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: candidates.map((i) => ({ name: i.name, daysLeft: i.daysLeft, risk: i.risk })),
          dietaryPreference: String(user?.user_metadata?.dietary_preference || "none"),
          avoidTitles,
        }),
      });
      const data = await res.json();

      if (!data.success) {
        setInlineError(data.error || "Couldn't put a recipe together just now. Try again in a moment.");
        return;
      }

      setGeneratedRecipe(data.recipe);
      setShowRecipe(true);
      const rescued = data.recipe.fromPantry?.length || 0;
      const toBuy = data.recipe.toBuy?.length || 0;
      toast("Recipe ready", {
        description: `Saves ${rescued} item${rescued === 1 ? "" : "s"}${toBuy > 0 ? ` · ${toBuy} to buy` : " · nothing to buy"}.`,
      });
    } catch {
      setInlineError("Couldn't reach the recipe service. Check your connection and try again.");
    } finally {
      setIsGeneratingRecipe(false);
    }
  };

  const tryAnotherRecipe = async () => {
    // Pass the current title back so the next idea is genuinely different.
    await generateRecipe(generatedRecipe ? [generatedRecipe.title] : []);
  };


  const addMissingIngredientsToShoppingList = async () => {
    if (!user || !generatedRecipe || isAddingToShoppingList) return;

    // toBuy comes from the recipe itself, which knows what it drew from the
    // pantry. The old version guessed by substring-matching every ingredient
    // against item names, which both missed things and added things you had.
    const missing = generatedRecipe.toBuy;

    if (missing.length === 0) {
      toast("Nothing to add", { description: "This recipe only uses things you already have." });
      return;
    }

    setIsAddingToShoppingList(true);
    // The amount is written into the name with an em-dash separator rather
    // than a new column, so this needs no migration and can never half-work
    // against a database that hasn't been updated. ShoppingListModal splits
    // on the same separator to lay the two parts out; a row without one
    // (anything typed by hand, or added before this) still renders fine.
    const rows = missing.map((row) => ({
      user_id: user.id,
      name: row.quantity ? `${row.item} — ${row.quantity}` : row.item,
      source_recipe: generatedRecipe.title,
    }));

    const { error } = await supabase.from("shopping_list_items").insert(rows);
    setIsAddingToShoppingList(false);

    if (error) {
      toast("Couldn't update shopping list", {
        description: error.code === "PGRST205" || error.message?.includes("does not exist")
          ? "Shopping list isn't set up yet — the required database migration hasn't been run."
          : "Please try again.",
      });
      return;
    }

    toast("Added to shopping list", { description: `${missing.length} item(s) from "${generatedRecipe.title}" added.` });
  };

  // ─── Receipt upload → Supabase insert ──────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setInlineError(null);
    setShowReceiptMenu(false);
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("receipt", file);

      const res = await fetch("/api/extract", { 
        method: "POST",
        body: formData 
      });
      const data = await res.json();
      if (data.success && data.items && user) {
        const normalizedItems = (data.items as any[])
          .map((apiItem) => {
            const name = String(apiItem?.name || "").trim();
            const daysLeft = Number.isFinite(Number(apiItem?.days_left))
              ? Math.max(1, Math.min(3650, Math.round(Number(apiItem.days_left))))
              : 7;
            if (!name) return null;

            return {
              name,
              days_left: daysLeft,
              risk: deriveRisk(daysLeft),
            };
          })
          .filter((item): item is { name: string; days_left: number; risk: RiskLevel } => Boolean(item));

        const purchaseDate = typeof data.purchase_date === "string" && data.purchase_date
          ? data.purchase_date
          : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        const rows = normalizedItems.map((apiItem) => ({
          user_id: user.id,
          ...householdIdField(),
          name: apiItem.name,
          days_left: apiItem.days_left,
          risk: apiItem.risk,
          purchase_date: purchaseDate,
        }));

        const failedLocalItems: Item[] = [];
        const successfulInsertedItems: Item[] = [];
        let insertedCount = 0;

        for (const row of rows) {
          const { data: insertedRow, error } = await supabase
            .from("pantry_items")
            .insert([row])
            .select("id, name, days_left, purchase_date")
            .single();

          if (error) {
            failedLocalItems.push({
              id: `local-${Math.random().toString(36).slice(2, 10)}`,
              name: row.name,
              daysLeft: row.days_left,
              risk: row.risk as RiskLevel,
              purchaseDate: row.purchase_date,
            });
          } else {
            insertedCount += 1;
            if (insertedRow) {
              const daysLeft = calculateCurrentDaysLeft(insertedRow.days_left, insertedRow.purchase_date);
              successfulInsertedItems.push({
                id: insertedRow.id,
                name: insertedRow.name,
                daysLeft,
                risk: deriveRisk(daysLeft),
                purchaseDate: insertedRow.purchase_date,
              });
              logScanHistory(insertedRow.name, "receipt");
            }
          }
        }

        if (successfulInsertedItems.length > 0) {
          setItems(prev => {
            const existingIds = new Set(prev.map((item) => item.id));
            const fresh = successfulInsertedItems.filter((item) => !existingIds.has(item.id));
            return [...fresh, ...prev];
          });
        }

        if (failedLocalItems.length > 0) {
          setItems(prev => [...failedLocalItems, ...prev]);
        }

        toast("Receipt Parsed", {
          description: insertedCount === rows.length
            ? `Added all ${rows.length} items to your inventory.`
            : `Added ${insertedCount}/${rows.length} items to cloud inventory. Remaining items were added locally.`,
        });
      } else {
        setInlineError(data.error || "We couldn't parse this receipt. Try a clearer image in good lighting.");
      }
    } catch {
      setInlineError("Something went wrong while parsing the receipt. Please try again.");
    } finally {
      setIsUploading(false);
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      if (galleryInputRef.current) galleryInputRef.current.value = "";
      if (invoiceInputRef.current) invoiceInputRef.current.value = "";
    }
  };

  // ─── Scan history logging (best-effort, never blocks the UI) ───
  const logScanHistory = (productName: string, source: "barcode" | "receipt" | "manual", healthScore?: string) => {
    if (!user || !productName) return;
    // Supabase's query builder is lazily thenable — the request is only
    // actually sent once something calls .then()/.catch() or awaits it.
    // `void` alone discards the builder without triggering it, so this
    // must chain .then() to fire the insert.
    supabase.from("scan_history").insert([{
      user_id: user.id,
      product_name: productName,
      source,
      health_score: healthScore ?? null,
    }]).then(() => {});
  };

  // ─── Barcode Processing ─────────────────────────────────────────
  const handleBarcodeScan = async (decodedText: string) => {
    setInlineError(null);
    setBarcodeRetryPrompt(null);
    setShowBarcodeRetryOptions(false);
    setShowBarcodeScanner(false);
    setIsAnalyzingFood(true);
    try {
      const OFF_FIELDS = "product_name,product_name_en,product_name_in,generic_name,brands,brand_owner,quantity,ingredients_text,categories,nutriscore_grade,additives_n,additives_tags,nutriments,image_url";

let res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${decodedText}.json?fields=${OFF_FIELDS}`);
let data = await res.json();

// Auto-fixing zero-padding issues common in Indian/Asian barcodes
if (data.status === 0 && !decodedText.startsWith("0")) {
  res = await fetch(`https://world.openfoodfacts.org/api/v2/product/0${decodedText}.json?fields=${OFF_FIELDS}`);
  data = await res.json();
}

// Try India-specific OFF server if global fails
if (data.status === 0) {
  res = await fetch(`https://in.openfoodfacts.org/api/v2/product/${decodedText}.json?fields=${OFF_FIELDS}`);
  data = await res.json();
}
      
      let productName = "";
      let productIngredients = PLACEHOLDER_INGREDIENTS_TEXT;
      let productCategories = "Unknown";
      let nutritionData: {
        sugars_g_100g?: number;
        sodium_mg_100g?: number;
        saturated_fat_g_100g?: number;
        fibre_g_100g?: number;
        protein_g_100g?: number;
      } = {};
      let additivesCount = 0;
      let additiveColors: string[] = [];

      if (data.status === 1 && data.product) {
        const product = data.product as {
         product_name?: string;
         product_name_en?: string;
         product_name_in?: string;
         generic_name?: string;
         brands?: string;
         brand_owner?: string;
         quantity?: string;
         ingredients_text?: string;
         categories?: string;
          nutriscore_grade?: string;
          additives_n?: number;
          additives_tags?: string[];
          nutriments?: {
            sugars_100g?: number;
            sodium_100g?: number;
            salt_100g?: number;
            [key: string]: number | undefined;
          };
        };

        const baseName =
         product.product_name ||
         product.product_name_en ||
         product.product_name_in ||
         product.generic_name ||
         "Unknown Product";
        const brand = product.brands?.split(",")?.[0] || product.brand_owner || "";
        productName = buildDisplayProductName({
         baseName,
         brand,
         quantity: product.quantity || "",
        });
        productIngredients = product.ingredients_text || productIngredients;
        productCategories = product.categories || productCategories;
        const nutriments = product.nutriments || {};
        // OFF stores sodium_100g in grams, so ×1000 converts to mg
const sodiumFromSodium = typeof nutriments.sodium_100g === "number" ? nutriments.sodium_100g * 1000 : undefined;
// Salt to sodium: sodium = salt × 0.393, then ×1000 for mg
const sodiumFromSalt = typeof nutriments.salt_100g === "number" ? nutriments.salt_100g * 393 : undefined;

        nutritionData = {
  sugars_g_100g: typeof nutriments.sugars_100g === "number" ? nutriments.sugars_100g : undefined,
  sodium_mg_100g: sodiumFromSodium ?? sodiumFromSalt,
  saturated_fat_g_100g: typeof nutriments["saturated-fat_100g"] === "number" ? nutriments["saturated-fat_100g"] : undefined,
  fibre_g_100g: nutriments["fiber_100g"] ?? nutriments["fibers_100g"] ?? nutriments["fiber-dietary_100g"] ?? undefined,
  protein_g_100g: typeof nutriments.proteins_100g === "number" ? nutriments.proteins_100g : undefined,
};

// Flag if nutrition data is mostly missing
const nutritionFieldsFilled = Object.values(nutritionData).filter(v => typeof v === "number").length;
if (nutritionFieldsFilled < 2) {
  // Mark so the UI can warn the user clearly
  (nutritionData as any).__isEstimated = true;
}

        additivesCount = typeof product.additives_n === "number"
         ? product.additives_n
         : Array.isArray(product.additives_tags)
          ? product.additives_tags.length
          : 0;

        additiveColors = (product.ingredients_text || "")
         .toLowerCase()
         .match(/(tartrazine|sunset yellow|allura red|brilliant blue|erythrosine|carmoisine|ponceau|yellow\s*5|red\s*40|blue\s*1|e1\d\d)/gi) || [];
      } else {
         // Auto fallback to server-side UPCItemDB proxy (Fixes CORS block)
         try {
            const fallbackRes = await fetch(`/api/lookup-upc?upc=${decodedText}`);
            const fallbackData = await fallbackRes.json();
            if (fallbackData.items && fallbackData.items.length > 0) {
            const upcItem = fallbackData.items[0] as {
             title?: string;
             brand?: string;
             size?: string;
             category?: string;
            };
            productName = buildDisplayProductName({
             baseName: upcItem.title || "",
             brand: upcItem.brand || "",
             quantity: upcItem.size || "",
            });
            productCategories = upcItem.category || "Unknown";
            }
         } catch(e) {
            console.error("UPC proxy fallback failed:", e);
         }
      }

      // Final fallback: unknown product metadata
      if (!productName || productName.trim() === "") {
         setIsAnalyzingFood(false);
        setBarcodeRetryPrompt({ code: decodedText });
        setManualRetryBarcode(decodedText);
        return;
      }

      const detectedItemDiet = getItemDietType(`${productName} ${productIngredients} ${productCategories}`);

      if (detectedItemDiet === "non-veg" && !containsAnimalNonVegKeyword(productName)) {
        productName = `${productName} (Non-Veg)`;
      } else if (detectedItemDiet === "egg" && !containsEggKeyword(productName)) {
        productName = `${productName} (Contains Egg)`;
      }

      const isEstimated = !Object.values(nutritionData).some((v) => typeof v === "number");

      const aiRes = await fetch("/api/analyze-food", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: productName,
          ingredients: productIngredients,
          categories: productCategories,
          nutritionData,
          additivesCount,
          additiveColors,
          nutriScoreGrade: (data?.product?.nutriscore_grade as string | undefined) || undefined,
          isEstimated,
        })
      });
      const analysis = await aiRes.json();

      if (!analysis.is_food) {
        setInlineError("This barcode appears to be a non-food item, so it wasn't added.");
      } else {
        logScanHistory(productName, "barcode", analysis.health_score);
        setScannedExpiry(null);
        setScannedResult({
          name: productName,
          analysis,
          itemDiet: detectedItemDiet,
          ingredients: productIngredients !== PLACEHOLDER_INGREDIENTS_TEXT ? productIngredients : null,
        });
      }
    } catch (e) {
      setInlineError("Barcode analysis failed. Please scan again or type item details manually.");
    } finally {
      setIsAnalyzingFood(false);
    }
  };

  const submitManualBarcodeName = async () => {
    if (!manualBarcodeEntry) return;
    const typedName = manualBarcodeName.trim();
    if (!typedName) {
      setInlineError("Please enter an item name to continue barcode analysis.");
      return;
    }

    setInlineError(null);
    setIsAnalyzingFood(true);

    try {
      const aiRes = await fetch("/api/analyze-food", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: typedName,
          ingredients: manualBarcodeEntry.ingredients,
          categories: manualBarcodeEntry.categories,
          nutritionData: {},
          additivesCount: 0,
          additiveColors: [],
        }),
      });

      const analysis = await aiRes.json();

      if (!analysis.is_food) {
        setInlineError("This barcode appears to be a non-food item, so it wasn't added.");
      } else {
        const detectedItemDiet = getItemDietType(`${typedName} ${manualBarcodeEntry.ingredients} ${manualBarcodeEntry.categories}`);
        logScanHistory(typedName, "manual", analysis.health_score);
        setScannedExpiry(null);
        setScannedResult({
          name: typedName,
          analysis,
          itemDiet: detectedItemDiet,
          ingredients: manualBarcodeEntry.ingredients !== PLACEHOLDER_INGREDIENTS_TEXT ? manualBarcodeEntry.ingredients : null,
        });

        if (contributeToOFF) {
          fetch("/api/contribute-product", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ barcode: manualBarcodeEntry.code, productName: typedName }),
          })
            .then((r) => r.json())
            .then((result) => {
              if (result.success) {
                toast("Shared with Open Food Facts", { description: "Thanks for helping improve the database for everyone." });
              } else {
                toast("Couldn't share with Open Food Facts", { description: result.error || "Please try again later." });
              }
            })
            .catch(() => toast("Couldn't share with Open Food Facts", { description: "Please try again later." }));
        }
      }
    } catch {
      setInlineError("Unable to analyze this item right now. Please try again in a moment.");
    } finally {
      setIsAnalyzingFood(false);
      setManualBarcodeEntry(null);
      setManualBarcodeName("");
      setContributeToOFF(false);
    }
  };

  const addScannedItemToPantry = async (forceAdd = false) => {
    if (!scannedResult || !user) return;

    const userDiet = normalizeDietPreference(String(user.user_metadata?.dietary_preference || "none"));
    const itemDiet = scannedResult.itemDiet || getItemDietType(scannedResult.name);
    if (!forceAdd && isDietConflict(userDiet, itemDiet)) {
      setDietConflictPrompt({ userDiet, itemDiet, itemName: scannedResult.name });
      return;
    }

    const initialDaysLeft = scannedExpiry?.daysLeft ?? DEFAULT_SCANNED_ITEM_DAYS_LEFT;
    const newItem = {
      user_id: user.id,
      ...householdIdField(),
      ...ingredientsTextField(scannedResult.ingredients),
      ...healthScoreField(scannedResult.analysis?.health_score),
      name: scannedResult.name,
      days_left: initialDaysLeft,
      risk: deriveRisk(initialDaysLeft),
      purchase_date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    };

    const { data: insertedRow, error } = await supabase
      .from("pantry_items")
      .insert([newItem])
      .select("id, name, days_left, purchase_date")
      .single();

    if (!error && insertedRow) {
       const daysLeft = calculateCurrentDaysLeft(insertedRow.days_left, insertedRow.purchase_date);
       setItems(prev => {
         if (prev.some((item) => item.id === insertedRow.id)) return prev;
         return [{
           id: insertedRow.id,
           name: insertedRow.name,
           daysLeft,
           risk: deriveRisk(daysLeft),
           purchaseDate: insertedRow.purchase_date,
           ingredientsText: scannedResult.ingredients ?? null,
           healthScore: scannedResult.analysis?.health_score ?? null,
         }, ...prev];
       });
       toast("Added to Pantry", {
         description: scannedExpiry
           ? `Using scanned expiry date: ${days(initialDaysLeft)} left.`
           : `No expiry date scanned — defaulted to ${days(DEFAULT_SCANNED_ITEM_DAYS_LEFT)}. You can scan the expiry date next time for accuracy.`,
       });
    } else if (error) {
       setInlineError("Item was analyzed, but could not be saved to cloud inventory.");
    }
     setDietConflictPrompt(null);
    setScannedResult(null);
    setScannedExpiry(null);
  };

  const handleNutritionLabelResult = async (nutrition: {
    sugars_g?: number | null;
    sodium_mg?: number | null;
    saturated_fat_g?: number | null;
    fibre_g?: number | null;
    protein_g?: number | null;
  }) => {
    setShowLabelScanner(false);
    if (!scannedResult) return;

    setIsAnalyzingFood(true);
    try {
      const nutritionData = {
        sugars_g_100g: nutrition.sugars_g ?? undefined,
        sodium_mg_100g: nutrition.sodium_mg ?? undefined,
        saturated_fat_g_100g: nutrition.saturated_fat_g ?? undefined,
        fibre_g_100g: nutrition.fibre_g ?? undefined,
        protein_g_100g: nutrition.protein_g ?? undefined,
      };

      const aiRes = await fetch("/api/analyze-food", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: scannedResult.name,
          ingredients: "",
          categories: "",
          nutritionData,
          additivesCount: 0,
          additiveColors: [],
          isEstimated: false,
        }),
      });

      const analysis = await aiRes.json();
      setScannedResult((prev) => (prev ? { ...prev, analysis } : null));
      toast("Label scanned!", {
        description: "Rating updated with real nutrition data from the label.",
      });
    } catch {
      toast("Error", { description: "Couldn't re-analyze with label data." });
    } finally {
      setIsAnalyzingFood(false);
    }
  };

  const handleExpiryScanResult = (expiry: {
    days_left: number | null;
    expiry_date: string | null;
    source: "printed_expiry" | "mfd_plus_shelf_life" | "shelf_life_from_today" | "unknown";
    confidence: "high" | "medium" | "low";
  }) => {
    setShowExpiryScanner(false);
    if (expiry.days_left === null) return;

    setScannedExpiry({
      daysLeft: expiry.days_left,
      expiryDate: expiry.expiry_date,
      source: expiry.source,
      confidence: expiry.confidence,
    });
    toast("Expiry date detected", {
      description: expiry.expiry_date
        ? `${days(expiry.days_left)} left (expires ${expiry.expiry_date}).`
        : `${days(expiry.days_left)} left.`,
    });
  };


  // Loading state. Also waits for the schema-readiness probes (household_id,
  // ingredients_text) to resolve once a user exists — otherwise a fast
  // scan-and-add right after signup can race ahead of them, silently
  // omitting those fields from the very first insert (confirmed
  // reproducible: the probes are still in flight for a beat after a fresh
  // signup, before the dashboard would otherwise already be interactive).
  const schemaProbesPending = !!user && (householdSchemaReady === null || ingredientsSchemaReady === null || healthScoreSchemaReady === null);
  if (authLoading || (!user && !authLoading) || schemaProbesPending) {
    return (
      <div className="flex flex-col items-center justify-center gap-5 min-h-screen">
        <motion.div
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          className="neu-raised w-20 h-20 rounded-3xl flex items-center justify-center"
        >
          <Image src="/logo.svg" alt="" width={36} height={36} className="w-9 h-9 object-contain" />
        </motion.div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              animate={{ y: [0, -7, 0], opacity: [0.35, 1, 0.35] }}
              transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
              className="w-1.5 h-1.5 rounded-full bg-foreground/50"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
    <div className="flex flex-col min-h-screen pb-32 sm:pb-28 bg-background">
      {/* Header */}
      <header className="px-4 pt-8 pb-6 border-b border-border bg-card/90 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 26 }}
          className="flex justify-between items-center mb-8"
        >
          <div className="flex items-center gap-2">
            <motion.div whileHover={{ rotate: [0, -12, 12, 0], scale: 1.1 }} transition={{ duration: 0.5 }}>
              <Image
                src="/logo.svg"
                alt="Nutri-Trust logo"
                width={24}
                height={24}
                className="w-6 h-6 rounded-md object-contain"
              />
            </motion.div>
            <h1 className="text-xl font-bold tracking-tight">Nutri-Trust</h1>
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              title="Open notifications"
              aria-label="Open notifications"
              onClick={handleNotificationPanelToggle}
              whileTap={{ scale: 0.9 }}
              className="neu-pressable relative w-11 h-11 rounded-full flex items-center justify-center"
            >
              <motion.span
                animate={urgentNotificationCount > 0 ? { rotate: [0, -14, 12, -8, 6, 0] } : { rotate: 0 }}
                transition={urgentNotificationCount > 0 ? { duration: 0.9 } : undefined}
                className="flex"
              >
                <Bell size={16} className="text-foreground/80" />
              </motion.span>
              {urgentNotificationCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 18 }}
                  className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center leading-none"
                >
                  {urgentNotificationCount > 9 ? "9+" : urgentNotificationCount}
                </motion.span>
              )}
            </motion.button>
            <ProfileDropdown onOpenShoppingList={() => setShowShoppingList(true)} />
          </div>
        </motion.div>

        {/* KPI Widgets */}
        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: { opacity: 1, transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
          }}
          className="grid grid-cols-2 gap-3 mb-4"
        >
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 18 },
              show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 280, damping: 24 } },
            }}
            className="neu-pressable flex-1 rounded-2xl p-4"
          >
            {/* No wrapper opacity here: it used to multiply with the span's
                own /70 to an effective 0.49 alpha, so this eyebrow measured
                3.32:1 while the identical one on the Critical tile measured
                6.55:1. Two paired labels, two different readabilities. */}
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={14} className="text-safe" />
              <span className="text-[10px] uppercase font-semibold tracking-widest text-foreground/70">Pantry Freshness</span>
            </div>
            <p className="text-3xl font-semibold tracking-tighter">
              <CountUp value={freshnessScore} suffix="%" />
            </p>
            <div className="mt-2 h-1.5 w-full rounded-full bg-foreground/10 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${freshnessScore}%` }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
                className={`h-full rounded-full ${
                  freshnessScore >= 66 ? "bg-safe" : freshnessScore >= 33 ? "bg-warning" : "bg-danger"
                }`}
              />
            </div>
            <p className="text-xs text-foreground/60 mt-1.5">Items not expiring soon</p>
          </motion.div>
          <motion.button
            type="button"
            onClick={() => {
              setRiskFilter("high");
              document.getElementById("inventory-log")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            disabled={highRiskItems.length === 0}
            aria-label={`${highRiskItems.length} critical items. Show only these.`}
            variants={{
              hidden: { opacity: 0, y: 18 },
              show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 280, damping: 24 } },
            }}
            className="neu-pressable flex-1 rounded-2xl p-4 text-left disabled:cursor-default"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className={`inline-flex w-2 h-2 rounded-full ${highRiskItems.length > 0 ? "bg-danger" : "bg-safe"}`} />
              <span className="text-[10px] uppercase font-semibold tracking-widest text-foreground/70">Critical Items</span>
            </div>
            <p className="text-3xl font-semibold tracking-tighter">
              <CountUp value={highRiskItems.length} />
            </p>
            <p className="text-xs text-foreground/60 mt-1">
              {highRiskItems.length > 0 ? "Tap to see just these" : "Nothing needs attention"}
            </p>
          </motion.button>
        </motion.div>

        <RestockSuggestions currentItemNames={items.map((i) => i.name)} />

      </header>

        {/* Recipe prompt. Lives outside <header> — it is a suggestion, not
            part of the site banner, and it sat above the section holding the
            actual data. It carries its own padding now that it no longer
            inherits the header's. */}
        {highRiskItems.length > 0 && (
          <div className="mx-4 mt-5 neu-raised rounded-2xl overflow-hidden">
            {!generatedRecipe ? (
              <div className="p-4 flex flex-col gap-4">
                <div>
                  <h2 className="font-semibold text-sm flex items-center gap-2"><BrainCircuit size={14} /> Use up what's expiring</h2>
                  <p className="text-xs text-foreground/60 mt-1">Cook something using what expires first.</p>
                </div>
                <motion.button
                  whileHover={{ scale: isGeneratingRecipe ? 1 : 1.04 }}
                  whileTap={{ scale: isGeneratingRecipe ? 1 : 0.96 }}
                  onClick={() => generateRecipe()}
                  disabled={isGeneratingRecipe}
                  className="w-full justify-center flex items-center gap-2 bg-foreground text-background text-sm font-semibold px-5 h-11 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60 whitespace-nowrap"
                >
                  {isGeneratingRecipe ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {isGeneratingRecipe ? "Finding..." : "Find a Recipe"}
                </motion.button>
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="p-4 space-y-3">
                  <div>
                    <h4 className="font-bold text-lg leading-tight">{generatedRecipe.title}</h4>
                    <div className="flex items-center gap-1.5 text-foreground/55 text-[11px] mt-1">
                      <Clock size={11} /> {generatedRecipe.prepTime}
                    </div>
                  </div>

                  <div className="flex items-stretch gap-3">
                    <div className="flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-foreground/55">Saves</p>
                      <p className="text-xl font-bold tracking-tight tabular-nums leading-tight">
                        {generatedRecipe.fromPantry.length}<span className="text-[11px] font-medium text-foreground/60 ml-1">of your items</span>
                      </p>
                    </div>
                    <div className="w-px bg-border" />
                    <div className="flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-foreground/55">To buy</p>
                      <p className="text-xl font-bold tracking-tight tabular-nums leading-tight">
                        {generatedRecipe.toBuy.length}<span className="text-[11px] font-medium text-foreground/60 ml-1">{generatedRecipe.toBuy.length === 1 ? "ingredient" : "ingredients"}</span>
                      </p>
                    </div>
                  </div>

                  {generatedRecipe.usesItems.length > 0 && (
                    <p className="text-[11px] leading-relaxed text-foreground/70">
                      Uses {generatedRecipe.usesItems.slice(0, 4).join(", ")}
                      {generatedRecipe.usesItems.length > 4 ? ` +${generatedRecipe.usesItems.length - 4} more` : ""}.
                    </p>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowRecipe(true)}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-foreground text-background text-xs font-semibold px-3 h-11 rounded-xl hover:opacity-90 transition-opacity"
                    >
                      View recipe
                    </button>
                    <button
                      onClick={tryAnotherRecipe}
                      disabled={isGeneratingRecipe}
                      className="neu-raised-sm flex items-center justify-center gap-1.5 text-foreground/80 text-xs font-semibold px-3 h-11 rounded-xl transition-all disabled:opacity-60"
                    >
                      {isGeneratingRecipe ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                      Another
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      {showNotificationsPanel && (
        <>
          <button
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setShowNotificationsPanel(false)}
            className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px]"
          />
          {/* role/aria-modal/Escape were all missing: this was a plain div,
              so a screen-reader user got no announcement and Escape did
              nothing at all while the panel was open. */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="notifications-heading"
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="neu-panel fixed top-20 left-4 right-4 z-50 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-105 rounded-3xl overflow-hidden"
          >
            <div className="px-4 py-3.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${urgentNotificationCount > 0 ? "bg-danger/15 text-danger-strong" : "bg-safe/15 text-safe-strong"}`}>
                  <Bell size={16} />
                </div>
                <div className="min-w-0">
                  <h3 id="notifications-heading" className="text-sm font-bold tracking-tight">Needs your attention</h3>
                  <p className="text-[11px] text-foreground/60">
                    {urgentNotificationCount > 0
                      ? `${urgentNotificationCount} ${urgentNotificationCount === 1 ? "item is" : "items are"} critical`
                      : "Nothing is critical right now"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {notifications.length > 0 && (
                  <button
                    onClick={clearAllNotifications}
                    className="text-[11px] font-semibold text-foreground/60 hover:text-foreground px-2.5 py-1.5 rounded-lg hover:bg-foreground/5 transition-colors whitespace-nowrap"
                  >
                    Clear all
                  </button>
                )}
                <button
                  title="Close notifications"
                  aria-label="Close notifications"
                  onClick={() => setShowNotificationsPanel(false)}
                  className="neu-raised-sm w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-foreground/70"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {notifications.length > 0 && (
              <div className="px-3 pb-3 grid grid-cols-2 gap-2">
                <select
                  value={notificationSeverityFilter}
                  onChange={(e) => setNotificationSeverityFilter(e.target.value as typeof notificationSeverityFilter)}
                  aria-label="Filter notifications by severity"
                  className="neu-field rounded-lg px-2 h-9 text-xs"
                >
                  <option value="all">All severities</option>
                  <option value="high">Critical</option>
                  <option value="medium">Expiring soon</option>
                  <option value="low">Still good</option>
                  <option value="info">Info</option>
                </select>
                <select
                  value={notificationSort}
                  onChange={(e) => setNotificationSort(e.target.value as typeof notificationSort)}
                  aria-label="Sort notifications"
                  className="neu-field rounded-lg px-2 h-9 text-xs"
                >
                  <option value="newest">Newest first</option>
                  <option value="urgent">Most urgent first</option>
                </select>
              </div>
            )}

            <div onScroll={handleNotificationsScroll} className="max-h-96 overflow-y-auto px-3 pb-3 space-y-2">
              {notifications.length === 0 && !notificationsLoading && (
                <div className="text-center py-10 px-6">
                  <div className="neu-raised w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 text-safe">
                    <CheckCircle2 size={22} />
                  </div>
                  <p className="text-sm font-semibold text-foreground">All clear</p>
                  <p className="text-xs text-foreground/60 mt-1 leading-relaxed">Nothing in your pantry needs attention today.</p>
                </div>
              )}

              {notifications.length > 0 && visibleNotifications.length === 0 && (
                <div className="text-center py-8 text-sm text-foreground/60">No notifications match this filter.</div>
              )}

              {visibleNotifications.map((note) => {
                const NoteIcon = notificationIconMap[note.category];
                // The severity stripe carries the reading, so the row itself
                // can stay quiet. Before, every row was an identical grey box
                // with the word "high" set in small caps beside it.
                const tone = note.severity === "high"
                  ? { stripe: "bg-danger", chip: "bg-danger/15 text-danger-strong", label: "Critical" }
                  : note.severity === "medium"
                    ? { stripe: "bg-warning", chip: "bg-warning/15 text-warning-strong", label: "Soon" }
                    : note.severity === "low"
                      ? { stripe: "bg-safe", chip: "bg-safe/15 text-safe-strong", label: "Fine" }
                      : { stripe: "bg-foreground/25", chip: "bg-foreground/10 text-foreground/70", label: "Info" };

                return (
                  <motion.div
                    key={note.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: "spring", stiffness: 340, damping: 30 }}
                    className="neu-raised-sm rounded-xl overflow-hidden flex"
                  >
                    <div className={`w-1 shrink-0 ${tone.stripe}`} />
                    <div className="flex-1 min-w-0 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <NoteIcon size={14} className="text-foreground/55 shrink-0" />
                          <p className="text-xs font-bold text-foreground truncate">{note.title}</p>
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0 ${tone.chip}`}>
                          {tone.label}
                        </span>
                      </div>
                      <p className="text-xs text-foreground/70 leading-relaxed">{note.message}</p>
                    </div>
                  </motion.div>
                );
              })}

              {notificationsLoading && (
                <div className="py-4 flex items-center justify-center text-foreground/60">
                  <Loader2 size={16} className="animate-spin" />
                </div>
              )}

              {!notificationsLoading && !hasMoreNotifications && notifications.length > 0 && (
                <p className="text-center text-[11px] text-foreground/40 py-2">That is everything</p>
              )}
            </div>
          </motion.div>
        </>
      )}

      {/* Inventory */}
      <section id="inventory-log" className="flex-1 px-4 py-6" aria-labelledby="inventory-heading">
        {inlineError && (
          <div className="mb-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <CircleAlert size={16} className="text-danger mt-0.5 shrink-0" />
              <p className="text-sm text-danger font-medium leading-relaxed">{inlineError}</p>
            </div>
            <button
              onClick={() => setInlineError(null)}
              className="text-danger/70 hover:text-danger transition-colors"
              aria-label="Dismiss error"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 id="inventory-heading" className="font-semibold text-sm uppercase tracking-widest text-foreground/70">Your Pantry</h2>
          {/* aria-live: tapping the Critical tile, typing in search or
              changing a filter silently swaps the list underneath. Sighted
              users see it; a screen-reader user got no signal at all that
              the count had changed from 10 to 6. */}
          <p
            aria-live="polite"
            aria-atomic="true"
            className="text-xs font-medium text-foreground/60 tabular-nums shrink-0"
          >
            {dbLoading ? "Loading…" : `${inventoryFilteredItems.length} ${inventoryFilteredItems.length === 1 ? "item" : "items"}`}
          </p>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50 pointer-events-none" />
            <label htmlFor="pantry-search" className="sr-only">Search your pantry</label>
            <input
              id="pantry-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your pantry…"
              className="neu-field w-full rounded-xl pl-9 pr-3 h-11 text-sm"
            />
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            aria-controls="pantry-filters"
            title="Filter and sort"
            className={`neu-pressable relative h-11 w-11 shrink-0 rounded-xl flex items-center justify-center ${showFilters ? "text-brand" : "text-foreground/70"}`}
          >
            <SlidersHorizontal size={16} />
            {/* A collapsed control must still say when it is doing something,
                or a filtered list reads as a missing list. */}
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-brand text-white text-[10px] font-bold flex items-center justify-center leading-none tabular-nums">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        <AnimatePresence initial={false}>
          {showFilters && (
            <motion.div
              id="pantry-filters"
              key="filters"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="neu-inset rounded-2xl p-3 mb-4 flex flex-col gap-3">
                <div role="group" aria-label="Filter by diet" className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setIsVegMode(true)}
                    aria-pressed={isVegMode}
                    className={`h-11 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${isVegMode ? "bg-safe/20 text-safe-strong" : "neu-raised-sm text-foreground/70 hover:text-foreground"}`}
                  >
                    <Leaf size={14} /> Veg only
                  </button>
                  <button
                    onClick={() => setIsVegMode(false)}
                    aria-pressed={!isVegMode}
                    className={`h-11 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${!isVegMode ? "bg-foreground/10 text-foreground" : "neu-raised-sm text-foreground/70 hover:text-foreground"}`}
                  >
                    <UtensilsCrossed size={14} /> All items
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="risk-filter" className="text-[10px] font-semibold uppercase tracking-widest text-foreground/60">Show</label>
                    <select
                      id="risk-filter"
                      value={riskFilter}
                      onChange={(e) => setRiskFilter(e.target.value as "all" | RiskLevel)}
                      className="neu-field rounded-xl px-3 h-11 text-sm"
                    >
                      <option value="all">Everything</option>
                      <option value="high">Critical only</option>
                      <option value="medium">Expiring soon</option>
                      <option value="low">Still good</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="sort-order" className="text-[10px] font-semibold uppercase tracking-widest text-foreground/60">Sort by</label>
                    <select
                      id="sort-order"
                      value={inventorySortBy}
                      onChange={(e) => setInventorySortBy(e.target.value as typeof inventorySortBy)}
                      className="neu-field rounded-xl px-3 h-11 text-sm"
                    >
                      <option value="expiring">Dying first</option>
                      <option value="freshest">Freshest first</option>
                      <option value="name">Name (A-Z)</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={() => { void addMockInventoryData(); }}
                  disabled={isSeedingMockData}
                  className="neu-raised-sm h-11 rounded-xl text-xs font-semibold disabled:opacity-60 flex items-center justify-center gap-2 text-foreground/80"
                  title="Insert a sample pantry for testing and demos"
                >
                  {isSeedingMockData ? <Loader2 size={14} className="animate-spin" /> : <Package size={14} />}
                  Add Demo Data
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {dbLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-foreground/20" />
          </div>
        ) : inventoryFilteredItems.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border rounded-3xl bg-foreground/5 sleek-shadow-sm flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-background border border-border flex items-center justify-center mb-4 sleek-shadow">
              <ScanLine size={24} className="text-foreground/40" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">No items found</h3>
            <p className="text-sm text-foreground/60 max-w-50 leading-relaxed mb-6">
              {items.length > 0 ? "No items match the current filter." : "Scan a grocery receipt or barcode to start tracking food waste."}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => setShowReceiptMenu(true)}
                className="flex items-center gap-2 bg-foreground text-background text-sm font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity"
              >
                <Camera size={16} /> Scan Receipt
              </button>
              <button
                onClick={() => { void addMockInventoryData(); }}
                disabled={isSeedingMockData}
                className="flex items-center gap-2 border border-border bg-card text-foreground text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-foreground/5 transition-colors disabled:opacity-60"
              >
                {isSeedingMockData ? <Loader2 size={16} className="animate-spin" /> : <Package size={16} />}
                Add Demo Data
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {paginatedItems.map(item => {
              // Only suggest an alternative when a real scan actually rated the
              // item poorly. This used to key off a grade derived from the
              // item name's character count.
              const scoreValue = item.healthScore != null ? Number.parseFloat(item.healthScore) : NaN;
              const healthierAlternative = Number.isFinite(scoreValue) && scoreValue < 2.5
                ? getHealthierAlternativeHint(inferItemCategory(item.name))
                : undefined;
              const detectedAllergens = item.ingredientsText ? detectAllergens(item.ingredientsText) : null;

              return (
                <PantryCard
                  key={item.id}
                  {...item}
                  healthScore={item.healthScore}
                  // The chip used to read `isVegMode ? true : isVegItem(name)`,
                  // so with the "All items" view selected a chicken breast
                  // showed a red DIET WARNING to a non-vegetarian — the view
                  // toggle was standing in for the user's actual preference.
                  dietMatch={userDietPreference === "veg" ? isVegItem(item.name) : true}
                  healthierAlternative={healthierAlternative}
                  detectedAllergens={detectedAllergens}
                  actions={
                    /* "Used it" is the point of the whole product and it did
                       not exist: the only way an item ever left the pantry
                       was a red trash can, so eating your food and wasting it
                       were the same gesture. item_outcomes already stores the
                       difference — only the UI was missing. */
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { void markItemUsed(item.id); }}
                        className="flex-1 h-11 rounded-xl bg-safe/15 text-safe-strong text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-safe/25 transition-colors"
                        title={`Mark ${item.name} as used`}
                      >
                        <Check size={15} /> Used it
                      </button>
                      <button
                        onClick={() => openEditItem(item)}
                        className="neu-raised-sm w-11 h-11 shrink-0 rounded-xl flex items-center justify-center text-foreground/70 hover:text-foreground transition-colors"
                        title="Edit item"
                        aria-label={`Edit ${item.name}`}
                      >
                        <Pencil size={15} />
                      </button>
                      {/* Two taps, not one. Deleting was a single tap on a
                          destructive control whose only escape was catching a
                          toast before it timed out. The confirm state is
                          inline rather than a dialog so it can't be missed
                          and costs nothing to back out of. */}
                      {confirmDeleteId === item.id ? (
                        <>
                          <button
                            onClick={() => { setConfirmDeleteId(null); void deleteItem(item.id); }}
                            className="h-11 px-3 shrink-0 rounded-xl bg-danger text-white text-xs font-bold"
                            title={`Confirm removing ${item.name}`}
                          >
                            Remove
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="neu-raised-sm h-11 px-3 shrink-0 rounded-xl text-xs font-semibold text-foreground/70"
                            title="Keep it"
                          >
                            Keep
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(item.id)}
                          className="neu-raised-sm w-11 h-11 shrink-0 rounded-xl flex items-center justify-center text-foreground/50 hover:text-danger transition-colors"
                          title="Threw it away"
                          aria-label={`Remove ${item.name}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  }
                />
              );
            })}

            {sortedInventoryItems.length > INVENTORY_PAGE_SIZE && (
              <div className="mt-2 flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2">
                <p className="text-xs text-foreground/60">
                  Page {currentPage} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="h-8 w-8 rounded-lg border border-border bg-background hover:bg-foreground/5 disabled:opacity-40 flex items-center justify-center"
                    title="Previous page"
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="h-8 w-8 rounded-lg border border-border bg-background hover:bg-foreground/5 disabled:opacity-40 flex items-center justify-center"
                    title="Next page"
                    aria-label="Next page"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <input type="file" accept="image/*" ref={cameraInputRef} onChange={handleFileUpload} className="hidden" title="Upload receipt photo" />
      <input type="file" accept="image/*,.pdf,application/pdf" ref={galleryInputRef} onChange={handleFileUpload} className="hidden" title="Upload receipt from gallery" />
      <input type="file" accept=".pdf,application/pdf,image/*" ref={invoiceInputRef} onChange={handleFileUpload} className="hidden" title="Upload invoice file" />

      {/* Bottom Nav Bar — capped to the same 448px column as the content it
          belongs to. left-3/right-3 stretched it to the full viewport on
          desktop, roughly 2.8x the column above it, which made a deliberate
          layout cap read as a broken one. */}
      <nav aria-label="Primary" className="fixed bottom-4 left-3 right-3 z-50 flex flex-col items-center sm:left-1/2 sm:right-auto sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:px-3">
        {/* Receipt Action Menu */}
        {showReceiptMenu && (
          <div className="neu-panel mb-4 rounded-2xl p-2 flex flex-col gap-2 w-full max-w-xs animate-in slide-in-from-bottom-2 fade-in duration-200">
            <button 
              onClick={() => cameraInputRef.current?.click()}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-foreground/5 text-foreground font-semibold text-sm transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                <Camera size={16} />
              </div>
              Take Photo
            </button>
            <div className="h-px w-full bg-border" />
            <button 
              onClick={() => galleryInputRef.current?.click()}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-foreground/5 text-foreground font-semibold text-sm transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center shrink-0">
                <Search size={16} />
              </div>
              Upload Gallery
            </button>
            <div className="h-px w-full bg-border" />
            <button
              onClick={() => invoiceInputRef.current?.click()}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-foreground/5 text-foreground font-semibold text-sm transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0">
                <Info size={16} />
              </div>
              Upload Invoice / PDF
            </button>
          </div>
        )}

        <div className="flex items-center justify-between w-full bg-card/95 border border-border shadow-lg rounded-2xl p-2 gap-1 backdrop-blur-md">
          <button onClick={() => setShowBarcodeScanner(true)} className="flex-1 min-w-0 flex flex-col items-center justify-center gap-1 hover:bg-foreground/5 text-foreground/80 hover:text-foreground h-16 px-2 rounded-xl transition-all">
            <ScanLine size={18} /><span className="text-[10px] tracking-wide">Barcode</span>
          </button>

          <div className="w-px h-8 bg-border" />

          <button onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})} className="flex-1 min-w-0 flex flex-col items-center justify-center gap-1 hover:bg-foreground/5 text-foreground/80 hover:text-foreground h-16 px-2 rounded-xl transition-all">
            <HomeIcon size={18} /><span className="text-[10px] tracking-wide">Home</span>
          </button>

          <div className="w-px h-8 bg-border" />

          <button
            onClick={() => setShowReceiptMenu(!showReceiptMenu)}
            disabled={isUploading}
            className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-1 hover:bg-foreground/5 h-16 px-2 rounded-xl transition-all disabled:opacity-50 ${showReceiptMenu ? 'bg-foreground/10 text-foreground' : 'text-foreground/80 hover:text-foreground'}`}
          >
            {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
            <span className="text-[10px] tracking-wide">{isUploading ? "Reading" : "Receipt"}</span>
          </button>

          <div className="w-px h-8 bg-border" />

          <button onClick={() => setShowPantryChat(true)} className="flex-1 min-w-0 flex flex-col items-center justify-center gap-1 hover:bg-foreground/5 text-foreground/80 hover:text-foreground h-16 px-2 rounded-xl transition-all">
            <Sparkles size={18} /><span className="text-[10px] tracking-wide">Ask AI</span>
          </button>
        </div>
      </nav>

      {showBarcodeScanner && (
        <BarcodeScanner 
          onScan={handleBarcodeScan} 
          onClose={() => setShowBarcodeScanner(false)} 
        />
      )}

      {isAnalyzingFood && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="neu-panel p-6 rounded-2xl flex flex-col items-center gap-4">
            <Loader2 size={32} className="animate-spin text-foreground" />
            <p className="text-sm font-medium">Analyzing Ingredients...</p>
          </div>
        </div>
      )}

      {scannedResult && (
        <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4 animate-in fade-in zoom-in-95 duration-200">
          <div role="dialog" aria-modal="true" aria-labelledby="scanned-result-heading" className="neu-panel w-full h-full border-0 sm:h-auto sm:max-h-[90vh] sm:max-w-md sm:rounded-3xl sm:border overflow-hidden flex flex-col">
            {/* Header */}
            <div className="sticky top-0 bg-card/80 backdrop-blur-md z-10 border-b border-border px-5 py-4 flex justify-between items-center">
              <h3 id="scanned-result-heading" className="font-bold text-lg text-foreground truncate pr-4">{scannedResult.name}</h3>
              <button onClick={() => { setScannedResult(null); setScannedExpiry(null); }} title="Close analysis" aria-label="Close analysis" className="w-8 h-8 flex items-center justify-center rounded-full bg-foreground/10 hover:bg-foreground/20 text-foreground transition-colors shrink-0">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 flex-1 space-y-6 overflow-y-auto pb-6">
              {/* Expiry Date Card */}
              <div className="bg-foreground/5 rounded-2xl p-4 flex items-center justify-between border border-border/50 sleek-shadow gap-3">
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold uppercase tracking-widest text-foreground/60 mb-1">Expiry Date</span>
                  {scannedExpiry ? (
                    <>
                      <span className="text-lg font-black">{days(scannedExpiry.daysLeft)} left</span>
                      <span className="text-[11px] text-foreground/60 truncate">
                        {scannedExpiry.expiryDate ? `Expires ${scannedExpiry.expiryDate}` : "From printed shelf-life"}
                        {scannedExpiry.confidence !== "high" ? " · double-check label" : ""}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-foreground/60">Not scanned — will default to {DEFAULT_SCANNED_ITEM_DAYS_LEFT} days</span>
                  )}
                </div>
                <button
                  onClick={() => setShowExpiryScanner(true)}
                  className="flex items-center gap-1.5 border border-border bg-card text-foreground text-xs font-semibold px-3 py-2 rounded-lg hover:bg-foreground/5 transition-colors shrink-0 whitespace-nowrap"
                >
                  <CalendarClock size={13} /> {scannedExpiry ? "Rescan" : "Scan date"}
                </button>
              </div>

              {/* TruthIn Style Rating Card */}
              <div className="bg-foreground/5 rounded-2xl p-4 flex items-center justify-between border border-border/50 sleek-shadow">
                <div className="flex flex-col">
                  <span className="text-xs font-bold uppercase tracking-widest text-foreground/60 mb-1">Nutri-Trust Rating</span>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-black">{scannedResult.analysis.health_score || "N/A"}</span>
                    <span className="text-sm font-semibold text-foreground/60">/ 5.0</span>
                  </div>
                </div>
                <div className={`px-4 py-2 rounded-xl border flex flex-col items-center justify-center min-w[80px] ${
                  parseFloat(scannedResult.analysis.health_score) >= 4 ? "bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400" :
                  parseFloat(scannedResult.analysis.health_score) >= 2.5 ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-600 dark:text-yellow-400" :
                  "bg-danger/10 border-danger/20 text-danger"
                }`}>
                  <span className="text-[10px] uppercase font-bold tracking-widest opacity-80 mb-0.5">Grade</span>
                  <span className="font-bold text-sm leading-none">{scannedResult.analysis.health_grade_text || "Unknown"}</span>
                </div>
              </div>

              {/* Data Accuracy Disclaimer */}
              {scannedResult.analysis.data_accuracy_warning && (
                <div className="flex gap-2 items-start bg-blue-500/5 p-3 rounded-lg border border-blue-500/20 text-blue-600 dark:text-blue-400">
                  <Info size={14} className="mt-0.5 shrink-0" />
                  <p className="text-[10px] leading-relaxed uppercase tracking-wider font-semibold">
                    {scannedResult.analysis.data_accuracy_warning}
                  </p>
                </div>
              )}

              {/* What Should Concern You */}
              {(scannedResult.analysis.concerns?.length > 0 || scannedResult.analysis.processing_level || scannedResult.analysis.macronutrients) && (
                <div className="space-y-3">
                  <h4 className="font-bold flex items-center gap-2 text-foreground">
                    What Should Concern You <span className="text-xl">😲</span>
                  </h4>
                  <div className="bg-foreground/5 rounded-2xl border border-border/50 divide-y divide-border/50 overflow-hidden">
                    
                    {scannedResult.analysis.processing_level && (
                       <div className="p-3.5 flex justify-between items-center bg-danger/5">
                         <div className="flex items-center gap-2.5">
                           <Activity size={16} className="text-danger" />
                           <span className="text-sm font-medium text-foreground/80">Processing Level</span>
                         </div>
                         <span className="text-xs font-bold text-danger uppercase tracking-wider">{scannedResult.analysis.processing_level}</span>
                       </div>
                    )}
                    
                    {scannedResult.analysis.macronutrients && Object.entries(scannedResult.analysis.macronutrients).map(([key, value]) => (
                       <div key={key} className="p-3.5 flex justify-between items-center">
                         <div className="flex items-center gap-2.5">
                           <Zap size={16} className="text-orange-500" />
                           <span className="text-sm font-medium text-foreground/80 capitalize">{key.replace(/_/g, ' ')}</span>
                         </div>
                         <span className="text-xs font-bold text-foreground">{String(value)}</span>
                       </div>
                    ))}

                    {scannedResult.analysis.concerns?.map((concern: any, i: number) => (
                       <div key={i} className="p-3.5 flex flex-col gap-1.5">
                         <div className="flex justify-between items-center">
                           <div className="flex items-center gap-2.5">
                             <AlertTriangle size={16} className="text-danger" />
                             <span className="text-sm font-bold text-foreground">{concern.title}</span>
                           </div>
                           <span className="text-[10px] font-bold text-danger px-2 py-0.5 rounded-full bg-danger/10 uppercase tracking-widest">{concern.level}</span>
                         </div>
                         {concern.details && <p className="text-[11px] text-foreground/60 pl-6 leading-relaxed">{concern.details}</p>}
                       </div>
                    ))}
                  </div>
                </div>
              )}


              {/* What You'll Like */}
              {scannedResult.analysis.positives?.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-bold flex items-center gap-2 text-foreground">
                    What You'll Like <span className="text-xl">🙂</span>
                  </h4>
                  <div className="bg-green-500/5 rounded-2xl border border-green-500/20 divide-y divide-green-500/20 overflow-hidden">
                    {scannedResult.analysis.positives.map((pos: any, i: number) => (
                       <div key={i} className="p-3.5 flex flex-col gap-1.5 bg-green-500/5">
                         <div className="flex justify-between items-center">
                           <div className="flex items-center gap-2.5">
                             <CheckCircle2 size={16} className="text-green-600 dark:text-green-400" />
                             <span className="text-sm font-bold text-green-700 dark:text-green-300">{pos.title}</span>
                           </div>
                           <span className="text-[10px] font-bold text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full bg-green-500/20 uppercase tracking-widest">{pos.level}</span>
                         </div>
                         {pos.details && <p className="text-[11px] text-green-700/70 dark:text-green-300/70 pl-6 leading-relaxed">{pos.details}</p>}
                       </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Better Rated Options */}
              {scannedResult.analysis.alternatives?.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-bold text-foreground/80 text-sm">Better Rated Options</h4>
                  <div className="flex gap-3 overflow-x-auto pb-4 snap-x hide-scrollbar">
                    {scannedResult.analysis.alternatives.map((alt: any, i: number) => (
                      <div key={i} className="min-w-35 snap-center bg-card border border-border p-3 rounded-2xl shrink-0 flex flex-col sleek-shadow">
                        <div className="w-8 h-8 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-center font-black text-xs mb-2">
                           {alt.score}
                        </div>
                        <span className="text-xs font-bold text-foreground leading-tight">{alt.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {scannedResult?.analysis?.data_accuracy_warning?.includes("⚠️") && (
              <div className="px-4 pb-3">
                <button
                  onClick={() => setShowLabelScanner(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-orange-400/40 bg-orange-500/10 text-orange-500 text-sm font-semibold hover:bg-orange-500/20 transition-all"
                >
                  📷 Data looks wrong? Scan the nutrition label
                </button>
              </div>
            )}

            <div className="p-4 border-t border-border/60 bg-card">
              <button 
                onClick={() => { void addScannedItemToPantry(); }} 
                className="w-full bg-foreground text-background font-bold text-sm py-4 rounded-2xl hover:opacity-90 active:scale-[0.98] transition-all shadow-xl"
              >
                Add to My Pantry
              </button>
            </div>
          </div>
        </div>
      )}

      {editingItem && (
        <div className="fixed inset-0 z-50 bg-background/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="edit-item-heading" className="neu-panel w-full max-w-md rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 id="edit-item-heading" className="text-lg font-bold tracking-tight">Edit Item</h3>
              <button onClick={closeEditItem} title="Close edit" aria-label="Close edit" className="w-8 h-8 flex items-center justify-center rounded-full bg-foreground/10 hover:bg-foreground/20 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-widest text-foreground/60">Item Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-foreground/20"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-widest text-foreground/60">Days Remaining</label>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={editDaysLeft}
                  onChange={(e) => setEditDaysLeft(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-foreground/20"
                />
                <p className="text-[11px] text-foreground/60">Saving resets the freshness clock to start counting down from today.</p>
              </div>
            </div>

            <div className="mt-5 flex flex-col sm:flex-row gap-2">
              <button
                onClick={closeEditItem}
                disabled={isSavingEdit}
                className="flex-1 border border-border rounded-xl py-2.5 text-sm font-semibold hover:bg-foreground/5 transition-colors disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={() => { void saveEditItem(); }}
                disabled={isSavingEdit}
                className="flex-1 bg-foreground text-background rounded-xl py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isSavingEdit ? <Loader2 size={14} className="animate-spin" /> : null}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {manualBarcodeEntry && (
        <div className="fixed inset-0 z-50 bg-background/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="manual-barcode-heading" className="neu-panel w-full max-w-md rounded-2xl p-5">
            <h3 id="manual-barcode-heading" className="text-lg font-bold tracking-tight mb-1">Item not found in global database</h3>
            <p className="text-sm text-foreground/60 mb-4">
              Enter the product name for barcode {manualBarcodeEntry.code} to continue AI analysis.
            </p>
            <input
              type="text"
              value={manualBarcodeName}
              onChange={(e) => setManualBarcodeName(e.target.value)}
              placeholder="e.g., Whole Wheat Pasta"
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-foreground/20"
            />
            <label className="mt-3 flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={contributeToOFF}
                onChange={(e) => setContributeToOFF(e.target.checked)}
                className="mt-0.5 shrink-0"
              />
              <span className="text-xs text-foreground/60 leading-relaxed">
                Also share this barcode + name with Open Food Facts, the open database this app looks products up from, so other users benefit too.
              </span>
            </label>
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => {
                  setManualBarcodeEntry(null);
                  setManualBarcodeName("");
                  setContributeToOFF(false);
                }}
                className="flex-1 border border-border rounded-xl py-2.5 text-sm font-semibold hover:bg-foreground/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitManualBarcodeName}
                className="flex-1 bg-foreground text-background rounded-xl py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Analyze Item
              </button>
            </div>
          </div>
        </div>
      )}

      {dietConflictPrompt && (
        <div className="fixed inset-0 z-60 bg-black/40 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl p-px bg-linear-to-br from-red-500/60 via-red-400/20 to-white/30 shadow-[0_20px_50px_-12px_rgba(239,68,68,0.45)]">
            <div className="relative overflow-hidden rounded-3xl border border-red-300/30 bg-linear-to-b from-red-500/12 via-card/95 to-card/95 p-5 backdrop-blur-xl">
              <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-white/20 via-transparent to-transparent" />

              <div className="relative flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-2xl bg-red-500/15 border border-red-400/40 text-red-500 flex items-center justify-center shadow-inner shadow-red-500/20">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold tracking-tight text-red-500">Diet Warning</h3>
                  <p className="text-xs uppercase tracking-widest font-semibold text-red-500/80">Potential mismatch</p>
                </div>
              </div>

              <p className="relative text-sm text-foreground/80 mb-4 leading-relaxed">
                <span className="font-semibold text-foreground">{dietConflictPrompt.itemName}</span> may not match your diet.
                Add anyway?
              </p>

              <div className="mt-1 flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => setDietConflictPrompt(null)}
                  className="flex-1 border border-red-300/35 bg-white/40 rounded-xl py-2.5 text-sm font-bold hover:bg-white/60 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setDietConflictPrompt(null);
                  void addScannedItemToPantry(true);
                }}
                  className="flex-1 bg-linear-to-r from-red-500 to-red-600 text-white rounded-xl py-2.5 text-sm font-bold hover:brightness-105 active:scale-[0.99] transition-all shadow-lg shadow-red-500/35"
              >
                Yes, add anyway
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {barcodeRetryPrompt && (
        <div className="fixed inset-0 z-50 bg-background/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="barcode-retry-heading" className="neu-panel w-full max-w-md rounded-2xl p-5">
            <h3 id="barcode-retry-heading" className="text-lg font-bold tracking-tight mb-1">Couldn&apos;t verify barcode</h3>
            <p className="text-sm text-foreground/60 mb-4">
              We couldn&apos;t identify barcode {barcodeRetryPrompt.code} from public food databases.
              Is this a food item?
            </p>

            {!showBarcodeRetryOptions ? (
              <div className="mt-2 flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => {
                    setBarcodeRetryPrompt(null);
                    setInlineError("Item skipped. If this is food, you can scan again anytime.");
                  }}
                  className="flex-1 border border-border rounded-xl py-2.5 text-sm font-semibold hover:bg-foreground/5 transition-colors"
                >
                  No
                </button>
                <button
                  onClick={() => setShowBarcodeRetryOptions(true)}
                  className="flex-1 bg-foreground text-background rounded-xl py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  Yes, it&apos;s food
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => {
                      setBarcodeRetryPrompt(null);
                      setShowBarcodeRetryOptions(false);
                      setShowBarcodeScanner(true);
                    }}
                    className="flex-1 border border-border rounded-xl py-2.5 text-sm font-semibold hover:bg-foreground/5 transition-colors"
                  >
                    Scan again
                  </button>
                  <button
                    onClick={() => {
                      const code = manualRetryBarcode.trim();
                      if (code.length < 8) {
                        setInlineError("Enter a valid barcode (at least 8 digits).");
                        return;
                      }
                      setBarcodeRetryPrompt(null);
                      setShowBarcodeRetryOptions(false);
                      void handleBarcodeScan(code);
                    }}
                    className="flex-1 bg-foreground text-background rounded-xl py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
                  >
                    Check typed barcode
                  </button>
                </div>

                <button
                  onClick={() => {
                    const code = manualRetryBarcode.trim() || barcodeRetryPrompt.code;
                    setBarcodeRetryPrompt(null);
                    setShowBarcodeRetryOptions(false);
                    setManualBarcodeEntry({
                      code,
                      ingredients: PLACEHOLDER_INGREDIENTS_TEXT,
                      categories: "Unknown",
                    });
                  }}
                  className="w-full border border-border rounded-xl py-2.5 text-sm font-semibold hover:bg-foreground/5 transition-colors"
                >
                  Type item name instead
                </button>

                <input
                  type="text"
                  value={manualRetryBarcode}
                  onChange={(e) => setManualRetryBarcode(e.target.value.replace(/\D/g, ""))}
                  inputMode="numeric"
                  placeholder="Type barcode digits"
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-foreground/20"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {showLabelScanner && (
        <NutritionLabelScanner
          onResult={handleNutritionLabelResult}
          onClose={() => setShowLabelScanner(false)}
        />
      )}

      {showExpiryScanner && (
        <ExpiryDateScanner
          onResult={handleExpiryScanResult}
          onClose={() => setShowExpiryScanner(false)}
        />
      )}

      {showShoppingList && (
        <ShoppingListModal onClose={() => setShowShoppingList(false)} />
      )}

      {showRecipe && generatedRecipe && (
        <RecipeModal
          recipe={generatedRecipe}
          onClose={() => setShowRecipe(false)}
          onTryAnother={tryAnotherRecipe}
          isRegenerating={isGeneratingRecipe}
          onAddMissing={() => { void addMissingIngredientsToShoppingList(); }}
          isAddingToShoppingList={isAddingToShoppingList}
        />
      )}

      {showPantryChat && (
        <PantryChatModal
          items={items.map((i) => ({ name: i.name, daysLeft: i.daysLeft, risk: i.risk, ingredientsText: i.ingredientsText }))}
          dietaryPreference={String(user?.user_metadata?.dietary_preference || "none")}
          onClose={() => setShowPantryChat(false)}
        />
      )}
    </div>
    </MotionConfig>
  );
}
