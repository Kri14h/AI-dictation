export const OFFLINE_EASY_WORDS = [
  "table", "glove", "brush", "climb", "train", "apple", "house", "smile", "water", "bread",
  "chair", "plant", "paper", "phone", "light", "clock", "shirt", "shoes", "grass", "river",
  "stone", "cloud", "mouse", "night", "beach", "fruit", "juice", "sweet", "sweet", "green",
  "smart", "sleep", "dream", "happy", "brave", "clean", "fresh", "quick", "quiet", "proud",
  "grand", "flame", "smoke", "spoon", "plate", "truck", "train", "sheep", "horse", "puppy",
  "kitten", "shark", "grape", "lemon", "peach"
];

export const OFFLINE_MEDIUM_WORDS = [
  "exaggerate", "aesthetic", "accommodate", "phenomenon", "vulnerable", "conscience", "belligerent", "meticulous", "benevolent", "ubiquitous",
  "ephemeral", "cacophony", "scrutinize", "redundant", "garrulous", "capricious", "resilient", "adversary", "altruistic", "gregarious",
  "pragmatic", "precocious", "superfluous", "ostentatious", "provocative", "reconcile", "sanctuary", "solitude", "spontaneous", "transient",
  "vehement", "vindictive", "whimsical", "zealous", "ambiguous", "arbitrary", "audacious", "benevolent", "coercion", "collaborate",
  "complacent", "corroborate", "debilitate", "decorum", "deference", "discrepancy", "disparage", "empathy", "equivocal", "exemplary"
];

export const OFFLINE_ADVANCED_WORDS = [
  "pulchritudinous", "synecdoche", "floccinaucinihilipilification", "onomatopoeia", "cacophony", "antidisestablishmentarianism", "sesquipedalian", "supercalifragilisticexpialidocious", "bourgeois", "psychoneuroendocrinology",
  "solipsism", "valetudinarian", "schadenfreude", "terpsichorean", "grandiloquent", "magnanimous", "recalcitrant", "obstreperous", "perspicacious", "refulgent",
  "somnambulist", "crepuscular", "defenestration", "panacea", "paradigmatic", "querulous", "rancorous", "surreptitious", "taciturn", "truculent",
  "unctuous", "vacillate", "verisimilitude", "vicissitude", "vociferous", "xenophobia", "zeitgeist", "sybarite", "sinecure", "pusillanimous",
  "perfidious", "pejorative", "parsimonious", "obfuscate", "nefarious", "mellifluous", "lugubrious", "loquacious", "laconic", "inchoate"
];

/**
 * Returns a random offline word batch for fallback usage based on the difficulty level
 */
export function getOfflineWordsBatch(difficulty: number, count: number = 10, excluded: string[] = []): string[] {
  let sourceList: string[] = [];
  if (difficulty <= 3) {
    sourceList = OFFLINE_EASY_WORDS;
  } else if (difficulty <= 7) {
    sourceList = OFFLINE_MEDIUM_WORDS;
  } else {
    sourceList = OFFLINE_ADVANCED_WORDS;
  }

  // Filter out excluded words
  let filtered = sourceList.filter(w => !excluded.includes(w.toLowerCase()));
  if (filtered.length === 0) {
    // If all excluded, use the entire source list
    filtered = sourceList;
  }

  // Shuffle and pick
  const shuffled = [...filtered].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}
