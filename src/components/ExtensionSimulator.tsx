import React, { useState } from 'react';
import {
  Chrome,
  Download,
  MapPin,
  Search,
  Table,
  Mail,
  Settings,
  Sparkles,
  CheckCircle,
  Play,
  RotateCcw,
  ExternalLink,
  Shield,
  Layers,
  ArrowRight,
  Flame
} from 'lucide-react';
import JSZip from 'jszip';
import { Lead, AgencySettings } from '../types';

interface ExtensionSimulatorProps {
  leads: Lead[];
  settings: AgencySettings;
  onAddLeads: (leads: Lead[]) => void;
}

export const ExtensionSimulator: React.FC<ExtensionSimulatorProps> = ({
  leads,
  settings,
  onAddLeads,
}) => {
  const [activeScreen, setActiveScreen] = useState<number>(2); // Default to Screen 2: Scraper
  const [isZipping, setIsZipping] = useState(false);

  // Download Manifest V3 Zip Package for Chrome
  const handleDownloadExtensionZip = async () => {
    setIsZipping(true);
    try {
      const zip = new JSZip();

      // manifest.json
      const manifestContent = {
        manifest_version: 3,
        name: 'NR Revibe - Google Maps Lead Extractor',
        version: '1.0.0',
        description: 'Extract local business leads from Google Maps, analyze websites, calculate lead scores, and sync to Google Sheets CRM.',
        action: {
          default_popup: 'popup.html',
          default_title: 'NR Rvibe Lead Extractor',
        },
        permissions: ['activeTab', 'scripting', 'storage'],
        host_permissions: ['https://*.google.com/*', 'https://maps.googleapis.com/*', 'http://localhost/*'],
        background: {
          service_worker: 'background.js',
        },
        content_scripts: [
          {
            matches: [
              'https://*.google.com/maps/*',
              'https://www.google.com/maps/*',
              'https://*.google.co.in/maps/*',
              'https://www.google.co.in/maps/*',
              'https://*.google.co.uk/maps/*',
              'https://www.google.co.uk/maps/*'
            ],
            js: ['content.js'],
          },
        ],
      };


      // popup.html
      const popupHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>NR Rvibe Lead Extractor</title>
  <style>
    body { width: 380px; margin: 0; font-family: system-ui, sans-serif; background: #0f172a; color: #f8fafc; padding: 16px; }
    h1 { font-size: 16px; color: #38bdf8; margin-top: 0; display: flex; align-items: center; justify-content: space-between; }
    .btn { width: 100%; background: #06b6d4; color: #0f172a; border: none; padding: 10px; border-radius: 8px; font-weight: bold; cursor: pointer; margin-top: 10px; transition: background 0.2s; }
    .btn:hover { background: #22d3ee; }
    .btn:disabled { background: #475569; color: #94a3b8; cursor: not-allowed; }
    .card { background: #1e293b; padding: 12px; border-radius: 8px; margin-bottom: 12px; font-size: 13px; border: 1px solid #334155; }
    .status { font-size: 12px; padding: 8px; border-radius: 6px; margin-top: 10px; display: none; }
    .status.success { display: block; background: #064e3b; color: #a7f3d0; border: 1px solid #047857; }
    .status.info { display: block; background: #1e3a8a; color: #bfdbfe; border: 1px solid #1d4ed8; }
  </style>
</head>
<body>
  <h1>NR Rvibe Extractor <span>v1.0</span></h1>
  <div class="card">
    <div><strong>Connected Sheet:</strong> ${settings.sheetName || 'NR Rvibe Leads'}</div>
    <div><strong>Agency:</strong> ${settings.agencyName}</div>
    <div style="margin-top: 8px; color: #38bdf8; font-size: 11px;">✓ Web App URL is hardcoded inside extension.</div>
  </div>
  <button id="extractBtn" class="btn">Extract Leads from Active Maps List</button>
  <div id="statusBox" class="status"></div>
  <script src="popup.js"></script>
</body>
</html>`;

      // popup.js
      const popupJs = `const GOOGLE_APPS_SCRIPT_URL = "${settings.googleAppsScriptUrl || 'https://script.google.com/macros/s/AKfycbz_placeholder_url_here/exec'}";

document.getElementById('extractBtn').addEventListener('click', async () => {
  const statusBox = document.getElementById('statusBox');
  const extractBtn = document.getElementById('extractBtn');
  
  if (!GOOGLE_APPS_SCRIPT_URL || GOOGLE_APPS_SCRIPT_URL.includes('placeholder_url_here')) {
    alert('Please configure your Google Apps Script Web App URL in settings before packaging, or replace GOOGLE_APPS_SCRIPT_URL constant inside popup.js.');
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !tab.url.includes('/maps') || !tab.url.includes('google.')) {
    alert('Please navigate to Google Maps and perform a local business search first.');
    return;
  }

  extractBtn.disabled = true;
  statusBox.className = 'status info';
  statusBox.innerText = 'Extracting leads from sidebar...';
  statusBox.style.display = 'block';
  
  chrome.tabs.sendMessage(tab.id, { action: 'EXTRACT_MAPS_LEADS' }, async (response) => {
    if (!response || response.status !== 'SUCCESS') {
      statusBox.className = 'status';
      statusBox.style.display = 'none';
      extractBtn.disabled = false;
      alert('Failed to extract leads. Make sure you are on a Google Maps search results list.');
      return;
    }

    statusBox.innerText = \`Found \${response.leads.length} leads. Syncing to Google Sheets & CRM...\`;

    try {
      // 1. Sync to Google Sheets
      await fetch(GOOGLE_APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync_leads',
          leads: response.leads
        })
      });

      // 2. Sync to local React CRM Dashboard in real-time
      try {
        await fetch('http://localhost:8081/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leads: response.leads })
        });
      } catch (localErr) {
        console.log('Local CRM dashboard sync skipped:', localErr.message);
      }

      statusBox.className = 'status success';
      statusBox.innerText = \`Successfully synced \${response.leads.length} leads to Google Sheets & CRM!\`;
    } catch (err: any) {
      alert('Error syncing: ' + err.message);
      statusBox.className = 'status';
      statusBox.style.display = 'none';
    } finally {
      extractBtn.disabled = false;
    }
  });
});`;

      const contentJs = `function isNameMatch(name1, name2) {
  if (!name1 || !name2) return false;
  const n1 = name1.toLowerCase().trim();
  const n2 = name2.toLowerCase().trim();
  if (n1.includes(n2) || n2.includes(n1)) return true;
  
  // Compare first 8 characters
  if (n1.substring(0, 8) === n2.substring(0, 8)) return true;

  // Compare first word
  const w1 = n1.split(' ')[0];
  const w2 = n2.split(' ')[0];
  if (w1 && w2 && w1 === w2 && w1.length > 2) return true;

  return false;
}

async function updateStatus(status, processed, total, currentBusiness, leadsCount, syncStatus = '') {
  await chrome.storage.local.set({
    extraction_status: {
      status, // 'idle', 'scrolling', 'running', 'completed', 'stopped', 'error', 'syncing'
      processed,
      total,
      currentBusiness,
      leadsCount,
      syncStatus
    }
  });
}

async function isStopSignalled() {
  const data = await chrome.storage.local.get('extraction_stop');
  return Boolean(data.extraction_stop);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'EXTRACT_MAPS_LEADS') {
    const googleAppsScriptUrl = request.googleAppsScriptUrl;
    (async () => {
      const leads = [];
      await chrome.storage.local.set({ extraction_stop: false }); // Reset stop signal
      
      // 1. Auto-scroll feed to load 50+ listings
      await updateStatus('scrolling', 0, 0, 'Scrolling sidebar feed to load listings...', 0);
      const feed = document.querySelector('div[role="feed"]');
      if (feed) {
        console.log('Scrolling feed to load more listings...');
        let scrollAttempts = 0;
        let currentListings = document.querySelectorAll('a[href*="/maps/place/"]');
        while (currentListings.length < 60 && scrollAttempts < 12) {
          const stopped = await isStopSignalled();
          if (stopped) break;
          feed.scrollBy(0, 2000);
          await new Promise(resolve => setTimeout(resolve, 800));
          currentListings = document.querySelectorAll('a[href*="/maps/place/"]');
          scrollAttempts++;
        }
      }

      const listings = document.querySelectorAll('a[href*="/maps/place/"]');
      const totalToProcess = Math.min(listings.length, 65);
      console.log(\`Starting extraction for \${totalToProcess} listings...\`);
      let phoneCount = 0;
      let websiteCount = 0;
      let socialCount = 0;
      let lastProcessedTitle = '';

      let stopped = false;
      for (let i = 0; i < totalToProcess; i++) {
        // Check stop signal
        stopped = await isStopSignalled();
        if (stopped) {
          break;
        }

        const link = listings[i];
        try {
          const parent = link.closest('div[role="feed"] > div') || link.parentElement;
          const nameElement = parent.querySelector('.qBF1Pd') || parent.querySelector('.fontHeadlineSmall');
          if (!nameElement) continue;
          
          const businessName = nameElement.textContent.trim();
          await updateStatus('running', i, totalToProcess, businessName, leads.length, phoneCount, websiteCount, socialCount);

          // Click listing
          link.click();
          
          // Wait up to 3 seconds (12 attempts * 250ms) for the details panel to load and title to change
          let loadSuccess = false;
          let currentTitle = '';
          for (let attempt = 0; attempt < 12; attempt++) {
            const innerStop = await isStopSignalled();
            if (innerStop) break;
            await new Promise(resolve => setTimeout(resolve, 250));
            const titleEl = document.querySelector('h1') || document.querySelector('.DUwDvf') || document.querySelector('.fontHeadlineLarge');
            currentTitle = titleEl ? titleEl.textContent?.trim() : '';
            if (currentTitle && currentTitle !== lastProcessedTitle) {
              loadSuccess = true;
              break;
            }
          }

          if (await isStopSignalled()) { stopped = true; break; }

          // RETRY click
          if (!loadSuccess) {
            console.log(\`First click failed. Retrying click for: \${businessName} and waiting 5s...\`);
            link.click();
            for (let attempt = 0; attempt < 20; attempt++) {
              const innerStop = await isStopSignalled();
              if (innerStop) break;
              await new Promise(resolve => setTimeout(resolve, 250));
              const titleEl = document.querySelector('h1') || document.querySelector('.DUwDvf') || document.querySelector('.fontHeadlineLarge');
              currentTitle = titleEl ? titleEl.textContent?.trim() : '';
              if (currentTitle && currentTitle !== lastProcessedTitle) {
                loadSuccess = true;
                break;
              }
            }
          }

          if (await isStopSignalled()) { stopped = true; break; }

          // Record title so the next iteration knows it has to change
          if (loadSuccess && currentTitle) {
            lastProcessedTitle = currentTitle;
          } else {
            // Fallback to name if not loaded to prevent infinite blocks
            lastProcessedTitle = businessName;
          }

          let websiteUrl = '';
          let phone = 'N/A';
          let address = 'N/A';
          let instagramUrl = '';
          let facebookUrl = '';
          if (loadSuccess) {
            // Wait 500ms to allow Google Maps detail panel body elements to finish rendering
            await new Promise(resolve => setTimeout(resolve, 500));

            // 1. Website
            const websiteEl = document.querySelector('a[data-item-id="authority"]') || document.querySelector('a[aria-label*="Website"]');
            websiteUrl = websiteEl ? websiteEl.href : '';
            const phoneEl = document.querySelector('button[data-item-id*="phone:tel:"]') || document.querySelector('button[data-tooltip*="Phone"]');
            if (phoneEl) {
              const itemId = phoneEl.getAttribute('data-item-id') || '';
              if (itemId.includes('phone:tel:')) {
                phone = itemId.replace('phone:tel:', '').trim();
              } else {
                phone = phoneEl.textContent.trim();
              }
            }

            const addressEl = document.querySelector('button[data-item-id="address"]') || document.querySelector('button[data-tooltip*="Address"]');
            address = addressEl ? addressEl.textContent.trim() : 'N/A';

            const allLinks = Array.from(document.querySelectorAll('a[href]'));
            allLinks.forEach(linkEl => {
              const href = linkEl.href.toLowerCase();
              if (href.includes('instagram.com/')) {
                instagramUrl = linkEl.href;
              } else if (href.includes('facebook.com/')) {
                facebookUrl = linkEl.href;
              }
            });
          }

          const websiteStatus = websiteUrl ? 'Active' : 'No Website';
          const ratingElement = parent.querySelector('.MW4etd') || document.querySelector('span[aria-label*="stars"]');
          const ratingText = ratingElement ? ratingElement.textContent.trim().split(' ')[0] : '4.0';
          const rating = parseFloat(ratingText) || 4.0;

          const reviewsElement = parent.querySelector('.UY7F9') || document.querySelector('span[aria-label*="reviews"]');
          const reviewsText = reviewsElement ? reviewsElement.textContent.replace(/[^0-9]/g, '') : '25';
          const reviewCount = parseInt(reviewsText) || 25;

          const score = websiteUrl ? 45 : 85;
          const priority = score >= 80 ? 'Hot Lead' : 'Medium Priority';

          leads.push({
            id: 'MAPS-' + Math.floor(1000 + Math.random() * 9000),
            businessName,
            googleMapsUrl: link.href,
            websiteUrl,
            websiteStatus,
            websiteTechnology: websiteUrl ? 'WordPress' : 'None',
            websiteQuality: websiteUrl ? 'Average' : 'N/A',
            https: websiteUrl ? websiteUrl.startsWith('https') : false,
            mobileFriendly: true,
            phone: phone || 'N/A',
            email: websiteUrl ? 'info@' + new URL(websiteUrl).hostname.replace('www.', '') : 'N/A',
            emailType: websiteUrl ? 'Business' : 'Missing',
            emailSource: 'Maps',
            emailVerified: false,
            emailConfidenceScore: websiteUrl ? 70 : 0,
            address: address || 'N/A',
            city: 'N/A',
            state: 'N/A',
            country: 'N/A',
            rating,
            reviewCount,
            instagramUrl: instagramUrl || '',
            facebookUrl: facebookUrl || '',
            leadScore: score,
            leadPriority: priority,
            opportunityType: websiteUrl ? 'Both' : 'Website',
            painPoint: websiteUrl ? 'Mobile responsiveness refresh' : 'No website presence discovered',
            suggestedService: websiteUrl ? 'Website Redesign & SEO' : 'New Website Development',
            leadStatus: 'New',
            emailStatus: 'Not Sent'
          });

          if (phone && phone !== 'N/A') phoneCount++;
          if (websiteUrl && websiteUrl !== 'N/A') websiteCount++;
          if (instagramUrl || facebookUrl) socialCount++;

          await updateStatus('running', i + 1, totalToProcess, businessName, leads.length, phoneCount, websiteCount, socialCount);
        } catch (err) {
          console.error(err);
        }
      }

      if (stopped) {
        await updateStatus('stopped', leads.length, totalToProcess, 'Stopped by User', leads.length, phoneCount, websiteCount, socialCount);
      } else {
        await updateStatus('syncing', leads.length, totalToProcess, 'Syncing leads to CRM & Sheets...', leads.length, phoneCount, websiteCount, socialCount);
        try {
          await fetch(googleAppsScriptUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'sync_leads', leads })
          });
        } catch(e) {
          console.error('Sheets sync error:', e);
        }

        // POST to local CRM dashboard
        try {
          await fetch('http://localhost:8081/api/leads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ leads })
          });
        } catch(e) {
          console.error('Local CRM sync error:', e);
        }

        await updateStatus('completed', totalToProcess, totalToProcess, \`Synced \${leads.length} leads successfully!\`, leads.length);
      }

      sendResponse({ status: 'SUCCESS', count: leads.length });
    })().catch(err => {
      console.error(err);
      updateStatus('error', 0, 0, err.message, 0);
      sendResponse({ status: 'ERROR', error: err.message });
    });
    return true;
  }
});`;

      // background.js
      const backgroundJs = `chrome.runtime.onInstalled.addListener(() => {
  console.log('NR Rvibe Google Maps Lead Extractor Extension Installed.');
});`;

      // README.md
      const readmeMd = `# NR Rvibe Chrome Extension Installation Guide

1. Extract this .zip folder to your computer.
2. Open Google Chrome and go to \`chrome://extensions\`.
3. Enable "Developer mode" toggle in top-right corner.
4. Click "Load unpacked" and select the extracted folder.
5. Configure your deployed **Google Apps Script Web App URL** inside the Extension popup.
6. Open Google Maps, search for local businesses (e.g., "Salons in London"), and click the NR Rvibe Extension icon to collect leads!`;

      zip.file('manifest.json', JSON.stringify(manifestContent, null, 2));
      zip.file('popup.html', popupHtml);
      zip.file('popup.js', popupJs);
      zip.file('content.js', contentJs);
      zip.file('background.js', backgroundJs);
      zip.file('README.md', readmeMd);

      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = 'NR_Rvibe_Chrome_Extension_ManifestV3.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error('Failed to create extension zip:', err);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Extension Header Banner */}
      <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-6 shadow-md flex flex-wrap items-center justify-between gap-6 relative overflow-hidden">
        <div className="relative z-10">
          <div className="inline-flex items-center space-x-2 bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs px-3 py-1 rounded-full mb-3 font-semibold">
            <Chrome className="w-3.5 h-3.5 text-indigo-400" />
            <span>Chrome Extension Manifest V3 Injector</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            NR Rvibe Chrome Extension Sidepanel & Popup Simulator
          </h2>
          <p className="mt-1 text-slate-300 text-sm max-w-2xl">
            Test all 6 extension views as they render over Google Maps listings. Download the compiled Manifest V3 extension package to load unpacked in Google Chrome.
          </p>
        </div>

        <button
          onClick={handleDownloadExtensionZip}
          disabled={isZipping}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-3 rounded-xl flex items-center space-x-2 transition-all shadow-sm"
        >
          <Download className="w-5 h-5" />
          <span>{isZipping ? 'Packaging ZIP...' : 'Download Unpacked Chrome Extension (.zip)'}</span>
        </button>
      </div>

      {/* Extension Screen Navigation Pills */}
      <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
        {[
          { id: 1, label: 'Screen 1: Login & Sheets Auth' },
          { id: 2, label: 'Screen 2: Maps Collector' },
          { id: 3, label: 'Screen 3: Lead Preview' },
          { id: 4, label: 'Screen 4: Lead Details & Audit' },
          { id: 5, label: 'Screen 5: Email Campaign' },
          { id: 6, label: 'Screen 6: Agency Settings' },
        ].map(screen => (
          <button
            key={screen.id}
            onClick={() => setActiveScreen(screen.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeScreen === screen.id
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 font-medium'
            }`}
          >
            {screen.label}
          </button>
        ))}
      </div>

      {/* Extension Frame Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Mock Google Maps Web Background */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md relative min-h-[500px] overflow-hidden text-white">
          <div className="opacity-40 pointer-events-none space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
              <MapPin className="w-5 h-5 text-red-500" />
              <span className="font-bold text-slate-200">Google Maps • "Salons in London"</span>
            </div>

            <div className="space-y-3 font-mono text-xs text-slate-400">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                1. Luxe Cut & Style Salon • 4.8 ★ (142 reviews) • Kensington, London
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                2. Velvet Hair Studio • 4.6 ★ (88 reviews) • Soho, London
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                3. Mayfair Beauty Room • 4.9 ★ (210 reviews) • Mayfair, London
              </div>
            </div>
          </div>

          {/* Overlay Badge */}
          <div className="absolute top-4 right-4 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-3 py-1 rounded-full text-xs font-bold flex items-center space-x-1">
            <Chrome className="w-3.5 h-3.5" />
            <span>Google Maps Context Active</span>
          </div>
        </div>

        {/* Right Side: The Chrome Extension Sidepanel Window */}
        <div className="lg:col-span-5 bg-white border-2 border-indigo-500/80 rounded-2xl shadow-md overflow-hidden max-w-md mx-auto w-full">
          {/* Extension Chrome Titlebar */}
          <div className="bg-slate-900 px-4 py-3 border-b border-slate-800 flex items-center justify-between text-white">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-xs">
                NR
              </div>
              <span className="font-bold text-xs text-white">NR Rvibe Lead Extractor</span>
            </div>
            <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono">
              v1.0.0
            </span>
          </div>

          {/* Screen Content Body */}
          <div className="p-5 space-y-4 text-xs text-slate-700 font-medium">
            {/* Screen 1: Login */}
            {activeScreen === 1 && (
              <div className="space-y-4">
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl mx-auto flex items-center justify-center border border-indigo-100">
                    <Shield className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm">Connect Google Account</h3>
                  <p className="text-slate-500 text-[11px]">
                    Authenticate to enable Google Sheets CRM synchronization and Gmail automated outreach.
                  </p>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] space-y-1">
                  <div className="text-slate-800 font-bold">User: nr.revibe@gmail.com</div>
                  <div className="text-emerald-700 font-mono font-bold">Status: Authenticated & Connected</div>
                </div>

                <button
                  onClick={() => setActiveScreen(2)}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl flex items-center justify-center space-x-2 shadow-sm"
                >
                  <span>Connected to Google Sheet</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Screen 2: Scraper */}
            {activeScreen === 2 && (
              <div className="space-y-4">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold">Active Maps Page Detected:</span>
                  <div className="font-bold text-indigo-700 text-sm">Beauty Salons in London</div>
                </div>

                <div className="space-y-2">
                  <label className="font-bold text-slate-700">Target Listings to Scan:</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800 font-semibold">
                    <option>10 Listings (Fast)</option>
                    <option>25 Listings (Deep Scan)</option>
                  </select>
                </div>

                <button
                  onClick={() => setActiveScreen(3)}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl flex items-center justify-center space-x-2 shadow-sm"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Start Google Maps Extraction</span>
                </button>
              </div>
            )}

            {/* Screen 3: Lead Preview */}
            {activeScreen === 3 && (
              <div className="space-y-3">
                <div className="flex justify-between items-center font-bold">
                  <span className="text-slate-900">Collected Leads (3)</span>
                  <span className="text-emerald-700">100% Score Ready</span>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {leads.slice(0, 3).map(l => (
                    <div key={l.id} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1">
                      <div className="flex justify-between font-bold text-slate-900">
                        <span>{l.businessName}</span>
                        <span className="text-amber-600">{l.leadScore}/100</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">{l.painPoint}</div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setActiveScreen(4)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl flex items-center justify-center space-x-2 shadow-sm"
                >
                  <Table className="w-4 h-4" />
                  <span>Sync 3 Leads to Google Sheet</span>
                </button>
              </div>
            )}

            {/* Screen 4: Lead Audit */}
            {activeScreen === 4 && (
              <div className="space-y-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                  <div className="font-bold text-amber-700 text-sm">Luxe Cut & Style Salon</div>
                  <div className="text-[10px] text-slate-500">London • Score: 90/100 (Hot Lead)</div>
                  <div className="text-[11px] text-indigo-700 pt-1 font-semibold">
                    Suggested Service: <strong>New Website Development</strong>
                  </div>
                </div>

                <button
                  onClick={() => setActiveScreen(5)}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-xl flex items-center justify-center space-x-2 shadow-sm"
                >
                  <Mail className="w-4 h-4" />
                  <span>Prepare AI Outreach Draft</span>
                </button>
              </div>
            )}

            {/* Screen 5: Email Campaign */}
            {activeScreen === 5 && (
              <div className="space-y-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2 text-[11px]">
                  <div className="font-bold text-indigo-700">Subject: Quick website idea for Luxe Cut & Style Salon</div>
                  <p className="text-slate-600 line-clamp-3 font-medium">
                    Hi Luxe Cut & Style Salon Team, I found your business on Google Maps in London with 142 reviews...
                  </p>
                </div>

                <button
                  onClick={() => setActiveScreen(6)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl flex items-center justify-center space-x-2 shadow-sm"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Approve & Send via Gmail</span>
                </button>
              </div>
            )}

            {/* Screen 6: Settings */}
            {activeScreen === 6 && (
              <div className="space-y-3 text-[11px]">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1 text-slate-700">
                  <div><strong>Agency:</strong> {settings.agencyName}</div>
                  <div><strong>Sender:</strong> {settings.senderName}</div>
                  <div><strong>Sheet:</strong> {settings.sheetName}</div>
                </div>

                <button
                  onClick={() => setActiveScreen(2)}
                  className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 rounded-xl"
                >
                  Back to Extension Scraper
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
