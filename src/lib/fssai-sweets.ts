import { matchesTerm } from "@/lib/text-match";

/**
 * Shelf life of Indian sweets, from FSSAI's own illustrative list.
 *
 * Source: FSSAI, "Guidance Note on Milk Products" (Guidance Note No. 14/2020,
 * dated 24-02-2020), section "Shelf life of sweets", page 4:
 * https://www.fssai.gov.in/upload/uploadfiles/files/Guidance_Note_Milk_Products_24_02_2020.pdf
 *
 * Every figure is copied from that list, not estimated, and so is every name
 * except a handful we added so common spellings match: spelling variants of
 * listed sweets ("Rasmalai", "Motichoor Modak", "Besan Ladoo", "Rewari Burfi"
 * — the PDF prints "Rewari Rurfi"), and generic names whose every listed
 * variant shares one figure ("Rabri", "Peda", "Gujia"). "Khoya Burfi" is the
 * guidance's own example of a short-lived sweet, placed with the khoya sweets.
 * The figures run from the DATE OF MANUFACTURE, which the app does not know —
 * it counts from the day the item was added, so for a sweet bought a day or
 * two after it was made, the true figure is shorter. That is stated wherever
 * the number is shown, and a best-before date on the shop's tray (which FSSAI
 * requires sellers to display) always wins.
 *
 * Group (b) is to be kept refrigerated; the guidance says (a) is kept at room
 * temperature, and gives no storage for (c)–(e).
 */

export interface SweetGroup {
  days: number;
  label: string;
  storage: "fridge" | "counter";
  names: string[];
}

export const FSSAI_SWEET_GROUPS: SweetGroup[] = [
  {
    days: 0,
    label: "Very short shelf life — same day",
    storage: "counter",
    names: ["Kalakand", "Butterscotch Kalakand", "Rose Kalakand", "Chocolate Kalakand"],
  },
  {
    days: 2,
    label: "Short shelf life — 2 days, refrigerated",
    storage: "fridge",
    names: [
      "Badam milk", "Rasgulla", "Ras Malai", "Rasmalai", "Rabri Rasmalai", "Shahi Toast", "Rajbhog", "Cham Cham",
      "Sandesh", "Malai Roll", "Bengali Rabri", "Rabri", "Hiramani", "Gur Sandesh", "Hari bhog", "Anurodh",
      "Anarkali", "Madhuri", "Pakiza", "Raskadam", "Gur Kaccha Gola Sandesh", "Ras Katta", "Kheer Mohan",
      "Gur Rasmalai", "Gur Rabri", "Gur Rasgulla",
    ],
  },
  {
    days: 4,
    label: "Medium short shelf life — 4 days",
    storage: "counter",
    names: [
      "Milk Cake", "Mathura Peda", "Plain Burfi", "Milk Burfi", "Pista Burfi", "Coconut Burfi", "Chocolate Burfi",
      "Safed Peda", "Peda", "Boondi Ladoo", "Coconut Ladoo", "Lal Ladoo", "Motichor Modak", "Motichoor Modak",
      "Khoya Badam", "Mewa Batti", "Fruit Cake", "Khoya Til Fruit Cake", "Kesar Coconut Ladoo", "Small Malai Ghewar",
      "Vrat Kesaria Coconut Ladoo", "Small Mewa Ladoo", "Pink Burfi", "Til Bugga", "Rewari Burfi",
      "Dry Fruit Til bugga", "Khoya Kesar Badam Roll", "Til Bati", "Kheer Kadam", "Kheera Beej Burfi",
      "Khoya Coconut Burfi", "Moti Pak", "Khoya Burfi",
    ],
  },
  {
    days: 7,
    label: "Long shelf life — 7 days",
    storage: "counter",
    names: [
      "Dry fruit ladoo", "Kaju Katli", "Ghewar", "Shahi Ghewar", "Sakkar Para", "Gur Para", "Shahi Ladoo",
      "Moong Burfi", "Aata ladoo", "Dry fruit Gujia", "Moti Boondi Ladoo", "Kaju Kesar Burfi", "Kaju Baked Gujia",
      "Badam Laung", "Balusahi", "Badam Burfi", "Kaju Anjeer Roll", "Kesar Big Malai", "Chandrakala",
      "Chhak Mitthi", "Kesar Gujia", "Maida Gujia", "Kaju Khazoor", "Pista Laung", "Small Kesar Ghewar",
      "Kesar Chandrakala", "Anjeer Cake", "Kaju apple", "Kaju Gujia", "Kaju Honey Dew", "Kaju Kalash",
      "Kaju Kesar", "Kaju Ladoo", "Kaju Roll", "Kaju Samosa", "Dil Khushal Burfi", "Kaju Rose Katli", "Besan Burfi",
      "Gujia",
    ],
  },
  {
    days: 30,
    label: "Very long shelf life — around 30 days",
    storage: "counter",
    names: [
      "Atta Laddoo", "Besan Laddoo", "Besan Ladoo", "Chana Laddoo", "Chana Burfi", "Anzeer Khajur Burfi",
      "Karachi Halwa", "Sohan Halwa", "Gajjak", "Chikki",
    ],
  },
];

/**
 * Note: FSSAI lists "Aata ladoo" under 7 days and "Atta Laddoo" under 30.
 * Both are reproduced as written; with longest-name-first matching, the
 * spelling the person types decides which applies. The shorter figure is
 * the one to trust if in doubt, and the explanation says the shop's date wins.
 */
const ENTRIES = FSSAI_SWEET_GROUPS
  .flatMap((group) => group.names.map((name) => ({ name, key: name.toLowerCase(), group })))
  .sort((a, b) => b.key.length - a.key.length);

export interface SweetMatch {
  name: string;
  group: SweetGroup;
}

/** The FSSAI entry whose name appears, as whole words, in the item name. */
export function findFssaiSweet(itemName: string): SweetMatch | null {
  const text = (itemName || "").toLowerCase();
  if (!text.trim()) return null;
  for (const entry of ENTRIES) {
    if (matchesTerm(text, entry.key)) return { name: entry.name, group: entry.group };
  }
  return null;
}

export const FSSAI_SWEETS_CITATION = "FSSAI Guidance Note on Milk Products (No. 14/2020), shelf life of sweets";
