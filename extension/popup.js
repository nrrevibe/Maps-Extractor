// Default Google Apps Script Web App URL
const DEFAULT_URL = "https://script.google.com/macros/s/AKfycbyRuroUMzw3HyBFD1kAgnwwxaQRWSOjUEhWCZl9spmQ1PomvyLkbZ-0luZXszWtCihU/exec";
let dynamicWebAppUrl = DEFAULT_URL;
let dynamicScrapeSpeed = 'safe';

const statusBox = document.getElementById('statusBox');
const extractBtn = document.getElementById('extractBtn');
const stopBtn = document.getElementById('stopBtn');
const syncStoppedBtn = document.getElementById('syncStoppedBtn');

// New Settings Elements
const webAppUrlInput = document.getElementById('webAppUrl');
const scrapeSpeedSelect = document.getElementById('scrapeSpeed');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const openCrmBtn = document.getElementById('openCrmBtn');
const clearCacheBtn = document.getElementById('clearCacheBtn');

// Load settings on startup
chrome.storage.local.get(['extension_settings', 'extraction_status'], (data) => {
  if (data.extension_settings) {
    if (data.extension_settings.webAppUrl) {
      dynamicWebAppUrl = data.extension_settings.webAppUrl;
      webAppUrlInput.value = dynamicWebAppUrl;
    }
    if (data.extension_settings.scrapeSpeed) {
      dynamicScrapeSpeed = data.extension_settings.scrapeSpeed;
      scrapeSpeedSelect.value = dynamicScrapeSpeed;
    }
  }
  
  if (data.extraction_status) {
    updateUI(data.extraction_status);
  }
});

saveSettingsBtn.addEventListener('click', async () => {
  const url = webAppUrlInput.value.trim() || DEFAULT_URL;
  const speed = scrapeSpeedSelect.value;
  
  dynamicWebAppUrl = url;
  dynamicScrapeSpeed = speed;
  
  await chrome.storage.local.set({
    extension_settings: {
      webAppUrl: url,
      scrapeSpeed: speed
    }
  });
  
  saveSettingsBtn.innerText = 'Saved!';
  setTimeout(() => saveSettingsBtn.innerText = 'Save Settings', 2000);
});

openCrmBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://maps-extractor.vercel.app' });
});

clearCacheBtn.addEventListener('click', async () => {
  if (confirm('Are you sure you want to clear all cached leads and reset extraction state?')) {
    await chrome.storage.local.remove(['stopped_leads', 'extraction_status', 'extraction_stop']);
    statusBox.style.display = 'none';
    syncStoppedBtn.style.display = 'none';
    clearCacheBtn.innerText = 'Cleared!';
    setTimeout(() => clearCacheBtn.innerText = 'Clear Cache', 2000);
  }
});

// Listen to storage updates for real-time progress reporting
chrome.storage.onChanged.addListener((changes) => {
  if (changes.extraction_status) {
    updateUI(changes.extraction_status.newValue);
  }
});

function updateUI(state) {
  if (!state) return;

  const statusHeader = document.getElementById('statusHeader');
  const statusText = document.getElementById('statusText');
  const progressBarContainer = document.getElementById('progressBarContainer');
  const progressBar = document.getElementById('progressBar');
  const statsGrid = document.getElementById('statsGrid');
  const statPhones = document.getElementById('statPhones');
  const statWebsites = document.getElementById('statWebsites');
  const statSocials = document.getElementById('statSocials');
  
  if (state.status === 'running' || state.status === 'scrolling' || state.status === 'syncing') {
    extractBtn.disabled = true;
    extractBtn.style.display = 'none';
    stopBtn.style.display = 'block';
    syncStoppedBtn.style.display = 'none';
    statusBox.className = 'status info';
    statusBox.style.display = 'block';
    
    if (state.status === 'scrolling') {
      statusHeader.innerText = 'Scrolling Sidebar Feed...';
      statusText.innerText = 'Triggering Google Maps lazy-loading to fetch more listings...';
      progressBarContainer.style.display = 'none';
      statsGrid.style.display = 'none';
    } else if (state.status === 'syncing') {
      statusHeader.innerText = 'Syncing Leads...';
      statusText.innerText = `Uploading ${state.leadsCount} scraped leads directly to CRM dashboard and Google Sheets...`;
      progressBarContainer.style.display = 'none';
      statsGrid.style.display = 'none';
    } else {
      const pct = state.total > 0 ? Math.round((state.processed / state.total) * 100) : 0;
      statusHeader.innerText = `Extracting Leads: ${state.processed} / ${state.total}`;
      statusText.innerText = `Currently opening and scraping detail cards:\n→ ${state.currentBusiness}`;
      
      progressBarContainer.style.display = 'block';
      progressBar.style.width = `${pct}%`;
      
      statsGrid.style.display = 'grid';
      statPhones.innerText = state.phoneCount || 0;
      statWebsites.innerText = state.websiteCount || 0;
      statSocials.innerText = state.socialCount || 0;
    }
  } else if (state.status === 'completed') {
    extractBtn.disabled = false;
    extractBtn.style.display = 'block';
    stopBtn.style.display = 'none';
    syncStoppedBtn.style.display = 'none';
    statusBox.className = 'status success';
    statusBox.style.display = 'block';
    
    statusHeader.innerText = 'Extraction Completed!';
    statusText.innerText = state.currentBusiness || `Scraped and synced ${state.leadsCount} leads successfully.`;
    progressBarContainer.style.display = 'none';
    statsGrid.style.display = 'none';
  } else if (state.status === 'stopped') {
    extractBtn.disabled = false;
    extractBtn.style.display = 'block';
    stopBtn.style.display = 'none';
    
    // Read local storage to see if we have stopped leads available to sync
    chrome.storage.local.get('stopped_leads', (res) => {
      if (res.stopped_leads && res.stopped_leads.length > 0) {
        syncStoppedBtn.style.display = 'block';
        syncStoppedBtn.innerText = `Sync ${res.stopped_leads.length} Scraped Leads to CRM & Sheets`;
      } else {
        syncStoppedBtn.style.display = 'none';
      }
    });

    statusBox.className = 'status info';
    statusBox.style.display = 'block';
    statusHeader.innerText = 'Extraction Stopped';
    statusText.innerText = `Paused by user. Extracted ${state.leadsCount} leads. You can resume extraction or sync current leads below.`;
    progressBarContainer.style.display = 'none';
    statsGrid.style.display = 'none';
  } else if (state.status === 'error') {
    extractBtn.disabled = false;
    extractBtn.style.display = 'block';
    stopBtn.style.display = 'none';
    syncStoppedBtn.style.display = 'none';
    statusBox.className = 'status';
    statusBox.style.display = 'block';
    statusHeader.innerText = 'Error Occurred';
    statusText.innerText = state.currentBusiness || 'An unexpected error occurred.';
    progressBarContainer.style.display = 'none';
    statsGrid.style.display = 'none';
  } else {
    // Idle state
    extractBtn.disabled = false;
    extractBtn.style.display = 'block';
    stopBtn.style.display = 'none';
    syncStoppedBtn.style.display = 'none';
    statusBox.style.display = 'none';
  }
}

extractBtn.addEventListener('click', async () => {
  if (!dynamicWebAppUrl || dynamicWebAppUrl.includes('placeholder_url_here')) {
    alert('Please enter your deployed Google Apps Script Web App URL in the settings above.');
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !tab.url.includes('/maps') || !tab.url.includes('google.')) {
    alert('Please navigate to Google Maps and perform a local business search first.');
    return;
  }

  // Clear previous stop states & start running
  await chrome.storage.local.set({ extraction_stop: false });
  await chrome.storage.local.set({
    extraction_status: {
      status: 'scrolling',
      processed: 0,
      total: 0,
      currentBusiness: 'Initializing...',
      leadsCount: 0,
      phoneCount: 0,
      websiteCount: 0,
      socialCount: 0
    }
  });

  chrome.tabs.sendMessage(tab.id, {
    action: 'EXTRACT_MAPS_LEADS',
    googleAppsScriptUrl: dynamicWebAppUrl,
    scrapeSpeed: dynamicScrapeSpeed
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn('Communication error:', chrome.runtime.lastError.message);
      // Fallback in case of content script disconnected
      chrome.tabs.reload(tab.id);
      alert('Content script was disconnected. Refreshing Google Maps tab. Please click Extract again in 5 seconds.');
      chrome.storage.local.set({ extraction_status: { status: 'idle' } });
    }
  });
});

stopBtn.addEventListener('click', async () => {
  await chrome.storage.local.set({ extraction_stop: true });
  stopBtn.disabled = true;
  stopBtn.innerText = 'Stopping...';
  setTimeout(() => {
    stopBtn.disabled = false;
    stopBtn.innerText = 'Stop Extraction';
  }, 1000);
});

syncStoppedBtn.addEventListener('click', async () => {
  chrome.storage.local.get('stopped_leads', async (data) => {
    const leads = data.stopped_leads || [];
    if (leads.length === 0) return;

    syncStoppedBtn.disabled = true;
    syncStoppedBtn.innerText = 'Syncing...';
    statusBox.className = 'status info';
    statusHeader.innerText = 'Syncing Leads...';
    statusText.innerText = `Syncing ${leads.length} leads directly to CRM & Sheets...`;
    statusBox.style.display = 'block';

    try {
      // 1. Sync to Google Sheets
      await fetch(dynamicWebAppUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync_leads',
          apiKey: 'nr-revibe-secure-key-2026',
          leads: leads
        })
      });

      // 2. Sync to local React CRM Dashboard
      try {
        await fetch('https://maps-extractor.vercel.app/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leads: leads })
        });
      } catch (localErr) {
        console.log('Local CRM sync skipped:', localErr.message);
      }

      // Clear stopped leads & set to completed state
      await chrome.storage.local.set({ stopped_leads: [] });
      await chrome.storage.local.set({
        extraction_status: {
          status: 'completed',
          processed: leads.length,
          total: leads.length,
          currentBusiness: `Manually synced ${leads.length} leads successfully!`,
          leadsCount: leads.length
        }
      });
    } catch (err) {
      alert('Error syncing leads: ' + err.message);
      syncStoppedBtn.disabled = false;
      syncStoppedBtn.innerText = 'Sync Scraped Leads to Sheets & CRM';
    }
  });
});
