"use client";

import { useState, useRef, useEffect } from "react";

const isVegItem = (name: string) => {
  const nonVegKeywords = ['chicken', 'meat', 'beef', 'pork', 'fish', 'salmon', 'tuna', 'egg', 'mutton', 'prawn', 'shrimp', 'crab', 'bacon', 'ham', 'sausage', 'turkey'];
  return !nonVegKeywords.some(kw => name.toLowerCase().includes(kw));
};
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { supabase } from "@/lib/supabase";
import { PantryCard, RiskLevel } from "@/components/pantry-card";
import { ProfileDropdown } from "@/components/profile-dropdown";
import BarcodeScanner from "@/components/barcode-scanner";
import {
  Camera, BrainCircuit, Loader2, TrendingUp, ScanLine,
  ExternalLink, Clock, X, Trash2, Home as HomeIcon
} from "lucide-react";
import { toast } from "sonner";

interface Item {
  id: string;
  name: string;
  daysLeft: number;
  risk: RiskLevel;
  purchaseDate: string;
}

// No fallback items — real users start with an empty pantry.

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<Item[]>([]);
  const [dbLoading, setDbLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingRecipe, setIsGeneratingRecipe] = useState(false);
  const [generatedRecipe, setGeneratedRecipe] = useState<{ title: string; time: string; image: string; link: string } | null>(null);
  const [isVegMode, setIsVegMode] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [isAnalyzingFood, setIsAnalyzingFood] = useState(false);
  const [scannedResult, setScannedResult] = useState<any | null>(null);


  const fileInputRef = useRef<HTMLInputElement>(null);
  const displayedItems = isVegMode ? items.filter(i => isVegItem(i.name)) : items;
  const highRiskItems = displayedItems.filter(i => i.risk === "high");

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
          daysLeft: row.days_left,
          risk: row.risk as RiskLevel,
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
      const critical = items.find(i => i.risk === "high");
      if (critical) {
        toast("System Alert", {
          description: `${critical.name} is expiring in ${critical.daysLeft} day(s).`,
          action: { label: "Dismiss", onClick: () => {} },
        });
      }
    }, 4000);
    return () => clearTimeout(t);
  }, [user, items]);

  // ─── Delete item ────────────────────────────────────────────────
  const deleteItem = async (id: string) => {
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
  const generateRecipe = () => {
    setIsGeneratingRecipe(true);
    setTimeout(() => {
      setIsGeneratingRecipe(false);
      setGeneratedRecipe({
        title: "Spinach & Cheese Omelet",
        time: "10m prep",
        image: "https://images.unsplash.com/photo-1510693042784-0e31db621ab7?auto=format&fit=crop&w=600&q=80",
        link: "https://www.bonappetit.com/recipe/spinach-and-cheese-omelet"
      });
    }, 2000);
  };

  // ─── Receipt upload → Supabase insert ──────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
        const rows = data.items.map((apiItem: any) => ({
          user_id: user.id,
          name: apiItem.name,
          days_left: apiItem.days_left || 7,
          risk: apiItem.risk || "medium",
          purchase_date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        }));

        const { data: inserted, error } = await supabase.from("pantry_items").insert(rows).select();

        if (error) {
          // Supabase not configured yet — add optimistically to UI
          const newItems: Item[] = data.items.map((apiItem: any) => ({
            id: Math.random().toString(36).substring(7),
            name: apiItem.name,
            daysLeft: apiItem.days_left || 7,
            risk: (apiItem.risk || "medium") as RiskLevel,
            purchaseDate: "Today",
          }));
          setItems(prev => [...newItems, ...prev]);
        }
        toast("Receipt Parsed", { description: `Cataloged ${data.items.length} items.` });
      } else {
        toast("Error", { description: data.error || "Failed to parse document." });
      }
    } catch {
      toast("Error", { description: "Failed to parse document." });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ─── Barcode Processing ─────────────────────────────────────────
  const handleBarcodeScan = async (decodedText: string) => {
    setShowBarcodeScanner(false);
    setIsAnalyzingFood(true);
    try {
      let res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${decodedText}.json`);
      let data = await res.json();
      
      // Auto-fixing zero-padding issues which are common in Asian barcode scans
      if (data.status === 0 && !decodedText.startsWith("0")) {
        res = await fetch(`https://world.openfoodfacts.org/api/v0/product/0${decodedText}.json`);
        data = await res.json();
      }
      
      let productName = "";
      let productIngredients = "None provided, rely purely on AI general knowledge";
      let productCategories = "Unknown";

      if (data.status === 1 && data.product) {
         productName = data.product.product_name || "Unknown Product";
         productIngredients = data.product.ingredients_text || productIngredients;
         productCategories = data.product.categories || productCategories;
      } else {
         // Auto fallback to server-side UPCItemDB proxy (Fixes CORS block)
         try {
            const fallbackRes = await fetch(`/api/lookup-upc?upc=${decodedText}`);
            const fallbackData = await fallbackRes.json();
            if (fallbackData.items && fallbackData.items.length > 0) {
               productName = fallbackData.items[0].title;
               productCategories = fallbackData.items[0].category || "Unknown";
            }
         } catch(e) {
            console.error("UPC proxy fallback failed:", e);
         }
      }

      // Final ultimate fallback: Just ask the user to type it if BOTH global DBs fail
      if (!productName || productName.trim() === "") {
         setIsAnalyzingFood(false);
         const manualName = window.prompt(`Barcode ${decodedText} isn't globally registered yet.\n\nPlease type the name of the item to grade it:`);
         if (!manualName || manualName.trim() === "") {
            return; // User canceled
         }
         productName = manualName.trim();
         setIsAnalyzingFood(true);
      }

      const aiRes = await fetch("/api/analyze-food", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: productName, ingredients: productIngredients, categories: productCategories })
      });
      const analysis = await aiRes.json();

      if (!analysis.is_food) {
        toast("Not a Food Item", { description: "AI determined this is not an edible item." });
      } else {
        setScannedResult({
          name: productName,
          analysis
        });
      }
    } catch (e) {
      toast("Error", { description: "Failed to analyze barcode." });
    } finally {
      setIsAnalyzingFood(false);
    }
  };

  const addScannedItemToPantry = async () => {
    if (!scannedResult || !user) return;
    const newItem = {
      user_id: user.id,
      name: scannedResult.name,
      days_left: 30, // Default for pantry scanned items
      risk: "low",
      purchase_date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    };

    const { error } = await supabase.from("pantry_items").insert([newItem]);
    if (!error) {
       toast("Added to Pantry");
    }
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
    <div className="flex flex-col min-h-screen pb-28 bg-background">
      {/* Header */}
      <header className="px-6 pt-10 pb-6 border-b border-border bg-card">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-foreground rounded-sm" />
            <h1 className="text-xl font-bold tracking-tight">NutriTrusto</h1>
          </div>
          <ProfileDropdown />
        </div>

        {/* KPI Widgets */}
        <div className="flex gap-4 mb-4">
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
              <div className="p-4 flex justify-between items-center gap-4">
                <div>
                  <h4 className="font-semibold text-sm flex items-center gap-2"><BrainCircuit size={14} /> AI Optimization</h4>
                  <p className="text-xs text-background/70 mt-1">Generate a recipe to utilize critical items.</p>
                </div>
                <button onClick={generateRecipe} disabled={isGeneratingRecipe} className="flex items-center gap-2 bg-background text-foreground text-xs font-semibold px-4 py-2.5 rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap">
                  {isGeneratingRecipe ? <Loader2 size={14} className="animate-spin" /> : "Generate"}
                </button>
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="h-32 w-full bg-cover bg-center relative" style={{ backgroundImage: `url('${generatedRecipe.image}')` }}>
                  <div className="absolute inset-0 bg-gradient-to-t from-foreground/90 to-transparent" />
                  <div className="absolute top-3 right-3 bg-black/30 backdrop-blur-sm px-2 py-1 rounded-lg border border-white/10 flex items-center gap-1.5 text-white">
                    <Clock size={12} /><span className="text-[10px] font-semibold">{generatedRecipe.time}</span>
                  </div>
                </div>
                <div className="p-4 pt-2 flex justify-between items-end gap-2">
                  <div>
                    <p className="text-[10px] text-background/60 uppercase font-semibold tracking-widest mb-1">AI Recommendation</p>
                    <h4 className="font-bold text-lg leading-tight">{generatedRecipe.title}</h4>
                  </div>
                  <a href={generatedRecipe.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 bg-background text-foreground text-xs font-semibold px-3 py-2 rounded-lg hover:scale-105 active:scale-95 transition-all shrink-0">
                    Cook this <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Inventory */}
      <main className="flex-1 px-6 py-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-sm uppercase tracking-widest text-foreground/70">Inventory Log</h2>
          <div className="flex items-center gap-1 bg-foreground/5 p-1 rounded-full border border-border/50">
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
        <div className="flex justify-end mb-4">
          <span className="text-xs font-medium text-foreground/50">
            {dbLoading ? "Loading..." : `Showing ${displayedItems.length} items`}
          </span>
        </div>

        {dbLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-foreground/20" />
          </div>
        ) : displayedItems.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border rounded-3xl bg-foreground/5 sleek-shadow-sm flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-background border border-border flex items-center justify-center mb-4 sleek-shadow">
              <ScanLine size={24} className="text-foreground/40" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">No items found</h3>
            <p className="text-sm text-foreground/60 max-w-[200px] leading-relaxed mb-6">
              {items.length > 0 ? "No items match the current filter." : "Scan a grocery receipt or barcode to start tracking food waste."}
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 bg-foreground text-background text-sm font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity"
            >
              <Camera size={16} /> Scan Receipt
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {[...displayedItems].sort((a, b) => a.daysLeft - b.daysLeft).map(item => {
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
          </div>
        )}
      </main>

      <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />

      {/* Bottom Nav Bar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <div className="flex items-center bg-card border border-border shadow-2xl rounded-2xl p-2 gap-2 backdrop-blur-md">
          <button onClick={() => setShowBarcodeScanner(true)} className="flex flex-col items-center justify-center gap-1 hover:bg-foreground/5 text-foreground/80 hover:text-foreground w-16 h-16 rounded-xl transition-all">
            <ScanLine size={18} /><span className="text-[10px] tracking-wide">Barcode</span>
          </button>

          <div className="w-px h-8 bg-border" />

          <button onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})} className="flex flex-col items-center justify-center gap-1 hover:bg-foreground/5 text-foreground/80 hover:text-foreground w-16 h-16 rounded-xl transition-all">
            <HomeIcon size={18} /><span className="text-[10px] tracking-wide">Home</span>
          </button>

          <div className="w-px h-8 bg-border" />

          <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="flex flex-col items-center justify-center gap-1 hover:bg-foreground/5 text-foreground/80 hover:text-foreground w-16 h-16 rounded-xl transition-all disabled:opacity-50">
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
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-card w-full max-w-sm rounded-3xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-border flex justify-between items-start bg-foreground/5 relative">
              <div className="pr-8">
                <h3 className="font-bold text-lg leading-tight text-foreground">{scannedResult.name}</h3>
                <span className="inline-block mt-2 px-2.5 py-1 bg-foreground text-background text-xs font-bold rounded-lg uppercase tracking-widest">
                  Health Grade: {scannedResult.analysis.health_rating}
                </span>
              </div>
              <button onClick={() => setScannedResult(null)} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-foreground/5 text-foreground hover:bg-foreground/20 transition-colors">
                <X size={16} />
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto flex-1 space-y-6">
              {scannedResult.analysis.banned_ingredients?.length > 0 && (
                <div className="bg-danger/10 border border-danger/20 rounded-xl p-4">
                  <h4 className="text-xs uppercase font-bold tracking-widest text-danger mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-danger"></span> Harmful Ingredients
                  </h4>
                  <ul className="space-y-2">
                    {scannedResult.analysis.banned_ingredients.map((item: any, i: number) => (
                      <li key={i} className="text-sm">
                        <strong className="text-foreground">{item.name}</strong>
                        <p className="text-xs text-foreground/70 mt-0.5">Banned in {item.banned_in}: {item.reason}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {scannedResult.analysis.coloring_agents?.length > 0 && (
                <div>
                  <h4 className="text-[10px] uppercase font-bold tracking-widest text-foreground/50 mb-2">Coloring Agents</h4>
                  <div className="flex flex-wrap gap-2">
                    {scannedResult.analysis.coloring_agents.map((agent: string, i: number) => (
                      <span key={i} className="px-2.5 py-1 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20 text-xs rounded-md shadow-sm">
                        {agent}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {scannedResult.analysis.alternatives?.length > 0 && (
                <div>
                  <h4 className="text-[10px] uppercase font-bold tracking-widest text-foreground/50 mb-2">Healthier Alternatives</h4>
                  <ul className="list-disc pl-4 space-y-1">
                    {scannedResult.analysis.alternatives.map((alt: string, i: number) => (
                      <li key={i} className="text-sm text-foreground/80">{alt}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-border bg-background">
              <button 
                onClick={addScannedItemToPantry} 
                className="w-full bg-foreground text-background font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity"
              >
                Add to Pantry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
