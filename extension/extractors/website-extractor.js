/**
 * extractors/website-extractor.js
 * Injected into business websites by the Tab Harvester.
 * Extracts emails, phones, social links, tech stack, site audit info,
 * business description, hours, address, and discovers Contact/About page links.
 *
 * Reports `discoveredPages` so background.js can navigate the tab
 * to sub-pages and re-inject the subpage extractor.
 */

(function () {

  function extractData() {
    const data = {
      // ── Core Contact Info ──
      emails: [],
      phones: [],
      address: '',

      // ── Business Info ──
      businessName: '',
      description: '',
      hours: '',

      // ── Social Links ──
      social: {
        instagram: '', facebook: '', twitter: '', linkedin: '',
        youtube: '', whatsapp: '', tiktok: '',
      },

      // ── Tech & Audit ──
      techStack: [],
      performance: { loadTime: 0 },
      isHttps: window.location.protocol === 'https:',
      isMobileFriendly: !!document.querySelector('meta[name="viewport"]'),
      hasContactForm: false,
      hasBooking: false,
      copyrightYear: null,
      issues: [],

      // ── Discovered Sub-Pages (for background to navigate) ──
      discoveredPages: {
        contactUrl: '',
        aboutUrl: '',
      },

      // ── Cross-Discovery (social links found here but not on Maps) ──
      discoveredLinks: {
        facebook: '',
        instagram: '',
        linkedin: '',
        twitter: '',
        youtube: '',
        tiktok: '',
      },
    };

    try {
      const bodyText = document.body ? document.body.innerText : '';
      const bodyHTML = document.body ? document.body.innerHTML : '';
      const currentOrigin = window.location.origin;

      // ══════════════════════════════════════════════════════════════════
      // BUSINESS NAME
      // ══════════════════════════════════════════════════════════════════
      // Priority: <h1> → logo alt → og:site_name → <title>
      const h1 = document.querySelector('h1');
      if (h1 && h1.textContent.trim().length > 1 && h1.textContent.trim().length < 120) {
        data.businessName = h1.textContent.trim();
      }
      if (!data.businessName) {
        const logo = document.querySelector('img[alt][class*="logo"], img[alt][id*="logo"], header img[alt]');
        if (logo && logo.alt && logo.alt.length > 1 && logo.alt.length < 80) {
          data.businessName = logo.alt.trim();
        }
      }
      if (!data.businessName) {
        const ogName = document.querySelector('meta[property="og:site_name"]');
        if (ogName && ogName.content) data.businessName = ogName.content.trim();
      }
      if (!data.businessName && document.title) {
        // Take first part before separators
        data.businessName = document.title.split(/[|\-–—·]/)[0].trim();
      }

      // ══════════════════════════════════════════════════════════════════
      // DESCRIPTION
      // ══════════════════════════════════════════════════════════════════
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc && metaDesc.content && metaDesc.content.length > 10) {
        data.description = metaDesc.content.trim();
      }
      if (!data.description) {
        const ogDesc = document.querySelector('meta[property="og:description"]');
        if (ogDesc && ogDesc.content && ogDesc.content.length > 10) {
          data.description = ogDesc.content.trim();
        }
      }

      // ══════════════════════════════════════════════════════════════════
      // EMAILS
      // ══════════════════════════════════════════════════════════════════
      // 1. mailto links
      document.querySelectorAll('a[href^="mailto:"]').forEach(el => {
        const email = el.href.replace('mailto:', '').split('?')[0].trim().toLowerCase();
        if (email && isValidEmail(email) && !data.emails.includes(email)) data.emails.push(email);
      });

      // 2. Full text regex
      const emailRegex = /([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/g;
      const textEmails = bodyText.match(emailRegex) || [];
      textEmails.forEach(e => {
        const el = e.toLowerCase().trim();
        if (isValidEmail(el) && !data.emails.includes(el)) data.emails.push(el);
      });

      // 3. HTML comment emails (obfuscated)
      const commentRegex = /<!--.*?-->/gs;
      const comments = bodyHTML.match(commentRegex) || [];
      comments.forEach(c => {
        const found = c.match(emailRegex) || [];
        found.forEach(e => {
          const el = e.toLowerCase().trim();
          if (isValidEmail(el) && !data.emails.includes(el)) data.emails.push(el);
        });
      });

      // 4. Obfuscated patterns: [at], (at), " at ", " dot "
      const obfuscated = bodyText.match(/([a-zA-Z0-9._%+\-]+)\s*(?:\[at\]|\(at\)| at |@)\s*([a-zA-Z0-9.\-]+)\s*(?:\[dot\]|\(dot\)| dot |\.)\s*([a-zA-Z]{2,})/gi) || [];
      obfuscated.forEach(m => {
        const cleaned = m.replace(/\s*(?:\[at\]|\(at\)| at )\s*/gi, '@').replace(/\s*(?:\[dot\]|\(dot\)| dot )\s*/gi, '.').toLowerCase().replace(/\s+/g, '');
        if (isValidEmail(cleaned) && !data.emails.includes(cleaned)) data.emails.push(cleaned);
      });

      // ══════════════════════════════════════════════════════════════════
      // PHONES
      // ══════════════════════════════════════════════════════════════════
      document.querySelectorAll('a[href^="tel:"]').forEach(el => {
        const phone = el.href.replace('tel:', '').replace(/\s/g, '').trim();
        if (phone && !data.phones.includes(phone)) data.phones.push(phone);
      });
      // Indian number formats in text
      const phoneRegex = /(?:\+91[\s\-]?)?(?:[6-9]\d{9})/g;
      const textPhones = bodyText.match(phoneRegex) || [];
      textPhones.forEach(p => {
        const cleaned = p.replace(/\D/g, '');
        if (cleaned.length >= 10 && !data.phones.includes(cleaned)) data.phones.push(cleaned);
      });
      // International format
      const intlPhoneRegex = /\+\d{1,3}[\s\-]?\(?\d{1,4}\)?[\s\-]?\d{2,4}[\s\-]?\d{2,4}[\s\-]?\d{0,4}/g;
      const intlPhones = bodyText.match(intlPhoneRegex) || [];
      intlPhones.forEach(p => {
        const cleaned = p.replace(/\D/g, '');
        if (cleaned.length >= 10 && cleaned.length <= 15 && !data.phones.includes(cleaned)) {
          data.phones.push(cleaned);
        }
      });

      // ══════════════════════════════════════════════════════════════════
      // ADDRESS
      // ══════════════════════════════════════════════════════════════════
      // 1. Schema.org structured data
      const schemas = document.querySelectorAll('script[type="application/ld+json"]');
      schemas.forEach(s => {
        try {
          const json = JSON.parse(s.textContent);
          const addr = json.address || (json['@graph'] && json['@graph'].find(g => g.address))?.address;
          if (addr) {
            const parts = [addr.streetAddress, addr.addressLocality, addr.addressRegion, addr.postalCode, addr.addressCountry].filter(Boolean);
            if (parts.length > 0) data.address = parts.join(', ');
          }
          // Also grab hours from structured data
          if (json.openingHours && !data.hours) {
            data.hours = Array.isArray(json.openingHours) ? json.openingHours.join('; ') : json.openingHours;
          }
          if (json.openingHoursSpecification && !data.hours) {
            data.hours = json.openingHoursSpecification.map(h =>
              `${(h.dayOfWeek || []).join(',')}: ${h.opens || ''}-${h.closes || ''}`
            ).join('; ');
          }
        } catch (e) {}
      });

      // 2. Visible address patterns (Indian pincode)
      if (!data.address) {
        const addrMatch = bodyText.match(/[\w\s,./\-#]+(?:\d{6})\s*(?:,?\s*(?:India|IN))?/i);
        if (addrMatch && addrMatch[0].length > 10 && addrMatch[0].length < 200) {
          data.address = addrMatch[0].trim();
        }
      }

      // ══════════════════════════════════════════════════════════════════
      // HOURS OF OPERATION
      // ══════════════════════════════════════════════════════════════════
      if (!data.hours) {
        // Look for common hours patterns
        const hoursPattern = /(?:hours|timing|schedule|open)\s*[:]\s*([^\n]{5,80})/i;
        const hoursMatch = bodyText.match(hoursPattern);
        if (hoursMatch) data.hours = hoursMatch[1].trim();
      }

      // ══════════════════════════════════════════════════════════════════
      // SOCIAL LINKS
      // ══════════════════════════════════════════════════════════════════
      document.querySelectorAll('a[href]').forEach(el => {
        const h = (el.href || '').toLowerCase();
        if (!data.social.instagram && h.includes('instagram.com/') && !h.includes('/p/') && !h.includes('/reel') && !h.includes('/explore')) data.social.instagram = el.href;
        if (!data.social.facebook && h.includes('facebook.com/') && !h.includes('/sharer') && !h.includes('facebook.com/dialog') && !h.includes('facebook.com/pages/create')) data.social.facebook = el.href;
        if (!data.social.twitter && (h.includes('twitter.com/') || h.includes('x.com/')) && !h.includes('/intent/')) data.social.twitter = el.href;
        if (!data.social.linkedin && h.includes('linkedin.com/')) data.social.linkedin = el.href;
        if (!data.social.youtube && h.includes('youtube.com/')) data.social.youtube = el.href;
        if (!data.social.whatsapp && (h.includes('wa.me/') || h.includes('api.whatsapp.com/send') || h.includes('whatsapp.com/'))) data.social.whatsapp = el.href;
        if (!data.social.tiktok && h.includes('tiktok.com/@')) data.social.tiktok = el.href;
      });

      // Meta tags often hide social links in Headless/React sites
      document.querySelectorAll('meta[property="og:see_also"]').forEach(m => {
        const h = (m.content || '').toLowerCase();
        if (!data.social.instagram && h.includes('instagram.com/')) data.social.instagram = m.content;
        if (!data.social.facebook && h.includes('facebook.com/')) data.social.facebook = m.content;
        if (!data.social.twitter && (h.includes('twitter.com/') || h.includes('x.com/'))) data.social.twitter = m.content;
      });

      // Next.js static props
      try {
        const nextDataNode = document.getElementById('__NEXT_DATA__');
        if (nextDataNode) {
          const nextStr = nextDataNode.textContent;
          const igMatch = nextStr.match(/https?:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9_.-]+/);
          if (!data.social.instagram && igMatch) data.social.instagram = igMatch[0];
          const fbMatch = nextStr.match(/https?:\/\/(www\.)?facebook\.com\/[a-zA-Z0-9_.-]+/);
          if (!data.social.facebook && fbMatch) data.social.facebook = fbMatch[0];
        }
      } catch(e) {}

      // Copy to discoveredLinks for cross-discovery
      data.discoveredLinks.facebook = data.social.facebook;
      data.discoveredLinks.instagram = data.social.instagram;
      data.discoveredLinks.linkedin = data.social.linkedin;
      data.discoveredLinks.twitter = data.social.twitter;
      data.discoveredLinks.youtube = data.social.youtube;
      data.discoveredLinks.tiktok = data.social.tiktok;

      // ══════════════════════════════════════════════════════════════════
      // DISCOVER CONTACT & ABOUT PAGE LINKS
      // ══════════════════════════════════════════════════════════════════
      const navLinks = document.querySelectorAll('nav a[href], header a[href], [role="navigation"] a[href], .menu a[href], .nav a[href]');
      const allPageLinks = navLinks.length > 0 ? navLinks : document.querySelectorAll('a[href]');

      const contactPatterns = /^(contact|kontact|kontakt|reach\s*us|get\s*in\s*touch|write\s*to\s*us|talk\s*to\s*us|connect|enquiry|inquiry|संपर्क)$/i;
      const aboutPatterns = /^(about|about\s*us|our\s*story|who\s*we\s*are|company|हमारे\s*बारे\s*में)$/i;

      allPageLinks.forEach(el => {
        const href = el.href || '';
        const text = (el.textContent || '').trim();
        const hrefLower = href.toLowerCase();

        // Only same-origin links
        if (!href.startsWith(currentOrigin) && !href.startsWith('/')) return;

        // Contact page
        if (!data.discoveredPages.contactUrl) {
          if (contactPatterns.test(text) || hrefLower.includes('/contact') || hrefLower.includes('/reach-us') || hrefLower.includes('/get-in-touch')) {
            data.discoveredPages.contactUrl = href;
          }
        }
        // About page
        if (!data.discoveredPages.aboutUrl) {
          if (aboutPatterns.test(text) || hrefLower.includes('/about') || hrefLower.includes('/our-story') || hrefLower.includes('/who-we-are')) {
            data.discoveredPages.aboutUrl = href;
          }
        }
      });

      // ══════════════════════════════════════════════════════════════════
      // TECH STACK
      // ══════════════════════════════════════════════════════════════════
      const scripts = Array.from(document.querySelectorAll('script[src]')).map(s => s.src.toLowerCase());
      const links = Array.from(document.querySelectorAll('link[href]')).map(l => l.href.toLowerCase());
      const metaGenerator = (document.querySelector('meta[name="generator"]') || {}).content || '';

      if (scripts.some(s => s.includes('wp-content') || s.includes('wp-includes')) || links.some(l => l.includes('wp-content'))) data.techStack.push('WordPress');
      if (window.Shopify || scripts.some(s => s.includes('shopify'))) data.techStack.push('Shopify');
      if (scripts.some(s => s.includes('wixstatic') || s.includes('wix.com'))) data.techStack.push('Wix');
      if (scripts.some(s => s.includes('squarespace'))) data.techStack.push('Squarespace');
      if (scripts.some(s => s.includes('webflow'))) data.techStack.push('Webflow');
      if (scripts.some(s => s.includes('framer'))) data.techStack.push('Framer');
      if (scripts.some(s => s.includes('godaddysites') || s.includes('secureserver.net'))) data.techStack.push('GoDaddy');
      if (document.querySelector('[data-reactroot]') || window.__NEXT_DATA__ || scripts.some(s => s.includes('react'))) data.techStack.push('React/Next.js');
      if (window.__vue || document.querySelector('[data-v-]') || scripts.some(s => s.includes('vue.'))) data.techStack.push('Vue.js');
      if (window.angular || scripts.some(s => s.includes('angular'))) data.techStack.push('Angular');
      if (metaGenerator.toLowerCase().includes('joomla')) data.techStack.push('Joomla');
      if (metaGenerator.toLowerCase().includes('drupal') || scripts.some(s => s.includes('drupal'))) data.techStack.push('Drupal');
      if (scripts.some(s => s.includes('blogger.com') || s.includes('blogspot.com'))) data.techStack.push('Blogger');
      if (scripts.some(s => s.includes('ghost.org') || s.includes('ghost.io'))) data.techStack.push('Ghost');
      if (scripts.some(s => s.includes('gatsby'))) data.techStack.push('Gatsby');

      // Analytics
      if (scripts.some(s => s.includes('google-analytics.com') || s.includes('gtag') || s.includes('googletagmanager'))) data.techStack.push('Google Analytics');
      if (scripts.some(s => s.includes('fbevents') || s.includes('connect.facebook.net'))) data.techStack.push('Facebook Pixel');

      // ══════════════════════════════════════════════════════════════════
      // PERFORMANCE
      // ══════════════════════════════════════════════════════════════════
      if (window.performance && window.performance.timing) {
        const t = window.performance.timing;
        data.performance.loadTime = t.loadEventEnd - t.navigationStart;
      }

      // ══════════════════════════════════════════════════════════════════
      // CONTACT FORM & BOOKING
      // ══════════════════════════════════════════════════════════════════
      data.hasContactForm = document.querySelectorAll('form').length > 0;
      data.hasBooking = /book now|appointment|book an appointment|calendly|acuityscheduling|schedule a call|book a demo/i.test(bodyText);

      // ══════════════════════════════════════════════════════════════════
      // COPYRIGHT YEAR
      // ══════════════════════════════════════════════════════════════════
      const yearMatch = bodyText.match(/©\s*(20\d{2})/);
      if (yearMatch) {
        data.copyrightYear = parseInt(yearMatch[1]);
        if (data.copyrightYear < new Date().getFullYear() - 2) {
          data.issues.push(`Outdated copyright (${data.copyrightYear})`);
        }
      }

      // ══════════════════════════════════════════════════════════════════
      // ISSUES
      // ══════════════════════════════════════════════════════════════════
      if (!data.isHttps) data.issues.push('No HTTPS');
      if (!data.isMobileFriendly) data.issues.push('Not mobile responsive');
      if (!data.hasContactForm) data.issues.push('No contact form');
      if (!data.hasBooking) data.issues.push('No booking widget');
      if (!data.social.instagram && !data.social.facebook) data.issues.push('No social links on site');
      if (data.performance.loadTime > 5000) data.issues.push(`Slow load (${(data.performance.loadTime / 1000).toFixed(1)}s)`);

      return { success: true, data };
    } catch (e) {
      return { success: false, error: 'EXTRACT_FAIL', message: e.message };
    }
  }

  function isValidEmail(email) {
    if (!email) return false;
    const lower = email.toLowerCase();
    if (/\.(png|jpg|gif|svg|jpeg|webp|pdf|zip|mp4|woff|ttf|css|js|html|php)$/i.test(lower)) return false;
    if (lower.includes('example.com') || lower.includes('yourdomain') || lower.includes('domain.com')) return false;
    if (lower.includes('sentry.') || lower.includes('noreply') || lower.includes('no-reply')) return false;
    if (lower.length > 100 || lower.length < 5) return false;
    
    // Prevent sentence boundaries from being extracted as TLDs by the obfuscated regex
    // e.g., "experience @ azure. The" -> experience@azure.the
    const tldMatch = lower.match(/\.([a-z]+)$/);
    if (tldMatch) {
      const tld = tldMatch[1];
      const invalidTlds = ['the', 'this', 'that', 'and', 'for', 'your', 'from', 'with'];
      if (invalidTlds.includes(tld)) return false;
    }

    return /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/.test(lower);
  }

  async function simulateHumanBehavior() {
    window.scrollBy({ top: 300 + Math.random() * 400, behavior: 'smooth' });
    for (let i = 0; i < 2; i++) {
      const e = new MouseEvent('mousemove', {
        clientX: Math.random() * window.innerWidth,
        clientY: Math.random() * window.innerHeight,
        bubbles: true
      });
      document.dispatchEvent(e);
      await new Promise(r => setTimeout(r, 600 + Math.random() * 600));
    }
    window.scrollBy({ top: -(100 + Math.random() * 200), behavior: 'smooth' });
    await new Promise(r => setTimeout(r, 400));
  }

  (async function() {
    await simulateHumanBehavior();
    chrome.runtime.sendMessage({
      action: 'HARVEST_RESULT',
      type: 'WEBSITE',
      result: extractData(),
    });
  })();
})();
