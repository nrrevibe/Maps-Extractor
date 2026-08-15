/**
 * instagram-extractor.js
 * Injected into Instagram profile pages to harvest data and detect login walls.
 */

(function() {
  function extractInstagram() {
    try {
      // 1. Detect Login Wall
      const isLoginWall = document.querySelector('form') && document.body.innerText.includes('Log In');
      if (window.location.pathname.includes('/accounts/login') || isLoginWall || document.body.innerText.includes("Sorry, this page isn't available")) {
        return { success: false, error: 'LOGIN_REQUIRED' };
      }

      const data = {
        followers: 0,
        following: 0,
        posts: 0,
        bio: '',
        externalLink: '',
        isPrivate: document.body.innerText.includes('This Account is Private'),
        isBusiness: false // hard to detect without API, but sometimes visible in meta tags
      };

      // Extract follower count from meta description
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        const desc = metaDesc.content;
        const match = desc.match(/([\d\.,km]+)\s*Followers,\s*([\d\.,km]+)\s*Following,\s*([\d\.,km]+)\s*Posts/i);
        if (match) {
          data.followers = parseNumber(match[1]);
          data.following = parseNumber(match[2]);
          data.posts = parseNumber(match[3]);
        }
      }
      
      return { success: true, data: data };
    } catch (e) {
      return { success: false, error: 'EXTRACT_FAIL', message: e.message };
    }
  }

  function parseNumber(str) {
    if (!str) return 0;
    str = str.toLowerCase().replace(/,/g, '');
    if (str.includes('k')) return parseFloat(str) * 1000;
    if (str.includes('m')) return parseFloat(str) * 1000000;
    return parseInt(str);
  }

  chrome.runtime.sendMessage({
    action: 'HARVEST_RESULT',
    type: 'INSTAGRAM',
    result: extractInstagram()
  });
})();
