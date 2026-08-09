window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data && event.data.type === 'OPEN_WHATSAPP_TAB') {
    chrome.runtime.sendMessage({
      action: 'OPEN_WHATSAPP_TAB',
      url: event.data.url
    });
    // Send ACK back to React app
    window.postMessage({ type: 'WHATSAPP_TAB_ACK' }, '*');
  }
});
