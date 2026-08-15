/**
 * facebook-extractor.js
 * Injected into Facebook pages to harvest data.
 */

(function() {
  function extractFacebook() {
    try {
      const isLoginWall = document.querySelector('#login_form') !== null;
      if (isLoginWall) return { success: false, error: 'LOGIN_REQUIRED' };

      const data = {
        likes: 0,
        followers: 0,
        websiteLink: '',
        email: ''
      };

      const links = Array.from(document.querySelectorAll('a[href]'));
      links.forEach(l => {
        const h = l.href.toLowerCase();
        if (h.includes('mailto:')) data.email = h.replace('mailto:', '').split('?')[0];
        if (h.includes('l.php?u=')) {
          // FB external link redirector
          try {
            const urlParams = new URLSearchParams(l.search);
            if (urlParams.has('u')) data.websiteLink = decodeURIComponent(urlParams.get('u'));
          } catch(e) {}
        }
      });
      
      const bodyText = document.body.innerText;
      const likesMatch = bodyText.match(/([\d\.,km]+)\s*likes/i);
      const followsMatch = bodyText.match(/([\d\.,km]+)\s*followers/i);
      
      if (likesMatch) data.likes = parseNumber(likesMatch[1]);
      if (followsMatch) data.followers = parseNumber(followsMatch[1]);
      
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
    type: 'FACEBOOK',
    result: extractFacebook()
  });
})();
