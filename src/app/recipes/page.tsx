"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { ProfileDropdown } from "@/components/profile-dropdown";
import { ArrowLeft, Search, Loader2, ExternalLink, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

// 37 countries from TheMealDB with country flag emojis
const COUNTRIES = [
  { name: "Indian", flag: "🇮🇳" }, { name: "Italian", flag: "🇮🇹" }, { name: "Mexican", flag: "🇲🇽" },
  { name: "Chinese", flag: "🇨🇳" }, { name: "Japanese", flag: "🇯🇵" }, { name: "American", flag: "🇺🇸" },
  { name: "British", flag: "🇬🇧" }, { name: "French", flag: "🇫🇷" }, { name: "Thai", flag: "🇹🇭" },
  { name: "Greek", flag: "🇬🇷" }, { name: "Turkish", flag: "🇹🇷" }, { name: "Moroccan", flag: "🇲🇦" },
  { name: "Malaysian", flag: "🇲🇾" }, { name: "Australian", flag: "🇦🇺" }, { name: "Canadian", flag: "🇨🇦" },
  { name: "Spanish", flag: "🇪🇸" }, { name: "Filipino", flag: "🇵🇭" }, { name: "Egyptian", flag: "🇪🇬" },
  { name: "Jamaican", flag: "🇯🇲" }, { name: "Vietnamese", flag: "🇻🇳" }, { name: "Portuguese", flag: "🇵🇹" },
  { name: "Russian", flag: "🇷🇺" }, { name: "Saudi Arabian", flag: "🇸🇦" }, { name: "Irish", flag: "🇮🇪" },
  { name: "Croatian", flag: "🇭🇷" }, { name: "Dutch", flag: "🇳🇱" }, { name: "Kenyan", flag: "🇰🇪" },
  { name: "Polish", flag: "🇵🇱" }, { name: "Norwegian", flag: "🇳🇴" }, { name: "Argentinian", flag: "🇦🇷" },
  { name: "Algerian", flag: "🇩🇿" }, { name: "Syrian", flag: "🇸🇾" }, { name: "Tunisian", flag: "🇹🇳" },
  { name: "Ukrainian", flag: "🇺🇦" }, { name: "Venezuelan", flag: "🇻🇪" }, { name: "Uruguayan", flag: "🇺🇾" },
  { name: "Slovakian", flag: "🇸🇰" },
];

interface Meal {
  idMeal: string;
  strMeal: string;
  strMealThumb: string;
  strYoutube?: string;
  strCategory?: string;
  strInstructions?: string;
}

export default function RecipesPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [mealDetail, setMealDetail] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const filteredCountries = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const fetchMealsByCountry = async (country: string) => {
    setSelectedCountry(country);
    setMeals([]);
    setSelectedMeal(null);
    setMealDetail(null);
    setLoading(true);
    try {
      const res = await fetch(`https://www.themealdb.com/api/json/v1/1/filter.php?a=${country}`);
      const data = await res.json();
      setMeals(data.meals || []);
    } catch {
      setMeals([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMealDetail = async (meal: Meal) => {
    setSelectedMeal(meal);
    setMealDetail(null);
    setLoadingDetail(true);
    try {
      const res = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${meal.idMeal}`);
      const data = await res.json();
      setMealDetail(data.meals?.[0] || null);
    } catch {
      setMealDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Build ingredient list from meal detail
  const getIngredients = (meal: any) => {
    const ingredients: string[] = [];
    for (let i = 1; i <= 20; i++) {
      const ing = meal[`strIngredient${i}`];
      const measure = meal[`strMeasure${i}`];
      if (ing && ing.trim()) {
        ingredients.push(`${measure?.trim() ? measure.trim() + " " : ""}${ing.trim()}`);
      }
    }
    return ingredients;
  };

  return (
    <div className="flex flex-col min-h-screen bg-background pb-8">
      {/* Header */}
      <header className="px-6 pt-10 pb-5 border-b border-border bg-card sticky top-0 z-30">
        <div className="flex justify-between items-center mb-1">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/")} className="text-foreground/50 hover:text-foreground transition-colors p-1 -ml-1">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Global Recipes</h1>
              <p className="text-[11px] text-foreground/50 font-medium">37 countries · TheMealDB</p>
            </div>
          </div>
          <ProfileDropdown />
        </div>
      </header>

      {/* Recipe Detail Modal */}
      {selectedMeal && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background animate-in fade-in duration-200 overflow-y-auto max-w-md mx-auto w-full">
          <button
            onClick={() => { setSelectedMeal(null); setMealDetail(null); }}
            className="flex items-center gap-2 text-sm font-medium text-foreground/60 hover:text-foreground px-6 py-4 sticky top-0 bg-background/90 backdrop-blur-md border-b border-border z-10"
          >
            <ArrowLeft size={16} /> Back to {selectedCountry}
          </button>

          <div className="relative h-56 w-full bg-foreground/5">
            <img src={selectedMeal.strMealThumb} alt={selectedMeal.strMeal} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
          </div>

          <div className="px-6 py-5 flex-1">
            {loadingDetail ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-foreground/30" />
              </div>
            ) : mealDetail ? (
              <>
                <p className="text-[10px] uppercase tracking-widest font-semibold text-foreground/40 mb-1">{mealDetail.strCategory} · {mealDetail.strArea}</p>
                <h2 className="text-2xl font-bold tracking-tight mb-4">{mealDetail.strMeal}</h2>

                {/* Ingredients */}
                <h3 className="text-[11px] font-semibold uppercase tracking-widest text-foreground/50 mb-3">Ingredients</h3>
                <div className="grid grid-cols-2 gap-2 mb-6">
                  {getIngredients(mealDetail).map((ing, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-foreground/80 bg-foreground/5 rounded-lg px-3 py-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-foreground/30 shrink-0"></span> {ing}
                    </div>
                  ))}
                </div>

                {/* Instructions */}
                <h3 className="text-[11px] font-semibold uppercase tracking-widest text-foreground/50 mb-3">Instructions</h3>
                <p className="text-sm text-foreground/70 leading-relaxed whitespace-pre-line mb-6">
                  {mealDetail.strInstructions?.slice(0, 600)}{mealDetail.strInstructions?.length > 600 ? "..." : ""}
                </p>

                {/* Links */}
                <div className="flex gap-3">
                  {mealDetail.strYoutube && (
                    <a href={mealDetail.strYoutube} target="_blank" rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 bg-danger text-white text-sm font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity">
                      ▶ Watch on YouTube
                    </a>
                  )}
                  <a href={`https://www.themealdb.com/meal/${mealDetail.idMeal}`} target="_blank" rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 bg-foreground text-background text-sm font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity">
                    Full Recipe <ExternalLink size={14} />
                  </a>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      <main className="px-6 py-5 flex-1">
        {/* Country list */}
        {!selectedCountry ? (
          <>
            <div className="relative mb-5">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
              <input
                type="text"
                placeholder="Search country..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-foreground/30 transition-all"
              />
            </div>
            <div className="grid grid-cols-1 gap-2">
              {filteredCountries.map(c => (
                <motion.button
                  key={c.name}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => fetchMealsByCountry(c.name)}
                  className="flex items-center justify-between px-4 py-3.5 bg-card border border-border rounded-xl hover:border-foreground/20 hover:bg-foreground/5 transition-all text-left"
                >
                  <span className="flex items-center gap-3 font-medium text-sm">
                    <span className="text-2xl">{c.flag}</span> {c.name}
                  </span>
                  <ChevronRight size={16} className="text-foreground/30" />
                </motion.button>
              ))}
            </div>
          </>
        ) : (
          /* Meal list for selected country */
          <>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-bold text-lg tracking-tight">{selectedCountry} Recipes</h2>
                <p className="text-xs text-foreground/50">{meals.length} dishes available</p>
              </div>
              <button onClick={() => { setSelectedCountry(null); setMeals([]); }}
                className="text-xs font-semibold text-foreground/60 hover:text-foreground border border-border px-3 py-1.5 rounded-lg transition-colors">
                ← All Countries
              </button>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-20 text-foreground/40">
                <Loader2 size={24} className="animate-spin" />
                <p className="text-sm">Loading recipes...</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {meals.map((meal) => (
                  <motion.button
                    key={meal.idMeal}
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={() => fetchMealDetail(meal)}
                    className="flex flex-col overflow-hidden rounded-xl border border-border bg-card hover:border-foreground/20 transition-all text-left"
                  >
                    <div className="h-28 w-full overflow-hidden bg-foreground/5">
                      <img src={meal.strMealThumb} alt={meal.strMeal} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                    </div>
                    <div className="p-3">
                      <p className="text-xs font-semibold leading-tight line-clamp-2 text-foreground">{meal.strMeal}</p>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
