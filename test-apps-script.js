import fs from 'fs';

async function testAppsScript() {
  const scriptUrl = "https://script.google.com/macros/s/AKfycbyRuroUMzw3HyBFD1kAgnwwxaQRWSOjUEhWCZl9spmQ1PomvyLkbZ-0luZXszWtCihU/exec";
  
  console.log("Testing Google Apps Script POST request...");
  console.log("URL:", scriptUrl);
  
  try {
    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'sync_leads',
        apiKey: 'nr-revibe-secure-key-2026',
        leads: [
          {
            id: 'TEST-123',
            businessName: 'Test Business 123',
            phone: '1234567890',
            websiteUrl: 'https://test.com',
            leadScore: 85
          }
        ]
      })
    });
    
    const text = await response.text();
    console.log("HTTP Status:", response.status);
    console.log("Response Body:", text);
    
    try {
      const json = JSON.parse(text);
      if (!json.success) {
        console.error("APPS SCRIPT ERROR:", json.error);
      } else {
        console.log("Success! Apps Script is working properly.");
      }
    } catch (e) {
      console.error("Failed to parse JSON response. The script might be returning HTML (like a Google Login page).");
    }
  } catch (error) {
    console.error("Fetch failed:", error);
  }
}

testAppsScript();
