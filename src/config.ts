/**
 * All external service endpoints in one place, overridable per environment
 * via Vite env vars (define them in .env / .env.local / CI — see .env.example).
 *
 * Note: this is a fully static app — env vars are baked into the bundle at
 * BUILD time and are visible to anyone. Secrets don't belong here; the
 * Spoonacular API key is intentionally a runtime user setting instead.
 */
const env = import.meta.env

export const config = {
  /** wger exercise database — REST API base */
  wgerApiBase: env.VITE_WGER_API_BASE ?? 'https://wger.de/api/v2',
  /** wger site origin (relative image URLs are resolved against it) */
  wgerSiteBase: env.VITE_WGER_SITE_BASE ?? 'https://wger.de',
  /** Open Food Facts full-text search endpoint */
  offSearchUrl: env.VITE_OFF_SEARCH_URL ?? 'https://world.openfoodfacts.org/cgi/search.pl',
  /** Open Food Facts barcode product endpoint base */
  offProductBase: env.VITE_OFF_PRODUCT_BASE ?? 'https://world.openfoodfacts.org/api/v2/product',
  /** TheMealDB recipe API base (v1/1 = free tier) */
  mealdbApiBase: env.VITE_MEALDB_API_BASE ?? 'https://www.themealdb.com/api/json/v1/1',
  /** Spoonacular API base (key is a per-profile runtime setting, not env) */
  spoonacularApiBase: env.VITE_SPOONACULAR_API_BASE ?? 'https://api.spoonacular.com',
} as const
