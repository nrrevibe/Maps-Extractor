/**
 * Google Apps Script Backend for NR Rvibe Lead Gen Suite
 * Optimized Version 2.1
 * 
 * Includes:
 * - Script caching to prevent duplicate database checking latency.
 * - Batch row operations using getRange/setValues (which is significantly faster than sequential appendRow).
 * - Automatic LockService usage to prevent race conditions when multiple scrapers execute concurrently.
 * - Dynamic environment resolution (Script Properties fallback).
 */

// POST requests: Receive leads from extension/frontend
function doPost(e) {
  // Obtain public lock to handle concurrent incoming requests safely
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000); // Wait up to 15 seconds for previous execution to complete
  } catch (ex) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Lock timeout. Server was busy processing other leads.'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    const postData = JSON.parse(e.postData.contents);
    
    // API KEY SECURITY CHECK
    if (postData.apiKey !== 'nr-revibe-secure-key-2026') {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Unauthorized. Invalid API Key.'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const action = postData.action || 'sync_leads';
    
    if (action === 'sync_leads') {
      const leads = Array.isArray(postData.leads) ? postData.leads : [postData.lead];
      const results = syncLeadsToDatabase(leads);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: `Successfully processed ${leads.length} leads.`,
        results: results
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'delete_lead') {
      const leadId = postData.leadId;
      const success = deleteLeadFromSheet(leadId);
      return ContentService.createTextOutput(JSON.stringify({
        success: success,
        message: success ? `Lead ${leadId} deleted from Google Sheets.` : `Lead ${leadId} not found in Google Sheets.`
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'update_lead') {
      const lead = postData.lead;
      const success = updateLeadInSheet(lead);
      return ContentService.createTextOutput(JSON.stringify({
        success: success,
        message: success ? `Lead ${lead.id} updated in Google Sheets.` : `Lead ${lead.id} not found.`
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'save_settings') {
      const settings = postData.settings;
      const success = saveSettingsToDatabase(settings);
      return ContentService.createTextOutput(JSON.stringify({
        success: success,
        message: 'Settings saved.'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Invalid action'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// GET requests: Check connection or retrieve configuration
function doGet(e) {
  const params = e || { parameter: {} };
  const action = params.parameter ? params.parameter.action : null;
  const apiKey = params.parameter ? params.parameter.apiKey : null;
  
  if (apiKey !== 'nr-revibe-secure-key-2026') {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Unauthorized. Invalid API Key.'
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'get_leads') {
    try {
      const leads = getLeadsFromDatabase();
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        leads: leads
      })).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: err.toString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  if (action === 'get_settings') {
    try {
      const settings = getSettingsFromDatabase();
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        settings: settings
      })).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: err.toString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: 'connected',
    message: 'NR Rvibe Google Sheets Database Web App is active.',
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

function getLeadsFromDatabase() {
  let masterDb;
  try {
    masterDb = SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {}

  if (!masterDb) {
    const props = PropertiesService.getScriptProperties();
    const dbSheetId = props.getProperty('DB_SHEET_ID');
    if (dbSheetId) {
      masterDb = SpreadsheetApp.openById(dbSheetId);
    } else {
      throw new Error("Master DB spreadsheet context not found. Set DB_SHEET_ID in script properties.");
    }
  }

  const rawLeadsTab = getOrCreateSheet(masterDb, 'Raw_Leads');
  const lastRow = rawLeadsTab.getLastRow();
  if (lastRow <= 1) return [];

  const headers = rawLeadsTab.getRange(1, 1, 1, rawLeadsTab.getLastColumn()).getValues()[0];
  const data = rawLeadsTab.getRange(2, 1, lastRow - 1, rawLeadsTab.getLastColumn()).getValues();

  const leads = data.map(row => {
    const lead = {};
    headers.forEach((header, index) => {
      lead[header] = row[index];
    });

    return {
      id: lead.raw_id || ('MAPS-' + Math.floor(1000 + Math.random() * 9000)),
      businessName: lead.business_name || '',
      category: lead.category || '',
      googleMapsUrl: lead.maps_url || '',
      websiteUrl: lead.website_url || '',
      websiteStatus: lead.website_status || (lead.website_url ? 'Active' : 'No Website'),
      websiteTechnology: lead.website_tech || 'None',
      websiteQuality: lead.website_url ? 'Average' : 'N/A',
      https: lead.https_enabled === 'Yes',
      mobileFriendly: lead.mobile_friendly === 'Yes',
      phone: lead.phone || '',
      email: lead.email || '',
      emailType: lead.email ? 'Business' : 'Missing',
      emailSource: 'Maps',
      emailVerified: false,
      emailConfidenceScore: 70,
      address: lead.address || '',
      city: lead.city || '',
      state: lead.state || '',
      country: lead.country || '',
      rating: parseFloat(lead.rating) || 4.0,
      reviewCount: parseInt(lead.review_count) || 25,
      instagramUrl: lead.instagram_url || '',
      facebookUrl: lead.facebook_url || '',
      twitterUrl: lead.twitter_url || '',
      linkedinUrl: lead.linkedin_url || '',
      youtubeUrl: lead.youtube_url || '',
      hours: lead.hours || '',
      socialStatus: (lead.instagram_url || lead.facebook_url || lead.twitter_url) ? 'Active' : 'Missing',
      leadScore: parseInt(lead.lead_score) || 50,
      leadPriority: (parseInt(lead.lead_score) || 50) >= 80 ? 'Hot Lead' : 'Medium Priority',
      opportunityType: lead.opportunity_type || (lead.website_url ? 'Social Media' : 'Website'),
      painPoint: lead.pain_point || (lead.website_url ? 'Mobile responsiveness refresh' : 'No website presence discovered'),
      suggestedService: lead.suggested_service || (lead.website_url ? 'Website Redesign & SEO' : 'New Website Development'),
      leadStatus: lead.lead_status || 'New',
      emailStatus: lead.email_status || 'Not Sent',
      notes: lead.notes || '',
      followUpDate: lead.follow_up_date || '',
      collectedDate: lead.timestamp ? new Date(lead.timestamp).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      collectedBy: 'NR Rvibe Maps Extractor'
    };
  });

  return leads;
}

function getLeadSpreadsheet() {
  const props = PropertiesService.getScriptProperties();
  const dbSheetId = props.getProperty('DB_SHEET_ID');
  let masterDb = null;
  try { masterDb = SpreadsheetApp.openById(dbSheetId); } catch(e) {}
  
  let leadSheetId = props.getProperty('LEAD_SHEET_ID');
  if (!leadSheetId && masterDb) {
    const settingsSheet = masterDb.getSheetByName('Settings');
    if (settingsSheet && settingsSheet.getLastRow() > 1) {
      const settingsData = settingsSheet.getRange(2, 1, settingsSheet.getLastRow() - 1, 2).getValues();
      for (let i = 0; i < settingsData.length; i++) {
        if (settingsData[i][0] === 'lead_sheet_id') {
          leadSheetId = settingsData[i][1];
          break;
        }
      }
    }
  }
  
  if (leadSheetId) {
    try { return SpreadsheetApp.openById(leadSheetId); } catch(e) {}
  }
  return masterDb;
}

// Sync leads to the Master DB and sync qualified leads to the Lead Workspace Sheet
function syncLeadsToDatabase(leads) {
  let masterDb;
  try {
    masterDb = SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {}

  if (!masterDb) {
    const props = PropertiesService.getScriptProperties();
    const dbSheetId = props.getProperty('DB_SHEET_ID');
    if (dbSheetId) {
      masterDb = SpreadsheetApp.openById(dbSheetId);
    } else {
      throw new Error("Master DB spreadsheet context not found. Set DB_SHEET_ID in script properties.");
    }
  }

  const rawLeadsTab = getOrCreateSheet(masterDb, 'Raw_Leads');
  
  const headers = [
    'raw_id', 'timestamp', 'business_name', 'category', 'maps_url', 
    'website_url', 'phone', 'email', 'address', 'city', 
    'state', 'country', 'postal_code', 'rating', 'review_count', 
    'instagram_url', 'facebook_url', 'twitter_url', 'linkedin_url', 'youtube_url',
    'hours', 'website_status', 'website_tech', 'https_enabled', 
    'mobile_friendly', 'lead_score', 'opportunity_type', 'pain_point', 'suggested_service',
    'duplicate_flag', 'pushed_to_leadsheet'
  ];
  
  if (rawLeadsTab.getLastRow() === 0) {
    rawLeadsTab.appendRow(headers);
  }
  
  // Load existing data once into memory for fast cache lookups
  const existingLeadsCache = loadExistingLeadsCache(rawLeadsTab);
  const results = [];
  const rowsToAppend = [];
  const leadsToPushToWorkspace = [];

  leads.forEach(lead => {
    if (!lead || !lead.businessName) return;
    
    // Check for duplicate — returns null (new) or { rowNum, phone, website, address } (existing)
    const dupInfo = checkDuplicateCached(existingLeadsCache, lead);
    
    if (dupInfo) {
      // Existing record found — check if incoming data is BETTER (has info the old row lacks)
      const newPhone   = (lead.phone || '').trim();
      const newWebsite = (lead.websiteUrl || '').trim();
      const newAddress = (lead.address || '').trim();
      const hasNewPhone   = newPhone   && newPhone   !== 'N/A' && newPhone   !== '';
      const hasNewWebsite = newWebsite && newWebsite !== 'N/A' && newWebsite !== '';
      const hasNewAddress = newAddress && newAddress !== 'N/A' && newAddress !== '';
      const oldPhoneMissing   = !dupInfo.phone   || dupInfo.phone   === 'n/a';
      const oldWebsiteMissing = !dupInfo.website || dupInfo.website === 'n/a';
      const oldAddressMissing = !dupInfo.address || dupInfo.address === 'n/a';

      // If we have better data, update the existing row
      if ((hasNewPhone && oldPhoneMissing) || (hasNewWebsite && oldWebsiteMissing) || (hasNewAddress && oldAddressMissing)) {
        try {
          // Column positions: G=phone(7), F=website(6), I=address(9), J=city(10), K=state(11)
          const updateRange = rawLeadsTab.getRange(dupInfo.rowNum, 1, 1, rawLeadsTab.getLastColumn());
          const existingRow = updateRange.getValues()[0];
          const headers = rawLeadsTab.getRange(1, 1, 1, rawLeadsTab.getLastColumn()).getValues()[0];
          const colIdx = h => headers.indexOf(h);
          
          if (hasNewPhone    && oldPhoneMissing)   existingRow[colIdx('phone')]   = newPhone;
          if (hasNewWebsite  && oldWebsiteMissing) existingRow[colIdx('website_url')] = newWebsite;
          if (hasNewAddress  && oldAddressMissing) existingRow[colIdx('address')] = newAddress;
          if (lead.hours && lead.hours !== 'N/A')  existingRow[colIdx('hours')] = lead.hours;
          if (lead.instagramUrl) existingRow[colIdx('instagram_url')] = lead.instagramUrl;
          if (lead.facebookUrl)  existingRow[colIdx('facebook_url')]  = lead.facebookUrl;
          if (lead.twitterUrl)   existingRow[colIdx('twitter_url')]   = lead.twitterUrl;
          if (lead.city && lead.city !== 'N/A') existingRow[colIdx('city')] = lead.city;
          if (lead.state && lead.state !== 'N/A') existingRow[colIdx('state')] = lead.state;
          
          updateRange.setValues([existingRow]);
          Logger.log('Updated existing row ' + dupInfo.rowNum + ' with better data for: ' + lead.businessName);
        } catch(e) {
          Logger.log('Row update failed: ' + e.toString());
        }
      }

      results.push({ businessName: lead.businessName, isDuplicate: true, updated: true, pushedToLeadSheet: false });
      return; // Do not append a new row
    }
    
    const rawId = lead.id || ('RAW' + Math.floor(100000 + Math.random() * 900000));
    const timestamp = new Date().toISOString();
    
    const opportunityType = lead.opportunityType || (lead.websiteUrl ? 'Social Media' : 'Website');
    
    // Queue sheet write
    rowsToAppend.push([
      rawId,
      timestamp,
      lead.businessName,
      lead.category || '',
      lead.googleMapsUrl || '',
      lead.websiteUrl || '',
      lead.phone || '',
      lead.email || '',
      lead.address || '',
      lead.city || '',
      lead.state || '',
      lead.country || '',
      lead.postalCode || '',
      lead.rating || 0,
      lead.reviewCount || 0,
      lead.instagramUrl || '',
      lead.facebookUrl || '',
      lead.twitterUrl || '',
      lead.linkedinUrl || '',
      lead.youtubeUrl || '',
      lead.hours || '',
      lead.websiteStatus || 'Active',
      lead.websiteTechnology || 'None',
      lead.https ? 'Yes' : 'No',
      lead.mobileFriendly ? 'Yes' : 'No',
      lead.leadScore || 0,
      opportunityType,
      lead.painPoint || '',
      lead.suggestedService || '',
      'No', // Not a duplicate if it reached here
      'No' // Will flip to Yes if pushed successfully
    ]);

    // Check minimum qualified score (default 50)
    const minScore = 50;
    if (lead.leadScore >= minScore) {
      leadsToPushToWorkspace.push({ lead: lead, rawId: rawId, rowIndex: rowsToAppend.length - 1 });
    }

    // Add current item to transient cache to prevent new duplicates within the same batch upload
    const nameLow  = lead.businessName.toLowerCase().trim();
    const phoneLow = (lead.phone || '').toLowerCase().replace(/\s/g, '');
    existingLeadsCache.names.set(nameLow, { rowNum: 0, phone: phoneLow, website: '', address: '' });
    if (lead.websiteUrl) existingLeadsCache.websites.set(lead.websiteUrl.toLowerCase().trim(), { rowNum: 0 });
    if (phoneLow && phoneLow !== 'n/a') existingLeadsCache.phones.set(phoneLow, { rowNum: 0 });
  });

  if (rowsToAppend.length > 0) {
    // Sync qualified items to secondary Lead Workspace spreadsheet
    leadsToPushToWorkspace.forEach(item => {
      const success = pushToLeadWorkspace(item.lead, item.rawId);
      if (success) {
        // Mark pushed_to_leadsheet flag as Yes
        rowsToAppend[item.rowIndex][headers.indexOf('pushed_to_leadsheet')] = 'Yes';
      }
      
      results.push({
        businessName: item.lead.businessName,
        rawId: item.rawId,
        isDuplicate: false,
        pushedToLeadSheet: success
      });
    });

    // Bulk append all rows to Master DB
    const startRow = rawLeadsTab.getLastRow() + 1;
    rawLeadsTab.getRange(startRow, 1, rowsToAppend.length, headers.length).setValues(rowsToAppend);
  }
  
  return results;
}

// Load current sheet listings into memory for smart dedup + update
function loadExistingLeadsCache(sheet) {
  const cache = { names: new Map(), websites: new Map(), phones: new Map() };
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return cache;

  // Read columns: C=name, D=category, E=maps_url, F=website_url, G=phone, H=email, I=address
  const data = sheet.getRange(2, 3, lastRow - 1, 7).getValues();
  for (let i = 0; i < data.length; i++) {
    const rowNum = i + 2; // 1-indexed, row 1 is header
    const name    = data[i][0].toString().toLowerCase().trim();
    const website = data[i][3].toString().toLowerCase().trim();
    const phone   = data[i][4].toString().toLowerCase().trim().replace(/\s/g, '');
    const address = data[i][6].toString().trim();
    if (name)    cache.names.set(name,    { rowNum, phone, website, address });
    if (website && website !== 'n/a') cache.websites.set(website, { rowNum });
    if (phone && phone !== 'n/a')   cache.phones.set(phone, { rowNum });
  }
  return cache;
}

// Returns null if no duplicate, or { rowNum, existingPhone, existingWebsite, existingAddress } if found
function checkDuplicateCached(cache, lead) {
  const nameLow    = lead.businessName.toLowerCase().trim();
  const websiteLow = (lead.websiteUrl || '').toLowerCase().trim();
  const phoneLow   = (lead.phone || '').toLowerCase().replace(/\s/g, '');

  if (cache.names.has(nameLow)) return cache.names.get(nameLow);
  if (websiteLow && websiteLow !== 'n/a' && cache.websites.has(websiteLow)) return cache.websites.get(websiteLow);
  if (phoneLow && phoneLow !== 'n/a' && cache.phones.has(phoneLow)) return cache.phones.get(phoneLow);
  return null;
}

// Push qualified leads to the secondary Lead Workspace Spreadsheet
function pushToLeadWorkspace(lead, rawId) {
  try {
    let leadSheetId = '';
    
    // 1. Try to read active spreadsheet settings
    let masterDb;
    try {
      masterDb = SpreadsheetApp.getActiveSpreadsheet();
    } catch(e) {}

    if (masterDb) {
      const settingsSheet = masterDb.getSheetByName('Settings');
      if (settingsSheet && settingsSheet.getLastRow() > 1) {
        const settings = settingsSheet.getRange(2, 1, settingsSheet.getLastRow() - 1, 2).getValues();
        for (let i = 0; i < settings.length; i++) {
          if (settings[i][0] === 'lead_sheet_id') {
            leadSheetId = settings[i][1];
            break;
          }
        }
      }
    }
    
    // 2. Fallback to Script Properties if settings sheet is missing/empty
    if (!leadSheetId) {
      const props = PropertiesService.getScriptProperties();
      leadSheetId = props.getProperty('LEAD_SHEET_ID') || '';
    }
    
    let leadSpreadsheet;
    if (leadSheetId) {
      leadSpreadsheet = SpreadsheetApp.openById(leadSheetId);
    } else if (masterDb) {
      leadSpreadsheet = masterDb;
    } else {
      throw new Error("Lead Workspace spreadsheet ID not found.");
    }
    
    const activeLeadsTab = getOrCreateSheet(leadSpreadsheet, 'Active_Leads');
    
    const leadHeaders = [
      'lead_id', 'raw_id', 'business_name', 'category', 'website_url', 
      'phone', 'email', 'city', 'lead_score', 'opportunity_type', 
      'suggested_service', 'lead_status', 'email_status', 'approval_status'
    ];
    
    if (activeLeadsTab.getLastRow() === 0) {
      activeLeadsTab.appendRow(leadHeaders);
    }
    
    const leadId = 'LD' + Math.floor(100000 + Math.random() * 900000);
    const newLeadRow = [
      leadId,
      rawId,
      lead.businessName,
      lead.category || '',
      lead.websiteUrl || '',
      lead.phone || '',
      lead.email || '',
      lead.city || '',
      lead.leadScore || 0,
      lead.opportunityType || 'Website',
      lead.suggestedService || 'Website Development',
      'New',
      'Not Sent',
      'Pending Approval'
    ];
    
    activeLeadsTab.appendRow(newLeadRow);
    return true;
  } catch (err) {
    Logger.log('Error pushing to Lead Workspace: ' + err.toString());
    return false;
  }
}

// Helper to get or create sheet tabs
function getOrCreateSheet(spreadsheet, sheetName) {
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }
  return sheet;
}

// Delete lead from sheets
function deleteLeadFromSheet(leadId) {
  let masterDb;
  try {
    masterDb = SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {}

  if (!masterDb) {
    const props = PropertiesService.getScriptProperties();
    const dbSheetId = props.getProperty('DB_SHEET_ID');
    if (dbSheetId) {
      masterDb = SpreadsheetApp.openById(dbSheetId);
    } else {
      return false;
    }
  }

  // 1. Delete from Raw_Leads (DB sheet)
  const rawLeadsTab = masterDb.getSheetByName('Raw_Leads');
  if (rawLeadsTab) {
    const lastRow = rawLeadsTab.getLastRow();
    if (lastRow > 1) {
      const ids = rawLeadsTab.getRange(2, 1, lastRow - 1, 1).getValues();
      for (let i = 0; i < ids.length; i++) {
        if (ids[i][0] === leadId) {
          rawLeadsTab.deleteRow(i + 2);
          break;
        }
      }
    }
  }

  // 2. Delete from Active_Leads (Lead Workspace sheet)
  let leadSheetId = '';
  const settingsSheet = masterDb.getSheetByName('Settings');
  if (settingsSheet && settingsSheet.getLastRow() > 1) {
    const settings = settingsSheet.getRange(2, 1, settingsSheet.getLastRow() - 1, 2).getValues();
    for (let i = 0; i < settings.length; i++) {
      if (settings[i][0] === 'lead_sheet_id') {
        leadSheetId = settings[i][1];
        break;
      }
    }
  }
  if (!leadSheetId) {
    const props = PropertiesService.getScriptProperties();
    leadSheetId = props.getProperty('LEAD_SHEET_ID');
  }

  let leadSpreadsheet;
  if (leadSheetId) {
    try {
      leadSpreadsheet = SpreadsheetApp.openById(leadSheetId);
    } catch(e) {}
  }
  if (!leadSpreadsheet) {
    leadSpreadsheet = masterDb;
  }

  const activeLeadsTab = leadSpreadsheet.getSheetByName('Active_Leads');
  if (activeLeadsTab) {
    const lastRow = activeLeadsTab.getLastRow();
    if (lastRow > 1) {
      const ids = activeLeadsTab.getRange(2, 1, lastRow - 1, 2).getValues(); // A: lead_id, B: raw_id
      for (let i = 0; i < ids.length; i++) {
        if (ids[i][0] === leadId || ids[i][1] === leadId) {
          activeLeadsTab.deleteRow(i + 2);
          break;
        }
      }
    }
  }

  return true;
}

function updateLeadInSheet(lead) {
  try {
    const props = PropertiesService.getScriptProperties();
    const dbSheetId = props.getProperty('DB_SHEET_ID');
    const masterDb = SpreadsheetApp.openById(dbSheetId);
    
    let leadSpreadsheet = getLeadSpreadsheet(); // Uses LEAD_SHEET_ID if available
    
    // 1. Update in Raw_Leads
    const rawLeadsTab = masterDb.getSheetByName('Raw_Leads');
    if (rawLeadsTab) {
      updateRowInTab(rawLeadsTab, lead);
    }
    
    // 2. Update in Active_Leads
    if (leadSpreadsheet) {
      const activeLeadsTab = leadSpreadsheet.getSheetByName('Active_Leads');
      if (activeLeadsTab) {
        updateRowInTab(activeLeadsTab, lead);
      }
    }
    
    return true;
  } catch (err) {
    Logger.log(err);
    return false;
  }
}

function updateRowInTab(tab, lead) {
  const lastRow = tab.getLastRow();
  if (lastRow <= 1) return;
  
  const headers = tab.getRange(1, 1, 1, tab.getLastColumn()).getValues()[0];
  const data = tab.getRange(2, 1, lastRow - 1, 2).getValues(); // Get first 2 columns (A and B)
  
  const ensureCol = (headerName) => {
    let idx = headers.indexOf(headerName) + 1;
    if (!idx) {
      idx = headers.length + 1;
      tab.getRange(1, idx).setValue(headerName);
      headers.push(headerName);
    }
    return idx;
  };
  
  // Create index map for O(1) lookups
  const idMap = new Map();
  for (let i = 0; i < data.length; i++) {
    if (data[i][0]) idMap.set(data[i][0].toString(), i + 2);
    if (data[i][1]) idMap.set(data[i][1].toString(), i + 2);
  }
  
  const targetRow = idMap.get(lead.id?.toString()) || idMap.get(lead.raw_id?.toString());
  
  if (targetRow) {
    if (lead.leadStatus) tab.getRange(targetRow, ensureCol('lead_status')).setValue(lead.leadStatus);
    if (lead.emailStatus) tab.getRange(targetRow, ensureCol('email_status')).setValue(lead.emailStatus);
    if (lead.leadPriority) tab.getRange(targetRow, ensureCol('lead_priority')).setValue(lead.leadPriority);
    if (lead.aiAnalysis) tab.getRange(targetRow, ensureCol('ai_analysis')).setValue(lead.aiAnalysis);
    if (lead.notes !== undefined) tab.getRange(targetRow, ensureCol('notes')).setValue(lead.notes);
    if (lead.followUpDate !== undefined) tab.getRange(targetRow, ensureCol('follow_up_date')).setValue(lead.followUpDate);
  }
}

function getSettingsFromDatabase() {
  const masterDb = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('DB_SHEET_ID'));
  const settingsSheet = getOrCreateSheet(masterDb, 'Settings');
  const lastRow = settingsSheet.getLastRow();
  const settings = {};
  
  if (lastRow > 1) {
    const data = settingsSheet.getRange(2, 1, lastRow - 1, 2).getValues();
    data.forEach(row => {
      if (row[0]) {
        try {
          settings[row[0]] = JSON.parse(row[1]);
        } catch(e) {
          settings[row[0]] = row[1];
        }
      }
    });
  }
  return settings;
}

function saveSettingsToDatabase(settings) {
  try {
    const masterDb = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('DB_SHEET_ID'));
    const settingsSheet = getOrCreateSheet(masterDb, 'Settings');
    
    if (settingsSheet.getLastRow() === 0) {
      settingsSheet.appendRow(['key', 'value']);
    }
    
    if (settingsSheet.getLastRow() > 1) {
      settingsSheet.getRange(2, 1, settingsSheet.getLastRow() - 1, 2).clearContent();
    }
    
    const rows = [];
    for (const [key, value] of Object.entries(settings)) {
      const valStr = typeof value === 'object' ? JSON.stringify(value) : value;
      rows.push([key, valStr]);
    }
    
    if (rows.length > 0) {
      settingsSheet.getRange(2, 1, rows.length, 2).setValues(rows);
    }
    return true;
  } catch (err) {
    Logger.log(err);
    return false;
  }
}
