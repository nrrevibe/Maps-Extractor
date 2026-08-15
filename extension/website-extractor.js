/**
 * website-extractor.js
 * Injected into business websites by the Tab Harvester to extract deep data.
 */

(function() {
  const SELECTORS = {
    emails: 'a[href^="mailto:"]',
    tel: 'a[href^="tel:"]',
    social: 'a[href*="instagram.com"], a[href*="facebook.com"], a[href*="twitter.com"], a[href*="x.com"], a[href*="linkedin.com"], a[href*="wa.me"], a[href*="api.whatsapp.com"]',
    forms: 'form'
  };

  function extractData() {
    const data = {
      emails: [],
      phones: [],
      social: { instagram: '', facebook: '', twitter: '', linkedin: '', whatsapp: '' },
      techStack: [],
      performance: { loadTime: 0 },
      isHttps: window.location.protocol === 'https:',
      isMobileFriendly: !!document.querySelector('meta[name="viewport"]'),
      hasContactForm: false,
      hasBooking: false,
      copyrightYear: null,
      issues: [],
      discoveredLinks: {
        instagram: '',
        facebook: '',
        twitter: '',
        linkedin: '',
        youtube: '',
        whatsapp: ''
      },
      discoveredPages: {
        contactUrl: '',
        aboutUrl: ''
      }
    };

    try {
      // Emails
      const mailtoLinks = Array.from(document.querySelectorAll(SELECTORS.emails));
      mailtoLinks.forEach(l => {
        const email = l.href.replace('mailto:', '').split('?')[0].trim().toLowerCase();
        if (email && !data.emails.includes(email)) data.emails.push(email);
      });
      
      // Basic text regex for emails (simplified)
      const bodyText = document.body.innerText;
      const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
      const foundEmails = bodyText.match(emailRegex);
      if (foundEmails) {
        foundEmails.forEach(e => {
          const eLower = e.toLowerCase();
          if (!eLower.includes('.png') && !eLower.includes('example.com') && !data.emails.includes(eLower)) {
            data.emails.push(eLower);
          }
        });
      }

      // Phones
      const telLinks = Array.from(document.querySelectorAll(SELECTORS.tel));
      telLinks.forEach(l => {
        const phone = l.href.replace('tel:', '').trim();
        if (phone && !data.phones.includes(phone)) data.phones.push(phone);
      });

      // Social
      const socialLinks = Array.from(document.querySelectorAll(SELECTORS.social));
      socialLinks.forEach(el => {
        const h = el.href.toLowerCase();
        if (!data.social.instagram && h.includes('instagram.com') && !h.includes('/p/')) { data.social.instagram = el.href; data.discoveredLinks.instagram = el.href; }
        if (!data.social.facebook && h.includes('facebook.com') && !h.includes('/sharer')) { data.social.facebook = el.href; data.discoveredLinks.facebook = el.href; }
        if (!data.social.whatsapp && (h.includes('wa.me') || h.includes('api.whatsapp.com'))) { data.social.whatsapp = el.href; data.discoveredLinks.whatsapp = el.href; }
        if (!data.social.twitter && (h.includes('twitter.com') || h.includes('x.com'))) { data.social.twitter = el.href; data.discoveredLinks.twitter = el.href; }
        if (!data.social.linkedin && h.includes('linkedin.com')) { data.social.linkedin = el.href; data.discoveredLinks.linkedin = el.href; }
      });

      // Tech Stack
      if (document.querySelector('script[src*="wp-content"]')) data.techStack.push('WordPress');
      if (window.Shopify) data.techStack.push('Shopify');
      if (document.querySelector('script[src*="wixstatic"]')) data.techStack.push('Wix');
      if (document.querySelector('[data-reactroot]')) data.techStack.push('React');

      // Contact Form
      data.hasContactForm = document.querySelectorAll(SELECTORS.forms).length > 0;

      // Booking
      data.hasBooking = /book now|appointment|calendly|acuity/i.test(bodyText);

      // Copyright
      const yearMatch = bodyText.match(/©\s*(20\d{2})/);
      if (yearMatch) {
        data.copyrightYear = parseInt(yearMatch[1]);
        if (data.copyrightYear < new Date().getFullYear() - 2) {
          data.issues.push(`Outdated copyright (${data.copyrightYear})`);
        }
      }

      // Discovered Pages (Sub-pages for deep scraping)
      const internalLinks = Array.from(document.querySelectorAll('a[href]'));
      internalLinks.forEach(el => {
        const h = el.href.toLowerCase();
        const text = el.innerText.toLowerCase();
        if (h.startsWith(window.location.origin) || !h.startsWith('http')) {
          if (!data.discoveredPages.contactUrl && (h.includes('contact') || text.includes('contact'))) {
            data.discoveredPages.contactUrl = el.href;
          }
          if (!data.discoveredPages.aboutUrl && (h.includes('about') || text.includes('about'))) {
            data.discoveredPages.aboutUrl = el.href;
          }
        }
      });

      if (!data.isHttps) data.issues.push("No HTTPS");
      if (!data.isMobileFriendly) data.issues.push("Not mobile responsive");
      if (!data.hasContactForm) data.issues.push("No contact form");

      return { success: true, data: data };
    } catch (e) {
      return { success: false, error: 'EXTRACT_FAIL', message: e.message };
    }
  }

  // Send back to background script
  chrome.runtime.sendMessage({
    action: 'HARVEST_RESULT',
    type: 'WEBSITE',
    result: extractData()
  });
})();
