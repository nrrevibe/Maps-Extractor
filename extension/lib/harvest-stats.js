/**
 * lib/harvest-stats.js
 * Tracks live harvester statistics.
 * Persisted to chrome.storage.local so popup can read live updates.
 *
 * Enhanced with per-lead preview, scraping action log, and active tabs tracking.
 */

const HarvestStats = (() => {

  const KEY = 'harvest_stats';

  const defaultStats = () => ({
    // Progress
    totalTasks: 0,
    completedTasks: 0,
    currentUrl: '',
    currentDomain: '',
    currentLeadName: '',
    currentElapsedMs: 0,

    // Counters
    websitesChecked: 0,
    emailsFound: 0,
    igChecked: 0,
    fbChecked: 0,
    success: 0,
    loginWalls: 0,
    failed: 0,
    skipped: 0,

    // ── Smart Scraping Counters ──
    subPagesScraped: 0,
    crossDiscoveries: 0,
    dynamicTasksCreated: 0,
    duplicatesFound: 0,
    mergedLeads: 0,

    // Before/After comparison (set once at start)
    beforeEmailCount: 0,
    beforeAvgScore: 0,
    beforeHotLeads: 0,

    // After (filled at end)
    afterEmailCount: 0,
    afterAvgScore: 0,
    afterHotLeads: 0,
    totalTabsOpened: 0,
    totalTimeMs: 0,

    // Hot Finds (array of { name, detail })
    hotFinds: [],

    // ── Live Preview (current lead being scraped) ──
    currentLeadPreview: {
      leadId: '',
      leadName: '',
      sources: {},  // { map: 'done', website: 'scraping', facebook: 'pending' }
      dataFound: {
        emails: [],
        phones: [],
        socialLinks: {},
        newFinds: [],  // Items found that weren't in maps data
      },
      decision: '',  // "Will add as new lead" / "Duplicate — will skip"
    },

    // ── Active Tabs ──
    activeTabs: [],  // [{ leadId, source, url, openTime }]

    // ── Scraping Log (last 20 actions) ──
    scrapingLog: [],  // [{ time, action, status, leadName }]

    // State
    status: 'idle', // idle | running | paused | complete | stopped
    startTime: null,
    isPaused: false,
  });

  let _stats = defaultStats();

  async function init(leads, tasks) {
    _stats = defaultStats();
    _stats.totalTasks = tasks.length;
    _stats.status = 'running';
    _stats.startTime = Date.now();

    // Capture before state
    const emails = leads.filter(l => l.email && l.email !== 'N/A' && l.email !== '');
    const scores = leads.map(l => Number(l.leadScore) || 0);
    _stats.beforeEmailCount = emails.length;
    _stats.beforeAvgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    _stats.beforeHotLeads = scores.filter(s => s >= 80).length;

    await save();
  }

  async function tick(task, result) {
    _stats.completedTasks++;
    _stats.totalTabsOpened++;
    _stats.currentElapsedMs = Date.now() - (_stats.startTime || Date.now());

    if (task.type === 'website') _stats.websitesChecked++;
    if (task.type === 'instagram') _stats.igChecked++;
    if (task.type === 'facebook') _stats.fbChecked++;

    if (!result || !result.success) {
      if (result && result.error === 'LOGIN_REQUIRED') _stats.loginWalls++;
      else _stats.failed++;
    } else {
      _stats.success++;
      if (task.type === 'website' && result.data && result.data.emails && result.data.emails.length > 0) {
        _stats.emailsFound++;
      }
    }

    await save();
    return _stats;
  }

  async function addHotFind(name, detail) {
    if (_stats.hotFinds.length < 10) {
      _stats.hotFinds.push({ name, detail });
      await save();
    }
  }

  async function setCurrentTask(task, leadName) {
    _stats.currentUrl = task.url;
    _stats.currentDomain = HarvestCache.getDomain(task.url);
    _stats.currentLeadName = leadName || '';
    _stats.currentElapsedMs = Date.now() - (_stats.startTime || Date.now());
    await save();
  }

  async function markSkipped() {
    _stats.skipped++;
    _stats.completedTasks++;
    await save();
  }

  async function addTasks(count) {
    _stats.totalTasks += count;
    await save();
  }

  // ── Smart Scraping Stats ──

  async function markSubPageScraped() {
    _stats.subPagesScraped++;
    await save();
  }

  async function markCrossDiscovery() {
    _stats.crossDiscoveries++;
    _stats.dynamicTasksCreated++;
    await save();
  }

  async function markDuplicateFound() {
    _stats.duplicatesFound++;
    await save();
  }

  async function markMergedLead() {
    _stats.mergedLeads++;
    await save();
  }

  // ── Live Preview ──

  async function updateLeadPreview(preview) {
    _stats.currentLeadPreview = {
      ..._stats.currentLeadPreview,
      ...preview,
    };
    await save();
  }

  async function clearLeadPreview() {
    _stats.currentLeadPreview = defaultStats().currentLeadPreview;
    await save();
  }

  // ── Active Tabs ──

  async function addActiveTab(leadId, source, url) {
    _stats.activeTabs.push({
      leadId,
      source,
      url,
      openTime: Date.now(),
    });
    await save();
  }

  async function removeActiveTab(leadId, source) {
    _stats.activeTabs = _stats.activeTabs.filter(
      t => !(t.leadId === leadId && t.source === source)
    );
    await save();
  }

  // ── Scraping Log ──

  async function appendLog(action, status, leadName) {
    _stats.scrapingLog.push({
      time: new Date().toISOString(),
      action,
      status,  // 'done' | 'failed' | 'scraping' | 'skipped' | 'discovered'
      leadName: leadName || '',
    });
    // Keep only last 20 entries
    if (_stats.scrapingLog.length > 20) {
      _stats.scrapingLog = _stats.scrapingLog.slice(-20);
    }
    await save();
  }

  // ── Lifecycle ──

  async function finalise(enrichedLeads) {
    _stats.status = 'complete';
    _stats.totalTimeMs = Date.now() - (_stats.startTime || Date.now());

    const emails = enrichedLeads.filter(l => l.email && l.email !== 'N/A' && l.email !== '');
    const scores = enrichedLeads.map(l => Number(l.leadScore) || 0);
    _stats.afterEmailCount = emails.length;
    _stats.afterAvgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    _stats.afterHotLeads = scores.filter(s => s >= 80).length;
    _stats.activeTabs = [];

    await save();
    return _stats;
  }

  async function setPaused(paused) {
    _stats.isPaused = paused;
    _stats.status = paused ? 'paused' : 'running';
    await save();
  }

  async function setStopped() {
    _stats.status = 'stopped';
    _stats.activeTabs = [];
    await save();
  }

  async function save() {
    await new Promise(r => chrome.storage.local.set({ [KEY]: _stats }, r));
  }

  async function get() {
    return new Promise(r => {
      chrome.storage.local.get(KEY, res => r(res[KEY] || defaultStats()));
    });
  }

  function getETA() {
    if (_stats.completedTasks === 0) return null;
    const remaining = _stats.totalTasks - _stats.completedTasks;
    const avgMs = _stats.currentElapsedMs / _stats.completedTasks;
    return Math.round((remaining * avgMs) / 1000);
  }

  return {
    init, tick, addHotFind, setCurrentTask, markSkipped, addTasks,
    finalise, setPaused, setStopped, get, getETA,
    // Smart scraping
    markSubPageScraped, markCrossDiscovery, markDuplicateFound, markMergedLead,
    // Live preview
    updateLeadPreview, clearLeadPreview,
    // Active tabs
    addActiveTab, removeActiveTab,
    // Log
    appendLog,
  };
})();
