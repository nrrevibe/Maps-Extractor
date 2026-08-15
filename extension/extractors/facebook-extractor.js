/**
 * extractors/facebook-extractor.js
 * Injected into Facebook pages by the Tab Harvester.
 * Extracts likes, followers, contact info, about section, detects login walls,
 * and reports discoveredLinks for cross-source discovery.
 */

(function () {

  function extractFacebook() {
    try {
      // ── DISMISS LOGIN POPUP IF POSSIBLE ─────────────────────────────────
      const closeBtn = document.querySelector('div[aria-label="Close"][role="button"], div[aria-label="Close"]');
      if (closeBtn) {
        try { closeBtn.click(); } catch(e) {}
      }

      // ── LOGIN WALL DETECTION ─────────────────────────────────────────────
      if (
        window.location.href.includes('/login') ||
        window.location.href.includes('/checkpoint/')
      ) {
        return { success: false, error: 'LOGIN_REQUIRED' };
      }

      // If there's a hard login wall with no 'main' content or h1
      if (
        (document.querySelector('#login_form') || document.querySelector('input[name="email"]')) &&
        !document.querySelector('[role="main"]') && !document.querySelector('h1')
      ) {
        if (document.body.innerText.includes('Log in or sign up')) {
          return { success: false, error: 'LOGIN_REQUIRED' };
        }
      }

      const bodyText = document.body ? document.body.innerText : '';

      const data = {
        // ── Core ──
        likes: 0,
        followers: 0,
        email: '',
        phone: '',
        websiteLink: '',
        category: '',
        address: '',
        daysInactive: null,
        lastPostDate: '',

        // ── New About Section Fields ──
        pageName: '',
        overview: '',
        establishedYear: null,
        priceRange: '',
        hours: '',
        isVerified: false,
        pageId: '',

        // ── Cross-Discovery ──
        discoveredLinks: {
          instagram: '',
          website: '',
          twitter: '',
          youtube: '',
        },
      };

      // ══════════════════════════════════════════════════════════════════
      // PAGE NAME
      // ══════════════════════════════════════════════════════════════════
      const h1 = document.querySelector('h1');
      if (h1) data.pageName = h1.textContent.trim();
      if (!data.pageName) {
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) data.pageName = ogTitle.content.trim();
      }

      // ══════════════════════════════════════════════════════════════════
      // VERIFIED BADGE
      // ══════════════════════════════════════════════════════════════════
      data.isVerified = !!document.querySelector('[aria-label="Verified"]') ||
                        !!document.querySelector('svg[aria-label*="verified" i]') ||
                        bodyText.includes('Verified');

      // ══════════════════════════════════════════════════════════════════
      // PAGE ID from URL or meta
      // ══════════════════════════════════════════════════════════════════
      const ogUrl = document.querySelector('meta[property="og:url"]');
      if (ogUrl && ogUrl.content) {
        const idMatch = ogUrl.content.match(/\/(\d{10,20})/);
        if (idMatch) data.pageId = idMatch[1];
      }

      // ══════════════════════════════════════════════════════════════════
      // LIKES & FOLLOWERS
      // ══════════════════════════════════════════════════════════════════
      const likesMatch = bodyText.match(/([\d,.km]+)\s*(?:people\s+)?likes?\s+this/i) ||
                         bodyText.match(/([\d,.km]+)\s*likes/i);
      if (likesMatch) data.likes = parseNum(likesMatch[1]);

      const followsMatch = bodyText.match(/([\d,.km]+)\s*(?:people\s+)?follow(?:s|ers?)\s+this/i) ||
                           bodyText.match(/([\d,.km]+)\s*followers/i);
      if (followsMatch) data.followers = parseNum(followsMatch[1]);

      // ══════════════════════════════════════════════════════════════════
      // LINKS: Email, External Website, Social
      // ══════════════════════════════════════════════════════════════════
      document.querySelectorAll('a[href]').forEach(el => {
        const href = el.href || '';
        const hLower = href.toLowerCase();

        // Email
        if (!data.email && hLower.includes('mailto:')) {
          data.email = href.replace(/^mailto:/i, '').split('?')[0].trim().toLowerCase();
        }

        // External website through FB redirect
        if (!data.websiteLink && hLower.includes('l.php?u=')) {
          try {
            const params = new URL(href).searchParams;
            const target = decodeURIComponent(params.get('u') || '');
            if (target && !target.includes('facebook.com') && !target.includes('fb.com') && target.startsWith('http')) {
              data.websiteLink = target;
            }
          } catch (e) {}
        }

        // Direct external link (non-Facebook)
        if (!data.websiteLink && href.startsWith('http') && !hLower.includes('facebook.com') && !hLower.includes('fb.com') && !hLower.includes('instagram.com')) {
          try {
            const urlObj = new URL(href);
            if (urlObj.pathname === '/' || urlObj.pathname === '') {
              data.websiteLink = href;
            }
          } catch (e) {}
        }

        // ── Cross-discovery: Instagram, Twitter, YouTube ──
        if (!data.discoveredLinks.instagram && hLower.includes('instagram.com/') && !hLower.includes('/p/')) {
          data.discoveredLinks.instagram = href;
        }
        if (!data.discoveredLinks.twitter && (hLower.includes('twitter.com/') || hLower.includes('x.com/')) && !hLower.includes('/intent/')) {
          data.discoveredLinks.twitter = href;
        }
        if (!data.discoveredLinks.youtube && hLower.includes('youtube.com/')) {
          data.discoveredLinks.youtube = href;
        }
      });

      // Also set discovered website
      data.discoveredLinks.website = data.websiteLink;

      // ══════════════════════════════════════════════════════════════════
      // PHONE (from text)
      // ══════════════════════════════════════════════════════════════════
      // Indian numbers
      const phoneMatch = bodyText.match(/(?:\+91[\s\-]?)?[6-9]\d{9}/);
      if (phoneMatch) data.phone = phoneMatch[0].replace(/\D/g, '');
      // International
      if (!data.phone) {
        const intlMatch = bodyText.match(/\+\d{1,3}[\s\-]?\(?\d{1,4}\)?[\s\-]?\d{2,4}[\s\-]?\d{2,4}/);
        if (intlMatch) data.phone = intlMatch[0].replace(/\D/g, '');
      }

      // ══════════════════════════════════════════════════════════════════
      // ABOUT SECTION — Overview, Established, Hours, Price Range
      // ══════════════════════════════════════════════════════════════════

      // Overview / description from meta or visible text
      const ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc && ogDesc.content && ogDesc.content.length > 10) {
        data.overview = ogDesc.content.trim().substring(0, 500);
      }

      // Established year
      const estMatch = bodyText.match(/(?:Founded|Established|Since|Started)\s*(?:in\s*)?(\d{4})/i);
      if (estMatch) data.establishedYear = parseInt(estMatch[1]);

      // Price range
      const priceMatch = bodyText.match(/(?:Price\s*Range|₹|Rs\.?)\s*[:·\-]?\s*([^\n]{3,50})/i);
      if (priceMatch) data.priceRange = priceMatch[1].trim();

      // Hours
      const hoursMatch = bodyText.match(/(?:Hours|Open|Timing)\s*[:·\-]?\s*([^\n]{5,120})/i);
      if (hoursMatch) data.hours = hoursMatch[1].trim();

      // ══════════════════════════════════════════════════════════════════
      // ADDRESS (from About section or text)
      // ══════════════════════════════════════════════════════════════════
      // Look for structured address
      const addrMatch = bodyText.match(/[\w\s,./\-#]+(?:\d{6})\s*(?:,?\s*(?:India|IN))?/i);
      if (addrMatch && addrMatch[0].length > 10 && addrMatch[0].length < 200) {
        data.address = addrMatch[0].trim();
      }

      // ══════════════════════════════════════════════════════════════════
      // LAST POST DATE
      // ══════════════════════════════════════════════════════════════════
      const times = document.querySelectorAll('abbr[data-utime], time[datetime]');
      if (times.length > 0) {
        const timestamps = Array.from(times).map(t => {
          const unix = t.getAttribute('data-utime');
          const dt = t.getAttribute('datetime');
          return unix ? parseInt(unix) * 1000 : new Date(dt).getTime();
        }).filter(t => !isNaN(t) && t > 0).sort((a, b) => b - a);

        if (timestamps.length > 0) {
          const latest = timestamps[0];
          data.daysInactive = Math.floor((Date.now() - latest) / (1000 * 60 * 60 * 24));
          data.lastPostDate = new Date(latest).toISOString().split('T')[0];
        }
      }

      // ══════════════════════════════════════════════════════════════════
      // CATEGORY
      // ══════════════════════════════════════════════════════════════════
      const categoryEl = document.querySelector('[data-key="category"]') ||
                         document.querySelector('.x193iq5w.xeuugli');
      if (categoryEl) data.category = categoryEl.textContent.trim().substring(0, 80);

      // Fallback: look for category text near page name
      if (!data.category) {
        const catMatch = bodyText.match(/(?:Restaurant|Café|Salon|Hotel|Gym|Clinic|Hospital|Shop|Store|Agency|Studio|School|College|University|Bar|Club|Spa|Dental|Bakery|Boutique|Photography|Consulting|Real Estate|Interior|Architecture|Law Firm|Accounting)/i);
        if (catMatch) data.category = catMatch[0];
      }

      // ══════════════════════════════════════════════════════════════════
      // EMAIL FROM BODY TEXT (fallback if not found in links)
      // ══════════════════════════════════════════════════════════════════
      if (!data.email) {
        const emailMatch = bodyText.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
        if (emailMatch) {
          const candidate = emailMatch[0].toLowerCase();
          // Exclude facebook internal emails
          if (!candidate.includes('facebook.com') && !candidate.includes('fb.com')) {
            data.email = candidate;
          }
        }
      }

      return { success: true, data };
    } catch (e) {
      return { success: false, error: 'EXTRACT_FAIL', message: e.message };
    }
  }

  function parseNum(str) {
    if (!str) return 0;
    const s = str.toString().toLowerCase().replace(/,/g, '').trim();
    if (s.endsWith('k')) return Math.round(parseFloat(s) * 1000);
    if (s.endsWith('m')) return Math.round(parseFloat(s) * 1000000);
    return parseInt(s) || 0;
  }

  chrome.runtime.sendMessage({
    action: 'HARVEST_RESULT',
    type: 'FACEBOOK',
    result: extractFacebook(),
  });
})();
