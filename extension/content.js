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
  const links = Array.from(scope.querySelectorAll('a[href]'));
  let instagram = '', facebook = '', twitter = '', linkedin = '', youtube = '';
  links.forEach(el => {
    const href = (el.href || '').toLowerCase();
    if (!instagram && href.includes('instagram.com/') && !href.includes('/p/')) instagram = el.href;
    else if (!facebook && href.includes('facebook.com/') && !href.includes('/sharer')) facebook = el.href;
    else if (!twitter && (href.includes('twitter.com/') || href.includes('x.com/')) && !href.includes('/intent/')) twitter = el.href;
    else if (!linkedin && href.includes('linkedin.com/')) linkedin = el.href;
    else if (!youtube && href.includes('youtube.com/')) youtube = el.href;
  });
  return { instagram, facebook, twitter, linkedin, youtube };
}

// ── Analyze External Website (via Background Proxy) ───────────────────────────
async function analyzeWebsite(url) {
  if (!url) return { platform: 'None', social: {} };
  try {
    const res = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'FETCH_WEBSITE', url }, (response) => resolve(response));
    });
    
    if (!res || !res.success || !res.html) return { platform: 'Unknown', social: {} };
    const html = res.html;
    
    // Detect Platform
    let platform = 'Custom / Unknown';
    if (/wp-content|wp-includes|<meta name="generator" content="WordPress/i.test(html)) platform = 'WordPress';
    else if (/cdn\.shopify\.com|shopify\.com/i.test(html)) platform = 'Shopify';
    else if (/wix\.com|wixsite\.com/i.test(html)) platform = 'Wix';
    else if (/squarespace\.com/i.test(html)) platform = 'Squarespace';
    else if (/weebly\.com/i.test(html)) platform = 'Weebly';
    else if (/webflow\.com/i.test(html)) platform = 'Webflow';
    
    // Detect Social Links
    const social = { instagram: '', facebook: '', twitter: '', linkedin: '', youtube: '' };
    
    // Scan all href="..." attributes in the HTML for reliable link extraction
    const hrefRegex = /href=["'](https?:\/\/[^"']+)["']/gi;
    let match;
    while ((match = hrefRegex.exec(html)) !== null) {
      const linkStr = match[1];
      const linkLow = linkStr.toLowerCase();
      
      if (!social.instagram && linkLow.includes('instagram.com') && !linkLow.includes('/p/')) social.instagram = linkStr;
      else if (!social.facebook && linkLow.includes('facebook.com') && !linkLow.includes('/sharer')) social.facebook = linkStr;
      else if (!social.twitter && (linkLow.includes('twitter.com') || linkLow.includes('x.com')) && !linkLow.includes('/intent/')) social.twitter = linkStr;
      else if (!social.linkedin && linkLow.includes('linkedin.com') && !linkLow.includes('/share')) social.linkedin = linkStr;
      else if (!social.youtube && linkLow.includes('youtube.com')) social.youtube = linkStr;
    }
    
    return { platform, social };
  } catch (err) {
    return { platform: 'Error', social: {} };
  }
}

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
  await chrome.storage.local.set({
    extraction_status: { status, processed, total, currentBusiness, leadsCount,
                         phoneCount, websiteCount, socialCount }
  });
}
async function isStopSignalled() {
  const d = await chrome.storage.local.get('extraction_stop');
  return Boolean(d.extraction_stop);
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action !== 'EXTRACT_MAPS_LEADS') return;
  const googleAppsScriptUrl = request.googleAppsScriptUrl;
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

    // ── Step 1: Scroll sidebar to load listings ─────────────────────────────
    await updateStatus('scrolling', 0, 0, 'Scrolling to load listings...', 0);
    const feed = document.querySelector('div[role="feed"]');
    if (feed) {
      let attempts = 0;
      while (document.querySelectorAll('a[href*="/maps/place/"]').length < 60 && attempts < 15) {
        if (await isStopSignalled()) break;
        feed.scrollBy(0, 2000);
        await sleep(delayScroll);
        attempts++;
      }
    }

    const listings    = document.querySelectorAll('a[href*="/maps/place/"]');
    const totalProcess = Math.min(listings.length, 65);
    console.log(`[Extractor] ${listings.length} listings found, processing ${totalProcess}`);

    let phoneCount = 0, websiteCount = 0, socialCount = 0, stopped = false;
    let lastProcessedTitle = '';

    for (let i = 0; i < totalProcess; i++) {
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

        await updateStatus('running', i, totalProcess, businessName, leads.length,
                           phoneCount, websiteCount, socialCount);

        // ── Click ─────────────────────────────────────────────────────────────
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
        let instagram = '', facebook = '', twitter = '', linkedin = '', youtube = '';

        if (panelReady) {
          // Poll until at least one detail element appears (up to 4 seconds)
          for (let a = 0; a < 16; a++) {
            await sleep(delayPoll);
            if (document.querySelector('button[data-item-id*="phone:tel:"]') ||
                document.querySelector('a[data-item-id="authority"]') ||
                document.querySelector('button[data-item-id="address"]')) break;
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

          // Address: button[data-item-id="address"] inner .Io6YTe
          const addrBtn = document.querySelector('button[data-item-id="address"]');
          if (addrBtn) {
            address = addrBtn.querySelector('.Io6YTe')?.textContent?.trim() ||
                      addrBtn.textContent?.trim() || 'N/A';
          }

          // Hours
          hours = extractHours(document);

          // Social links
          ({ instagram, facebook, twitter, linkedin, youtube } = extractSocialLinks(document));

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
        // ── Analyze External Website for deeper insights ──────────────────────
        let websitePlatform = 'None';
        if (websiteUrl) {
          const siteAnalysis = await analyzeWebsite(websiteUrl);
          websitePlatform = siteAnalysis.platform;
          // Only overwrite if the Maps panel didn't already have them
          if (!instagram && siteAnalysis.social.instagram) instagram = siteAnalysis.social.instagram;
          if (!facebook && siteAnalysis.social.facebook) facebook = siteAnalysis.social.facebook;
          if (!twitter && siteAnalysis.social.twitter) twitter = siteAnalysis.social.twitter;
          if (!linkedin && siteAnalysis.social.linkedin) linkedin = siteAnalysis.social.linkedin;
          if (!youtube && siteAnalysis.social.youtube) youtube = siteAnalysis.social.youtube;
        }

        const hasSocial = !!(instagram || facebook || twitter);
        const { score, priority } = computeLeadScore(!!websiteUrl, rating, reviewCount, phone !== 'N/A', hasSocial);

        seenNames.add(businessName.toLowerCase());
        if (phone && phone !== 'N/A') seenPhones.add(phone);

        let safeEmail = 'N/A';
        if (websiteUrl) { try { safeEmail = 'info@' + new URL(websiteUrl).hostname.replace('www.', ''); } catch(e) {} }

        leads.push({
          id: 'MAPS-' + Math.floor(1000 + Math.random() * 9000),
          businessName, category, googleMapsUrl: link.href,
          websiteUrl, websiteStatus: websiteUrl ? 'Active' : 'No Website',
          websiteTechnology: websitePlatform,
          websiteQuality: websiteUrl ? 'Average' : 'N/A',
          https: websiteUrl ? websiteUrl.startsWith('https') : false,
          mobileFriendly: true, phone, hours,
          email: safeEmail, emailType: websiteUrl ? 'Business' : 'Missing',
          emailSource: 'Maps', emailVerified: false,
          emailConfidenceScore: websiteUrl ? 70 : 0,
          address, city, state, country, rating, reviewCount,
          instagramUrl: instagram, facebookUrl: facebook,
          twitterUrl: twitter, linkedinUrl: linkedin, youtubeUrl: youtube,
          leadScore: score, leadPriority: priority,
          opportunityType: websiteUrl ? 'Redesign' : 'New Website',
          painPoint: websiteUrl ? 'Mobile responsiveness / SEO' : 'No online presence',
          suggestedService: websiteUrl ? 'Website Redesign & SEO' : 'New Website Development',
          leadStatus: 'New', emailStatus: 'Not Sent',
          collectedDate: new Date().toISOString().split('T')[0],
          collectedBy: 'NR Rvibe Maps Extractor'
        });

        if (phone && phone !== 'N/A') phoneCount++;
        if (websiteUrl) websiteCount++;
        if (hasSocial)  socialCount++;

        await updateStatus('running', i + 1, totalProcess, businessName, leads.length,
                           phoneCount, websiteCount, socialCount);
      } catch (err) {
        console.error(`[Error i=${i}]`, err.message, err);
      }
    }

    // ── Sync ──────────────────────────────────────────────────────────────────
    if (stopped) {
      await chrome.storage.local.set({ stopped_leads: leads });
      await updateStatus('stopped', leads.length, totalProcess,
                         `Stopped — ${leads.length} leads saved`, leads.length,
                         phoneCount, websiteCount, socialCount);
    } else {
      await chrome.storage.local.set({ stopped_leads: [] });
      await updateStatus('syncing', leads.length, totalProcess,
                         'Uploading to Sheets & CRM...', leads.length,
                         phoneCount, websiteCount, socialCount);
      try {
        await fetch(googleAppsScriptUrl, {
          method: 'POST', mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'sync_leads', apiKey: 'nr-revibe-secure-key-2026', leads })
        });
      } catch (e) { console.error('Sheets sync error:', e); }
      try {
        await fetch('http://localhost:8081/api/leads', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leads })
        });
      } catch (e) { console.log('Local CRM sync skipped:', e.message); }
      await updateStatus('completed', totalProcess, totalProcess,
                         `Done! ${leads.length} leads synced`, leads.length,
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
