/**
 * The one term-matching primitive, shared by both food matchers.
 *
 * There were two, and they disagreed. `findShelfLifeRow` was fixed to use
 * word boundaries and per-row exclusions after seven common Indian products
 * resolved wrongly — "Coconut Milk" matched `milk` and got three days,
 * "Garlic Bread" matched `garlic` and got thirty. `inferItemCategory` was
 * never fixed: it still used a bare `value.includes(keyword)` with no
 * boundaries and no exclusions, so the tier-4 fallback carried the identical
 * defect the tier-3 path had been repaired for.
 *
 * Both now call `matchesTerm`, and both consult the same exclusion phrases.
 */

const WORD_CHAR = /[a-z0-9]/i;

/**
 * True when `term` appears in `text` as a whole word, allowing a plural.
 *
 * A plain word-boundary regex does NOT match a plural, because the trailing
 * "s" is itself a word character — `\bonion\b` fails on "Onions". That bug
 * sent every plural item name to the category default, and "Tomatoes" hid it
 * by falling through to a value that happened to equal the tomato row's own,
 * so a day-count assertion passed while the row never matched.
 */
export const matchesTerm = (text: string, term: string): boolean => {
  for (let from = 0; ; ) {
    const at = text.indexOf(term, from);
    if (at === -1) return false;
    let end = at + term.length;
    if (text.slice(end, end + 2) === "es") end += 2;
    else if (text[end] === "s") end += 1;
    const before = at === 0 ? "" : text[at - 1];
    const after = text[end] ?? "";
    if (!WORD_CHAR.test(before) && !WORD_CHAR.test(after)) return true;
    from = at + 1;
  }
};

/**
 * Whether a name reads as a plural, judged on its head noun — the last word,
 * which is what a verb has to agree with. "Eggs" is plural; "Chicken Breast"
 * is not, despite naming a bird.
 *
 * Lives here rather than at its call site because this file already owns the
 * plural morphology: `matchesTerm` extends a match by "s"/"es" for the same
 * reason. Two places deciding what a plural is, in one codebase, is exactly
 * the drift this module exists to prevent.
 *
 * The -ss/-us/-is exceptions are singular nouns that merely end in s, three of
 * which are foods that turn up in a pantry: sea bass, octopus, hummus.
 * Without them a doneness line reads "check the Sea Bass are cooked".
 *
 * Not a term match: it takes no list and compares against nothing. It answers
 * a grammatical question about one string.
 */
export const isPluralNoun = (name: string): boolean => {
  const head = name.trim().split(/\s+/).pop()?.toLowerCase().replace(/[^a-z]/g, "") ?? "";
  return head.endsWith("s") && !/(ss|us|is)$/.test(head);
};

/**
 * Phrases that must never be read as the concept they contain.
 *
 * Keyed by concept rather than by category or row, so the shelf-life table
 * and the category inferrer can both consult the same entry. Every phrase
 * here is a product that genuinely exists in an Indian kitchen and was
 * being misread.
 */
export const FALSE_FRIENDS: Record<string, string[]> = {
  // Shelf-stable products whose names contain a highly perishable word.
  dairy: [
    "coconut milk", "milk powder", "milk chocolate", "milkmaid",
    "condensed milk", "soy milk", "soya milk", "almond milk", "oat milk",
    "milk shake", "milkshake",
    // A spice packet and a nut spread, neither of them dairy.
    "paneer masala", "shahi paneer masala", "paneer tikka masala",
    "peanut butter",
    // Dishes named after the dairy they contain.
    "butter chicken", "butter paneer", "butter masala", "curd rice",
    "cream biscuit", "cream cracker", "ice cream",
  ],
  // Bread and bakery named after a vegetable.
  vegetable: [
    "garlic bread", "garlic naan", "ginger garlic paste", "garlic powder",
    "onion powder", "tomato ketchup", "tomato sauce", "tomato puree",
    "potato chips", "potato wafers", "onion pickle",
  ],
  // Spice mixes and preserved goods named after the meat or fish they season.
  meat: [
    "fish curry masala", "fish masala", "fish oil", "chicken masala",
    "chicken curry masala", "egg curry masala", "eggplant", "eggless",
  ],
  fruit: ["mango pickle", "aam achar", "mango juice", "apple juice", "orange juice"],
  grain: ["rice flour", "fried rice", "rice bran oil", "dal fry", "dal makhani"],
};

/** Every false-friend phrase, flattened. */
export const ALL_FALSE_FRIENDS: string[] = Object.values(FALSE_FRIENDS).flat();

/**
 * True when any of the given phrases appears in the text as a whole term.
 *
 * This used a bare `text.includes(phrase)`, which made the exclusion list
 * carry the same defect the key matcher was fixed for — and worse, because an
 * over-firing exclusion silently removes the CORRECT row from consideration.
 * `"goat milk".includes("oat milk")` is true, so the dairy row excluded itself
 * from goat milk and the item fell through to a shelf-stable plant-milk row at
 * 365 days.
 *
 * Boundary-aware matching keeps every intended exclusion working — "Coconut
 * Milk 200ml" still matches the phrase "coconut milk" — while refusing the
 * ones that only ever fired on a word fragment.
 */
export const isExcluded = (text: string, phrases: readonly string[] | undefined): boolean =>
  !!phrases?.some((phrase) => matchesTerm(text, phrase.toLowerCase()));
