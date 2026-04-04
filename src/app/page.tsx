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
import { PantryCard, RiskLevel } from "@/components/pantry-card";
import { ProfileDropdown } from "@/components/profile-dropdown";
import BarcodeScanner from "@/components/barcode-scanner";
import {
  Camera, BrainCircuit, Loader2, TrendingUp, ScanLine,
  ExternalLink, Clock, X, Trash2, Home as HomeIcon, Info, Activity, Zap, AlertTriangle, CheckCircle2, Search, CircleAlert, Bell, Carrot, Apple, Milk, Drumstick, Wheat, CupSoda, Croissant, Snowflake, Candy, Package, ChevronLeft, ChevronRight
} from "lucide-react";
import { toast } from "sonner";

interface Item {
  id: string;
  name: string;
  daysLeft: number;
  risk: RiskLevel;
  purchaseDate: string;
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
}

const NOTIFICATIONS_PAGE_SIZE = 8;
const INVENTORY_PAGE_SIZE = 6;

// No fallback items — real users start with an empty pantry.

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<Item[]>([]);
  const [dbLoading, setDbLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingRecipe, setIsGeneratingRecipe] = useState(false);
  const [generatedRecipe, setGeneratedRecipe] = useState<{ title: string; time: string; image: string; link: string } | null>(null);
  const [recipeSourceItem, setRecipeSourceItem] = useState<string>("");
  const [recipeItemIndex, setRecipeItemIndex] = useState(0);
  const [isVegMode, setIsVegMode] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [isAnalyzingFood, setIsAnalyzingFood] = useState(false);
  const [scannedResult, setScannedResult] = useState<ScannedResultEntry | null>(null);
  const [barcodeRetryPrompt, setBarcodeRetryPrompt] = useState<{ code: string } | null>(null);
  const [showBarcodeRetryOptions, setShowBarcodeRetryOptions] = useState(false);
  const [manualRetryBarcode, setManualRetryBarcode] = useState("");
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [dietConflictPrompt, setDietConflictPrompt] = useState<{ userDiet: DietPreference; itemDiet: ItemDietType; itemName: string } | null>(null);
  const [manualBarcodeEntry, setManualBarcodeEntry] = useState<{ code: string; ingredients: string; categories: string } | null>(null);
  const [manualBarcodeName, setManualBarcodeName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<"all" | RiskLevel>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [showNotificationsPanel, setShowNotificationsPanel] = useState(false);
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  const [notificationPage, setNotificationPage] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [hasMoreNotifications, setHasMoreNotifications] = useState(true);
  const [notificationsInitialized, setNotificationsInitialized] = useState(false);


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
  const sortedInventoryItems = [...inventoryFilteredItems].sort((a, b) => a.daysLeft - b.daysLeft);
  const totalPages = Math.max(1, Math.ceil(sortedInventoryItems.length / INVENTORY_PAGE_SIZE));
  const paginatedItems = sortedInventoryItems.slice((currentPage - 1) * INVENTORY_PAGE_SIZE, currentPage * INVENTORY_PAGE_SIZE);
  const highRiskItems = displayedItems.filter(i => i.risk === "high");
  const urgentNotificationCount = items.filter(i => i.daysLeft > 0 && i.daysLeft <= 3).length;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, riskFilter, isVegMode]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

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
        message: `${row.name} may spoil in ${currentDays} day(s).`,
        severity: "high",
        createdAt,
        category,
      };
    }

    if (currentDays <= 7) {
      return {
        id: `${row.id}-${createdAt}`,
        title: "Use soon",
        message: `${row.name} is still fresh but should be used within ${currentDays} day(s).`,
        severity: "medium",
        createdAt,
        category,
      };
    }

    return {
      id: `${row.id}-${createdAt}`,
      title: "Inventory update",
      message: `${row.name} is in good condition with ${currentDays} day(s) left.`,
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
        })));
      } else {
        setItems([]);
      }
      setDbLoading(false);
    };

    fetchItems();

    // ─── Real-time subscription ─────────────────────────────────
    const channel = supabase
      .channel("pantry-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "pantry_items", filter: `user_id=eq.${user.id}` },
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

        toast("Expiry Reminder", {
          description: `${item.name} may spoil in ${item.daysLeft} day(s). Use it soon.`,
          action: { label: "Got it", onClick: () => {} },
        });

        if (typeof window !== "undefined") {
          localStorage.setItem(key, "1");
        }
      });
    }, 4000);
    return () => clearTimeout(t);
  }, [user, items]);

  // ─── Delete item ────────────────────────────────────────────────
  const deleteItem = async (id: string) => {
    setInlineError(null);
    const itemToUndo = items.find(i => i.id === id);
    if (!itemToUndo) return;

    setItems(prev => prev.filter(i => i.id !== id));
    if (!id.startsWith("seed-")) {
      await supabase.from("pantry_items").delete().eq("id", id);
    }
    
    toast("Item removed", {
      description: `${itemToUndo.name} was deleted.`,
      action: {
        label: "Undo",
        onClick: async () => {
          setItems(prev => [...prev, itemToUndo]);
          if (!id.startsWith("seed-") && user) {
            const rowToInsert = {
               id: itemToUndo.id,
               user_id: user.id,
               name: itemToUndo.name,
               days_left: itemToUndo.daysLeft,
               risk: itemToUndo.risk,
               purchase_date: itemToUndo.purchaseDate
            };
            await supabase.from("pantry_items").insert([rowToInsert]);
          }
        }
      }
    });
  };

  // ─── Recipe generation ──────────────────────────────────────────
  const generateRecipe = async (preferredItem?: string) => {
    const fallbackRecipes = [
      {
        title: "Veggie Stir-Fry Bowl",
        time: "20m prep",
        image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80",
        link: "https://www.bbcgoodfood.com/recipes/collection/stir-fry-recipes"
      },
      {
        title: "Quick Pantry Pasta",
        time: "18m prep",
        image: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=900&q=80",
        link: "https://www.simplyrecipes.com/quick-pasta-recipes-4799018"
      },
      {
        title: "One-Pot Rice & Beans",
        time: "25m prep",
        image: "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=900&q=80",
        link: "https://www.loveandlemons.com/rice-and-beans/"
      }
    ];

    const preferredItemName = preferredItem || highRiskItems[0]?.name || displayedItems[0]?.name || "";
    const primaryToken = preferredItemName
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .find((w) => w.length > 2) || "chicken";

    setIsGeneratingRecipe(true);
    setInlineError(null);

    try {
      const searchByIngredient = async (ingredient: string) => {
        const filterRes = await fetch(`https://www.themealdb.com/api/json/v1/1/filter.php?i=${encodeURIComponent(ingredient)}`);
        const filterData = await filterRes.json();
        const meals = Array.isArray(filterData?.meals) ? filterData.meals : [];
        if (meals.length === 0) return null;

        const pickedMeal = meals[Math.floor(Math.random() * Math.min(meals.length, 8))];
        const detailRes = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${pickedMeal.idMeal}`);
        const detailData = await detailRes.json();
        const meal = detailData?.meals?.[0] || pickedMeal;

        return {
          title: meal.strMeal || "Smart Pantry Recipe",
          time: "20m prep",
          image: meal.strMealThumb || fallbackRecipes[0].image,
          link: meal.strSource || meal.strYoutube || `https://www.themealdb.com/meal/${meal.idMeal}`
        };
      };

      let recipe = await searchByIngredient(primaryToken);

      if (!recipe && preferredItemName) {
        recipe = await searchByIngredient(preferredItemName);
      }

      if (!recipe) {
        recipe = fallbackRecipes[Math.floor(Math.random() * fallbackRecipes.length)];
      }

      setGeneratedRecipe(recipe);
      setRecipeSourceItem(preferredItemName);
      toast("Recipe Ready", { description: `Generated a recipe using ${preferredItemName || "pantry"} ingredients.` });
    } catch {
      const recipe = fallbackRecipes[Math.floor(Math.random() * fallbackRecipes.length)];
      setGeneratedRecipe(recipe);
      setInlineError("Live recipe provider was unavailable, so we loaded a curated fallback recipe.");
    } finally {
      setIsGeneratingRecipe(false);
    }
  };

  const tryAnotherRecipe = async () => {
    if (isGeneratingRecipe) return;

    const sourceItems = highRiskItems.length > 0 ? highRiskItems : displayedItems;
    if (sourceItems.length === 0) {
      await generateRecipe();
      return;
    }

    const nextIndex = (recipeItemIndex + 1) % sourceItems.length;
    setRecipeItemIndex(nextIndex);
    await generateRecipe(sourceItems[nextIndex].name);
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

        const rows = normalizedItems.map((apiItem) => ({
          user_id: user.id,
          name: apiItem.name,
          days_left: apiItem.days_left,
          risk: apiItem.risk,
          purchase_date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
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
      let productIngredients = "None provided, rely purely on AI general knowledge";
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

      const aiRes = await fetch("/api/analyze-food", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        const isEstimated = !!(nutritionData as any).__isEstimated;
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
        setScannedResult({
          name: productName,
          analysis,
          itemDiet: detectedItemDiet,
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
        setScannedResult({ name: typedName, analysis, itemDiet: detectedItemDiet });
      }
    } catch {
      setInlineError("Unable to analyze this item right now. Please try again in a moment.");
    } finally {
      setIsAnalyzingFood(false);
      setManualBarcodeEntry(null);
      setManualBarcodeName("");
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

    const newItem = {
      user_id: user.id,
      name: scannedResult.name,
      days_left: 30, // Default for pantry scanned items
      risk: "low",
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
         }, ...prev];
       });
       toast("Added to Pantry");
    } else if (error) {
       setInlineError("Item was analyzed, but could not be saved to cloud inventory.");
    }
     setDietConflictPrompt(null);
    setScannedResult(null);
  };


  // Loading state
  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={24} className="animate-spin text-foreground/30" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen pb-32 sm:pb-28 bg-background">
      {/* Header */}
      <header className="px-4 sm:px-6 pt-8 sm:pt-10 pb-6 border-b border-border bg-card/90 backdrop-blur-sm">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-2">
            <Image
              src="/logo.svg"
              alt="Nutri-Trust logo"
              width={24}
              height={24}
              className="w-6 h-6 rounded-md object-contain"
            />
            <h1 className="text-xl font-bold tracking-tight">Nutri-Trust</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              title="Open notifications"
              aria-label="Open notifications"
              onClick={handleNotificationPanelToggle}
              className="relative w-9 h-9 rounded-full border border-border bg-card hover:bg-foreground/5 transition-colors flex items-center justify-center"
            >
              <Bell size={16} className="text-foreground/80" />
              {urgentNotificationCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center leading-none">
                  {urgentNotificationCount > 9 ? "9+" : urgentNotificationCount}
                </span>
              )}
            </button>
            <ProfileDropdown />
          </div>
        </div>

        {/* KPI Widgets */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4">
          <div className="flex-1 rounded-xl border border-border bg-background p-4 sleek-shadow">
            <div className="flex items-center gap-2 mb-2 opacity-70">
              <TrendingUp size={14} className="text-safe" />
              <span className="text-[10px] uppercase font-semibold tracking-widest">Value Retained</span>
            </div>
            <p className="text-3xl font-semibold tracking-tighter">{displayedItems.length > 0 ? "₹3,450" : "₹0"}</p>
            <p className="text-xs text-foreground/50 mt-1">This Week</p>
          </div>
          <div className="flex-1 rounded-xl border border-border bg-background p-4 sleek-shadow">
            <div className="flex items-center gap-2 mb-2 opacity-70">
              <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />
              <span className="text-[10px] uppercase font-semibold tracking-widest">Critical Items</span>
            </div>
            <p className="text-3xl font-semibold tracking-tighter">{highRiskItems.length}</p>
            <p className="text-xs text-foreground/50 mt-1">Require Action</p>
          </div>
        </div>

        {/* AI Recipe Card */}
        {highRiskItems.length > 0 && (
          <div className="rounded-xl border border-border bg-foreground text-background overflow-hidden">
            {!generatedRecipe ? (
              <div className="p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div>
                  <h4 className="font-semibold text-sm flex items-center gap-2"><BrainCircuit size={14} /> AI Optimization</h4>
                  <p className="text-xs text-background/70 mt-1">Generate a recipe to utilize critical items.</p>
                </div>
                <button onClick={() => generateRecipe()} disabled={isGeneratingRecipe} className="w-full sm:w-auto justify-center flex items-center gap-2 bg-background text-foreground text-xs font-semibold px-4 py-2.5 rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap">
                  {isGeneratingRecipe ? <Loader2 size={14} className="animate-spin" /> : "Generate"}
                </button>
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="h-32 w-full bg-cover bg-center relative">
                  <img src={generatedRecipe.image} alt={generatedRecipe.title} className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-linear-to-t from-foreground/90 to-transparent" />
                  <div className="absolute top-3 right-3 bg-black/30 backdrop-blur-sm px-2 py-1 rounded-lg border border-white/10 flex items-center gap-1.5 text-white">
                    <Clock size={12} /><span className="text-[10px] font-semibold">{generatedRecipe.time}</span>
                  </div>
                </div>
                <div className="p-4 pt-2 flex justify-between items-end gap-2">
                  <div>
                    <p className="text-[10px] text-background/60 uppercase font-semibold tracking-widest mb-1">AI Recommendation</p>
                    <h4 className="font-bold text-lg leading-tight">{generatedRecipe.title}</h4>
                    {recipeSourceItem && (
                      <p className="text-[11px] text-background/70 mt-1">Using near-expiry item: {recipeSourceItem}</p>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-center shrink-0">
                    <button
                      onClick={tryAnotherRecipe}
                      disabled={isGeneratingRecipe}
                      className="flex items-center justify-center gap-1.5 border border-background/30 text-background text-xs font-semibold px-3 py-2 rounded-lg hover:bg-background/10 transition-all disabled:opacity-60"
                    >
                      {isGeneratingRecipe ? <Loader2 size={12} className="animate-spin" /> : null}
                      Try another
                    </button>
                    <a href={generatedRecipe.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 bg-background text-foreground text-xs font-semibold px-3 py-2 rounded-lg hover:scale-105 active:scale-95 transition-all justify-center">
                      Cook this <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </header>

      {showNotificationsPanel && (
        <>
          <button
            aria-label="Close notifications"
            onClick={() => setShowNotificationsPanel(false)}
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
          />
          <div className="fixed top-20 left-4 right-4 z-50 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-105 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold tracking-tight">Notifications</h3>
                <p className="text-[11px] text-foreground/50">Scroll to load more</p>
              </div>
              <button
                title="Close notifications"
                aria-label="Close notifications"
                onClick={() => setShowNotificationsPanel(false)}
                className="w-8 h-8 rounded-full hover:bg-foreground/5 flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>

            <div onScroll={handleNotificationsScroll} className="max-h-96 overflow-y-auto p-3 space-y-2">
              {notifications.length === 0 && !notificationsLoading && (
                <div className="text-center py-8 text-sm text-foreground/60">No notifications yet.</div>
              )}

              {notifications.map((note) => {
                const NoteIcon = notificationIconMap[note.category];

                return (
                  <div key={note.id} className="rounded-xl border border-border bg-background px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-md bg-foreground/6 border border-border flex items-center justify-center text-foreground/70 shrink-0">
                          <NoteIcon size={13} />
                        </div>
                        <p className="text-xs font-semibold text-foreground truncate">{note.title}</p>
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-wide ${note.severity === "high" ? "text-danger" : note.severity === "medium" ? "text-warning" : "text-foreground/50"}`}>
                        {note.severity}
                      </span>
                    </div>
                    <p className="text-xs text-foreground/70 leading-relaxed">{note.message}</p>
                  </div>
                );
              })}

              {notificationsLoading && (
                <div className="py-4 flex items-center justify-center text-foreground/50">
                  <Loader2 size={16} className="animate-spin" />
                </div>
              )}

              {!notificationsLoading && !hasMoreNotifications && notifications.length > 0 && (
                <p className="text-center text-[11px] text-foreground/40 py-2">No more notifications</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Inventory */}
      <main className="flex-1 px-4 sm:px-6 py-6">
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

        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
          <h2 className="font-semibold text-sm uppercase tracking-widest text-foreground/70">Inventory Log</h2>
          <div className="flex items-center gap-1 bg-foreground/5 p-1 rounded-full border border-border/50 w-fit">
            <button
              onClick={() => setIsVegMode(true)}
              className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all ${isVegMode ? "bg-green-500/20 text-green-600 dark:text-green-400 shadow-sm" : "text-foreground/50 hover:text-foreground/80"}`}
            >
              🌱 Veg
            </button>
            <button
              onClick={() => setIsVegMode(false)}
              className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all ${!isVegMode ? "bg-card text-foreground shadow-sm" : "text-foreground/50 hover:text-foreground/80"}`}
            >
              🍗 All
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 mb-4">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search inventory..."
              className="w-full bg-card border border-border rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-foreground/30"
            />
          </div>
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value as "all" | RiskLevel)}
            className="bg-card border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-foreground/30"
            title="Filter by risk"
          >
            <option value="all">All Risk</option>
            <option value="high">High Risk</option>
            <option value="medium">Medium Risk</option>
            <option value="low">Low Risk</option>
          </select>
          <div className="text-xs font-medium text-foreground/50 flex items-center justify-start sm:justify-end px-1">
            {dbLoading ? "Loading..." : `Showing ${inventoryFilteredItems.length} items`}
          </div>
        </div>

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
            <button
              onClick={() => setShowReceiptMenu(true)}
              className="flex items-center gap-2 bg-foreground text-background text-sm font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity"
            >
              <Camera size={16} /> Scan Receipt
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {paginatedItems.map(item => {
              // Deterministic assignment of mock TruthIn values based on item name character count
              const ratingsLineup = ["A", "B", "C", "D", "E"] as const;
              const healthRating = ratingsLineup[item.name.length % 5];
              const healthierAlternative = ["C", "D", "E"].includes(healthRating) ? `Organic/Whole ${item.name}` : undefined;

              return (
                <div key={item.id} className="relative group">
                  <PantryCard 
                    {...item} 
                    healthRating={healthRating} 
                    dietMatch={isVegMode ? true : isVegItem(item.name)} 
                    healthierAlternative={healthierAlternative} 
                  />
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="absolute bottom-4 right-4 bg-danger text-white p-2.5 rounded-full shadow-lg z-20 active:scale-95 transition-all opacity-90 hover:opacity-100"
                    title="Remove item"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
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
      </main>

      <input type="file" accept="image/*" ref={cameraInputRef} onChange={handleFileUpload} className="hidden" title="Upload receipt photo" />
      <input type="file" accept="image/*,.pdf,application/pdf" ref={galleryInputRef} onChange={handleFileUpload} className="hidden" title="Upload receipt from gallery" />
      <input type="file" accept=".pdf,application/pdf,image/*" ref={invoiceInputRef} onChange={handleFileUpload} className="hidden" title="Upload invoice file" />

      {/* Bottom Nav Bar */}
      <div className="fixed bottom-4 left-3 right-3 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-50 flex flex-col items-center">
        {/* Receipt Action Menu */}
        {showReceiptMenu && (
          <div className="mb-4 bg-card border border-border shadow-2xl rounded-2xl p-2 flex flex-col gap-2 w-full max-w-xs animate-in slide-in-from-bottom-2 fade-in duration-200">
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

        <div className="flex items-center justify-between w-full sm:w-auto bg-card/95 border border-border shadow-2xl rounded-2xl p-2 gap-1 sm:gap-2 backdrop-blur-md">
          <button onClick={() => setShowBarcodeScanner(true)} className="flex-1 sm:flex-none min-w-0 flex flex-col items-center justify-center gap-1 hover:bg-foreground/5 text-foreground/80 hover:text-foreground h-16 px-2 sm:w-16 rounded-xl transition-all">
            <ScanLine size={18} /><span className="text-[10px] tracking-wide">Barcode</span>
          </button>

          <div className="w-px h-8 bg-border hidden sm:block" />

          <button onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})} className="flex-1 sm:flex-none min-w-0 flex flex-col items-center justify-center gap-1 hover:bg-foreground/5 text-foreground/80 hover:text-foreground h-16 px-2 sm:w-16 rounded-xl transition-all">
            <HomeIcon size={18} /><span className="text-[10px] tracking-wide">Home</span>
          </button>

          <div className="w-px h-8 bg-border hidden sm:block" />

          <button 
            onClick={() => setShowReceiptMenu(!showReceiptMenu)} 
            disabled={isUploading} 
            className={`flex-1 sm:flex-none min-w-0 flex flex-col items-center justify-center gap-1 hover:bg-foreground/5 h-16 px-2 sm:w-16 rounded-xl transition-all disabled:opacity-50 ${showReceiptMenu ? 'bg-foreground/10 text-foreground' : 'text-foreground/80 hover:text-foreground'}`}
          >
            {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
            <span className="text-[10px] tracking-wide">{isUploading ? "Reading" : "Receipt"}</span>
          </button>
        </div>
      </div>

      {showBarcodeScanner && (
        <BarcodeScanner 
          onScan={handleBarcodeScan} 
          onClose={() => setShowBarcodeScanner(false)} 
        />
      )}

      {isAnalyzingFood && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-card p-6 rounded-2xl border border-border shadow-2xl flex flex-col items-center gap-4">
            <Loader2 size={32} className="animate-spin text-foreground" />
            <p className="text-sm font-medium">Analyzing Ingredients...</p>
          </div>
        </div>
      )}

      {scannedResult && (
        <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-card w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-md sm:rounded-3xl border-0 sm:border border-border shadow-2xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="sticky top-0 bg-card/80 backdrop-blur-md z-10 border-b border-border px-5 py-4 flex justify-between items-center">
              <h3 className="font-bold text-lg text-foreground truncate pr-4">{scannedResult.name}</h3>
              <button onClick={() => setScannedResult(null)} title="Close analysis" aria-label="Close analysis" className="w-8 h-8 flex items-center justify-center rounded-full bg-foreground/10 hover:bg-foreground/20 text-foreground transition-colors shrink-0">
                <X size={18} />
              </button>
            </div>
            
            <div className="p-5 flex-1 space-y-6 overflow-y-auto">
              {/* TruthIn Style Rating Card */}
              <div className="bg-foreground/5 rounded-2xl p-4 flex items-center justify-between border border-border/50 sleek-shadow">
                <div className="flex flex-col">
                  <span className="text-xs font-bold uppercase tracking-widest text-foreground/50 mb-1">Nutri-Trust Rating</span>
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
            
            {/* Sticky Action Button */}
            <div className="sticky bottom-0 left-0 right-0 p-4 bg-linear-to-t from-card via-card to-transparent pt-10 border-t border-border/60">
              <button 
                onClick={() => { void addScannedItemToPantry(); }} 
                className="w-full bg-foreground text-background font-bold text-sm py-4 rounded-2xl hover:opacity-90 active:scale-[0.98] transition-all shadow-xl"
              >
                Add to Hub Inventory
              </button>
            </div>
          </div>
        </div>
      )}

      {manualBarcodeEntry && (
        <div className="fixed inset-0 z-50 bg-background/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-5">
            <h3 className="text-lg font-bold tracking-tight mb-1">Item not found in global database</h3>
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
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => {
                  setManualBarcodeEntry(null);
                  setManualBarcodeName("");
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
          <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-5">
            <h3 className="text-lg font-bold tracking-tight mb-1">Couldn&apos;t verify barcode</h3>
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
                      ingredients: "None provided, rely purely on AI general knowledge",
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
    </div>
  );
}
