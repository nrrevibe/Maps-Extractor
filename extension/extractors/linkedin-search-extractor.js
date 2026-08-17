/**
 * extractors/linkedin-search-extractor.js
 * Scrapes DuckDuckGo HTML results to find the founder's LinkedIn profile.
 */

try {
  (function() {
    const data = {
      founderName: '',
      founderLinkedin: '',
      title: ''
    };

    // Find the first organic result (supports Bing, Google, DDG)
    const results = Array.from(document.querySelectorAll('.b_algo, .result, .g'));
    for (const result of results) {
      const a = result.querySelector('h2 a') || result.querySelector('.result__url') || result.querySelector('a');
      if (!a) continue;
      
      const href = a.href || '';
      if (href.includes('linkedin.com/in/')) {
        const titleText = a.textContent ? a.textContent.trim() : '';
        
        // Typical format: "John Doe - Founder - Company | LinkedIn"
        const cleanName = titleText.split('-')[0].split('|')[0].trim();
        
        data.founderLinkedin = href;
        data.founderName = cleanName;
        data.title = titleText;
        break; // Only need the top hit
      }
    }

    chrome.runtime.sendMessage({
      action: 'HARVEST_RESULT',
      type: 'LINKEDIN_SEARCH',
      result: { success: true, data }
    });
  })();
} catch (e) {
  chrome.runtime.sendMessage({
    action: 'HARVEST_RESULT',
    type: 'LINKEDIN_SEARCH',
    result: { success: false, error: e.message }
  });
}
