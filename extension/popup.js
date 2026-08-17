/**
 * popup.js — NR Rvibe Lead Extractor
 * Handles 3-screen SPA: Setup, Live Pipeline, Summary
 * Enhanced with live preview, scraping log, and dedup settings.
 */

// ── Navigation ─────────────────────────────────────────────────────────────────
const navTabs   = document.querySelectorAll('.nav-tab');
const screens   = document.querySelectorAll('.screen');

navTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    navTabs.forEach(t  => t.classList.remove('active'));
    screens.forEach(s  => s.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.screen).classList.add('active');
    // Re-sync live status whenever user switches to pipeline/summary tab
    if (tab.dataset.screen === 'screen-pipeline' || tab.dataset.screen === 'screen-summary') {
      syncStatsFromStorage();
    }
  });
});

function switchTo(screenId) {
  navTabs.forEach(t => t.classList.toggle('active', t.dataset.screen === screenId));
  screens.forEach(s => s.classList.toggle('active', s.id === screenId));
}

// ── Open in Tab ────────────────────────────────────────────────────────────────
const openInTabBtn = document.getElementById('openInTabBtn');
if (openInTabBtn) {
  openInTabBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
  });
}

// ── Settings ───────────────────────────────────────────────────────────────────
const DEFAULTS = {
  harvestWebsite: true,
  harvestInstagram: true,
  harvestFacebook: true,
  harvestLinkedin: true,
  speedMode: 'normal',
  maxMapsLeads: 500,
  maxWebsites: 1000,
  maxSocial: 1000,
  pageLoadTimeout: 20,
  skipCached: true,
  autoPauseOnFailures: true,
  stopOnInstagramLoginWall: true,
  retryFailed: false,
  // Smart scraping
  scrapeSubPages: true,
  crossDiscovery: true,
  // Dedup
  skipDuplicates: true,
  mergeExisting: true,
  updateExisting: true,
};

function loadSettings() {
  chrome.storage.local.get('nr_rvibe_ext_settings', res => {
    const s = { ...DEFAULTS, ...(res.nr_rvibe_ext_settings || {}) };
    document.getElementById('harvestWebsite').checked = s.harvestWebsite;
    document.getElementById('harvestInstagram').checked = s.harvestInstagram;
    document.getElementById('harvestFacebook').checked = s.harvestFacebook;
    document.getElementById('harvestLinkedin').checked = s.harvestLinkedin;
    document.getElementById('maxMapsLeads').value = s.maxMapsLeads;
    document.getElementById('maxWebsites').value = s.maxWebsites;
    document.getElementById('maxSocial').value = s.maxSocial;
    document.getElementById('pageLoadTimeout').value = s.pageLoadTimeout;
    document.getElementById('skipCached').checked = s.skipCached;
    document.getElementById('autoPauseOnFailures').checked = s.autoPauseOnFailures;
    document.getElementById('stopOnInstagramLoginWall').checked = s.stopOnInstagramLoginWall;
    document.getElementById('retryFailed').checked = s.retryFailed;
    // Speed mode radio
    const radios = document.querySelectorAll('input[name="speedMode"]');
    radios.forEach(r => { r.checked = (r.value === s.speedMode); });
    // Smart scraping
    document.getElementById('scrapeSubPages').checked = s.scrapeSubPages;
    document.getElementById('crossDiscovery').checked = s.crossDiscovery;
    // Dedup
    document.getElementById('skipDuplicates').checked = s.skipDuplicates;
    document.getElementById('mergeExisting').checked = s.mergeExisting;
    document.getElementById('updateExisting').checked = s.updateExisting;
  });
}

function getSettings() {
  const speedMode = [...document.querySelectorAll('input[name="speedMode"]')].find(r => r.checked)?.value || 'normal';
  return {
    harvestWebsite: document.getElementById('harvestWebsite').checked,
    harvestInstagram: document.getElementById('harvestInstagram').checked,
    harvestFacebook: document.getElementById('harvestFacebook').checked,
    harvestLinkedin: document.getElementById('harvestLinkedin').checked,
    speedMode,
    maxMapsLeads: parseInt(document.getElementById('maxMapsLeads').value) || 500,
    maxWebsites: parseInt(document.getElementById('maxWebsites').value) || 100,
    maxSocial: parseInt(document.getElementById('maxSocial').value) || 50,
    pageLoadTimeout: parseInt(document.getElementById('pageLoadTimeout').value) || 20,
    skipCached: document.getElementById('skipCached').checked,
    autoPauseOnFailures: document.getElementById('autoPauseOnFailures').checked,
    stopOnInstagramLoginWall: document.getElementById('stopOnInstagramLoginWall').checked,
    retryFailed: document.getElementById('retryFailed').checked,
    // Smart scraping
    scrapeSubPages: document.getElementById('scrapeSubPages').checked,
    crossDiscovery: document.getElementById('crossDiscovery').checked,
    // Dedup
    skipDuplicates: document.getElementById('skipDuplicates').checked,
    mergeExisting: document.getElementById('mergeExisting').checked,
    updateExisting: document.getElementById('updateExisting').checked,
  };
}

document.getElementById('saveSettingsBtn').addEventListener('click', () => {
  const s = getSettings();
  
  chrome.storage.local.set({ nr_rvibe_ext_settings: s }, () => {
    const btn = document.getElementById('saveSettingsBtn');
    btn.textContent = '✅ Saved!';
    setTimeout(() => { btn.textContent = '💾 Save Configuration'; }, 2000);
  });
});

document.getElementById('clearCacheBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'CLEAR_CACHE' }, () => {
    const btn = document.getElementById('clearCacheBtn');
    btn.textContent = '✅ Cache Cleared!';
    setTimeout(() => { btn.textContent = '🗑 Clear Harvest Cache'; }, 2000);
  });
});

// ── Collector ──────────────────────────────────────────────────────────────────
document.getElementById('startCollectorBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !(tab.url.includes('/maps') || tab.url.includes('google.co'))) {
    alert('Please navigate to Google Maps and perform a local business search first.');
    return;
  }
  const settings = getSettings();
  await chrome.storage.local.set({ extraction_stop: false });
  document.getElementById('startCollectorBtn').style.display = 'none';
  document.getElementById('stopCollectorBtn').style.display = 'block';
  document.getElementById('collectorProgress').style.display = 'block';
  chrome.tabs.sendMessage(tab.id, {
    action: 'EXTRACT_MAPS_LEADS',
    apiKey: settings.apiKey,
    scrapeSpeed: document.getElementById('scrapeSpeed').value,
    harvestSettings: settings,
  });
});

document.getElementById('stopCollectorBtn').addEventListener('click', () => {
  chrome.storage.local.set({ extraction_stop: true });
  document.getElementById('stopCollectorBtn').textContent = '⏳ Stopping...';
});

// ── Harvest Controls ───────────────────────────────────────────────────────────
let _isPaused = false;

document.getElementById('pauseBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'PAUSE_HARVEST' }, res => {
    _isPaused = res && res.paused;
    document.getElementById('pauseBtn').textContent = _isPaused ? '▶ Resume' : '⏸ Pause';
    document.getElementById('autoPauseBanner').style.display = 'none';
  });
});

document.getElementById('skipBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'SKIP_CURRENT' });
});

document.getElementById('stopBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'STOP_HARVEST' });
  document.getElementById('stopBtn').textContent = '⏳ Stopping...';
});

document.getElementById('resumeBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'PAUSE_HARVEST' });
  document.getElementById('autoPauseBanner').style.display = 'none';
  _isPaused = false;
  document.getElementById('pauseBtn').textContent = '⏸ Pause';
});

// ── Summary: Push to Sheet ────────────────────────────────────────────────────
function pushLeads(filterType, btnId) {
  chrome.storage.local.get(['enriched_leads', 'nr_rvibe_ext_settings'], res => {
    let leads = res.enriched_leads || [];
    const s = res.nr_rvibe_ext_settings || {};
    
    if (filterType === 'email') {
      leads = leads.filter(l => l.email && l.email !== 'N/A');
    } else if (filterType === 'phone') {
      leads = leads.filter(l => (!l.email || l.email === 'N/A') && l.phone && l.phone !== 'N/A');
    } else if (filterType === 'lowScore') {
      leads = leads.filter(l => (l.leadScore || 0) < 30);
    }
    if (!leads.length) { alert('No leads match this criteria.'); return; }

    const btn = document.getElementById(btnId);
    const originalText = btn.textContent;
    btn.textContent = '⏳ Syncing...';
    btn.disabled = true;

    chrome.runtime.sendMessage({
      action: 'SYNC_LEADS',
      apiKey: s.apiKey,
      leads,
      settings: s,
    }, res => {
      if (res && res.success) {
        const added = res.data && res.data.added ? res.data.added : leads.length;
        const skipped = res.data && res.data.duplicatesSkipped ? res.data.duplicatesSkipped : 0;
        
        let msg = `✅ Added ${added}`;
        if (skipped > 0) msg += ` (${skipped} dupe skips)`;
        
        btn.textContent = msg;
        setTimeout(() => { btn.textContent = originalText; btn.disabled = false; }, 4000);
      } else {
        btn.textContent = '❌ Failed';
        const errMsg = res && res.error ? res.error : 'Check your Apps Script URL and API Key in Setup tab.';
        alert('Push Failed:\n\n' + errMsg + '\n\nPlease ensure your Web App URL is correct and deployed as "Anyone".');
        setTimeout(() => { btn.textContent = originalText; btn.disabled = false; }, 3000);
      }
    });
  });
}

document.getElementById('pushQualifiedBtn').addEventListener('click', () => pushLeads('email', 'pushQualifiedBtn'));
document.getElementById('pushPhoneOnlyBtn').addEventListener('click', () => pushLeads('phone', 'pushPhoneOnlyBtn'));
document.getElementById('pushLowScoreBtn').addEventListener('click', () => pushLeads('lowScore', 'pushLowScoreBtn'));
document.getElementById('pushAllBtn').addEventListener('click', () => pushLeads('all', 'pushAllBtn'));

// ── Summary: Harvest Pending ──────────────────────────────────────────────────
document.getElementById('harvestPendingBtn').addEventListener('click', () => {
  chrome.storage.local.get(['enriched_leads', 'nr_rvibe_ext_settings'], res => {
    const leads = res.enriched_leads || [];
    const settings = res.nr_rvibe_ext_settings || {};
    
    const pending = leads.filter(l => l.websiteUrl && l.websiteUrl !== 'N/A' && (!l.email || l.email === 'N/A'));
    
    if (!pending.length) {
      alert('No pending websites found in this batch.');
      return;
    }
    
    switchTo('screen-pipeline');
    
    // Set a flag so we don't prompt to harvest pending again for this batch
    chrome.storage.local.set({ pending_harvested: true });

    // Force skipCached to false so we actually re-try these websites!
    const forceSettings = { ...settings, skipCached: false };

    chrome.runtime.sendMessage({
      action: 'START_HARVEST',
      leads: pending,
      settings: forceSettings,
      apiKey: settings.apiKey
    });
  });
});

// ── Summary: Export CSV ───────────────────────────────────────────────────────
document.getElementById('exportCsvBtn').addEventListener('click', () => {
  chrome.storage.local.get('enriched_leads', res => {
    const leads = res.enriched_leads || [];
    if (!leads.length) { alert('No leads to export.'); return; }

    const keys = ['businessName', 'email', 'secondaryEmails', 'phone', 'secondaryPhones',
                  'websiteUrl', 'instagramUrl', 'facebookUrl', 'linkedinUrl',
                  'leadScore', 'leadPriority', 'dataCompleteness', 'dataSources',
                  'painPoint', 'suggestedService',
                  'websiteTechnology', 'websiteQuality', 'websiteDescription',
                  'services', 'foundedYear', 'teamMembers',
                  'igFollowers', 'igDaysInactive', 'fbLikes', 'fbFollowers',
                  'city', 'state', 'category', 'address',
                  'founderName', 'founderLinkedin'];
    const rows = [keys.join(',')];
    leads.forEach(l => {
      rows.push(keys.map(k => `"${(l[k] || '').toString().replace(/"/g, '""')}"`).join(','));
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({ url, filename: `nr_rvibe_leads_${Date.now()}.csv` });
  });
});

// ── Summary: Extract More ───────────────────────────────────────────────────────
document.getElementById('extractMoreBtn').addEventListener('click', () => {
  if (confirm('Start a new extraction? This will clear the current results from the summary.')) {
    chrome.storage.local.remove(['harvest_stats', 'extraction_status', 'enriched_leads', 'pending_harvested'], () => {
      document.getElementById('harvestRunning').style.display = 'none';
      document.getElementById('collectorProgress').style.display = 'none';
      document.getElementById('summaryContent').style.display = 'none';
      document.getElementById('summaryEmpty').style.display = 'block';
      document.getElementById('startCollectorBtn').style.display = 'block';
      document.getElementById('stopCollectorBtn').style.display = 'none';
      switchTo('screen-pipeline');
    });
  }
});

// ── Message Listener (from background.js) ─────────────────────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  switch (msg.action) {

    case 'HARVEST_STARTED':
      showHarvestRunning();
      updateHarvestUI({ totalTasks: msg.total, completedTasks: 0 });
      switchTo('screen-pipeline');
      break;

    case 'HARVEST_PROGRESS':
      if (msg.stats) updateHarvestUI(msg.stats);
      if (msg.task) updateNowChecking(msg.task, msg.leadName, msg.statusLabel);
      break;

    case 'HARVEST_COMPLETE':
      showSummary(msg.stats);
      break;

    case 'HARVEST_STOPPED':
      document.getElementById('stopBtn').textContent = '⏹ Stop';
      break;

    case 'HARVEST_AUTO_PAUSED':
      document.getElementById('autoPauseBanner').style.display = 'block';
      document.getElementById('pauseBtn').textContent = '▶ Resume';
      _isPaused = true;
      break;

    case 'IG_LOGIN_WALL_DETECTED':
      document.getElementById('igLoginBanner').style.display = 'block';
      break;
  }
});

  // Storage change listener (Collector progress + Harvest Stats) ─────────────
chrome.storage.onChanged.addListener((changes, area) => {
  if (changes.extraction_status) {
    const s = changes.extraction_status.newValue;
    if (!s) return;
    updateCollectorUI(s);
    if (s.status === 'syncing' || s.status === 'completed' || s.status === 'stopped' || s.status === 'error') {
      document.getElementById('stopCollectorBtn').style.display = 'none';
      document.getElementById('startCollectorBtn').style.display = 'block';
      document.getElementById('stopCollectorBtn').textContent = '⏹ Stop Collector';
    }
  }
  // Live harvest stats written by background.js
  if (area === 'local' && changes.harvest_stats) {
    const stats = changes.harvest_stats.newValue;
    if (!stats) return;
    if (stats.status === 'running' || stats.status === 'paused') {
      showHarvestRunning();
      updateHarvestUI(stats);
      updateLivePreview(stats);
      updateScrapingLog(stats);
      updateActiveTabsBar(stats);
    } else if (stats.status === 'complete') {
      showSummary(stats);
    }
  }
});

// ── UI Helpers ─────────────────────────────────────────────────────────────────
function updateCollectorUI(s) {
  const pct = s.total > 0 ? Math.round((s.processed / s.total) * 100) : 0;
  document.getElementById('collectorStatusText').textContent = s.currentBusiness || s.status;
  document.getElementById('collectorBar').style.width = pct + '%';
  document.getElementById('collectorPct').textContent = pct + '%';
  document.getElementById('collectorCount').textContent = `${s.processed || 0} / ${s.total || 0}`;
  document.getElementById('statMapsFound').textContent = s.total || 0;
  document.getElementById('statMapsProcessed').textContent = s.processed || 0;
  document.getElementById('statPhone').textContent = s.phoneCount || 0;
  document.getElementById('statWebsite').textContent = s.websiteCount || 0;
}

function showHarvestRunning() {
  const idle = document.getElementById('harvestIdle');
  if (idle) idle.style.display = 'none';
  document.getElementById('harvestRunning').style.display = 'block';
}

function updateNowChecking(task, leadName, statusLabel) {
  let domain = '—';
  try { domain = new URL(task.url.startsWith('http') ? task.url : 'https://' + task.url).hostname; } catch(e) {}
  document.getElementById('ncDomain').textContent = domain;
  const typeLabel = { website: '🌐', instagram: '📱', facebook: '👍', linkedin_search: '🔍' }[task.type] || '';
  const dynLabel = task.isDynamic ? ' 🔗' : '';
  document.getElementById('ncMeta').textContent = `${typeLabel}${dynLabel} ${task.type} — ${leadName || ''} — ${statusLabel || ''}`;
}

function updateHarvestUI(stats) {
  const { totalTasks = 0, completedTasks = 0, currentElapsedMs = 0 } = stats;
  const pct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  document.getElementById('harvesterBar').style.width = pct + '%';
  document.getElementById('harvesterPct').textContent = pct + '%';
  document.getElementById('harvesterCount').textContent = `${completedTasks} / ${totalTasks}`;

  // Stats grid
  document.getElementById('sWebsites').textContent  = stats.websitesChecked || 0;
  document.getElementById('sEmails').textContent    = stats.emailsFound     || 0;
  document.getElementById('sIG').textContent        = stats.igChecked       || 0;
  document.getElementById('sFB').textContent        = stats.fbChecked       || 0;
  document.getElementById('sSuccess').textContent   = stats.success         || 0;
  document.getElementById('sLoginWalls').textContent= stats.loginWalls      || 0;
  document.getElementById('sFailed').textContent    = stats.failed          || 0;
  document.getElementById('sSkipped').textContent   = stats.skipped         || 0;
  document.getElementById('sSubPages').textContent  = stats.subPagesScraped || 0;
  document.getElementById('sCrossDisc').textContent = stats.crossDiscoveries || 0;

  // Timer
  const elapsed = Math.round(currentElapsedMs / 1000);
  document.getElementById('elapsedText').textContent = `⏱ ${fmtTime(elapsed)} elapsed`;

  // ETA
  if (completedTasks > 0) {
    const remaining = totalTasks - completedTasks;
    const avgSec = elapsed / completedTasks;
    const eta = Math.round(remaining * avgSec);
    document.getElementById('etaText').textContent = `ETA: ${fmtTime(eta)}`;
  }

  // Hot Finds
  if (stats.hotFinds && stats.hotFinds.length > 0) {
    document.getElementById('hotFindsCard').style.display = 'block';
    const list = document.getElementById('hotFindsList');
    list.innerHTML = stats.hotFinds.map(f => `
      <div class="hot-find">
        <span class="icon">🔥</span>
        <div><div class="name">${esc(f.name)}</div><div class="detail">${esc(f.detail)}</div></div>
      </div>`).join('');
  }
}

// ── Live Data Preview ─────────────────────────────────────────────────────────
function updateLivePreview(stats) {
  const preview = stats.currentLeadPreview;
  if (!preview || !preview.leadId) {
    document.getElementById('livePreview').style.display = 'none';
    return;
  }

  const el = document.getElementById('livePreview');
  el.style.display = 'block';
  el.classList.remove('idle');

  // Lead name
  document.getElementById('lpLeadName').textContent = preview.leadName || '—';

  // Source status pills
  const sourcesEl = document.getElementById('lpSources');
  const sourceIcons = { map: '📍', website: '🌐', instagram: '📱', facebook: '👍', linkedin_search: '🔍' };
  const sourceLabels = { map: 'Map', website: 'Website', instagram: 'Instagram', facebook: 'Facebook', linkedin_search: 'LinkedIn' };
  
  let sourcesHTML = '<div class="lp-source done">📍 Map ✓</div>'; // Map is always done
  if (preview.sources) {
    for (const [src, status] of Object.entries(preview.sources)) {
      if (src === 'map') continue;
      const icon = sourceIcons[src] || '📄';
      const label = sourceLabels[src] || src;
      const statusIcon = status === 'done' ? '✓' : status === 'failed' ? '✗' : status === 'scraping' ? '→' : '⏳';
      sourcesHTML += `<div class="lp-source ${status}">${icon} ${label} ${statusIcon}</div>`;
    }
  }
  sourcesEl.innerHTML = sourcesHTML;

  // Discovered data
  const findsEl = document.getElementById('lpFinds');
  if (preview.dataFound && preview.dataFound.newFinds && preview.dataFound.newFinds.length > 0) {
    findsEl.innerHTML = preview.dataFound.newFinds.map(f => `<div>${esc(f)}</div>`).join('');
  } else {
    findsEl.innerHTML = '<div style="color:var(--muted)">Collecting data...</div>';
  }

  // Decision
  const decisionEl = document.getElementById('lpDecision');
  decisionEl.textContent = preview.decision || '';
}

// ── Scraping Action Log ───────────────────────────────────────────────────────
function updateScrapingLog(stats) {
  if (!stats.scrapingLog || stats.scrapingLog.length === 0) return;

  const logEl = document.getElementById('scrapingLog');
  const statusIcons = {
    done: '✓',
    failed: '✗',
    scraping: '→',
    skipped: '⏭',
    discovered: '🔗',
  };

  logEl.innerHTML = stats.scrapingLog.map(entry => {
    const icon = statusIcons[entry.status] || '•';
    const nameTag = entry.leadName ? `<span class="log-name">${esc(entry.leadName)}</span> ` : '';
    return `<div class="log-entry ${entry.status}">
      <span class="log-icon">${icon}</span>
      <span class="log-text">${nameTag}${esc(entry.action)}</span>
    </div>`;
  }).join('');

  // Auto-scroll to bottom
  logEl.scrollTop = logEl.scrollHeight;
}

// ── Active Tabs Bar ───────────────────────────────────────────────────────────
function updateActiveTabsBar(stats) {
  const bar = document.getElementById('activeTabsBar');
  const count = stats.activeTabs ? stats.activeTabs.length : 0;
  if (count > 0) {
    bar.style.display = 'flex';
    document.getElementById('activeTabsText').textContent = `${count} tab${count > 1 ? 's' : ''} open`;
  } else {
    bar.style.display = 'none';
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────
function showSummary(stats) {
  if (!stats) return;
  switchTo('screen-summary');
  document.getElementById('summaryEmpty').style.display = 'none';
  document.getElementById('summaryContent').style.display = 'block';

  document.getElementById('sumTotal').textContent   = stats.totalTasks || 0;
  document.getElementById('sumTabs').textContent    = stats.totalTabsOpened || 0;
  document.getElementById('sumTime').textContent    = fmtTime(Math.round((stats.totalTimeMs || 0) / 1000));
  document.getElementById('sumEmails').textContent  = stats.afterEmailCount || 0;
  document.getElementById('sumSubPages').textContent = stats.subPagesScraped || 0;
  document.getElementById('sumCrossDisc').textContent = stats.crossDiscoveries || 0;

  // Before/After
  document.getElementById('baEmailBefore').textContent = stats.beforeEmailCount;
  document.getElementById('baEmailAfter').textContent  = stats.afterEmailCount;
  document.getElementById('baEmailGain').textContent   = gainLabel(stats.beforeEmailCount, stats.afterEmailCount);

  document.getElementById('baScoreBefore').textContent = stats.beforeAvgScore;
  document.getElementById('baScoreAfter').textContent  = stats.afterAvgScore;
  document.getElementById('baScoreGain').textContent   = gainLabel(stats.beforeAvgScore, stats.afterAvgScore);

  document.getElementById('baHotBefore').textContent   = stats.beforeHotLeads;
  document.getElementById('baHotAfter').textContent    = stats.afterHotLeads;
  document.getElementById('baHotGain').textContent     = gainLabel(stats.beforeHotLeads, stats.afterHotLeads);

  // Hide live preview when complete
  document.getElementById('livePreview').style.display = 'none';

  // Pull lead counts from storage for the boxes
  chrome.storage.local.get(['enriched_leads', 'pending_harvested'], res => {
    const leads = res.enriched_leads || [];
    const qualified  = leads.filter(l => l.email && l.email !== 'N/A').length;
    const phoneOnly  = leads.filter(l => (!l.email || l.email === 'N/A') && l.phone && l.phone !== 'N/A').length;
    const lowScore   = leads.filter(l => (l.leadScore || 0) < 30).length;

    let pending = leads.filter(l => l.websiteUrl && l.websiteUrl !== 'N/A' && (!l.email || l.email === 'N/A')).length;
    if (res.pending_harvested) pending = 0; // Don't prompt again if already retried

    document.getElementById('sumQualified').textContent = qualified;
    document.getElementById('sumPhoneOnly').textContent = phoneOnly;
    document.getElementById('sumLowScore').textContent  = lowScore;

    document.getElementById('qualifiedBox').style.display  = qualified  ? 'block' : 'none';
    document.getElementById('phoneOnlyBox').style.display  = phoneOnly  ? 'block' : 'none';
    document.getElementById('lowScoreBox').style.display   = lowScore   ? 'block' : 'none';

    document.getElementById('pushQualifiedBtn').textContent = `📤 Push Email (${qualified})`;
    document.getElementById('pushPhoneOnlyBtn').textContent = `📤 Push Phone (${phoneOnly})`;
    document.getElementById('pushLowScoreBtn').textContent = `📤 Push Low Score (${lowScore})`;
    document.getElementById('pushAllBtn').textContent = `📤 Push All (${leads.length})`;
    
    const harvestBtn = document.getElementById('harvestPendingBtn');
    harvestBtn.textContent = res.pending_harvested ? '✅ All Pending Harvested' : `▶ Harvest Pending Websites (${pending})`;
    harvestBtn.disabled = pending === 0 || res.pending_harvested;
  });
}

// ── Formatters ────────────────────────────────────────────────────────────────
function fmtTime(sec) {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}m ${s}s`;
}

function gainLabel(before, after) {
  if (!before || before === 0) return after > 0 ? `+${after}` : '';
  const pct = Math.round(((after - before) / before) * 100);
  return pct > 0 ? `+${pct}%` : `${pct}%`;
}

function esc(str) {
  return (str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Sync stats from storage (called on tab switch + init) ───────────────────
function syncStatsFromStorage() {
  chrome.storage.local.get(['harvest_stats', 'extraction_status'], res => {
    const stats = res && res.harvest_stats;
    if (stats) {
      if (stats.status === 'running' || stats.status === 'paused') {
        showHarvestRunning();
        updateHarvestUI(stats);
        updateLivePreview(stats);
        updateScrapingLog(stats);
        updateActiveTabsBar(stats);
        switchTo('screen-pipeline');
        // Restore paused state
        if (stats.isPaused) {
          _isPaused = true;
          document.getElementById('pauseBtn').textContent = '▶ Resume';
        }
      } else if (stats.status === 'complete') {
        showSummary(stats);
        switchTo('screen-summary');
      }
    }
    
    // Restore maps collector progress
    const ext = res && res.extraction_status;
    if (ext && ext.status && ext.status !== 'completed' && ext.status !== 'syncing' && ext.status !== 'idle' && ext.status !== 'stopped' && ext.status !== 'error') {
      document.getElementById('startCollectorBtn').style.display = 'none';
      document.getElementById('stopCollectorBtn').style.display = 'block';
      document.getElementById('collectorProgress').style.display = 'block';
      updateCollectorUI(ext);
      switchTo('screen-pipeline');
    }
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────
loadSettings();

// On popup open: restore live state from storage first (works even if popup was closed)
syncStatsFromStorage();

// Also ask background for current stats (catches the case where session was cleared)
chrome.runtime.sendMessage({ action: 'GET_HARVEST_STATS' }, stats => {
  if (stats && (stats.status === 'running' || stats.status === 'paused')) {
    showHarvestRunning();
    updateHarvestUI(stats);
    updateLivePreview(stats);
    updateScrapingLog(stats);
    updateActiveTabsBar(stats);
    switchTo('screen-pipeline');
  } else if (stats && stats.status === 'complete') {
    showSummary(stats);
  }
});
