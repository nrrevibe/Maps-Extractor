// ═══════════════════════════════════════════════════════════════════════════════
// NR Rvibe — Google Maps Lead Extractor (Content Script)
// Strategy: click → wait for h1 to MATCH business name → wait for body to load
// ═══════════════════════════════════════════════════════════════════════════════

// ── Fuzzy name match ─────────────────────────────────────────────────────────
function isNameMatch(a, b) {
  if (!a || !b) return false;
  const n1 = a.toLowerCase().replace(/[|•,]/g, ' ').replace(/\s+/g, ' ').trim();
  const n2 = b.toLowerCase().replace(/[|•,]/g, ' ').replace(/\s+/g, ' ').trim();
  if (n1 === n2) return true;
  if (n1.includes(n2) || n2.includes(n1)) return true;
  const w1 = n1.split(' ')[0];
  const w2 = n2.split(' ')[0];
  return w1 && w2 && w1.length > 2 && w1 === w2;
}

// ── Parse Indian address → city / state ──────────────────────────────────────
function parseCityState(raw) {
  if (!raw || raw === 'N/A') return { city: 'N/A', state: 'N/A', country: 'India' };
  const parts = raw.split(',').map(p => p.trim()).filter(Boolean);
  let city  = parts[parts.length - 3] || parts[parts.length - 2] || 'N/A';
  let state = parts[parts.length - 2] || 'N/A';
  city  = city.replace(/\d{4,6}/, '').trim() || 'N/A';
  state = state.replace(/\d{4,6}/, '').trim() || 'N/A';
  return { city, state, country: 'India' };
}

// ── Lead scoring ─────────────────────────────────────────────────────────────
function computeLeadScore(hasWebsite, rating, reviewCount, hasPhone, hasSocial) {
  let score = 0;
  if (!hasWebsite)        score += 40;
  if (hasPhone)           score += 15;
  if (hasSocial)          score += 10;
  if (rating >= 4.0)      score += 15;
  if (reviewCount >= 50)  score += 10;
  if (reviewCount >= 200) score += 10;
  score = Math.min(score, 100);
  const priority = score >= 75 ? 'Hot Lead' : score >= 45 ? 'Medium Priority' : 'Low Priority';
  return { score, priority };
}

// ── Extract social links (from Maps Panel) ────────────────────────────────────
function extractSocialLinks(scope) {
  let links = Array.from(scope.querySelectorAll('a[href]'));
  
  // Also check inside same-origin iframes (like "Web results" iframe)
  const iframes = scope.querySelectorAll('iframe');
  for (let i = 0; i < iframes.length; i++) {
    try {
      const doc = iframes[i].contentDocument || iframes[i].contentWindow?.document;
      if (doc) {
        links = links.concat(Array.from(doc.querySelectorAll('a[href]')));
      }
    } catch(e) { }
  }

  let instagram = '', facebook = '', twitter = '', linkedin = '', youtube = '', whatsapp = '';
  links.forEach(el => {
    const href = (el.href || '').toLowerCase();
    if (!instagram && href.includes('instagram.com/') && !href.includes('/p/')) instagram = el.href;
    else if (!facebook && href.includes('facebook.com/') && !href.includes('/sharer')) facebook = el.href;
    else if (!twitter && (href.includes('twitter.com/') || href.includes('x.com/')) && !href.includes('/intent/')) twitter = el.href;
    else if (!linkedin && href.includes('linkedin.com/')) linkedin = el.href;
    else if (!youtube && href.includes('youtube.com/')) youtube = el.href;
    else if (!whatsapp && (href.includes('wa.me/') || href.includes('api.whatsapp.com/send') || href.includes('whatsapp.com/'))) whatsapp = el.href;
  });

  // Fallback: search raw HTML for "Web results" which might hide hrefs in javascript or data attributes
  try {
    const html = (scope.body ? scope.body.innerHTML : scope.innerHTML) || '';
    if (!instagram) { 
      const m = html.match(/https?:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9_.-]+/); 
      if (m && !m[0].includes('/explore') && !m[0].includes('/p/')) instagram = m[0]; 
    }
    if (!facebook) { 
      const m = html.match(/https?:\/\/(www\.)?facebook\.com\/[a-zA-Z0-9_.-]+/); 
      if (m && !m[0].includes('/sharer') && !m[0].includes('/pages/create')) facebook = m[0]; 
    }
    if (!twitter) { 
      const m = html.match(/https?:\/\/(www\.)?(twitter|x)\.com\/[a-zA-Z0-9_.-]+/); 
      if (m && !m[0].includes('/intent/')) twitter = m[0]; 
    }
    if (!linkedin) { 
      const m = html.match(/https?:\/\/(www\.)?linkedin\.com\/(in|company)\/[a-zA-Z0-9_.-]+/); 
      if (m) linkedin = m[0]; 
    }
  } catch(e) {}

  return { instagram, facebook, twitter, linkedin, youtube, whatsapp };
}

// ── External Website Analysis (Delegated to Tab Harvester) ───────────────────
// Inline analysis removed. Deep data is now handled by Tab Harvester queue via background.js

// ── Extract opening hours ─────────────────────────────────────────────────────
// From actual Google Maps DOM: .OqCZI .ZDu9vd shows "Open · Closes 9 pm"
function extractHours(scope) {
  try {
    const el = scope.querySelector('.OqCZI .ZDu9vd') ||
               scope.querySelector('.OqCZI .o0Svhf .ZDu9vd') ||
               scope.querySelector('.o0Svhf .ZDu9vd');
    if (el) { const t = el.textContent.trim(); if (t && t.length > 2 && t.length < 100) return t; }
    const row = scope.querySelector('table.eK4R0e tr:first-child');
    if (row) return row.textContent.trim().replace(/\s+/g, ' ');
  } catch (e) { /* ignore */ }
  return 'N/A';
}

// ── Status helpers ────────────────────────────────────────────────────────────
async function updateStatus(status, processed, total, currentBusiness, leadsCount,
                             phoneCount = 0, websiteCount = 0, socialCount = 0) {
  try {
    await chrome.storage.local.set({
      extraction_status: { status, processed, total, currentBusiness, leadsCount,
                           phoneCount, websiteCount, socialCount }
    });
  } catch (e) {
    // Context was invalidated (extension reloaded) — stop silently
    if (e.message && e.message.includes('Extension context invalidated')) throw e;
  }
}
async function isStopSignalled() {
  try {
    const d = await chrome.storage.local.get('extraction_stop');
    return Boolean(d.extraction_stop);
  } catch (e) {
    return true; // Treat context invalidation as a stop signal
  }
}
function isContextValid() {
  try { return !!chrome.runtime.id; } catch (e) { return false; }
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action !== 'EXTRACT_MAPS_LEADS') return;
  const apiKey = request.apiKey || 'nr-revibe-secure-key-2026';
  const harvestSettings = request.harvestSettings || {};
  const scrapeSpeed = request.scrapeSpeed || 'safe';
  
  let delayScroll = 900;
  let delayRender = 300;
  let delayPoll = 250;
  
  if (scrapeSpeed === 'fast') {
    delayScroll = 400;
    delayRender = 100;
    delayPoll = 100;
  }

  (async () => {
    const leads = [], seenPhones = new Set(), seenNames = new Set();
    await chrome.storage.local.set({ extraction_stop: false });

    // Initialize Streaming Harvester
    try {
      chrome.runtime.sendMessage({
        action: 'START_HARVEST',
        apiKey: apiKey,
        settings: harvestSettings,
        leads: [] // Start streaming with empty array
      });
    } catch (e) { console.error('Failed to start streaming harvest:', e); }

    let phoneCount = 0, websiteCount = 0, socialCount = 0, stopped = false;
    let lastProcessedTitle = '';
    const maxMapsLeads = harvestSettings.maxMapsLeads || 500;
    let paginationAttempts = 0;

    // ── OUTER PAGINATION LOOP ──────────────────────────────────────────────────
    while (leads.length < maxMapsLeads && !stopped && paginationAttempts < 50) {
      if (await isStopSignalled()) { stopped = true; break; }
      
      // ── Step 1: Scroll sidebar to load listings ─────────────────────────────
      await updateStatus('scrolling', leads.length, maxMapsLeads, 'Scrolling to load area listings...', leads.length);
      const feed = document.querySelector('div[role="feed"]');
      if (feed) {
      let attempts = 0;
      let lastCount = 0;
      let identicalCounts = 0;
      
      while (identicalCounts < 5 && attempts < 150) {
        if (await isStopSignalled()) break;
        feed.scrollBy(0, 2000);
        await sleep(delayScroll);
        
        const currentCount = document.querySelectorAll('a[href*="/maps/place/"]').length;
        if (currentCount === lastCount) {
          identicalCounts++;
        } else {
          identicalCounts = 0;
          lastCount = currentCount;
        }
        
        // Break early if Google Maps says we reached the end
        const endFound = Array.from(document.querySelectorAll('span')).some(s => 
          s.textContent && s.textContent.includes("You've reached the end of the list")
        );
        if (endFound) break;
        
        attempts++;
      }
    }

      const listings    = document.querySelectorAll('a[href*="/maps/place/"]');
      
      // Filter to only unprocessed listings
      const unprocessedListings = Array.from(listings).filter(link => {
        const parent = link.closest('div[role="feed"] > div') || link.parentElement;
        const nameEl = parent.querySelector('.qBF1Pd') || parent.querySelector('.fontHeadlineSmall');
        if (!nameEl) return false;
        return !seenNames.has(nameEl.textContent.trim().toLowerCase());
      });

      console.log(`[Extractor] ${unprocessedListings.length} new listings found in this area.`);
      
      if (unprocessedListings.length === 0) {
        // No more new listings in this area, try to paginate!
        await updateStatus('scrolling', leads.length, maxMapsLeads, 'Looking for next area...', leads.length);
        
        // 1. Look for "Search this area" button
        const buttons = Array.from(document.querySelectorAll('button span'));
        const searchBtnSpan = buttons.find(s => s.textContent && s.textContent.includes('Search this area'));
        
        if (searchBtnSpan && searchBtnSpan.closest('button')) {
          console.log('[Extractor] Clicking "Search this area" button');
          searchBtnSpan.closest('button').click();
          await sleep(2500);
          paginationAttempts++;
          continue;
        } else {
          console.log('[Extractor] Panning map to find more leads...');
          // 2. Try artificial panning of the map
          const canvas = document.querySelector('canvas');
          if (canvas) {
            const rect = canvas.getBoundingClientRect();
            // Dispatch mouse events to pan
            const mousedown = new MouseEvent('mousedown', { bubbles: true, clientX: rect.left + rect.width/2, clientY: rect.top + rect.height/2 });
            const mousemove = new MouseEvent('mousemove', { bubbles: true, clientX: rect.left + rect.width/2 + 200, clientY: rect.top + rect.height/2 + 200 });
            const mouseup = new MouseEvent('mouseup', { bubbles: true });
            canvas.dispatchEvent(mousedown);
            await sleep(100);
            canvas.dispatchEvent(mousemove);
            await sleep(100);
            canvas.dispatchEvent(mouseup);
            await sleep(3000); // Wait for results to update
            paginationAttempts++;
            continue;
          } else {
            console.warn('[Extractor] No more leads and cannot pan map. Stopping.');
            break;
          }
        }
      }

      for (let i = 0; i < unprocessedListings.length; i++) {
        if (leads.length >= maxMapsLeads) break;
      // Stop immediately if context was invalidated (extension reloaded)
      if (!isContextValid()) {
        console.warn('[NR Rvibe] Extension context invalidated — stopping scraper.');
        stopped = true; break;
      }
      if (await isStopSignalled()) { stopped = true; break; }
      const link = listings[i];
      try {
        // ── Sidebar card ──────────────────────────────────────────────────────
        const parent   = link.closest('div[role="feed"] > div') || link.parentElement;
        const nameEl   = parent.querySelector('.qBF1Pd') || parent.querySelector('.fontHeadlineSmall');
        if (!nameEl) continue;
        const businessName = nameEl.textContent.trim();

        if (seenNames.has(businessName.toLowerCase())) {
          console.log(`[Skip-dup] ${businessName}`); continue;
        }

        const catEl = parent.querySelector('.W4Efsd .W4Efsd span') ||
                      parent.querySelector('.W4Efsd span');
        let category = catEl ? catEl.textContent.trim().split('·')[0].trim() : 'N/A';

        const ratingEl    = parent.querySelector('.MW4etd');
        const rating      = parseFloat(ratingEl?.textContent?.trim()) || 4.0;
        const reviewsEl   = parent.querySelector('.UY7F9');
        const reviewCount = parseInt((reviewsEl?.textContent || '').replace(/\D/g, '')) || 0;

        await updateStatus('running', leads.length + 1, maxMapsLeads, businessName, leads.length,
                           phoneCount, websiteCount, socialCount);

        // ── Click ─────────────────────────────────────────────────────────────
        try { link.scrollIntoView({ block: 'center' }); } catch(e) {}
        await sleep(150);
        link.click();

        // ── Step 2: Wait for h1 to MATCH this business name ──────────────────
        // KEY FIX: don't just wait for h1 to "change" — wait for it to
        // MATCH the business we actually clicked. Prevents reading wrong panel.
        let panelReady = false;
        let currentTitle = '';
        const getTitle = () => {
          // Priority classes
          let el = document.querySelector('h1.DUwDvf') || 
                   document.querySelector('.DUwDvf') || 
                   document.querySelector('.fontHeadlineLarge');
          
          if (el && el.textContent.trim()) return el.textContent.trim();
          
          // Fallback to any h1 that actually has text
          const h1s = document.querySelectorAll('h1');
          for (let h of h1s) {
            if (h.textContent.trim()) return h.textContent.trim();
          }
          return '';
        };

        for (let a = 0; a < 28; a++) {
          if (await isStopSignalled()) break;
          await sleep(delayPoll);
          currentTitle = getTitle();
          if (currentTitle && isNameMatch(currentTitle, businessName)) {
            panelReady = true; break;
          }
        }
        // Retry click once if still no match
        if (!panelReady) {
          try { link.scrollIntoView({ block: 'center' }); } catch(e) {}
          await sleep(150);
          link.click();
          for (let a = 0; a < 24; a++) {
            if (await isStopSignalled()) break;
            await sleep(delayPoll);
            currentTitle = getTitle();
            if (currentTitle && isNameMatch(currentTitle, businessName)) {
              panelReady = true; break;
            }
          }
        }

        // FALLBACK: If fuzzy match failed but we clearly loaded a title that is NOT the previous listing,
        // accept it as loaded anyway to prevent N/A failures on weirdly named businesses.
        if (!panelReady && currentTitle && currentTitle.length > 2 && !isNameMatch(currentTitle, lastProcessedTitle)) {
           console.warn(`[FuzzyMatch-Fail] Assuming loaded because title changed. Expected: "${businessName}", Got: "${currentTitle}"`);
           panelReady = true;
        }
        
        lastProcessedTitle = panelReady ? currentTitle : businessName;

        if (await isStopSignalled()) { stopped = true; break; }

        // ── Step 3: Wait for body detail elements to render ───────────────────
        let websiteUrl = '', phone = 'N/A', address = 'N/A', hours = 'N/A';
        let instagram = '', facebook = '', twitter = '', linkedin = '', youtube = '', whatsapp = '';

        if (panelReady) {
          // Poll until at least one detail element appears (up to 4 seconds)
          for (let a = 0; a < 16; a++) {
            await sleep(delayPoll);
            if (document.querySelector('button[data-item-id*="phone:tel:"]') ||
                document.querySelector('a[data-item-id="authority"]') ||
                document.querySelector('button[data-item-id="address"]')) break;
          }
          
          // ── Scroll the detail panel to load lazy-loaded data (like Web Results/Social) ──
          let detailPanel = null;
          const h1s = Array.from(document.querySelectorAll('h1'));
          const targetH1 = h1s.find(h => isNameMatch(h.textContent.trim(), businessName)) || document.querySelector('h1.DUwDvf');
          if (targetH1) {
             detailPanel = targetH1.closest('.m6QErb[tabindex="-1"]') || targetH1.closest('.m6QErb.DxyBCb.kA9KIf.dS8AEf.XiKgde') || targetH1.closest('[role="main"]');
          }
          if (!detailPanel) detailPanel = document.querySelector('.m6QErb.DxyBCb.kA9KIf.dS8AEf.XiKgde') || document.querySelector('[role="main"]');
          
          if (detailPanel) {
            detailPanel.scrollBy(0, 3000);
            await sleep(delayScroll > 300 ? 500 : delayScroll);
            detailPanel.scrollBy(0, 3000);
            // Wait slightly longer after scrolling for iframes to render
            await sleep(delayScroll > 300 ? 800 : delayScroll * 2);
          }
          
          await sleep(delayRender); // render buffer

          // Phone: button[data-item-id="phone:tel:XXXXXXXXXX"]
          const phoneEl = document.querySelector('button[data-item-id*="phone:tel:"]');
          if (phoneEl) {
            const raw = phoneEl.getAttribute('data-item-id') || '';
            phone = raw.replace('phone:tel:', '').trim();
            if (!phone) phone = phoneEl.querySelector('.Io6YTe')?.textContent?.trim() || 'N/A';
          }

          // Website: a[data-item-id="authority"]
          const wsEl = document.querySelector('a[data-item-id="authority"]');
          websiteUrl = wsEl?.href || '';

          // Address: multiple fallback selectors
          const addrBtn = document.querySelector('button[data-item-id="address"]') || 
                          document.querySelector('button[aria-label^="Address:"]') ||
                          document.querySelector('button[data-tooltip="Copy address"]');
          if (addrBtn) {
            address = addrBtn.querySelector('.Io6YTe')?.textContent?.trim() ||
                      addrBtn.getAttribute('aria-label')?.replace('Address:', '')?.trim() ||
                      addrBtn.textContent?.trim() || 'N/A';
          }
          
          if (address === 'N/A') {
            // Fallback to the list item text (parent)
            const parentText = parent.textContent || '';
            const match = parentText.match(/·\s([^·]+)$/);
            if (match) address = match[1].trim();
          }

          // Hours
          hours = extractHours(document);

          // Social links
          ({ instagram, facebook, twitter, linkedin, youtube, whatsapp } = extractSocialLinks(document));

          // Category from panel
          const pCatEl = document.querySelector('[role="main"] button.DkEaL');
          if (pCatEl) { const pc = pCatEl.textContent?.trim(); if (pc && pc.length > 1) category = pc; }

          console.log(`OK [${businessName}] ph=${phone} | addr=${address.substring(0,25)} | web=${websiteUrl} | hrs=${hours}`);
        } else {
          console.warn(`FAIL [${businessName}] h1 never matched`);
        }

        // In-run phone dedup
        if (phone && phone !== 'N/A' && seenPhones.has(phone)) {
          console.log(`[Skip-phone] ${businessName}`); continue;
        }

        const { city, state, country } = parseCityState(address);
        // ── Analyze External Website for deeper insights (DEFERRED TO HARVESTER) ──
        let websitePlatform = 'N/A';
        let isMobileFriendly = true;

        const hasPhone    = phone !== 'N/A';
        const hasWebsite  = !!websiteUrl;
        const hasSocial   = !!(instagram || facebook || linkedin || whatsapp);
        const { score, priority } = computeLeadScore(hasWebsite, rating, reviewCount, hasPhone, hasSocial);

        seenNames.add(businessName.toLowerCase());
        if (phone && phone !== 'N/A') seenPhones.add(phone);

        // We defer deep email extraction to the Tab Harvester, but log what we found in Maps directly.
        let bestEmail = 'N/A';
        let emailSource = 'Pending Harvest';
        let emailType = 'Missing';
        let emailConfidence = 0;

        // Try to find email in raw maps description text
        try {
          const bodyText = document.body ? document.body.innerText : '';
          const emailMatch = bodyText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
          if (emailMatch && emailMatch[0]) {
            // Avoid grabbing google emails or image artifact names
            const e = emailMatch[0].toLowerCase();
            if (!e.includes('sentry.io') && !e.includes('@google.com') && !e.includes('.png') && !e.includes('.jpg')) {
              bestEmail = e;
              emailSource = 'Google Maps Detail';
              emailType = 'Maps Description';
              emailConfidence = 70;
            }
          }
        } catch(e) {}

        const newLead = {
          id: 'MAPS-' + Math.floor(1000 + Math.random() * 9000),
          businessName, category, googleMapsUrl: link.href,
          websiteUrl, 
          websiteStatus: websiteUrl ? 'Pending Harvest' : 'No Website',
          websiteTechnology: websitePlatform,
          websiteQuality: websiteUrl ? 'Pending Harvest' : 'N/A',
          https: websiteUrl ? true : false,
          mobileFriendly: isMobileFriendly, phone, hours,
          email: bestEmail, emailType: emailType,
          emailSource: emailSource, emailVerified: false,
          emailConfidenceScore: emailConfidence,
          address, city, state, country, rating, reviewCount,
          instagramUrl: instagram || undefined,
          facebookUrl: facebook || undefined,
          twitterUrl: twitter || undefined,
          linkedinUrl: linkedin || undefined,
          youtubeUrl: youtube || undefined,
          whatsappUrl: whatsapp || undefined,
          socialStatus: hasSocial ? 'Active' : 'Missing',
          leadScore: score, leadPriority: priority,
          opportunityType: websiteUrl ? 'Redesign' : 'New Website',
          painPoint: websiteUrl ? 'Mobile responsiveness / SEO' : 'No online presence',
          suggestedService: websiteUrl ? 'Website Redesign & SEO' : 'New Website Development',
          leadStatus: 'New', emailStatus: 'Not Sent',
          collectedDate: new Date().toISOString().split('T')[0],
          collectedBy: 'NR Rvibe Maps Extractor'
        };

        leads.push(newLead);
        seenNames.add(businessName.toLowerCase());
        if (phone && phone !== 'N/A') seenPhones.add(phone);

        // Stream lead to background harvester
        try {
          chrome.runtime.sendMessage({ action: 'ENQUEUE_LEAD', lead: newLead });
        } catch (e) { console.warn('Failed to enqueue:', e.message); }

        if (phone && phone !== 'N/A') phoneCount++;
        if (websiteUrl) websiteCount++;
        if (hasSocial)  socialCount++;

        await updateStatus('running', leads.length, maxMapsLeads, businessName, leads.length,
                           phoneCount, websiteCount, socialCount);
      } catch (err) {
        if (err.message && err.message.includes('Extension context invalidated')) {
          console.warn('[NR Rvibe] Extension context invalidated during iteration — stopping gracefully.');
          stopped = true;
          break;
        }
        console.error(`[Error]`, err.message, err);
      }
    } // end for loop over unprocessedListings
  } // end OUTER PAGINATION LOOP

    // ── Sync ──────────────────────────────────────────────────────────────────
    if (stopped) {
      await chrome.storage.local.set({ stopped_leads: leads });
      try { chrome.runtime.sendMessage({ action: 'COLLECTOR_FINISHED' }); } catch (e) {}
      await updateStatus('stopped', leads.length, maxMapsLeads,
                         `Stopped — ${leads.length} leads saved`, leads.length,
                         phoneCount, websiteCount, socialCount);
    } else {
      await chrome.storage.local.set({ stopped_leads: [] });
      try { chrome.runtime.sendMessage({ action: 'COLLECTOR_FINISHED' }); } catch (e) {}
      await updateStatus('completed', leads.length, maxMapsLeads,
                         `Maps Scrape Done! Finishing background harvest...`, leads.length,
                         phoneCount, websiteCount, socialCount);
    }
    sendResponse({ status: 'SUCCESS', count: leads.length });
  })().catch(err => {
    console.error('[Fatal]', err);
    updateStatus('error', 0, 0, err.message, 0);
    sendResponse({ status: 'ERROR', error: err.message });
  });
  return true;
});
