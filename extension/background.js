/**
 * background.js — NR Rvibe Tab Harvester Service Worker
 *
 * Orchestrates the full harvest pipeline:
 *  1. Receive leads + settings from content.js (START_HARVEST)
 *  2. Build per-source task queue
 *  3. Open tabs, inject extractors, collect results
 *  4. Navigate sub-pages (Contact/About) and re-inject
 *  5. Cross-discover social links and dynamically queue tasks
 *  6. Merge data, update stats, close tabs
 *  7. Auto-sync to Apps Script on complete
 */

// Wrap importScripts so a single bad file doesn't kill the whole service worker
try {
  importScripts(
    'lib/harvest-config.js',
    'lib/harvest-cache.js',
    'lib/harvest-queue.js',
    'lib/harvest-stats.js',
    'lib/data-merger.js'
  );
} catch (importErr) {
  console.error('[NR Rvibe] importScripts failed:', importErr);
}

// ── State ──────────────────────────────────────────────────────────────────────
let _state = {
  isRunning:   false,
  isPaused:    false,
  skipCurrent: false,
  leads:       [],        // original maps leads
  results:     {},        // { leadId: { website, instagram, facebook } }
  queue:       [],        // task list
  queueIdx:    0,
  settings:    {},
  consecutiveFails: 0,
};

let _activeTabIds = new Set();

// ── Message Router ─────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.action) {

    case 'START_HARVEST':
      startHarvest(msg.leads || [], msg.settings || {}, msg.apiKey)
        .then(() => sendResponse({ success: true }))
        .catch(e => sendResponse({ success: false, error: e.message }));
      return true;

    case 'STOP_HARVEST':
      _state.isRunning = false;
      killAllTabs();
      HarvestStats.setStopped();
      sendResponse({ success: true });
      return true;

    case 'PAUSE_HARVEST':
      _state.isPaused = !_state.isPaused;
      HarvestStats.setPaused(_state.isPaused);
      sendResponse({ success: true, paused: _state.isPaused });
      return true;

    case 'SKIP_CURRENT':
      _state.skipCurrent = true;
      sendResponse({ success: true });
      return true;

    case 'SYNC_LEADS':
      pushToNodeAPI(msg.leads, msg.settings)
        .then(data => sendResponse({ success: true, data }))
        .catch(e => sendResponse({ success: false, error: e.message }));
      return true;

    case 'GET_HARVEST_STATS':
      HarvestStats.get().then(s => sendResponse(s));
      return true;

    case 'CLEAR_CACHE':
      HarvestCache.clearAll().then(() => sendResponse({ success: true }));
      return true;

    case 'ENQUEUE_LEAD':
      if (!_state.isRunning) { sendResponse({ success: false }); return true; }
      _state.leads.push(msg.lead);
      HarvestQueue.buildForLead(msg.lead, _state.settings, _state.queueCounts).then(tasks => {
        if (tasks.length > 0) {
          _state.queue.push(...tasks);
          HarvestStats.addTasks(tasks.length);
        }
      });
      sendResponse({ success: true });
      return true;

    case 'COLLECTOR_FINISHED':
      _state.collectorFinished = true;
      sendResponse({ success: true });
      return true;
  }
});

// ── Main Harvest Orchestrator ──────────────────────────────────────────────────
async function startHarvest(leads, settings, apiKey) {
  // Merge with defaults
  settings = { ...HARVEST_CONFIG.DEFAULT_SETTINGS, ...settings };
  const profile = HARVEST_CONFIG.SPEED_PROFILES[settings.speedMode] || HARVEST_CONFIG.SPEED_PROFILES.normal;

  _state.isRunning   = true;
  _state.isPaused    = false;
  _state.skipCurrent = false;
  _state.collectorFinished = (leads.length > 0); // If started with leads, it's a batch mode run
  _state.leads       = [...leads];
  _state.results     = {};
  _state.consecutiveFails = 0;
  _state.settings = settings;
  _state.queueCounts = { webCount: 0, socialCount: 0 };

  // Build task queue
  const queue = await HarvestQueue.build(leads, settings);
  _state.queue    = queue;
  _state.queueIdx = 0;

  // Init stats
  await HarvestStats.init(_state.leads, queue);
  await HarvestCache.clearExpired(settings.cacheTTLDays || 7);

  // Broadcast start
  broadcastToPopup({ action: 'HARVEST_STARTED', total: queue.length });

  // ── Run with concurrency ────────────────────────────────────────────────────
  const concurrency = profile.concurrentTabs || 1;
  const workers = [];
  for (let i = 0; i < concurrency; i++) {
    workers.push(runWorker(profile, settings));
  }
  await Promise.all(workers);

  if (!_state.isRunning) {
    broadcastToPopup({ action: 'HARVEST_STOPPED' });
    // Don't return here! We want to merge and save whatever we managed to collect so far.
  }

  // ── Merge all results into leads ───────────────────────────────────────────
  const enrichedLeads = _state.leads.map(lead => {
    const res = _state.results[lead.id] || {};
    return DataMerger.mergeLead(lead, {
      website:   res.website   || null,
      instagram: res.instagram || null,
      facebook:  res.facebook  || null,
      linkedin_search: res.linkedin_search || null,
    });
  });

  // Finalise stats
  const finalStats = await HarvestStats.finalise(enrichedLeads);

  // Store enriched leads for popup retrieval
  await chrome.storage.local.set({ enriched_leads: enrichedLeads });

  // Auto-push to Node API
  try {
    await pushToNodeAPI(enrichedLeads, settings);
  } catch (e) {
    console.warn('[Harvester] Auto-push failed:', e.message);
  }

  broadcastToPopup({ action: 'HARVEST_COMPLETE', stats: finalStats, leads: enrichedLeads });
  _state.isRunning = false;
}

// ── Worker: processes tasks sequentially ──────────────────────────────────────
async function runWorker(profile, settings) {
  while (_state.isRunning) {
    // Wait if paused
    while (_state.isPaused && _state.isRunning) {
      await sleep(500);
    }

    // Get next task
    const task = getNextTask();
    if (!task) {
      if (_state.collectorFinished) break; // Queue empty and collector done
      await sleep(1000); // Wait for more leads
      continue;
    }

    const lead = _state.leads.find(l => l.id === task.leadId);
    const leadName = lead ? lead.businessName : task.leadId;

    // Check cache
    if (settings.skipCached) {
      const cached = await HarvestCache.isCached(task.url);
      if (cached) {
        await HarvestStats.markSkipped();
        await HarvestStats.appendLog(`Skipped (cached): ${HarvestCache.getDomain(task.url)}`, 'skipped', leadName);
        broadcastProgress(task, null, leadName, 'skipped');
        continue;
      }
    }

    await HarvestStats.setCurrentTask(task, leadName);
    await HarvestStats.appendLog(`${task.isDynamic ? '🔗 ' : ''}${task.type}: ${HarvestCache.getDomain(task.url)}`, 'scraping', leadName);

    // Update live preview
    await HarvestStats.updateLeadPreview({
      leadId: task.leadId,
      leadName: leadName,
      sources: { ...(_state.results[task.leadId] ? getSourceStatuses(task.leadId) : {}), [task.type]: 'scraping' },
    });

    broadcastProgress(task, null, leadName, 'starting');

    // Execute the tab harvest
    const startMs = Date.now();
    const result = await harvestTab(task, profile, settings);
    if (!_state.isRunning) break; // Exit immediately if stopped

    const elapsed = Date.now() - startMs;

    // Store result
    if (!_state.results[task.leadId]) _state.results[task.leadId] = {};
    _state.results[task.leadId][task.type] = result;

    // Mark domain as cached
    await HarvestCache.markCached(task.url);

    // Update stats
    const stats = await HarvestStats.tick(task, result);

    // Update live preview with data found
    await updatePreviewWithResult(task, result, leadName);

    // Log result
    const logStatus = result && result.success ? 'done' : 'failed';
    const logDetail = result && result.success
      ? `✓ ${task.type}: ${summarizeResult(task.type, result)}`
      : `✗ ${task.type}: ${result ? result.error : 'unknown'}`;
    await HarvestStats.appendLog(logDetail, logStatus, leadName);

    // Track consecutive failures for auto-pause
    if (!result || !result.success) {
      _state.consecutiveFails++;
      if (settings.autoPauseOnFailures && _state.consecutiveFails >= HARVEST_CONFIG.DEFAULT_LIMITS.maxConsecutiveFailures) {
        _state.isPaused = true;
        await HarvestStats.setPaused(true);
        broadcastToPopup({ action: 'HARVEST_AUTO_PAUSED', reason: `${_state.consecutiveFails} consecutive failures` });
      }
      // Stop IG harvesting if login wall detected
      if (result && result.error === 'LOGIN_REQUIRED' && task.type === 'instagram' && settings.stopOnInstagramLoginWall) {
        broadcastToPopup({ action: 'IG_LOGIN_WALL_DETECTED' });
        disableInstagramTasks();
      }
    } else {
      _state.consecutiveFails = 0;

      // ── CROSS-DISCOVERY ──────────────────────────────────────────────────
      if (settings.crossDiscovery && HARVEST_CONFIG.CROSS_DISCOVERY_ENABLED) {
        await handleCrossDiscovery(task, lead, result, settings);
      }
    }

    // Hot Find detection
    if (result && result.success) {
      checkForHotFind(task, lead, result, stats);
    }

    broadcastProgress(task, stats, leadName, result && result.success ? 'done' : 'failed');

    // Cooldown
    const cooldown = randBetween(profile.cooldownMin, profile.cooldownMax);
    await sleep(cooldown);
  }
}

// ── Get next task atomically ───────────────────────────────────────────────────
function getNextTask() {
  if (_state.queueIdx >= _state.queue.length) return null;
  return _state.queue[_state.queueIdx++];
}

// ── Open tab, inject extractor, collect result ─────────────────────────────────
async function harvestTab(task, profile, settings) {
  let tabId = null;
  const loadTimeout = (settings.pageLoadTimeout || 20) * 1000;

  // Normalize URL — chrome.tabs.create requires a valid full URL
  let url = task.url;
  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  if (!url || url === 'https://') {
    return { success: false, error: 'INVALID_URL' };
  }

  try {
    const tab = await chrome.tabs.create({ url, active: false, pinned: true });
    tabId = tab.id;
    _activeTabIds.add(tabId);
    chrome.storage.local.set({ harvest_active_tabs: Array.from(_activeTabIds) });

    // Track active tab
    await HarvestStats.addActiveTab(task.leadId, task.type, url);

    // Wait for tab to fully load
    const loaded = await waitForTabLoad(tabId, loadTimeout);

    // Check if skipped or stopped during load
    const wasSkipped = _state.skipCurrent;
    if (wasSkipped) _state.skipCurrent = false;

    if (!loaded || !_state.isRunning || wasSkipped) {
      return { success: false, error: wasSkipped ? 'SKIPPED' : 'LOAD_TIMEOUT' };
    }

    // Settle delay for JS rendering
    await sleep(profile.settleDelay || 2000);

    // Set up the listener BEFORE injecting the script, otherwise we miss the message
    const resultPromise = waitForExtractorResult(tabId, HARVEST_CONFIG.EXTRACT_TIMEOUT);

    // Inject extractor script
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [task.script],
      });
    } catch (injectErr) {
      console.warn('[Harvester] Script injection failed:', task.script, injectErr.message);
      return { success: false, error: 'INJECT_FAILED', message: injectErr.message };
    }

    // Wait for the message we listened for
    const result = await resultPromise;

    // ════════════════════════════════════════════════════════════════════
    // SUB-PAGE NAVIGATION (Website only)
    // ════════════════════════════════════════════════════════════════════
    if (
      task.type === 'website' &&
      result && result.success &&
      settings.scrapeSubPages &&
      result.data && result.data.discoveredPages
    ) {
      const subPages = result.data.discoveredPages;
      const subPageData = {};

      // Scrape Contact page
      if (subPages.contactUrl) {
        const contactResult = await scrapeSubPage(tabId, subPages.contactUrl, 'contact', profile);
        if (contactResult) {
          subPageData.contact = contactResult;
          await HarvestStats.markSubPageScraped();
          await HarvestStats.appendLog('→ Scraped Contact page', 'done', '');
        }
      }

      // Scrape About page
      if (subPages.aboutUrl) {
        const aboutResult = await scrapeSubPage(tabId, subPages.aboutUrl, 'about', profile);
        if (aboutResult) {
          subPageData.about = aboutResult;
          await HarvestStats.markSubPageScraped();
          await HarvestStats.appendLog('→ Scraped About page', 'done', '');
        }
      }

      // Attach sub-page data to the main result
      result.subPages = subPageData;
    }

    return result;

  } catch (e) {
    console.error('[Harvester] harvestTab error:', url, e.message);
    return { success: false, error: 'TAB_ERROR', message: e.message };
  } finally {
    if (tabId) {
      try { await chrome.tabs.remove(tabId); } catch (e) {}
      _activeTabIds.delete(tabId);
      chrome.storage.local.set({ harvest_active_tabs: Array.from(_activeTabIds) });
      await HarvestStats.removeActiveTab(task.leadId, task.type);
    }
  }
}

// ── Navigate existing tab to sub-page and re-inject extractor ──────────────────
async function scrapeSubPage(tabId, subPageUrl, pageType, profile) {
  try {
    // Normalize URL
    if (!subPageUrl.startsWith('http')) {
      subPageUrl = 'https://' + subPageUrl;
    }

    // Set page type so subpage extractor knows what to extract
    try {
      await chrome.storage.session.set({ harvest_subpage_type: pageType });
    } catch (e) {
      // session storage might not be available in all contexts
      console.warn('[Harvester] session storage unavailable for subpage type');
    }

    // Navigate existing tab
    await chrome.tabs.update(tabId, { url: subPageUrl });

    // Wait for load
    const loaded = await waitForTabLoad(tabId, HARVEST_CONFIG.SUBPAGE_TIMEOUT);
    if (!loaded || !_state.isRunning) return null;

    // Settle delay
    await sleep(HARVEST_CONFIG.SUBPAGE_SETTLE_DELAY);

    // Set up listener for sub-page result
    const resultPromise = waitForSubPageResult(tabId, HARVEST_CONFIG.SUBPAGE_TIMEOUT);

    // Inject sub-page extractor
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [HARVEST_CONFIG.SUBPAGE_EXTRACTOR],
    });

    const result = await resultPromise;
    return result && result.success ? result.data : null;

  } catch (e) {
    console.warn('[Harvester] Sub-page scrape error:', subPageUrl, e.message);
    return null;
  }
}

// ── Wait for HARVEST_SUBPAGE_RESULT message ───────────────────────────────────
function waitForSubPageResult(tabId, timeoutMs) {
  return new Promise(resolve => {
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        chrome.runtime.onMessage.removeListener(msgListener);
        chrome.tabs.onRemoved.removeListener(tabListener);
        resolve({ success: false, error: 'SUBPAGE_TIMEOUT' });
      }
    }, timeoutMs);

    const msgListener = (request, sender) => {
      if (
        sender.tab &&
        sender.tab.id === tabId &&
        request.action === 'HARVEST_SUBPAGE_RESULT'
      ) {
        if (!done) {
          done = true;
          clearTimeout(timer);
          chrome.runtime.onMessage.removeListener(msgListener);
          chrome.tabs.onRemoved.removeListener(tabListener);
          resolve(request.result);
        }
      }
    };

    const tabListener = (id) => {
      if (id === tabId && !done) {
        done = true;
        clearTimeout(timer);
        chrome.runtime.onMessage.removeListener(msgListener);
        chrome.tabs.onRemoved.removeListener(tabListener);
        resolve({ success: false, error: 'TAB_CLOSED' });
      }
    };

    chrome.runtime.onMessage.addListener(msgListener);
    chrome.tabs.onRemoved.addListener(tabListener);
  });
}

// ── Cross-Discovery Handler ───────────────────────────────────────────────────
async function handleCrossDiscovery(task, lead, result, settings) {
  if (!lead || !result || !result.success || !result.data) return;

  const discovered = result.data.discoveredLinks;
  if (!discovered) return;

  const leadId = task.leadId;
  const existingDynamic = HarvestQueue.countDynamicTasks(_state.queue, leadId);
  if (existingDynamic >= HARVEST_CONFIG.MAX_DYNAMIC_TASKS_PER_LEAD) return;

  const sourcesToCheck = [];

  // Check for Facebook not already known
  if (discovered.facebook && !lead.facebookUrl && settings.harvestFacebook) {
    sourcesToCheck.push({ type: 'facebook', url: discovered.facebook });
  }
  // Check for Instagram not already known
  if (discovered.instagram && !lead.instagramUrl && settings.harvestInstagram) {
    sourcesToCheck.push({ type: 'instagram', url: discovered.instagram });
  }
  // Check for Website not already known (from IG/FB bio)
  if (discovered.website && !lead.websiteUrl && settings.harvestWebsite) {
    sourcesToCheck.push({ type: 'website', url: discovered.website });
  }

  for (const { type, url } of sourcesToCheck) {
    if (existingDynamic + HarvestQueue.countDynamicTasks(_state.queue, leadId) >= HARVEST_CONFIG.MAX_DYNAMIC_TASKS_PER_LEAD) break;

    // Check if we already have a result or queued task for this type
    if (_state.results[leadId] && _state.results[leadId][type]) continue;
    if (_state.queue.some(t => t.leadId === leadId && t.type === type && _state.queue.indexOf(t) >= _state.queueIdx)) continue;

    const newTask = await HarvestQueue.createDynamicTask(leadId, type, url, task.type, settings);
    if (newTask) {
      // Insert right after current position (priority)
      _state.queue.splice(_state.queueIdx, 0, newTask);
      await HarvestStats.addTasks(1);
      await HarvestStats.markCrossDiscovery();
      await HarvestStats.appendLog(`🔗 Discovered ${type} from ${task.type}`, 'discovered', lead.businessName);
      console.log(`[CrossDiscovery] ${lead.businessName}: Found ${type} from ${task.type} → ${url}`);
    }
  }
}

// ── Update live preview with scrape results ───────────────────────────────────
async function updatePreviewWithResult(task, result, leadName) {
  if (!result || !result.success || !result.data) {
    await HarvestStats.updateLeadPreview({
      sources: { [task.type]: 'failed' },
    });
    return;
  }

  const d = result.data;
  const newFinds = [];
  const lead = _state.leads.find(l => l.id === task.leadId);

  if (task.type === 'website') {
    if (d.emails && d.emails.length > 0 && (!lead || !lead.email || lead.email === 'N/A')) {
      newFinds.push(`📧 ${d.emails[0]} [NEW!]`);
    }
    if (d.phones && d.phones.length > 0 && (!lead || !lead.phone || lead.phone === 'N/A')) {
      newFinds.push(`📞 ${d.phones[0]} [NEW!]`);
    }
    if (d.social && d.social.facebook && (!lead || !lead.facebookUrl)) {
      newFinds.push(`📘 Facebook found [NEW!]`);
    }
    if (d.social && d.social.instagram && (!lead || !lead.instagramUrl)) {
      newFinds.push(`📱 Instagram found [NEW!]`);
    }
    if (d.discoveredPages && d.discoveredPages.contactUrl) {
      newFinds.push(`📋 Contact page found`);
    }
  } else if (task.type === 'instagram') {
    if (d.bioEmail) newFinds.push(`📧 ${d.bioEmail} [NEW!]`);
    if (d.followers) newFinds.push(`👥 ${formatNum(d.followers)} followers`);
    if (d.externalLink) newFinds.push(`🌐 Website in bio [NEW!]`);
  } else if (task.type === 'facebook') {
    if (d.email) newFinds.push(`📧 ${d.email} [NEW!]`);
    if (d.followers) newFinds.push(`👥 ${formatNum(d.followers)} followers`);
    if (d.websiteLink && (!lead || !lead.websiteUrl)) newFinds.push(`🌐 Website found [NEW!]`);
  }

  await HarvestStats.updateLeadPreview({
    leadId: task.leadId,
    leadName,
    sources: { [task.type]: 'done' },
    dataFound: { newFinds },
  });
}

// ── Get source statuses for a lead ────────────────────────────────────────────
function getSourceStatuses(leadId) {
  const res = _state.results[leadId] || {};
  const statuses = {};
  for (const [type, result] of Object.entries(res)) {
    statuses[type] = result && result.success ? 'done' : 'failed';
  }
  return statuses;
}

// ── Summarize result for log ──────────────────────────────────────────────────
function summarizeResult(type, result) {
  if (!result || !result.data) return 'no data';
  const d = result.data;
  if (type === 'website') {
    const parts = [];
    if (d.emails && d.emails.length) parts.push(`${d.emails.length} email${d.emails.length > 1 ? 's' : ''}`);
    if (d.phones && d.phones.length) parts.push(`${d.phones.length} phone${d.phones.length > 1 ? 's' : ''}`);
    if (d.techStack && d.techStack.length) parts.push(d.techStack[0]);
    return parts.join(', ') || 'homepage only';
  }
  if (type === 'instagram') {
    return `${formatNum(d.followers || 0)} followers`;
  }
  if (type === 'facebook') {
    return `${formatNum(d.followers || 0)} followers`;
  }
  return 'data collected';
}

// ── Wait for tab to reach 'complete' ──────────────────────────────────────────
function waitForTabLoad(tabId, timeoutMs) {
  return new Promise(resolve => {
    let done = false;

    const timer = setTimeout(() => {
      if (!done) { done = true; resolve(false); }
    }, timeoutMs);

    const listener = (updatedId, info) => {
      if (updatedId === tabId && info.status === 'complete') {
        if (!done) {
          done = true;
          clearTimeout(timer);
          chrome.tabs.onUpdated.removeListener(listener);
          resolve(true);
        }
      }
    };
    
    // 1. Attach listener FIRST to catch any instant transitions
    chrome.tabs.onUpdated.addListener(listener);

    // 2. Check if it's ALREADY complete
    chrome.tabs.get(tabId, tab => {
      if (chrome.runtime.lastError) return;
      if (tab && tab.status === 'complete') {
        if (!done) {
          done = true;
          clearTimeout(timer);
          chrome.tabs.onUpdated.removeListener(listener);
          resolve(true);
        }
      }
    });

    // Also clean up listener if tab is removed unexpectedly
    chrome.tabs.onRemoved.addListener(function onRemoved(id) {
      if (id === tabId && !done) {
        done = true;
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        chrome.tabs.onRemoved.removeListener(onRemoved);
        resolve(false);
      }
    });
  });
}

// ── Wait for HARVEST_RESULT message from injected extractor ───────────────────
function waitForExtractorResult(tabId, timeoutMs) {
  return new Promise(resolve => {
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        chrome.runtime.onMessage.removeListener(msgListener);
        chrome.tabs.onRemoved.removeListener(tabListener);
        resolve({ success: false, error: 'EXTRACT_TIMEOUT' });
      }
    }, timeoutMs);

    const msgListener = (request, sender) => {
      if (
        sender.tab &&
        sender.tab.id === tabId &&
        request.action === 'HARVEST_RESULT'
      ) {
        if (!done) {
          done = true;
          clearTimeout(timer);
          chrome.runtime.onMessage.removeListener(msgListener);
          chrome.tabs.onRemoved.removeListener(tabListener);
          resolve(request.result);
        }
      }
    };

    const tabListener = (id) => {
      if (id === tabId && !done) {
        done = true;
        clearTimeout(timer);
        chrome.runtime.onMessage.removeListener(msgListener);
        chrome.tabs.onRemoved.removeListener(tabListener);
        resolve({ success: false, error: 'TAB_CLOSED' });
      }
    };

    chrome.runtime.onMessage.addListener(msgListener);
    chrome.tabs.onRemoved.addListener(tabListener);
  });
}

// ── Disable remaining Instagram tasks (on login wall) ─────────────────────────
function disableInstagramTasks() {
  // Mark remaining IG tasks as skipped by filtering them out
  _state.queue = _state.queue.map((t, idx) => {
    if (idx >= _state.queueIdx && t.type === 'instagram') {
      return { ...t, _disabled: true };
    }
    return t;
  });
  // Re-filter disabled
  const skipped = _state.queue.filter((t, idx) => idx >= _state.queueIdx && t._disabled).length;
  _state.queueIdx = _state.queue.length - (_state.queue.length - _state.queueIdx - skipped);
  _state.queue = _state.queue.filter(t => !t._disabled || _state.queue.indexOf(t) < _state.queueIdx);
}

// ── Check for Hot Finds ────────────────────────────────────────────────────────
async function checkForHotFind(task, lead, result, stats) {
  if (!lead) return;
  const name = lead.businessName || 'Unknown';

  if (task.type === 'instagram' && result.data) {
    const { followers, daysSincePost } = result.data;
    if (followers > 1000 && !lead.websiteUrl) {
      await HarvestStats.addHotFind(name, `No website, IG ${formatNum(followers)}`);
    } else if (daysSincePost > 60) {
      await HarvestStats.addHotFind(name, `IG inactive for ${daysSincePost} days`);
    }
  }

  if (task.type === 'website' && result.data) {
    const { techStack, issues, emails } = result.data;
    if (techStack && (techStack.includes('Wix') || techStack.includes('Blogger'))) {
      await HarvestStats.addHotFind(name, `Using ${techStack.join(', ')} — easy upsell`);
    }
    if (emails && emails.length > 0 && (!lead.email || lead.email === 'N/A')) {
      await HarvestStats.addHotFind(name, `Email found: ${emails[0]}`);
    }
  }

  // Cross-discovery hot find
  if (task.isDynamic) {
    await HarvestStats.addHotFind(name, `Cross-discovered ${task.type} from ${task.source}`);
  }
}

// ── Broadcast helpers ──────────────────────────────────────────────────────────
function broadcastToPopup(msg) {
  chrome.runtime.sendMessage(msg).catch(() => {}); // Ignore if popup is closed
}

function broadcastProgress(task, stats, leadName, statusLabel) {
  broadcastToPopup({
    action: 'HARVEST_PROGRESS',
    task,
    stats,
    leadName,
    statusLabel,
  });
}

// ── Kill all active harvest tabs ──────────────────────────────────────────────
function killAllTabs() {
  _activeTabIds.forEach(id => { try { chrome.tabs.remove(id); } catch (e) {} });
  _activeTabIds.clear();
  chrome.storage.local.set({ harvest_active_tabs: [] });
}

// ── Push enriched leads to Node API ───────────────────────────────────────────
const API_BASE_URL = 'http://localhost:8081'; // Change to https://your-vercel-app.vercel.app for production

async function pushToNodeAPI(leads, settings) {
  const res = await fetch(`${API_BASE_URL}/api/leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ leads, settings }),
  });
  return await res.json();
}

// ── Utils ──────────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function randBetween(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function formatNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

// ── Startup: emergency orphan tab cleanup ──────────────────────────────────────
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get('harvest_active_tabs', res => {
    const tabs = res.harvest_active_tabs || [];
    tabs.forEach(id => { try { chrome.tabs.remove(id); } catch (e) {} });
    chrome.storage.local.remove('harvest_active_tabs');
  });
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('[NR Rvibe] Extension installed. Smart Tab Harvester ready.');
});
