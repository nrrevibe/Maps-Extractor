/**
 * extractors/website-subpage-extractor.js
 * Lightweight extractor injected into Contact / About sub-pages.
 *
 * background.js sets `harvest_subpage_type` in chrome.storage.session
 * before injecting this script so we know which page we're on.
 *
 * Sends HARVEST_SUBPAGE_RESULT back to background.js.
 */

(function () {

  async function run() {
    // Determine page type from storage (set by background before injection)
    let pageType = 'contact'; // default
    try {
      const res = await chrome.storage.session.get('harvest_subpage_type');
      if (res && res.harvest_subpage_type) pageType = res.harvest_subpage_type;
    } catch (e) {
      // session storage unavailable, try to infer from URL
      const url = window.location.href.toLowerCase();
      if (url.includes('about') || url.includes('our-story') || url.includes('who-we-are')) {
        pageType = 'about';
      }
    }

    const data = pageType === 'about' ? extractAboutPage() : extractContactPage();

    chrome.runtime.sendMessage({
      action: 'HARVEST_SUBPAGE_RESULT',
      pageType,
      result: { success: true, data },
    });
  }

  // ════════════════════════════════════════════════════════════════════
  // CONTACT PAGE EXTRACTION
  // ════════════════════════════════════════════════════════════════════
  function extractContactPage() {
    const bodyText = document.body ? document.body.innerText : '';
    const data = {
      emails: [],
      phones: [],
      addresses: [],
      formPresent: false,
      hoursOfOperation: '',
      mapEmbedUrl: '',
    };

    // Emails — mailto links
    document.querySelectorAll('a[href^="mailto:"]').forEach(el => {
      const email = el.href.replace('mailto:', '').split('?')[0].trim().toLowerCase();
      if (email && isValidEmail(email) && !data.emails.includes(email)) data.emails.push(email);
    });

    // Emails — text regex
    const emailRegex = /([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/g;
    (bodyText.match(emailRegex) || []).forEach(e => {
      const el = e.toLowerCase().trim();
      if (isValidEmail(el) && !data.emails.includes(el)) data.emails.push(el);
    });

    // Phones — tel links
    document.querySelectorAll('a[href^="tel:"]').forEach(el => {
      const phone = el.href.replace('tel:', '').replace(/\s/g, '').trim();
      if (phone && !data.phones.includes(phone)) data.phones.push(phone);
    });

    // Phones — text patterns
    const phonePatterns = [
      /(?:\+91[\s\-]?)?(?:[6-9]\d{9})/g,
      /\+\d{1,3}[\s\-]?\(?\d{1,4}\)?[\s\-]?\d{2,4}[\s\-]?\d{2,4}[\s\-]?\d{0,4}/g,
    ];
    phonePatterns.forEach(regex => {
      (bodyText.match(regex) || []).forEach(p => {
        const cleaned = p.replace(/\D/g, '');
        if (cleaned.length >= 10 && cleaned.length <= 15 && !data.phones.includes(cleaned)) {
          data.phones.push(cleaned);
        }
      });
    });

    // Address — look near contact headings
    const addressContainers = document.querySelectorAll(
      '[class*="address"], [class*="location"], [itemprop="address"], address'
    );
    addressContainers.forEach(el => {
      const text = el.textContent.trim();
      if (text.length > 10 && text.length < 300 && !data.addresses.includes(text)) {
        data.addresses.push(text.replace(/\s+/g, ' '));
      }
    });

    // Address — Indian pincode pattern
    if (data.addresses.length === 0) {
      const addrMatch = bodyText.match(/[\w\s,./\-#]+(?:\d{6})\s*(?:,?\s*(?:India|IN))?/i);
      if (addrMatch && addrMatch[0].length > 10 && addrMatch[0].length < 200) {
        data.addresses.push(addrMatch[0].trim());
      }
    }

    // Contact form
    data.formPresent = document.querySelectorAll('form').length > 0;

    // Hours
    const hoursPattern = /(?:hours|timing|schedule|open)\s*[:]\s*([^\n]{5,120})/i;
    const hoursMatch = bodyText.match(hoursPattern);
    if (hoursMatch) data.hoursOfOperation = hoursMatch[1].trim();

    // Google Maps embed
    const mapIframe = document.querySelector('iframe[src*="google.com/maps"]');
    if (mapIframe) data.mapEmbedUrl = mapIframe.src;

    return data;
  }

  // ════════════════════════════════════════════════════════════════════
  // ABOUT PAGE EXTRACTION
  // ════════════════════════════════════════════════════════════════════
  function extractAboutPage() {
    const bodyText = document.body ? document.body.innerText : '';
    const data = {
      description: '',
      services: [],
      team: [],
      foundedYear: null,
      missionStatement: '',
    };

    // Description — first large paragraph
    const paragraphs = document.querySelectorAll('main p, article p, .content p, [class*="about"] p, section p');
    const descParts = [];
    paragraphs.forEach(p => {
      const text = p.textContent.trim();
      if (text.length > 30 && text.length < 1000 && descParts.length < 3) {
        descParts.push(text);
      }
    });
    data.description = descParts.join(' ').substring(0, 500);

    // Fallback to meta description
    if (!data.description) {
      const meta = document.querySelector('meta[name="description"]');
      if (meta && meta.content) data.description = meta.content.trim();
    }

    // Services — look for service lists
    const serviceHeadings = document.querySelectorAll('h2, h3, h4');
    serviceHeadings.forEach(h => {
      const text = h.textContent.trim().toLowerCase();
      if (text.includes('service') || text.includes('what we do') || text.includes('our work') || text.includes('offerings')) {
        // Get next sibling list items
        let sibling = h.nextElementSibling;
        let attempts = 0;
        while (sibling && attempts < 5) {
          if (sibling.tagName === 'UL' || sibling.tagName === 'OL') {
            sibling.querySelectorAll('li').forEach(li => {
              const svc = li.textContent.trim();
              if (svc.length > 2 && svc.length < 100) data.services.push(svc);
            });
            break;
          }
          // Also try div/section with child items
          if (sibling.querySelectorAll) {
            const items = sibling.querySelectorAll('li, [class*="item"], [class*="service"]');
            items.forEach(item => {
              const svc = item.textContent.trim().split('\n')[0];
              if (svc.length > 2 && svc.length < 100 && data.services.length < 20) data.services.push(svc);
            });
            if (data.services.length > 0) break;
          }
          sibling = sibling.nextElementSibling;
          attempts++;
        }
      }
    });

    // Team members
    const teamCards = document.querySelectorAll('[class*="team"] [class*="member"], [class*="team"] [class*="card"], [class*="staff"] [class*="card"]');
    teamCards.forEach(card => {
      const name = card.querySelector('h3, h4, [class*="name"]');
      const role = card.querySelector('p, [class*="role"], [class*="title"], [class*="position"]');
      if (name) {
        data.team.push({
          name: name.textContent.trim(),
          role: role ? role.textContent.trim() : '',
        });
      }
    });

    // Founded year
    const foundedMatch = bodyText.match(/(?:founded|established|since|started|est\.?)\s*(?:in\s*)?(\d{4})/i);
    if (foundedMatch) data.foundedYear = parseInt(foundedMatch[1]);

    // Mission statement
    const missionMatch = bodyText.match(/(?:mission|our\s*mission)\s*[:]\s*([^\n.]{10,200})/i);
    if (missionMatch) data.missionStatement = missionMatch[1].trim();

    return data;
  }

  // ════════════════════════════════════════════════════════════════════
  // HELPERS
  // ════════════════════════════════════════════════════════════════════
  function isValidEmail(email) {
    if (!email) return false;
    const lower = email.toLowerCase();
    if (/\.(png|jpg|gif|svg|jpeg|webp|pdf|zip|mp4|woff|ttf|css|js)$/i.test(lower)) return false;
    if (lower.includes('example.com') || lower.includes('yourdomain') || lower.includes('domain.com')) return false;
    if (lower.includes('sentry.') || lower.includes('noreply') || lower.includes('no-reply')) return false;
    if (lower.length > 100 || lower.length < 5) return false;
    return /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/.test(lower);
  }

  run();
})();
