/**
 * lib/harvest-queue.js
 * Converts a flat array of leads into an ordered list of harvest tasks.
 * Each task maps to one background tab + one injected extractor.
 *
 * Enhanced with dynamic task insertion for cross-source discovery.
 *
 * Task shape:
 * {
 *   taskId:   string,          // unique per task
 *   leadId:   string,          // lead this task enriches
 *   type:     'website' | 'instagram' | 'facebook' | 'linkedin_search',
 *   url:      string,          // URL to open
 *   script:   string,          // extractor script file path
 *   isDynamic: boolean,        // true if cross-discovered
 *   source:   string,          // where this task was discovered from (e.g. 'website')
 * }
 */

const HarvestQueue = (() => {

  const SCRIPT_MAP = {
    website:         'extractors/website-extractor.js',
    instagram:       'extractors/instagram-extractor.js',
    facebook:        'extractors/facebook-extractor.js',
    linkedin_search: 'extractors/linkedin-search-extractor.js',
  };

  // Priority ordering: website first, then social, then search
  const TYPE_PRIORITY = { website: 0, instagram: 1, facebook: 2, linkedin_search: 3 };

  /**
   * Build tasks for a single lead.
   */
  async function buildForLead(lead, settings, currentCounts = { webCount: 0, socialCount: 0 }) {
    const {
      harvestWebsite   = true,
      harvestInstagram = true,
      harvestFacebook  = true,
      harvestLinkedin  = true,
      maxWebsites      = 100,
      maxSocial        = 50,
      skipCached       = true,
    } = settings;

    const tasks = [];
    const leadId = lead.id;

    // Website
    if (harvestWebsite && lead.websiteUrl && lead.websiteUrl !== 'N/A' && currentCounts.webCount < maxWebsites) {
      let skip = false;
      if (skipCached) skip = await HarvestCache.isCached(lead.websiteUrl);
      if (!skip) {
        tasks.push({
          taskId: `${leadId}_web`,
          leadId,
          type: 'website',
          url: lead.websiteUrl,
          script: SCRIPT_MAP.website,
          isDynamic: false,
          source: 'maps',
        });
        currentCounts.webCount++;
      }
    }

    // Instagram
    if (harvestInstagram && lead.instagramUrl && currentCounts.socialCount < maxSocial) {
      let skip = false;
      if (skipCached) skip = await HarvestCache.isCached(lead.instagramUrl);
      if (!skip) {
        tasks.push({
          taskId: `${leadId}_ig`,
          leadId,
          type: 'instagram',
          url: lead.instagramUrl,
          script: SCRIPT_MAP.instagram,
          isDynamic: false,
          source: 'maps',
        });
        currentCounts.socialCount++;
      }
    }

    // Facebook
    if (harvestFacebook && lead.facebookUrl && currentCounts.socialCount < maxSocial) {
      let skip = false;
      if (skipCached) skip = await HarvestCache.isCached(lead.facebookUrl);
      if (!skip) {
        tasks.push({
          taskId: `${leadId}_fb`,
          leadId,
          type: 'facebook',
          url: lead.facebookUrl,
          script: SCRIPT_MAP.facebook,
          isDynamic: false,
          source: 'maps',
        });
        currentCounts.socialCount++;
      }
    }

    // LinkedIn Founder Search
    if (harvestLinkedin) {
      const searchUrl = `https://html.duckduckgo.com/html/?q=site:linkedin.com/in+"${encodeURIComponent(lead.businessName)}"+"founder"+OR+"owner"`;
      let skip = false;
      if (skipCached) skip = await HarvestCache.isCached(searchUrl);
      if (!skip) {
        tasks.push({
          taskId: `${leadId}_li_search`,
          leadId,
          type: 'linkedin_search',
          url: searchUrl,
          script: SCRIPT_MAP.linkedin_search,
          isDynamic: false,
          source: 'maps',
        });
      }
    }

    // Sort by priority
    tasks.sort((a, b) => (TYPE_PRIORITY[a.type] || 99) - (TYPE_PRIORITY[b.type] || 99));

    return tasks;
  }

  /**
   * Build queue from leads + settings (Batch mode).
   */
  async function build(leads, settings) {
    const tasks = [];
    const counts = { webCount: 0, socialCount: 0 };
    for (const lead of leads) {
      const leadTasks = await buildForLead(lead, settings, counts);
      tasks.push(...leadTasks);
    }
    return tasks;
  }

  /**
   * Create a dynamic cross-discovered task.
   * Returns a task object or null if the URL is invalid/cached.
   */
  async function createDynamicTask(leadId, type, url, discoveredFrom, settings = {}) {
    if (!url || !type || !SCRIPT_MAP[type]) return null;

    // Don't duplicate existing tasks
    const skipCached = settings.skipCached !== false;
    if (skipCached) {
      const cached = await HarvestCache.isCached(url);
      if (cached) return null;
    }

    return {
      taskId: `${leadId}_${type}_dynamic_${Date.now()}`,
      leadId,
      type,
      url,
      script: SCRIPT_MAP[type],
      isDynamic: true,
      source: discoveredFrom,
    };
  }

  /**
   * Get all tasks for a specific lead from a task list.
   */
  function getLeadTasks(allTasks, leadId) {
    return allTasks.filter(t => t.leadId === leadId);
  }

  /**
   * Count dynamic tasks already queued for a lead.
   */
  function countDynamicTasks(allTasks, leadId) {
    return allTasks.filter(t => t.leadId === leadId && t.isDynamic).length;
  }

  return { build, buildForLead, createDynamicTask, getLeadTasks, countDynamicTasks, SCRIPT_MAP };
})();
