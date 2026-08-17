export const CATEGORY_GROUPS: Record<string, string[]> = {
  "Home Services": ["plumb", "hvac", "electric", "contractor", "roof", "paint", "clean", "landscap", "pest", "repair", "handyman", "builder", "remodel", "pool", "tree"],
  "Health & Wellness": ["dentist", "doctor", "clinic", "chiropract", "pharmacy", "medical", "hospital", "therapy", "fitness", "gym", "yoga", "physician", "ortho"],
  "Food & Dining": ["restaurant", "cafe", "bakery", "bar", "pizza", "food", "coffee", "diner", "steak", "sushi", "pub"],
  "Retail": ["store", "shop", "boutique", "grocery", "market", "retail", "florist", "hardware"],
  "Professional Services": ["agency", "consultant", "accountant", "lawyer", "attorney", "web design", "marketing", "insurance", "finance", "software", "tax"],
  "Automotive": ["auto", "car", "mechanic", "tire", "dealership", "vehicle", "tow", "body shop"],
  "Beauty & Spa": ["salon", "spa", "barber", "nail", "massage", "hair", "beauty", "cosmetic"],
  "Real Estate": ["real estate", "broker", "property", "realtor", "mortgage"],
  "Education": ["school", "tutor", "college", "university", "academy", "training", "music lesson"]
};

export function getMainCategory(subCategory: string): string {
  if (!subCategory) return "Other";
  const lower = subCategory.toLowerCase();
  
  for (const [main, keywords] of Object.entries(CATEGORY_GROUPS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return main;
    }
  }
  return "Other";
}

export function groupCategories(categories: string[]): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};
  categories.forEach(cat => {
    const main = getMainCategory(cat);
    if (!grouped[main]) grouped[main] = [];
    grouped[main].push(cat);
  });
  return grouped;
}
