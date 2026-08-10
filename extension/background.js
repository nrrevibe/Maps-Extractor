chrome.runtime.onInstalled.addListener(() => {
  console.log('NR Rvibe Google Maps Lead Extractor Extension Installed.');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'FETCH_WEBSITE') {
    fetch(request.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
      },
      signal: AbortSignal.timeout(8000) // 8 second timeout
    })
      .then(response => {
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
        return response.text().then(html => ({ html, finalUrl: response.url }));
      })
      .then(data => sendResponse({ success: true, html: data.html, finalUrl: data.finalUrl }))
      .catch(error => sendResponse({ success: false, error: error.message }));
      
    return true; // Keep port open for async response
  }
  
  if (request.action === 'SYNC_LEADS') {
    console.log('Background Syncing Leads...');
    
    // Use the local server as a proxy to bypass Chrome's strict Apps Script blocking
    fetch(`http://localhost:8081/api/leads?scriptUrl=${encodeURIComponent(request.googleAppsScriptUrl)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leads: request.leads })
    })
    .then(r => r.json())
    .then(data => console.log('Local server response:', data))
    .catch(e => console.error('Background Sync Error (Localhost proxy):', e));

    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === 'OPEN_WHATSAPP_TAB') {
    const autoSendWhatsApp = () => {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        
        // Strategy 1: Find the Send button by aria-label or icon
        const sendBtn = document.querySelector('button[aria-label="Send"]') || 
                        document.querySelector('span[data-icon="send"]')?.closest('button');
                        
        if (sendBtn && !sendBtn.disabled) {
          sendBtn.click();
          clearInterval(interval);
        } else {
          // Strategy 2: Fallback to synthetic Enter keypress if chatbox has text
          const chatBox = document.querySelector('div[contenteditable="true"][data-tab="10"]') ||
                          document.querySelector('div[contenteditable="true"][title="Type a message"]');
                          
          if (chatBox && chatBox.textContent.trim().length > 0) {
            const enterEvent = new KeyboardEvent('keydown', {
              bubbles: true, cancelable: true, keyCode: 13, key: 'Enter', code: 'Enter'
            });
            chatBox.dispatchEvent(enterEvent);
            clearInterval(interval);
          }
        }
        
        if (attempts > 30) {
          clearInterval(interval);
        }
      }, 500);
    };

    chrome.tabs.query({ url: "*://web.whatsapp.com/*" }, (tabs) => {
      if (tabs.length > 0) {
        const tabId = tabs[0].id;
        chrome.tabs.update(tabId, { url: request.url, active: true }, () => {
          chrome.windows.update(tabs[0].windowId, { focused: true });
          setTimeout(() => {
            chrome.scripting.executeScript({
              target: { tabId: tabId },
              func: autoSendWhatsApp
            }).catch(e => console.log('Script injection error:', e));
          }, 1000); // Give SPA a moment to process the URL change
        });
      } else {
        chrome.tabs.create({ url: request.url }, (tab) => {
          const listener = (updatedTabId, info) => {
            if (updatedTabId === tab.id && info.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: autoSendWhatsApp
              }).catch(e => console.log('Script injection error:', e));
            }
          };
          chrome.tabs.onUpdated.addListener(listener);
        });
      }
    });
    return true;
  }
});
