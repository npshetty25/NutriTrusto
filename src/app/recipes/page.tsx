"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { ProfileDropdown } from "@/components/profile-dropdown";
import { ArrowLeft, Search, Loader2, ExternalLink, ChevronRight, Leaf, Egg, UtensilsCrossed, CircleAlert } from "lucide-react";
import { getItemDietType, normalizeDietPreference } from "@/lib/diet";
import { motion } from "framer-motion";

// Every entry here was checked against TheMealDB's filter endpoint on
// 2026-08-26 and returns a non-empty result. The list is NOT taken from the
// API's own list.php?a=list, which is out of sync with it: that endpoint
// advertises 192 areas of which only 29 return meals, lists "Indian" (which
// returns null), and omits "India" (which returns 15).
//
// The previous list used demonyms throughout, so eight of its 37 entries
// were dead — including Indian, first in the list, in an India-first
// product. Tapping India returned nothing at all.
//
// The count beside each name is what the API returned at the time of
// checking; it is a comment, not a promise, and the UI reads the real
// number at runtime.
const COUNTRIES = [
  { name: "India", flag: "🇮🇳" },            // 15
  { name: "Bangladesh", flag: "🇧🇩" },       // 3
  { name: "Thai", flag: "🇹🇭" },             // 27
  { name: "Chinese", flag: "🇨🇳" },          // 27
  { name: "Japanese", flag: "🇯🇵" },         // 9
  { name: "Malaysian", flag: "🇲🇾" },        // 8
  { name: "Vietnamese", flag: "🇻🇳" },       // 27
  { name: "Filipino", flag: "🇵🇭" },         // 8
  { name: "Turkish", flag: "🇹🇷" },          // 30
  { name: "Saudi Arabian", flag: "🇸🇦" },    // 12
  { name: "Syrian", flag: "🇸🇾" },           // 6
  { name: "Egyptian", flag: "🇪🇬" },         // 8
  { name: "Moroccan", flag: "🇲🇦" },         // 6
  { name: "Algerian", flag: "🇩🇿" },         // 12
  { name: "Tunisian", flag: "🇹🇳" },         // 8
  { name: "Kenyan", flag: "🇰🇪" },           // 5
  { name: "Italian", flag: "🇮🇹" },          // 21
  { name: "Spanish", flag: "🇪🇸" },          // 48
  { name: "France", flag: "🇫🇷" },           // 28
  { name: "Greek", flag: "🇬🇷" },            // 8
  { name: "Portuguese", flag: "🇵🇹" },       // 8
  { name: "British", flag: "🇬🇧" },          // 60
  { name: "Ireland", flag: "🇮🇪" },          // 8
  { name: "Netherlands", flag: "🇳🇱" },      // 18
  { name: "Poland", flag: "🇵🇱" },           // 27
  { name: "Croatian", flag: "🇭🇷" },         // 8
  { name: "Slovakia", flag: "🇸🇰" },         // 4
  { name: "Ukrainian", flag: "🇺🇦" },        // 7
  { name: "Russian", flag: "🇷🇺" },          // 7
  { name: "Norway", flag: "🇳🇴" },           // 18
  { name: "United States", flag: "🇺🇸" },    // 34
  { name: "Canadian", flag: "🇨🇦" },         // 22
  { name: "Mexican", flag: "🇲🇽" },          // 6
  { name: "Jamaican", flag: "🇯🇲" },         // 27
  { name: "Brazil", flag: "🇧🇷" },           // 11
  { name: "Argentina", flag: "🇦🇷" },        // 10
  { name: "Venezuela", flag: "🇻🇪" },        // 10
  { name: "Uruguayan", flag: "🇺🇾" },        // 9
  { name: "Australian", flag: "🇦🇺" },       // 13
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
  // This page browses an external catalogue that knows nothing about the
  // user. India's 15 dishes include Beef Mandi, Lamb Rogan Josh and
  // Tandoori Chicken — so a vegetarian opening the flagship cuisine of an
  // India-first product met beef first. Beef in particular is not a mild
  // mismatch here: it is restricted by law in much of the country.
  const userDiet = normalizeDietPreference(String(user?.user_metadata?.dietary_preference || "none"));
  const [dietFilter, setDietFilter] = useState<"veg" | "egg" | "all">("all");
  const [dietFilterTouched, setDietFilterTouched] = useState(false);

  // Not a lazy useState initialiser: `user` is still null on first render
  // while auth resolves, so the initialiser would lock in "all" and never
  // reconsider. Verified — a vegetarian account was still being shown Beef
  // Mandi until this ran as an effect instead.
  useEffect(() => {
    if (dietFilterTouched) return;
    if (userDiet === "veg") setDietFilter("veg");
    else if (userDiet === "eggtarian") setDietFilter("egg");
  }, [userDiet, dietFilterTouched]);
  const [mealDetail, setMealDetail] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const filteredCountries = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  // Classified from the dish name alone, which is all the list endpoint
  // returns. It is a filter over a browse list, not a safety guarantee —
  // the detail view still shows the full ingredient list.
  const visibleMeals = dietFilter === "all"
    ? meals
    : meals.filter((m) => {
        const t = getItemDietType(m.strMeal);
        return dietFilter === "veg" ? t === "veg" : t !== "non-veg";
      });
  const hiddenCount = meals.length - visibleMeals.length;

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
        <header className="px-4 sm:px-6 pt-8 sm:pt-10 pb-5 border-b border-border bg-card/90 backdrop-blur-sm sticky top-0 z-30">
        <div className="flex justify-between items-center mb-1">
          <div className="flex items-center gap-3">
            <button title="Back to pantry" aria-label="Back to pantry" onClick={() => router.push("/")} className="text-foreground/50 hover:text-foreground transition-colors p-1 -ml-1">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Global Recipes</h1>
              <p className="text-[11px] text-foreground/50 font-medium">{COUNTRIES.length} cuisines · TheMealDB</p>
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
            <div className="absolute inset-0 bg-linear-to-t from-background to-transparent" />
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
                <div className="flex flex-col sm:flex-row gap-3">
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

      <main className="px-4 sm:px-6 py-5 flex-1">
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
              <div>
                <h2 className="font-bold text-lg tracking-tight">{selectedCountry} Recipes</h2>
                <p className="text-xs text-foreground/50">
                  {visibleMeals.length} {visibleMeals.length === 1 ? "dish" : "dishes"}
                  {hiddenCount > 0 ? ` · ${hiddenCount} hidden by your diet filter` : ""}
                </p>
              </div>
              <button onClick={() => { setSelectedCountry(null); setMeals([]); }}
                className="text-xs font-semibold text-foreground/60 hover:text-foreground border border-border px-3 py-1.5 rounded-lg transition-colors">
                ← All Countries
              </button>
            </div>

            {/* A filter that hides results has to be visible, or the list
                just looks short. Defaults to the account's preference. */}
            <div role="group" aria-label="Filter recipes by diet" className="grid grid-cols-3 gap-2 mb-5">
              {([
                { id: "veg", label: "Veg", Icon: Leaf, tone: "bg-safe/20 text-safe-strong" },
                { id: "egg", label: "Egg OK", Icon: Egg, tone: "bg-warning/20 text-warning-strong" },
                { id: "all", label: "All", Icon: UtensilsCrossed, tone: "bg-foreground/10 text-foreground" },
              ] as const).map(({ id, label, Icon, tone }) => (
                <button
                  key={id}
                  onClick={() => { setDietFilter(id); setDietFilterTouched(true); }}
                  aria-pressed={dietFilter === id}
                  className={`h-10 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    dietFilter === id ? tone : "neu-raised-sm text-foreground/70 hover:text-foreground"
                  }`}
                >
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-20 text-foreground/40">
                <Loader2 size={24} className="animate-spin" />
                <p className="text-sm">Loading recipes...</p>
              </div>
            ) : meals.length === 0 ? (
              /* An external catalogue can return nothing for a cuisine. Say
                 so, rather than rendering an empty grid that reads as a
                 broken page. */
              <div className="text-center py-16 px-6">
                <div className="w-14 h-14 rounded-2xl neu-raised flex items-center justify-center mx-auto mb-3 text-foreground/40">
                  <CircleAlert size={22} />
                </div>
                <p className="text-sm font-semibold">No dishes for {selectedCountry}</p>
                <p className="text-xs text-foreground/60 mt-1 leading-relaxed">
                  The recipe database has nothing filed under this cuisine right now. Try another,
                  or use Find a Recipe on the dashboard, which builds one from your own pantry.
                </p>
              </div>
            ) : visibleMeals.length === 0 ? (
              <div className="text-center py-16 px-6">
                <div className="w-14 h-14 rounded-2xl neu-raised flex items-center justify-center mx-auto mb-3 text-safe">
                  <Leaf size={22} />
                </div>
                <p className="text-sm font-semibold">Nothing here matches your diet</p>
                <p className="text-xs text-foreground/60 mt-1 leading-relaxed">
                  All {meals.length} {selectedCountry} dishes in this catalogue contain meat or fish.
                  Switch to All above to see them anyway.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {visibleMeals.map((meal) => (
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
