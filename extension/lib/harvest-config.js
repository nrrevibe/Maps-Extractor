/**
 * lib/harvest-config.js
 * Central configuration for the Tab Harvester.
 * All timeouts, speed profiles, limits, and smart scraping settings live here.
 */

const HARVEST_CONFIG = {

  // ── Speed Profiles ──────────────────────────────────────────────────────────
  SPEED_PROFILES: {
    safe: {
      label: '🐢 Safe',
      concurrentTabs: 1,
      cooldownMin: 5000,
      cooldownMax: 10000,
      settleDelay: 3000,
      pageLoadTimeout: 25000,
    },
    normal: {
      label: '🚶 Normal',
      concurrentTabs: 1,
      cooldownMin: 3000,
      cooldownMax: 5000,
      settleDelay: 2000,
      pageLoadTimeout: 20000,
    },
    fast: {
      label: '🏃 Fast',
      concurrentTabs: 2,
      cooldownMin: 1500,
      cooldownMax: 3000,
      settleDelay: 1200,
      pageLoadTimeout: 15000,
    },
  },

  // ── Per-Source Timeouts (ms) ─────────────────────────────────────────────
  SOURCE_TIMEOUTS: {
    website: 20000,
    instagram: 25000,
    facebook: 25000,
  },

  // ── Extractor result wait timeout (after inject) ─────────────────────────
  EXTRACT_TIMEOUT: 8000,

  // ── Sub-Page Settings ───────────────────────────────────────────────────
  SUBPAGE_TIMEOUT: 10000,          // Timeout for Contact/About sub-pages (ms)
  SUBPAGE_SETTLE_DELAY: 1500,      // Wait for sub-page JS rendering
  MAX_SUBPAGES_PER_SITE: 2,        // Max sub-pages to scrape (Contact + About)
  SUBPAGE_EXTRACTOR: 'extractors/website-subpage-extractor.js',

  // ── Cross-Discovery Settings ────────────────────────────────────────────
  CROSS_DISCOVERY_ENABLED: true,    // Toggle cross-source discovery
  MAX_DYNAMIC_TASKS_PER_LEAD: 3,    // Max cross-discovered tasks per lead
  CROSS_DISCOVERY_DELAY: 2000,      // Delay before opening cross-discovered tab (ms)

  // ── Default Session Limits ────────────────────────────────────────────────
  DEFAULT_LIMITS: {
    maxWebsites: 100,
    maxSocial: 50,
    maxConsecutiveFailures: 5,
    cacheTTLDays: 7,
  },

  // ── Default Settings ─────────────────────────────────────────────────────
  DEFAULT_SETTINGS: {
    speedMode: 'normal',
    harvestWebsite: true,
    harvestInstagram: true,
    harvestFacebook: true,
    harvestLinkedin: true,
    maxWebsites: 100,
    maxSocial: 50,
    pageLoadTimeout: 20,
    skipCached: true,
    autoPauseOnFailures: true,
    stopOnInstagramLoginWall: true,
    retryFailed: false,

    // ── Smart Scraping Defaults ──
    scrapeSubPages: true,         // Navigate to Contact/About pages
    crossDiscovery: true,         // Discover social links from other sources
    skipDuplicates: true,         // Skip exact duplicates
    mergeExisting: true,          // Merge data into similar leads
    updateExisting: true,         // Update existing leads with new data
  },

  // ── Data Source Confidence Levels ─────────────────────────────────────────
  SOURCE_CONFIDENCE: {
    website_contact: 95,    // Contact page → highest priority
    website_homepage: 80,   // Homepage data
    website_about: 75,      // About page data
    website_footer: 70,     // Footer data
    google_maps: 85,        // Google Maps data
    facebook_about: 70,     // Facebook about section
    facebook_page: 60,      // Facebook page data
    instagram_bio: 60,      // Instagram bio data
    instagram_profile: 55,  // Instagram profile metadata
  },
};

// Export for both Service Worker (background.js) and popup.js
if (typeof module !== 'undefined') module.exports = HARVEST_CONFIG;
