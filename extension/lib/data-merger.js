/**
 * lib/data-merger.js
 * Merges the Maps scrape + website + Instagram + Facebook harvest results
 * into a single enriched lead object with updated lead score.
 *
 * Enhanced with:
 * - Source tracking (value + source + confidence) for each field
 * - Phone/email normalization and deduplication
 * - Data completeness scoring
 * - Sub-page data merging (contact page, about page)
 * - Cross-discovered data integration
 */

const DataMerger = (() => {

  // Confidence levels per source (from harvest-config.js, but inlined for service worker)
  const CONFIDENCE = {
    website_contact: 95,
    website_homepage: 80,
    website_about: 75,
    google_maps: 85,
    facebook_about: 70,
    facebook_page: 60,
    instagram_bio: 60,
    instagram_profile: 55,
  };

  // ══════════════════════════════════════════════════════════════════════
  // MAIN MERGE FUNCTION
  // ══════════════════════════════════════════════════════════════════════
  function mergeLead(mapsLead, results) {
    const { website, instagram, facebook, linkedin_search } = results;
    const enriched = { ...mapsLead };

    // Sub-page results (attached to website result by background.js)
    const contactPage = website && website.subPages && website.subPages.contact;
    const aboutPage = website && website.subPages && website.subPages.about;

    // ══════════════════════════════════════════════════════════════════
    // COLLECT ALL EMAILS (with source tracking)
    // ══════════════════════════════════════════════════════════════════
    const allEmails = [];

    // From website contact page (highest priority)
    if (contactPage && contactPage.emails) {
      contactPage.emails.forEach(e => addTrackedValue(allEmails, e, 'Website Contact', CONFIDENCE.website_contact));
    }
    // From website homepage
    if (website && website.success && website.data && website.data.emails) {
      website.data.emails.forEach(e => addTrackedValue(allEmails, e, 'Website', CONFIDENCE.website_homepage));
    }
    // From Facebook
    if (facebook && facebook.success && facebook.data && facebook.data.email) {
      addTrackedValue(allEmails, facebook.data.email, 'Facebook', CONFIDENCE.facebook_about);
    }
    // From Instagram bio
    if (instagram && instagram.success && instagram.data && instagram.data.bioEmail) {
      addTrackedValue(allEmails, instagram.data.bioEmail, 'Instagram Bio', CONFIDENCE.instagram_bio);
    }

    // Normalize and deduplicate
    const uniqueEmails = deduplicateTracked(allEmails, normalizeEmail);

    if (uniqueEmails.length > 0) {
      enriched.email = uniqueEmails[0].value;
      enriched.emailSource = uniqueEmails[0].source;
      enriched.emailType = getEmailType(uniqueEmails[0].source);
      enriched.emailVerified = false;
      enriched.emailConfidenceScore = uniqueEmails[0].confidence;
      enriched.allEmails = uniqueEmails;
      if (uniqueEmails.length > 1) {
        enriched.secondaryEmails = uniqueEmails.slice(1).map(e => e.value).join(', ');
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // COLLECT ALL PHONES (with source tracking)
    // ══════════════════════════════════════════════════════════════════
    const allPhones = [];

    // From Maps (already primary)
    if (mapsLead.phone && mapsLead.phone !== 'N/A') {
      addTrackedValue(allPhones, mapsLead.phone, 'Google Maps', CONFIDENCE.google_maps);
    }
    // From website contact page
    if (contactPage && contactPage.phones) {
      contactPage.phones.forEach(p => addTrackedValue(allPhones, p, 'Website Contact', CONFIDENCE.website_contact));
    }
    // From website homepage
    if (website && website.success && website.data && website.data.phones) {
      website.data.phones.forEach(p => addTrackedValue(allPhones, p, 'Website', CONFIDENCE.website_homepage));
    }
    // From Facebook
    if (facebook && facebook.success && facebook.data && facebook.data.phone) {
      addTrackedValue(allPhones, facebook.data.phone, 'Facebook', CONFIDENCE.facebook_about);
    }
    // From Instagram bio
    if (instagram && instagram.success && instagram.data && instagram.data.bioPhone) {
      addTrackedValue(allPhones, instagram.data.bioPhone, 'Instagram Bio', CONFIDENCE.instagram_bio);
    }

    const uniquePhones = deduplicateTracked(allPhones, normalizePhone);

    if (uniquePhones.length > 0) {
      enriched.phone = uniquePhones[0].value;
      enriched.allPhones = uniquePhones;
      if (uniquePhones.length > 1) {
        enriched.secondaryPhones = uniquePhones.slice(1).map(p => p.value).join(', ');
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // SOCIAL LINKS (fill gaps from all sources)
    // ══════════════════════════════════════════════════════════════════
    if (website && website.success && website.data && website.data.social) {
      const ws = website.data.social;
      if (!enriched.instagramUrl && ws.instagram) enriched.instagramUrl = ws.instagram;
      if (!enriched.facebookUrl && ws.facebook) enriched.facebookUrl = ws.facebook;
      if (!enriched.whatsappUrl && ws.whatsapp) enriched.whatsappUrl = ws.whatsapp;
      if (!enriched.linkedinUrl && ws.linkedin) enriched.linkedinUrl = ws.linkedin;
      if (!enriched.youtubeUrl && ws.youtube) enriched.youtubeUrl = ws.youtube;
      if (!enriched.twitterUrl && ws.twitter) enriched.twitterUrl = ws.twitter;
      if (!enriched.tiktokUrl && ws.tiktok) enriched.tiktokUrl = ws.tiktok;
    }
    // From Facebook discovered links
    if (facebook && facebook.success && facebook.data && facebook.data.discoveredLinks) {
      const fl = facebook.data.discoveredLinks;
      if (!enriched.instagramUrl && fl.instagram) enriched.instagramUrl = fl.instagram;
      if (!enriched.twitterUrl && fl.twitter) enriched.twitterUrl = fl.twitter;
      if (!enriched.youtubeUrl && fl.youtube) enriched.youtubeUrl = fl.youtube;
    }
    // From Instagram discovered links
    if (instagram && instagram.success && instagram.data && instagram.data.discoveredLinks) {
      const il = instagram.data.discoveredLinks;
      if (!enriched.facebookUrl && il.facebook) enriched.facebookUrl = il.facebook;
      if (!enriched.youtubeUrl && il.youtube) enriched.youtubeUrl = il.youtube;
      if (!enriched.twitterUrl && il.twitter) enriched.twitterUrl = il.twitter;
    }

    // ══════════════════════════════════════════════════════════════════
    // WEBSITE TECH & AUDIT
    // ══════════════════════════════════════════════════════════════════
    if (website && website.success) {
      const wd = website.data;
      enriched.websiteTechnology = (wd.techStack && wd.techStack.length > 0)
        ? wd.techStack.join(', ')
        : 'Custom / Unknown';
      enriched.websiteStatus = 'Active';
      enriched.https = wd.isHttps;
      enriched.mobileFriendly = wd.isMobileFriendly;
      enriched.hasContactForm = wd.hasContactForm;
      enriched.hasBooking = wd.hasBooking;
      enriched.copyrightYear = wd.copyrightYear;
      enriched.websiteIssues = (wd.issues || []).join('; ');
      enriched.websiteQuality = computeWebsiteQuality(wd);
      enriched.webLoadTime = wd.performance ? wd.performance.loadTime : null;

      // New fields from enhanced extractor
      if (wd.businessName && !enriched.websiteBusinessName) {
        enriched.websiteBusinessName = wd.businessName;
      }
      if (wd.description) {
        enriched.websiteDescription = wd.description;
      }
      if (wd.hours) {
        enriched.websiteHours = wd.hours;
      }
      if (wd.address && (!enriched.address || enriched.address === 'N/A')) {
        enriched.address = wd.address;
      }
    } else if (website && !website.success && website.error !== 'LOAD_TIMEOUT') {
      enriched.websiteStatus = 'Broken';
    }

    // ══════════════════════════════════════════════════════════════════
    // SUB-PAGE DATA (Contact + About)
    // ══════════════════════════════════════════════════════════════════
    if (contactPage) {
      // Address from contact page
      if (contactPage.addresses && contactPage.addresses.length > 0) {
        if (!enriched.address || enriched.address === 'N/A') {
          enriched.address = contactPage.addresses[0];
        }
        enriched.contactPageAddresses = contactPage.addresses;
      }
      // Hours from contact page
      if (contactPage.hoursOfOperation && !enriched.websiteHours) {
        enriched.websiteHours = contactPage.hoursOfOperation;
      }
      // Map embed
      if (contactPage.mapEmbedUrl) {
        enriched.hasMapEmbed = true;
      }
    }

    if (aboutPage) {
      // Description from about page (longer/better than homepage meta)
      if (aboutPage.description && aboutPage.description.length > (enriched.websiteDescription || '').length) {
        enriched.businessDescription = aboutPage.description;
      }
      // Services
      if (aboutPage.services && aboutPage.services.length > 0) {
        enriched.services = aboutPage.services.join('; ');
      }
      // Team
      if (aboutPage.team && aboutPage.team.length > 0) {
        enriched.teamMembers = aboutPage.team.map(t => `${t.name}${t.role ? ' (' + t.role + ')' : ''}`).join('; ');
      }
      // Founded year
      if (aboutPage.foundedYear) {
        enriched.foundedYear = aboutPage.foundedYear;
      }
      // Mission
      if (aboutPage.missionStatement) {
        enriched.missionStatement = aboutPage.missionStatement;
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // INSTAGRAM DATA
    // ══════════════════════════════════════════════════════════════════
    if (instagram && instagram.success) {
      const ig = instagram.data;
      enriched.igFollowers = ig.followers || 0;
      enriched.igFollowing = ig.following || 0;
      enriched.igPosts = ig.posts || 0;
      enriched.igBio = ig.bio || '';
      enriched.igDaysInactive = ig.daysSincePost || null;
      enriched.igPrivate = ig.isPrivate || false;
      enriched.igExternalLink = ig.externalLink || '';
      enriched.igUsername = ig.username || '';
      enriched.igCategory = ig.category || '';
      enriched.igIsBusiness = ig.isBusiness || false;

      // If IG has external link and we found no website, use it
      if (!enriched.websiteUrl && ig.externalLink) {
        enriched.websiteUrl = ig.externalLink;
      }
    } else if (instagram && instagram.error === 'LOGIN_REQUIRED') {
      enriched.igStatus = 'Login Wall';
    }

    // ══════════════════════════════════════════════════════════════════
    // FACEBOOK DATA
    // ══════════════════════════════════════════════════════════════════
    if (facebook && facebook.success) {
      const fb = facebook.data;
      enriched.fbLikes = fb.likes || 0;
      enriched.fbFollowers = fb.followers || 0;
      enriched.fbLastPostDate = fb.lastPostDate || '';
      enriched.fbDaysInactive = fb.daysInactive || null;
      enriched.fbCategory = fb.category || '';
      enriched.fbIsVerified = fb.isVerified || false;
      enriched.fbOverview = fb.overview || '';
      enriched.fbEstablishedYear = fb.establishedYear || null;
      enriched.fbHours = fb.hours || '';
      enriched.fbPriceRange = fb.priceRange || '';

      if (!enriched.websiteUrl && fb.websiteLink) enriched.websiteUrl = fb.websiteLink;
      if (fb.address && (!enriched.address || enriched.address === 'N/A')) {
        enriched.address = fb.address;
      }
    } else if (facebook && facebook.error === 'LOGIN_REQUIRED') {
      enriched.fbStatus = 'Login Wall';
    }

    // ══════════════════════════════════════════════════════════════════
    // FOUNDER LINKEDIN
    // ══════════════════════════════════════════════════════════════════
    if (linkedin_search && linkedin_search.success && linkedin_search.data) {
      enriched.founderName = linkedin_search.data.founderName;
      enriched.founderLinkedin = linkedin_search.data.founderLinkedin;
    }

    // ══════════════════════════════════════════════════════════════════
    // RE-SCORE LEAD with enriched data
    // ══════════════════════════════════════════════════════════════════
    enriched.leadScore = computeEnrichedScore(enriched);
    enriched.leadPriority = enriched.leadScore >= 75 ? 'Hot Lead'
                          : enriched.leadScore >= 45 ? 'Medium Priority'
                          : 'Low Priority';

    // ══════════════════════════════════════════════════════════════════
    // PAIN POINTS & SUGGESTED SERVICE
    // ══════════════════════════════════════════════════════════════════
    const pp = [];
    if (!enriched.websiteUrl || enriched.websiteUrl === 'N/A') pp.push('No website');
    if (enriched.mobileFriendly === false) pp.push('Not mobile friendly');
    if (!enriched.https && enriched.websiteUrl) pp.push('No HTTPS');
    if (!enriched.hasContactForm) pp.push('No contact form');
    if (!enriched.instagramUrl) pp.push('No Instagram');
    if (enriched.copyrightYear && enriched.copyrightYear < new Date().getFullYear() - 2) pp.push(`Outdated site (${enriched.copyrightYear})`);
    if (enriched.igDaysInactive > 60) pp.push(`Inactive IG (${enriched.igDaysInactive}d)`);
    if (enriched.fbDaysInactive > 60) pp.push(`Inactive FB (${enriched.fbDaysInactive}d)`);

    enriched.painPoints = pp.join('; ');
    enriched.painPoint = pp[0] || enriched.painPoint || '';
    enriched.suggestedService = determineSuggestedService(enriched);
    enriched.harvestStatus = 'Complete';

    // ══════════════════════════════════════════════════════════════════
    // DATA COMPLETENESS
    // ══════════════════════════════════════════════════════════════════
    enriched.dataCompleteness = computeDataCompleteness(enriched);

    // ══════════════════════════════════════════════════════════════════
    // DATA SOURCES METADATA
    // ══════════════════════════════════════════════════════════════════
    const sources = ['map'];
    if (website && website.success) sources.push('website');
    if (contactPage) sources.push('website_contact');
    if (aboutPage) sources.push('website_about');
    if (instagram && instagram.success) sources.push('instagram');
    if (facebook && facebook.success) sources.push('facebook');
    if (linkedin_search && linkedin_search.success) sources.push('linkedin');
    enriched.dataSources = sources.join(', ');
    enriched.scrapeDate = new Date().toISOString().split('T')[0];

    return enriched;
  }

  // ══════════════════════════════════════════════════════════════════════
  // TRACKED VALUE HELPERS
  // ══════════════════════════════════════════════════════════════════════

  function addTrackedValue(arr, value, source, confidence) {
    if (!value) return;
    arr.push({ value: value.toString().trim(), source, confidence });
  }

  function deduplicateTracked(arr, normalizeFn) {
    const seen = new Set();
    const result = [];
    // Sort by confidence descending so highest confidence wins
    arr.sort((a, b) => b.confidence - a.confidence);
    for (const item of arr) {
      const normalized = normalizeFn(item.value);
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        result.push({ ...item, value: normalized });
      }
    }
    return result;
  }

  // ══════════════════════════════════════════════════════════════════════
  // NORMALIZATION
  // ══════════════════════════════════════════════════════════════════════

  function normalizeEmail(email) {
    if (!email) return '';
    return email.toString().toLowerCase().trim();
  }

  function normalizePhone(phone) {
    if (!phone) return '';
    let digits = phone.toString().replace(/\D/g, '');
    // Remove leading 0
    if (digits.startsWith('0')) digits = digits.substring(1);
    // Remove country code prefix for dedup
    if (digits.startsWith('91') && digits.length > 10) digits = digits.substring(2);
    // Keep last 10 digits
    if (digits.length > 10) digits = digits.slice(-10);
    return digits;
  }

  function getEmailType(source) {
    if (source.includes('Contact')) return 'Direct';
    if (source.includes('Website')) return 'Website';
    if (source.includes('Facebook')) return 'Social';
    if (source.includes('Instagram')) return 'Social';
    return 'Unknown';
  }

  // ══════════════════════════════════════════════════════════════════════
  // SCORING & QUALITY
  // ══════════════════════════════════════════════════════════════════════

  function computeWebsiteQuality(wd) {
    if (!wd) return 'N/A';
    let score = 100;
    if (!wd.isHttps) score -= 20;
    if (!wd.isMobileFriendly) score -= 25;
    if (!wd.hasContactForm) score -= 10;
    if (wd.copyrightYear && wd.copyrightYear < new Date().getFullYear() - 2) score -= 15;
    if (score >= 80) return 'Good';
    if (score >= 50) return 'Average';
    return 'Poor';
  }

  function computeEnrichedScore(lead) {
    let score = 0;

    // Website presence & quality
    if (!lead.websiteUrl || lead.websiteUrl === 'N/A') score += 30;
    else {
      if (!lead.https) score += 10;
      if (!lead.mobileFriendly) score += 15;
      if (!lead.hasContactForm) score += 5;
      if (lead.copyrightYear && lead.copyrightYear < new Date().getFullYear() - 2) score += 10;
    }

    // Social presence
    if (!lead.instagramUrl) score += 10;
    else if (lead.igDaysInactive > 60) score += 8;
    if (!lead.facebookUrl) score += 5;

    // Contact info (boost for reachable leads)
    if (lead.email && lead.email !== 'N/A') score += 15;
    if (lead.phone && lead.phone !== 'N/A') score += 5;

    // Reputation
    if (lead.rating >= 4.0) score += 5;
    if (lead.reviewCount >= 50) score += 5;

    return Math.min(Math.max(score, 0), 100);
  }

  function computeDataCompleteness(lead) {
    const fields = [
      lead.businessName, lead.phone, lead.email, lead.websiteUrl,
      lead.address, lead.instagramUrl, lead.facebookUrl,
      lead.category, lead.rating, lead.reviewCount,
      lead.websiteDescription || lead.businessDescription,
      lead.services, lead.websiteHours || lead.fbHours,
    ];
    const filled = fields.filter(f => f && f !== 'N/A' && f !== '' && f !== 0).length;
    return Math.round((filled / fields.length) * 100);
  }

  function determineSuggestedService(lead) {
    if (!lead.websiteUrl || lead.websiteUrl === 'N/A') return 'New Website Development';
    const issues = [];
    if (!lead.https || !lead.mobileFriendly) issues.push('Website Redesign');
    if (!lead.instagramUrl || lead.igDaysInactive > 60) issues.push('Social Media Management');
    if (lead.copyrightYear && lead.copyrightYear < new Date().getFullYear() - 2) issues.push('Website Modernization');
    return issues.length > 0 ? issues.join(' + ') : 'SEO & Growth Package';
  }

  // ══════════════════════════════════════════════════════════════════════
  // FUZZY NAME MATCHING (for dedup)
  // ══════════════════════════════════════════════════════════════════════

  function fuzzyNameMatch(name1, name2) {
    if (!name1 || !name2) return 0;
    const a = name1.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const b = name2.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    if (a === b) return 100;
    if (a.includes(b) || b.includes(a)) return 85;

    // Levenshtein distance
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 100;
    const dist = levenshteinDistance(a, b);
    return Math.round((1 - dist / maxLen) * 100);
  }

  function levenshteinDistance(s, t) {
    const m = s.length, n = t.length;
    const d = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) d[i][0] = i;
    for (let j = 0; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = s[i - 1] === t[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      }
    }
    return d[m][n];
  }

  return { mergeLead, normalizePhone, normalizeEmail, fuzzyNameMatch, computeDataCompleteness };
})();
