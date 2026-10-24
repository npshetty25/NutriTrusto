"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { ProfileDropdown } from "@/components/profile-dropdown";
import { ArrowLeft, Search, Loader2, ExternalLink, ChevronRight, Leaf, Egg, UtensilsCrossed, CircleAlert } from "lucide-react";
import { getItemDietType, lockedDietScope, normalizeDietPreference, type ItemDietType } from "@/lib/diet";
import { VegMark } from "@/components/veg-mark";
import { motion } from "framer-motion";
import { LOCAL_RECIPES, localRecipeId, findLocalRecipe, localRecipeDiet, localRecipeDetail } from "@/lib/global-recipes";
import { MyRecipes } from "@/components/my-recipes";

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
// The 15 best food countries, in rank order. `area` is the name TheMealDB
// files that cuisine under, when it has one; Peru, Indonesia and Serbia have
// no TheMealDB entry, so their dishes come only from lib/global-recipes.ts.
const COUNTRIES: { name: string; flag: string; area?: string }[] = [
  { name: "Italy", flag: "🇮🇹", area: "Italian" },
  { name: "Greece", flag: "🇬🇷", area: "Greek" },
  { name: "Peru", flag: "🇵🇪" },
  { name: "Portugal", flag: "🇵🇹", area: "Portuguese" },
  { name: "Spain", flag: "🇪🇸", area: "Spanish" },
  { name: "Japan", flag: "🇯🇵", area: "Japanese" },
  { name: "Turkey", flag: "🇹🇷", area: "Turkish" },
  { name: "China", flag: "🇨🇳", area: "Chinese" },
  { name: "France", flag: "🇫🇷", area: "France" },
  { name: "Indonesia", flag: "🇮🇩" },
  { name: "Mexico", flag: "🇲🇽", area: "Mexican" },
  { name: "Serbia", flag: "🇷🇸" },
  { name: "India", flag: "🇮🇳", area: "India" },
  { name: "Poland", flag: "🇵🇱", area: "Poland" },
  { name: "United States", flag: "🇺🇸", area: "United States" },
];

// TheMealDB's lookup endpoint returns one flat object per meal: named fields
// (strMeal, strInstructions, ...) plus strIngredient1..20 / strMeasure1..20,
// each a string, or null / empty when unused.
type MealDetail = Record<string, string | null | undefined>;

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
  // Cuisines (the global list) or the account's own recipes.
  const [view, setView] = useState<"cuisines" | "mine">("cuisines");
  // A veg or eggtarian account is locked to its diet: no chip can widen it
  // back to "All". Everyone else picks. Derived rather than set in an effect,
  // which also removes the first-render window where `user` was still null and
  // a vegetarian briefly met Beef Mandi.
  const lockedScope = lockedDietScope(userDiet);
  const [pickedFilter, setPickedFilter] = useState<"veg" | "egg" | "all">("all");
  const dietFilter = lockedScope ?? pickedFilter;
  // idMeal -> diet resolved from the real ingredient list. A dish title is a
  // marketing name, not a declaration: it is the only thing filter.php
  // returns, so on a strict filter the survivors get checked properly.
  const [verified, setVerified] = useState<Record<string, ItemDietType>>({});
  const [verifying, setVerifying] = useState(false);

  // Verify only what a strict filter is about to SHOW. Checking every dish
  // would mean 60 lookups for British; checking the survivors of the title
  // filter is a handful, and it is exactly the set where being wrong
  // matters — a dish wrongly shown to a vegetarian.
  useEffect(() => {
    if (dietFilter === "all" || meals.length === 0) return;

    const pending = meals
      .filter((m) => {
        const t = getItemDietType(m.strMeal);
        const passesTitle = dietFilter === "veg" ? t === "veg" : t !== "non-veg";
        return passesTitle && !verified[m.idMeal];
      })
      .slice(0, 40);
    if (pending.length === 0) return;

    let cancelled = false;
    setVerifying(true);
    (async () => {
      const found: Record<string, ItemDietType> = {};
      await Promise.all(
        pending.map(async (m) => {
          try {
            const res = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${m.idMeal}`);
            const detail = (await res.json())?.meals?.[0];
            if (!detail) return;
            const ingredients = Array.from({ length: 20 }, (_, i) => detail[`strIngredient${i + 1}`] || "").join(" ");
            found[m.idMeal] = getItemDietType(ingredients);
          } catch {
            // A lookup that fails leaves the dish on its title reading. It is
            // not silently promoted to "verified vegetarian".
          }
        })
      );
      if (!cancelled) {
        setVerified((prev) => ({ ...prev, ...found }));
        setVerifying(false);
      }
    })();

    return () => { cancelled = true; };
  }, [meals, dietFilter, verified]);

  const [mealDetail, setMealDetail] = useState<MealDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const filteredCountries = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  // Stricter of the title reading and, once fetched, the ingredient
  // reading. Until a dish has been verified it is judged on its title.
  const dietOf = (m: Meal): ItemDietType => {
    const byTitle = getItemDietType(m.strMeal);
    const byIngredients = verified[m.idMeal];
    if (!byIngredients) return byTitle;
    if (byTitle === "non-veg" || byIngredients === "non-veg") return "non-veg";
    if (byTitle === "egg" || byIngredients === "egg") return "egg";
    if (byTitle === "uncertain" || byIngredients === "uncertain") return "uncertain";
    return "veg";
  };

  const visibleMeals = dietFilter === "all"
    ? meals
    : meals.filter((m) => {
        const t = dietOf(m);
        // The opposite call to the pantry's, deliberately. The pantry shows an
        // uncertain item because the user already owns it and hiding it would
        // not un-own it — they need to see it to decide. This is a browse list
        // of thousands of suggestions, so dropping an ambiguous one costs
        // nothing, while showing it risks recommending meat to a vegetarian.
        // Dropped ones are counted in `hiddenCount` and shown, not swallowed.
        if (t === "uncertain") return false;
        return dietFilter === "veg" ? t === "veg" : t !== "non-veg";
      });
  const hiddenCount = meals.length - visibleMeals.length;

  const fetchMealsByCountry = async (country: string) => {
    const entry = COUNTRIES.find((c) => c.name === country);
    setSelectedCountry(country);
    setMeals([]);
    setSelectedMeal(null);
    setMealDetail(null);
    setLoading(true);

    // Our own dishes come with their diet already read from the ingredients,
    // so they are marked verified without a network lookup.
    const own = LOCAL_RECIPES[country] ?? [];
    const ownMeals: Meal[] = own.map((r) => ({ idMeal: localRecipeId(r), strMeal: r.name, strMealThumb: "" }));
    const ownVerified: Record<string, ItemDietType> = {};
    for (const r of own) ownVerified[localRecipeId(r)] = localRecipeDiet(r);
    setVerified(ownVerified);

    try {
      let remote: Meal[] = [];
      if (entry?.area) {
        const res = await fetch(`https://www.themealdb.com/api/json/v1/1/filter.php?a=${entry.area}`);
        const data = await res.json();
        remote = data.meals || [];
      }
      setMeals([...ownMeals, ...remote]);
    } catch {
      setMeals(ownMeals);
    } finally {
      setLoading(false);
    }
  };

  const fetchMealDetail = async (meal: Meal) => {
    setSelectedMeal(meal);
    setMealDetail(null);
    const own = findLocalRecipe(meal.idMeal);
    if (own) {
      setMealDetail(localRecipeDetail(own.country, own.recipe));
      return;
    }
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
  const getIngredients = (meal: MealDetail) => {
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
            <button title="Back to pantry" aria-label="Back to pantry" onClick={() => router.push("/")} className="flex h-11 w-11 items-center justify-center text-foreground/50 hover:text-foreground transition-colors -ml-3">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Global Recipes</h1>
              <p className="text-[11px] text-foreground/50 font-medium">{COUNTRIES.length} cuisines · TheMealDB and our own kitchen</p>
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
            selectedMeal.strMealThumb ? (
              <img src={selectedMeal.strMealThumb} alt={selectedMeal.strMeal} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-foreground/5 text-foreground/30">
                <UtensilsCrossed size={32} />
              </div>
            )
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
                <h2 className="text-2xl font-bold tracking-tight mb-4 flex items-center gap-2">
                  <VegMark diet={getItemDietType(getIngredients(mealDetail).join(" "))} size={20} />
                  {mealDetail.strMeal}
                </h2>

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
                  {findLocalRecipe(String(mealDetail.idMeal))
                    ? <span className="whitespace-pre-line">{mealDetail.strInstructions}</span>
                    : <>{mealDetail.strInstructions?.slice(0, 600)}{(mealDetail.strInstructions?.length ?? 0) > 600 ? "..." : ""}</>}
                </p>

                {/* Links */}
                <div className="flex flex-col sm:flex-row gap-3">
                  {mealDetail.strYoutube && (
                    <a href={mealDetail.strYoutube} target="_blank" rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 bg-danger text-white text-sm font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity">
                      ▶ Watch on YouTube
                    </a>
                  )}
                  {!findLocalRecipe(String(mealDetail.idMeal)) && (
                    <a href={`https://www.themealdb.com/meal/${mealDetail.idMeal}`} target="_blank" rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 bg-foreground text-background text-sm font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity">
                      Full Recipe <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      <main className="px-4 sm:px-6 py-5 flex-1">
        <div role="tablist" aria-label="Recipes" className="grid grid-cols-2 gap-2 mb-5">
          {([
            { id: "cuisines", label: "Cuisines" },
            { id: "mine", label: "My recipes" },
          ] as const).map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={view === t.id}
              onClick={() => {
                setView(t.id);
                if (t.id === "cuisines") { setSelectedCountry(null); setMeals([]); }
              }}
              className={`min-h-11 rounded-xl text-sm font-bold transition-all ${view === t.id ? "bg-foreground text-background" : "neu-raised-sm text-foreground/70 hover:text-foreground"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {view === "mine" ? (
          <MyRecipes userDiet={userDiet} />
        ) : (
          <>
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
                className="w-full min-h-11 bg-card border border-border rounded-xl pl-9 pr-4 py-2.5 text-base focus:outline-none focus:border-foreground/30 transition-all"
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
                  {verifying ? " · checking ingredients…" : ""}
                </p>
              </div>
              <button onClick={() => { setSelectedCountry(null); setMeals([]); }}
                className="text-xs font-semibold text-foreground/60 hover:text-foreground border border-border px-3 py-1.5 rounded-lg transition-colors">
                ← All Countries
              </button>
            </div>

            {/* A filter that hides results has to be visible, or the list
                just looks short. Only shown to accounts that are not locked
                to a diet — for the rest the diet is already the filter. */}
            {!lockedScope && (
              <div role="group" aria-label="Filter recipes by diet" className="grid grid-cols-3 gap-2 mb-5">
                {([
                  { id: "veg", label: "Veg", Icon: Leaf, tone: "bg-safe/20 text-safe-strong" },
                  { id: "egg", label: "Egg OK", Icon: Egg, tone: "bg-warning/20 text-warning-strong" },
                  { id: "all", label: "All", Icon: UtensilsCrossed, tone: "bg-foreground/10 text-foreground" },
                ] as const).map(({ id, label, Icon, tone }) => (
                  <button
                    key={id}
                    onClick={() => setPickedFilter(id)}
                    aria-pressed={dietFilter === id}
                    className={`h-10 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      dietFilter === id ? tone : "neu-raised-sm text-foreground/70 hover:text-foreground"
                    }`}
                  >
                    <Icon size={14} /> {label}
                  </button>
                ))}
              </div>
            )}

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
                  {lockedScope
                    ? `None of the ${meals.length} ${selectedCountry} dishes in this catalogue fit your diet. Try another cuisine.`
                    : `All ${meals.length} ${selectedCountry} dishes in this catalogue contain meat or fish. Switch to All above to see them anyway.`}
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
                      meal.strMealThumb ? (
                        <img src={meal.strMealThumb} alt={meal.strMeal} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-foreground/5 text-foreground/30">
                          <UtensilsCrossed size={28} />
                        </div>
                      )
                    </div>
                    <div className="p-3 flex items-start gap-1.5">
                      <VegMark
                        diet={dietOf(meal)}
                        unverified={!verified[meal.idMeal]}
                        size={13}
                        className="mt-0.5"
                      />
                      <p className="text-xs font-semibold leading-tight line-clamp-2 text-foreground">{meal.strMeal}</p>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </>
        )}
          </>
        )}
      </main>
    </div>
  );
}
