/**
 * extractors/instagram-extractor.js
 * Injected into Instagram profile pages by the Tab Harvester.
 * Extracts followers, bio, activity status, detects login walls,
 * parses email/phone/website from bio, and reports discoveredLinks
 * for cross-source discovery.
 */

(function () {

  function extractInstagram() {
    try {
      // ── LOGIN WALL DETECTION ─────────────────────────────────────────────
      if (
        window.location.pathname.includes('/accounts/login') ||
        window.location.pathname.includes('/challenge/') ||
        document.querySelector('input[name="username"]') ||
        document.body.innerText.includes("Log in to Instagram")
      ) {
        return { success: false, error: 'LOGIN_REQUIRED' };
      }

      if (document.body.innerText.includes("Sorry, this page isn't available")) {
        return { success: false, error: 'PAGE_NOT_FOUND' };
      }

      const data = {
        followers: 0,
        following: 0,
        posts: 0,
        bio: '',
        externalLink: '',
        isPrivate: false,
        daysSincePost: null,
        username: '',

        // ── New fields ──
        profileImage: '',
        category: '',
        isBusiness: false,
        bioEmail: '',
        bioPhone: '',
        bioWebsite: '',

        // ── Cross-discovery ──
        discoveredLinks: {
          website: '',
          facebook: '',
          youtube: '',
          twitter: '',
        },
      };

      // ── META DESCRIPTION (most reliable for public profiles) ─────────────
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc && metaDesc.content) {
        const desc = metaDesc.content;
        const match = desc.match(/([\d,.km]+)\s*Followers?,\s*([\d,.km]+)\s*Following,\s*([\d,.km]+)\s*Posts?/i);
        if (match) {
          data.followers = parseNum(match[1]);
          data.following = parseNum(match[2]);
          data.posts = parseNum(match[3]);
        }
        // Bio is typically after " - " in description
        const dashIdx = desc.indexOf(' - ');
        if (dashIdx !== -1) {
          const bioCandidate = desc.substring(dashIdx + 3).trim();
          if (bioCandidate.length > 3 && bioCandidate.length < 300) data.bio = bioCandidate;
        }
      }

      // ── OPEN GRAPH tags ──────────────────────────────────────────────────
      const ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc && ogDesc.content && data.followers === 0) {
        const match = ogDesc.content.match(/([\d,.km]+)\s*Followers?/i);
        if (match) data.followers = parseNum(match[1]);
      }

      // ── TITLE for username ───────────────────────────────────────────────
      const titleEl = document.querySelector('title');
      if (titleEl) {
        const titleMatch = titleEl.textContent.match(/\(@([^)]+)\)/);
        if (titleMatch) data.username = titleMatch[1];
      }

      // ── PROFILE IMAGE ────────────────────────────────────────────────────
      const profileImg = document.querySelector('header img[alt*="profile"], header img[draggable="false"]');
      if (profileImg && profileImg.src) {
        data.profileImage = profileImg.src;
      }

      // ── EXTERNAL LINK (in bio) ───────────────────────────────────────────
      const linkInBio = document.querySelector('a[href*="l.instagram.com/l.php"]') ||
                        document.querySelector('a[href*="linktr.ee"]') ||
                        document.querySelector('a[target="_blank"][href*="http"]');
      if (linkInBio) {
        try {
          const href = linkInBio.href;
          if (href.includes('l.php')) {
            const params = new URL(href).searchParams;
            data.externalLink = params.get('u') || '';
          } else {
            data.externalLink = href;
          }
        } catch (e) {}
      }

      // ── PRIVATE ACCOUNT DETECTION ────────────────────────────────────────
      data.isPrivate = document.body.innerText.includes('This Account is Private') ||
                       !!document.querySelector('[aria-label="This account is private"]');

      // ── DAYS SINCE LAST POST ─────────────────────────────────────────────
      const times = document.querySelectorAll('time[datetime]');
      if (times.length > 0) {
        const latestPost = Array.from(times)
          .map(t => new Date(t.getAttribute('datetime')).getTime())
          .filter(t => !isNaN(t))
          .sort((a, b) => b - a)[0];
        if (latestPost) {
          data.daysSincePost = Math.floor((Date.now() - latestPost) / (1000 * 60 * 60 * 24));
        }
      }

      // ── BUSINESS CATEGORY ────────────────────────────────────────────────
      // IG sometimes shows category below the name
      const categoryEl = document.querySelector('header [class*="category"]') ||
                         document.querySelector('header div[dir="auto"] ~ div[dir="auto"]');
      if (categoryEl) {
        const catText = categoryEl.textContent.trim();
        if (catText.length > 2 && catText.length < 60 && !catText.match(/followers|following|posts/i)) {
          data.category = catText;
          data.isBusiness = true;
        }
      }
      // Also detect from page source
      if (!data.isBusiness) {
        data.isBusiness = !!document.querySelector('[aria-label="Email"], [aria-label="Call"], [aria-label="Get Directions"]');
      }

      // ══════════════════════════════════════════════════════════════════
      // BIO PARSING — Extract email, phone, website from bio text
      // ══════════════════════════════════════════════════════════════════
      if (data.bio) {
        // Email in bio
        const emailMatch = data.bio.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
        if (emailMatch) data.bioEmail = emailMatch[0].toLowerCase();

        // Phone in bio
        const phoneMatch = data.bio.match(/(?:\+91[\s\-]?)?[6-9]\d{9}/) ||
                           data.bio.match(/\+\d{1,3}[\s\-]?\(?\d{1,4}\)?[\s\-]?\d{2,4}[\s\-]?\d{2,4}/);
        if (phoneMatch) data.bioPhone = phoneMatch[0].replace(/\D/g, '');

        // Website in bio
        const urlMatch = data.bio.match(/https?:\/\/[^\s,]+/);
        if (urlMatch) data.bioWebsite = urlMatch[0];
      }

      // ══════════════════════════════════════════════════════════════════
      // CROSS-DISCOVERY — find other social/website links
      // ══════════════════════════════════════════════════════════════════
      // Website from bio link or bio text
      data.discoveredLinks.website = data.externalLink || data.bioWebsite || '';

      // Scan all links on page for other socials
      document.querySelectorAll('a[href]').forEach(el => {
        const h = (el.href || '').toLowerCase();
        if (!data.discoveredLinks.facebook && h.includes('facebook.com/') && !h.includes('instagram.com')) {
          data.discoveredLinks.facebook = el.href;
        }
        if (!data.discoveredLinks.youtube && h.includes('youtube.com/')) {
          data.discoveredLinks.youtube = el.href;
        }
        if (!data.discoveredLinks.twitter && (h.includes('twitter.com/') || h.includes('x.com/'))) {
          data.discoveredLinks.twitter = el.href;
        }
      });

      // Also check bio text for social handles
      if (data.bio) {
        if (!data.discoveredLinks.facebook) {
          const fbMatch = data.bio.match(/(?:fb|facebook)\.com\/([a-zA-Z0-9._]+)/i);
          if (fbMatch) data.discoveredLinks.facebook = 'https://facebook.com/' + fbMatch[1];
        }
        if (!data.discoveredLinks.youtube) {
          const ytMatch = data.bio.match(/youtube\.com\/(c\/|channel\/|@)?([a-zA-Z0-9._\-]+)/i);
          if (ytMatch) data.discoveredLinks.youtube = 'https://youtube.com/' + (ytMatch[1] || '') + ytMatch[2];
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
    type: 'INSTAGRAM',
    result: extractInstagram(),
  });
})();
