/**
 * AppBackend.gs
 * 
 * Contains Configuration, WebApp Endpoints, Setup, Duplicate Check, Lead Scoring, and DB writing logic.
 * Enhanced with smartLeadAdd, fuzzy deduplication, and batch processing.
 */

// =================================================================================
// 1. CONFIGURATION
// =================================================================================
const CONFIG = {
  DB_SHEET_ID: PropertiesService.getScriptProperties().getProperty('DB_SHEET_ID') || '',
  LEAD_SHEET_ID: PropertiesService.getScriptProperties().getProperty('LEAD_SHEET_ID') || '',
  API_SECRET_KEY: PropertiesService.getScriptProperties().getProperty('API_SECRET_KEY') || 'nr-revibe-secure-key-2026',
  SENDER_EMAIL: PropertiesService.getScriptProperties().getProperty('SENDER_EMAIL') || Session.getEffectiveUser().getEmail(),
  
  DB_TABS: {
    RAW_LEADS: 'Raw_Leads', EMAIL_TEMPLATES: 'Email_Templates', EMAIL_LOG: 'Email_Log',
    BLACKLIST: 'Blacklist', SETTINGS: 'Settings', ACTIVITY_LOG: 'Activity_Log',
    CAMPAIGNS: 'Campaigns', DASHBOARD: 'Dashboard'
  },
  WORKSPACE_TABS: {
    ACTIVE_LEADS: 'Active_Leads', FOLLOWUPS_DUE: 'Followups_Due',
    REPLIED_LEADS: 'Replied_Leads', WON_CLIENTS: 'Won_Clients', QUICK_STATS: 'Quick_Stats'
  },
  EMAIL: { SEND_WINDOW_START_HOUR: 9, SEND_WINDOW_END_HOUR: 18, SKIP_WEEKENDS: true, MAX_FOLLOWUPS: 2 }
};

function getSettings() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('nr_rvibe_settings');
  if (cached) return JSON.parse(cached);
  try {
    const sheet = SpreadsheetApp.openById(CONFIG.DB_SHEET_ID).getSheetByName(CONFIG.DB_TABS.SETTINGS);
    const data = sheet.getDataRange().getValues();
    const settings = {};
    for (let i = 1; i < data.length; i++) if (data[i][0]) settings[data[i][0]] = data[i][1];
    cache.put('nr_rvibe_settings', JSON.stringify(settings), 3600);
    return settings;
  } catch (e) { return {}; }
}

// =================================================================================
// 2. SETUP SCRIPT
// =================================================================================
function runInitialSetup() {
  const masterDb = SpreadsheetApp.create("NRRvibe_Master_DB");
  let sheet = masterDb.insertSheet(CONFIG.DB_TABS.RAW_LEADS);
  sheet.appendRow(["ID", "Date", "Business_Name", "Category", "Phone", "Email", "Email_Source", "Website", "Address", "City", "State", "Country", "Rating", "Reviews", "Place_ID", "Instagram", "Facebook", "LinkedIn", "WhatsApp", "Web_Platform", "Web_Load_Time", "Web_Copyright", "Mobile_Responsive", "IG_Followers", "IG_Days_Inactive", "FB_Likes", "FB_Days_Inactive", "Lead_Score", "Pain_Points", "Top_Pain_Point", "Evidence", "Suggested_Service", "Status",
  // New columns for smart scraping
  "Data_Completeness", "Data_Sources", "Secondary_Emails", "Secondary_Phones", "Website_Quality", "Website_Description", "Services", "Founded_Year", "Team_Members", "Founder_Name", "Founder_LinkedIn", "FB_Followers", "FB_Overview", "FB_Established", "IG_Category", "IG_Is_Business", "Email_Confidence", "Scrape_Date"]);
  
  sheet = masterDb.insertSheet(CONFIG.DB_TABS.EMAIL_TEMPLATES);
  sheet.appendRow(["Template_ID", "Step", "Delay", "Subject", "HTML", "Plain"]);
  sheet.appendRow(["TPL001", "1", "0", "Quick question about {{business_name}}", "<p>Hi, noticed you don't have a website.</p>", "Hi, noticed you don't have a website."]);
  
  masterDb.insertSheet(CONFIG.DB_TABS.EMAIL_LOG).appendRow(["Timestamp", "Lead_ID", "Email", "Subject", "Thread_ID", "Replied", "Bounce"]);
  masterDb.insertSheet(CONFIG.DB_TABS.BLACKLIST).appendRow(["Email_Domain", "Reason", "Date"]);
  
  sheet = masterDb.insertSheet(CONFIG.DB_TABS.SETTINGS);
  sheet.appendRow(["Key", "Value"]);
  sheet.appendRow(["daily_email_limit", "100"]);
  sheet.appendRow(["sender_name", "NR Rvibe Team"]);
  
  masterDb.insertSheet(CONFIG.DB_TABS.ACTIVITY_LOG).appendRow(["Time", "Action", "Details"]);
  masterDb.insertSheet(CONFIG.DB_TABS.CAMPAIGNS).appendRow(["Campaign", "Keywords", "Leads"]);
  masterDb.insertSheet(CONFIG.DB_TABS.DASHBOARD).appendRow(["Metric", "Value"]);
  
  const workspaceDb = SpreadsheetApp.create("NRRvibe_Lead_Workspace");
  sheet = workspaceDb.insertSheet(CONFIG.WORKSPACE_TABS.ACTIVE_LEADS);
  sheet.appendRow(["Approve", "ID", "Score", "Business", "Email", "Email_Status", "Sent_Count", "Last_Contact", "Followup", "Top_Pain_Point", "Suggested_Service", "Phone", "Website", "Notes"]);
  sheet.getRange("A2:A1000").setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build());
  
  workspaceDb.insertSheet(CONFIG.WORKSPACE_TABS.FOLLOWUPS_DUE).appendRow(["Approve", "ID", "Score", "Business", "Email", "Email_Status", "Sent_Count", "Last_Contact", "Followup", "Top_Pain_Point", "Suggested_Service", "Phone", "Website", "Notes"]);
  workspaceDb.insertSheet(CONFIG.WORKSPACE_TABS.REPLIED_LEADS).appendRow(["Date", "Business", "Email", "Snippet", "Thread_Link", "Status"]);
  workspaceDb.insertSheet(CONFIG.WORKSPACE_TABS.WON_CLIENTS).appendRow(["Date", "Business", "Service", "Value"]);
  workspaceDb.insertSheet(CONFIG.WORKSPACE_TABS.QUICK_STATS).appendRow(["Stat", "Count"]);
  
  PropertiesService.getScriptProperties().setProperties({
    'DB_SHEET_ID': masterDb.getId(), 'LEAD_SHEET_ID': workspaceDb.getId()
  });
}

// =================================================================================
// 3. WEB APP ENDPOINTS
// =================================================================================
function doGet(e) {
  if (e.parameter.action === 'unsubscribe') return handleUnsubscribe(e);
  if (!authenticate(e)) return createError("Unauthorized", 401);
  
  if (e.parameter.action === 'ping') return createSuccess({status: "online"});
  if (e.parameter.action === 'get_leads') return getLeadsApi();
  if (e.parameter.action === 'get_settings') return getSettingsApi();
  
  return createError("Unknown", 400);
}

function doPost(e) {
  if (!authenticate(e)) return createError("Unauthorized", 401);
  
  let payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (err) {
    return createError("Invalid JSON", 400);
  }

  if (payload.action === 'saveLeads' || payload.action === 'sync_leads') return processIncomingLeads(payload.leads, payload.settings);
  if (payload.action === 'smart_lead_add') return smartLeadAdd(payload.lead, payload.settings);
  if (payload.action === 'batch_smart_add') return batchSmartAdd(payload.leads, payload.settings);
  if (payload.action === 'update_lead') return updateLeadApi(payload.lead);
  if (payload.action === 'delete_lead') return deleteLeadApi(payload.leadId);
  if (payload.action === 'save_settings') return saveSettingsApi(payload.settings);
  
  return createError("Unknown", 400);
}

function authenticate(e) {
  const k = e.parameter.apiKey || (e.postData && JSON.parse(e.postData.contents || '{}').apiKey);
  return k === CONFIG.API_SECRET_KEY;
}

function createSuccess(data) { return ContentService.createTextOutput(JSON.stringify(Object.assign({ success: true }, data))).setMimeType(ContentService.MimeType.JSON); }
function createError(msg, code) { return ContentService.createTextOutput(JSON.stringify({ success: false, error: msg, code: code })).setMimeType(ContentService.MimeType.JSON); }

// =================================================================================
// 3.5 API HANDLERS
// =================================================================================
function getLeadsApi() {
  try {
    // Read from DB_SHEET_ID instead of LEAD_SHEET_ID to get all historical leads
    const db = SpreadsheetApp.openById(CONFIG.DB_SHEET_ID);
    const sheet = db.getSheetByName(CONFIG.DB_TABS.RAW_LEADS) || db.getSheets()[0];
    const data = sheet.getDataRange().getValues();
    const leads = [];
    
    if (data.length <= 1) return createSuccess({ leads: [] });

    // Dynamically find columns in case the old spreadsheet has a different layout
    const headers = data[0].map(h => h.toString().toLowerCase().trim());
    const idx = {
      id: headers.indexOf('id'),
      business: headers.findIndex(h => h.includes('business') || h.includes('name')),
      email: headers.indexOf('email'),
      phone: headers.indexOf('phone'),
      website: headers.findIndex(h => h.includes('website') || h === 'web'),
      score: headers.findIndex(h => h.includes('score')),
      pain: headers.findIndex(h => h.includes('pain')),
      suggested: headers.findIndex(h => h.includes('suggested')),
      category: headers.findIndex(h => h.includes('category')),
      status: headers.findIndex(h => h === 'status' || h === 'email_status')
    };

    for (let i = 1; i < data.length; i++) {
      let r = data[i];
      if (!r[idx.id > -1 ? idx.id : 0]) continue; // Skip empty rows
      
      leads.push({
        id: r[idx.id > -1 ? idx.id : 0],
        businessName: r[idx.business > -1 ? idx.business : 2] || '',
        email: r[idx.email > -1 ? idx.email : 5] || '',
        phone: r[idx.phone > -1 ? idx.phone : 4] || '',
        websiteUrl: r[idx.website > -1 ? idx.website : 7] || '',
        leadScore: r[idx.score > -1 ? idx.score : 27] || 0,
        painPoint: r[idx.pain > -1 ? idx.pain : 28] || '',
        suggestedService: r[idx.suggested > -1 ? idx.suggested : 31] || '',
        emailStatus: r[idx.status > -1 ? idx.status : 32] || 'New',
        category: r[idx.category > -1 ? idx.category : 3] || ''
      });
    }
    return createSuccess({ leads: leads });
  } catch (e) {
    return createError(e.message, 500);
  }
}

function getSettingsApi() {
  return createSuccess({ settings: getSettings() });
}

function saveSettingsApi(settings) {
  try {
    const sheet = SpreadsheetApp.openById(CONFIG.DB_SHEET_ID).getSheetByName(CONFIG.DB_TABS.SETTINGS);
    // Overwrite existing settings
    sheet.clear();
    sheet.appendRow(["Key", "Value"]);
    for (let key in settings) {
      if (typeof settings[key] === 'object') {
        sheet.appendRow([key, JSON.stringify(settings[key])]);
      } else {
        sheet.appendRow([key, settings[key]]);
      }
    }
    CacheService.getScriptCache().remove('nr_rvibe_settings'); // flush cache
    return createSuccess({ saved: true });
  } catch (e) {
    return createError(e.message, 500);
  }
}

function updateLeadApi(leadObj) {
  if (!leadObj || !leadObj.id) return createError("Missing lead ID", 400);
  try {
    const db = SpreadsheetApp.openById(CONFIG.DB_SHEET_ID);
    const sheet = db.getSheetByName(CONFIG.DB_TABS.RAW_LEADS) || db.getSheets()[0];
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) return createError("Database is empty", 404);
    
    const headers = data[0].map(h => h.toString().toLowerCase().trim());
    const idIdx = headers.indexOf('id') > -1 ? headers.indexOf('id') : 0;
    
    const colIdx = {
      emailStatus: headers.findIndex(h => h === 'status' || h === 'email_status'),
      contactAttempts: headers.findIndex(h => h.includes('attempt')),
      lastContactDate: headers.findIndex(h => h.includes('last_contact')),
      followUpDate: headers.findIndex(h => h.includes('followup') || h.includes('follow_up')),
      customTags: headers.findIndex(h => h.includes('tags') || h.includes('notes'))
    };

    for (let i = 1; i < data.length; i++) {
      if (data[i][idIdx] === leadObj.id) {
        const row = i + 1; // Google Sheets is 1-indexed
        
        // Update specific columns if they exist in the spreadsheet
        if (leadObj.emailStatus !== undefined && colIdx.emailStatus > -1) {
          sheet.getRange(row, colIdx.emailStatus + 1).setValue(leadObj.emailStatus);
        }
        if (leadObj.contactAttempts !== undefined && colIdx.contactAttempts > -1) {
          sheet.getRange(row, colIdx.contactAttempts + 1).setValue(leadObj.contactAttempts);
        }
        if (leadObj.lastContactDate !== undefined && colIdx.lastContactDate > -1) {
          sheet.getRange(row, colIdx.lastContactDate + 1).setValue(leadObj.lastContactDate);
        }
        if (leadObj.followUpDate !== undefined && colIdx.followUpDate > -1) {
          sheet.getRange(row, colIdx.followUpDate + 1).setValue(leadObj.followUpDate);
        }
        if (leadObj.customTags !== undefined && colIdx.customTags > -1) {
          sheet.getRange(row, colIdx.customTags + 1).setValue(Array.isArray(leadObj.customTags) ? leadObj.customTags.join(',') : leadObj.customTags);
        }
        
        return createSuccess({ updated: true });
      }
    }
    return createError("Lead not found", 404);
  } catch (e) {
    return createError(e.message, 500);
  }
}

function deleteLeadApi(leadId) {
  if (!leadId) return createError("Missing lead ID", 400);
  try {
    const db = SpreadsheetApp.openById(CONFIG.DB_SHEET_ID);
    const sheet = db.getSheetByName(CONFIG.DB_TABS.RAW_LEADS) || db.getSheets()[0];
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) return createError("Database is empty", 404);
    
    const headers = data[0].map(h => h.toString().toLowerCase().trim());
    const idIdx = headers.indexOf('id') > -1 ? headers.indexOf('id') : 0;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][idIdx] === leadId) {
        sheet.deleteRow(i + 1);
        return createSuccess({ deleted: true });
      }
    }
    return createError("Lead not found", 404);
  } catch (e) {
    return createError(e.message, 500);
  }
}

// =================================================================================
// 4. LEAD DB INSERTS & DUPLICATE CHECK & SCORING
// =================================================================================
function processIncomingLeads(leads, settings) {
  try {
    const mDb = SpreadsheetApp.openById(CONFIG.DB_SHEET_ID);
    const rawSheet = mDb.getSheetByName(CONFIG.DB_TABS.RAW_LEADS);
    const wDb = SpreadsheetApp.openById(CONFIG.LEAD_SHEET_ID);
    const actSheet = wDb.getSheetByName(CONFIG.WORKSPACE_TABS.ACTIVE_LEADS);
    
    if (!rawSheet || !actSheet) {
      return createError("Database sheets not found. Please run runInitialSetup() first.", 500);
    }
    
    const cache = buildDuplicateCache(rawSheet);
    const rawRows = [], actRows = [];
    const mergeSettings = settings || {};
    let merged = 0;
    
    leads.forEach(lead => {
      // Enhanced duplicate check with fuzzy matching
      const dupResult = checkDuplicate(lead, cache, rawSheet, mergeSettings);
      
      if (dupResult.isDuplicate) {
        if (dupResult.action === 'merge' && dupResult.rowIndex) {
          // Merge new data into existing record
          mergeIntoExisting(rawSheet, dupResult.rowIndex, lead);
          merged++;
        }
        // Skip if action is 'skip'
        return;
      }
      
      const score = scoreLeadEnhanced(lead);
      const rawRow = buildRawRow(lead, score);
      rawRows.push(rawRow);
      
      if (score.score >= 35 && lead.email && lead.email !== 'N/A' && !isBlacklisted(lead.email)) {
        const combinedEmail = lead.email + (lead.secondaryEmails ? ', ' + lead.secondaryEmails : '');
        const combinedPhone = lead.phone + (lead.secondaryPhones ? ', ' + lead.secondaryPhones : '');
        actRows.push([false, rawRow[0], score.score, lead.businessName, combinedEmail, "Not Sent", 0, "", "", score.painPoints[0] || '', score.suggested, combinedPhone, lead.websiteUrl, ""]);
      }
      
      if (lead.phone) cache.phones.add(normalizePhone(lead.phone));
      if (lead.email && lead.email !== 'N/A') cache.emails.add(lead.email.toLowerCase());
      if (lead.businessName) cache.names.add(normalizeName(lead.businessName));
      if (lead.websiteUrl) { const d = extractDomain(lead.websiteUrl); if (d) cache.websites.add(d); }
    });
    
    if (rawRows.length > 0) rawSheet.getRange(rawSheet.getLastRow() + 1, 1, rawRows.length, rawRows[0].length).setValues(rawRows);
    if (actRows.length > 0) actSheet.getRange(actSheet.getLastRow() + 1, 1, actRows.length, actRows[0].length).setValues(actRows);
    
    // Log activity
    logActivity('SYNC', `Added ${rawRows.length}, merged ${merged}, skipped ${leads.length - rawRows.length - merged} duplicates`);
    
    return createSuccess({ added: rawRows.length, merged: merged, duplicatesSkipped: leads.length - rawRows.length - merged });
  } catch (e) {
    return createError("Spreadsheet error: " + e.message + ". Did you run setup?", 500);
  }
}

// =================================================================================
// 5. SMART LEAD ADD (Single lead with full enriched data)
// =================================================================================
function smartLeadAdd(lead, settings) {
  if (!lead) return createError("Missing lead data", 400);
  
  try {
    const mDb = SpreadsheetApp.openById(CONFIG.DB_SHEET_ID);
    const rawSheet = mDb.getSheetByName(CONFIG.DB_TABS.RAW_LEADS);
    const cache = buildDuplicateCache(rawSheet);
    
    const dupResult = checkDuplicate(lead, cache, rawSheet, settings || {});
    
    if (dupResult.isDuplicate) {
      if (dupResult.action === 'merge' && dupResult.rowIndex) {
        mergeIntoExisting(rawSheet, dupResult.rowIndex, lead);
        logActivity('SMART_MERGE', `Merged enriched data into ${lead.businessName}`);
        return createSuccess({ action: 'merged', matchConfidence: dupResult.confidence });
      }
      logActivity('SMART_SKIP', `Skipped duplicate: ${lead.businessName}`);
      return createSuccess({ action: 'skipped', matchConfidence: dupResult.confidence });
    }
    
    // New lead
    const score = scoreLeadEnhanced(lead);
    const rawRow = buildRawRow(lead, score);
    rawSheet.appendRow(rawRow);
    
    // Add to workspace if qualified
    if (score.score >= 35 && lead.email && lead.email !== 'N/A' && !isBlacklisted(lead.email)) {
      const wDb = SpreadsheetApp.openById(CONFIG.LEAD_SHEET_ID);
      const actSheet = wDb.getSheetByName(CONFIG.WORKSPACE_TABS.ACTIVE_LEADS);
      const combinedEmail = lead.email + (lead.secondaryEmails ? ', ' + lead.secondaryEmails : '');
      const combinedPhone = lead.phone + (lead.secondaryPhones ? ', ' + lead.secondaryPhones : '');
      actSheet.appendRow([false, rawRow[0], score.score, lead.businessName, combinedEmail, "Not Sent", 0, "", "", score.painPoints[0] || '', score.suggested, combinedPhone, lead.websiteUrl, ""]);
    }
    
    logActivity('SMART_ADD', `Added new enriched lead: ${lead.businessName} (score: ${score.score})`);
    return createSuccess({ action: 'added', score: score.score });
  } catch (e) {
    return createError(e.message, 500);
  }
}

// =================================================================================
// 5.5 BATCH SMART ADD (Multiple leads at once)
// =================================================================================
function batchSmartAdd(leads, settings) {
  if (!leads || !Array.isArray(leads)) return createError("Missing leads array", 400);
  
  try {
    const results = { added: 0, merged: 0, skipped: 0, errors: 0 };
    
    const mDb = SpreadsheetApp.openById(CONFIG.DB_SHEET_ID);
    const rawSheet = mDb.getSheetByName(CONFIG.DB_TABS.RAW_LEADS);
    const wDb = SpreadsheetApp.openById(CONFIG.LEAD_SHEET_ID);
    const actSheet = wDb.getSheetByName(CONFIG.WORKSPACE_TABS.ACTIVE_LEADS);
    const cache = buildDuplicateCache(rawSheet);
    
    const rawRows = [], actRows = [];
    
    leads.forEach(lead => {
      try {
        const dupResult = checkDuplicate(lead, cache, rawSheet, settings || {});
        
        if (dupResult.isDuplicate) {
          if (dupResult.action === 'merge' && dupResult.rowIndex) {
            mergeIntoExisting(rawSheet, dupResult.rowIndex, lead);
            results.merged++;
          } else {
            results.skipped++;
          }
          return;
        }
        
        const score = scoreLeadEnhanced(lead);
        const rawRow = buildRawRow(lead, score);
        rawRows.push(rawRow);
        
        if (score.score >= 35 && lead.email && lead.email !== 'N/A' && !isBlacklisted(lead.email)) {
          const combinedEmail = lead.email + (lead.secondaryEmails ? ', ' + lead.secondaryEmails : '');
          const combinedPhone = lead.phone + (lead.secondaryPhones ? ', ' + lead.secondaryPhones : '');
          actRows.push([false, rawRow[0], score.score, lead.businessName, combinedEmail, "Not Sent", 0, "", "", score.painPoints[0] || '', score.suggested, combinedPhone, lead.websiteUrl, ""]);
        }
        
        // Update cache
        if (lead.phone) cache.phones.add(normalizePhone(lead.phone));
        if (lead.email && lead.email !== 'N/A') cache.emails.add(lead.email.toLowerCase());
        if (lead.businessName) cache.names.add(normalizeName(lead.businessName));
        if (lead.websiteUrl) { const d = extractDomain(lead.websiteUrl); if (d) cache.websites.add(d); }
        
        results.added++;
      } catch (err) {
        results.errors++;
      }
    });
    
    if (rawRows.length > 0) rawSheet.getRange(rawSheet.getLastRow() + 1, 1, rawRows.length, rawRows[0].length).setValues(rawRows);
    if (actRows.length > 0) actSheet.getRange(actSheet.getLastRow() + 1, 1, actRows.length, actRows[0].length).setValues(actRows);
    
    logActivity('BATCH_SMART_ADD', `Added ${results.added}, merged ${results.merged}, skipped ${results.skipped}, errors ${results.errors}`);
    
    return createSuccess(results);
  } catch (e) {
    return createError(e.message, 500);
  }
}

// =================================================================================
// 6. ENHANCED DUPLICATE CHECK (Fuzzy matching)
// =================================================================================
function buildDuplicateCache(rawSheet) {
  const c = { phones: new Set(), emails: new Set(), names: new Set(), websites: new Set(), namesList: [] };
  if (rawSheet.getLastRow() <= 1) return c;
  
  // Fetch up to 8 columns: ID, Date, Name, Category, Phone, Email, Source, Website
  const data = rawSheet.getRange(2, 1, rawSheet.getLastRow() - 1, 8).getValues();
  data.forEach((r, idx) => {
    const name = normalizeName(r[2]);
    if (name) {
      c.names.add(name);
      c.namesList.push({ name: name, rowIndex: idx + 2 }); // 1-indexed + header
    }
    if (r[4] && r[4] !== 'N/A') c.phones.add(normalizePhone(r[4]));
    if (r[5] && r[5] !== 'N/A') c.emails.add(r[5].toString().toLowerCase().trim());
    if (r[7]) {
      const domain = extractDomain(r[7]);
      if (domain) c.websites.add(domain);
    }
  });
  return c;
}

/**
 * Enhanced duplicate check with confidence scoring.
 * Returns { isDuplicate, confidence, action, rowIndex }
 *   confidence: 0-100 (how sure we are it's a duplicate)
 *   action: 'skip' | 'merge' | null
 *   rowIndex: row to merge into (if merge)
 */
function checkDuplicate(lead, cache, rawSheet, settings) {
  if (settings && settings.skipDuplicates === false) {
    return { isDuplicate: false, confidence: 0, action: null, rowIndex: null };
  }

  const p = normalizePhone(lead.phone);
  const e = (lead.email && lead.email !== 'N/A') ? lead.email.toString().toLowerCase().trim() : '';
  const n = normalizeName(lead.businessName);
  const w = extractDomain(lead.websiteUrl);
  
  let matches = 0;
  let matchedRow = null;
  let confidence = 0;
  
  // ── Exact phone match (strong signal) ──
  if (p && cache.phones.has(p)) {
    matches++;
    confidence += 40;
    if (!matchedRow) matchedRow = findRowByField(rawSheet, 4, lead.phone);
  }
  
  // ── Exact email match (strong signal) ──
  if (e && cache.emails.has(e)) {
    matches++;
    confidence += 40;
    if (!matchedRow) matchedRow = findRowByField(rawSheet, 5, lead.email);
  }
  
  // ── Domain match (medium signal) ──
  if (w && cache.websites.has(w)) {
    matches++;
    confidence += 30;
    if (!matchedRow) matchedRow = findRowByDomain(rawSheet, 7, w);
  }
  
  // ── Fuzzy name match (with Levenshtein) ──
  if (n) {
    // Exact match
    if (cache.names.has(n)) {
      matches++;
      confidence += 25;
      if (!matchedRow) {
        const found = cache.namesList.find(item => item.name === n);
        if (found) matchedRow = found.rowIndex;
      }
    } else {
      // Fuzzy match (>80% similarity)
      for (const item of cache.namesList) {
        const similarity = fuzzyNameSimilarity(n, item.name);
        if (similarity >= 80) {
          matches++;
          confidence += Math.round(similarity * 0.25);
          if (!matchedRow) matchedRow = item.rowIndex;
          break;
        }
      }
    }
  }
  
  // ── Decision tree ──
  confidence = Math.min(confidence, 100);
  
  // HIGH confidence duplicate (2+ matches) — skip
  if (matches >= 2 && confidence >= 50) {
    const mergeEnabled = settings.mergeExisting !== false;
    return {
      isDuplicate: true,
      confidence,
      action: mergeEnabled ? 'merge' : 'skip',
      rowIndex: matchedRow,
    };
  }
  
  // MEDIUM confidence (1 match, phone or email) — merge
  if (matches === 1 && confidence >= 35) {
    const updateEnabled = settings.updateExisting !== false;
    return {
      isDuplicate: true,
      confidence,
      action: updateEnabled ? 'merge' : 'skip',
      rowIndex: matchedRow,
    };
  }
  
  // Name-only match with no other signals — treat as new to avoid false positives
  if (matches === 1 && confidence < 35) {
    return { isDuplicate: false, confidence, action: null, rowIndex: null };
  }
  
  // No match — new lead
  return { isDuplicate: false, confidence: 0, action: null, rowIndex: null };
}

// =================================================================================
// 7. MERGE INTO EXISTING ROW
// =================================================================================
function mergeIntoExisting(sheet, rowIndex, newLead) {
  try {
    const existingRow = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => h.toString().toLowerCase().trim());
    
    // Find column indices
    const colMap = {};
    headers.forEach((h, i) => { colMap[h] = i; });
    
    // Only update fields that are empty in existing but present in new
    const fieldsToMerge = [
      { header: 'email', value: newLead.email, skip: ['N/A', ''] },
      { header: 'phone', value: newLead.phone, skip: ['N/A', ''] },
      { header: 'instagram', value: newLead.instagramUrl, skip: [''] },
      { header: 'facebook', value: newLead.facebookUrl, skip: [''] },
      { header: 'linkedin', value: newLead.linkedinUrl, skip: [''] },
      { header: 'whatsapp', value: newLead.whatsappUrl, skip: [''] },
      { header: 'web_platform', value: newLead.websiteTechnology, skip: ['', 'Custom / Unknown'] },
      { header: 'ig_followers', value: newLead.igFollowers, skip: [0, '', null] },
      { header: 'ig_days_inactive', value: newLead.igDaysInactive, skip: [null, ''] },
      { header: 'fb_likes', value: newLead.fbLikes, skip: [0, '', null] },
      { header: 'fb_days_inactive', value: newLead.fbDaysInactive, skip: [null, ''] },
      { header: 'email_source', value: newLead.emailSource, skip: [''] },
      { header: 'address', value: newLead.address, skip: ['', 'N/A'] },
      // New enhanced fields
      { header: 'data_completeness', value: newLead.dataCompleteness, skip: [0, '', null] },
      { header: 'data_sources', value: newLead.dataSources, skip: [''] },
      { header: 'secondary_emails', value: newLead.secondaryEmails, skip: [''] },
      { header: 'secondary_phones', value: newLead.secondaryPhones, skip: [''] },
      { header: 'website_quality', value: newLead.websiteQuality, skip: ['', 'N/A'] },
      { header: 'website_description', value: newLead.websiteDescription || newLead.businessDescription, skip: [''] },
      { header: 'services', value: newLead.services, skip: [''] },
      { header: 'founded_year', value: newLead.foundedYear || newLead.fbEstablishedYear, skip: [null, ''] },
      { header: 'team_members', value: newLead.teamMembers, skip: [''] },
      { header: 'founder_name', value: newLead.founderName, skip: [''] },
      { header: 'founder_linkedin', value: newLead.founderLinkedin, skip: [''] },
      { header: 'fb_followers', value: newLead.fbFollowers, skip: [0, '', null] },
      { header: 'fb_overview', value: newLead.fbOverview, skip: [''] },
      { header: 'ig_category', value: newLead.igCategory, skip: [''] },
      { header: 'email_confidence', value: newLead.emailConfidenceScore, skip: [0, null, ''] },
    ];
    
    fieldsToMerge.forEach(({ header, value, skip }) => {
      if (value === undefined || value === null) return;
      if (skip && skip.includes(value)) return;
      
      const colIdx = colMap[header];
      if (colIdx === undefined) return;
      
      const existing = existingRow[colIdx];
      // Only update if existing is empty or N/A
      if (!existing || existing === '' || existing === 'N/A' || existing === 0) {
        sheet.getRange(rowIndex, colIdx + 1).setValue(value);
      }
    });
    
    // Always update lead score if new score is higher
    const scoreIdx = colMap['lead_score'];
    if (scoreIdx !== undefined && newLead.leadScore) {
      const existingScore = existingRow[scoreIdx] || 0;
      if (newLead.leadScore > existingScore) {
        sheet.getRange(rowIndex, scoreIdx + 1).setValue(newLead.leadScore);
      }
    }
    
    // Update status to reflect merge
    const statusIdx = colMap['status'];
    if (statusIdx !== undefined) {
      sheet.getRange(rowIndex, statusIdx + 1).setValue('Enriched');
    }
    
  } catch (e) {
    console.error('Merge error:', e.message);
  }
}

// =================================================================================
// 8. ENHANCED LEAD SCORING
// =================================================================================
function scoreLeadEnhanced(lead) {
  let score = 0;
  const pp = [];
  
  // ── Website scoring ──
  if (!lead.websiteUrl || lead.websiteUrl === 'N/A') {
    score += 30;
    pp.push("No website");
  } else {
    if (lead.mobileFriendly === false) { score += 15; pp.push("Not mobile friendly"); }
    if (lead.https === false) { score += 10; pp.push("No HTTPS"); }
    if (lead.hasContactForm === false) { score += 5; pp.push("No contact form"); }
    if (lead.copyrightYear && lead.copyrightYear < new Date().getFullYear() - 2) {
      score += 10;
      pp.push("Outdated website (" + lead.copyrightYear + ")");
    }
    if (lead.websiteQuality === 'Poor') { score += 5; pp.push("Poor website quality"); }
  }
  
  // ── Social scoring ──
  if (!lead.instagramUrl) { score += 10; pp.push("No Instagram"); }
  else if (lead.igDaysInactive > 60) { score += 8; pp.push("Inactive IG (" + lead.igDaysInactive + " days)"); }
  
  if (!lead.facebookUrl) { score += 5; pp.push("No Facebook"); }
  else if (lead.fbDaysInactive > 60) { score += 5; pp.push("Inactive FB (" + lead.fbDaysInactive + " days)"); }
  
  // ── Contact info (boost for reachable leads) ──
  if (lead.email && lead.email !== 'N/A') score += 15;
  else score -= 15;
  
  if (lead.phone && lead.phone !== 'N/A') score += 5;
  else score -= 5;
  
  // ── Reputation ──
  if (lead.rating >= 4.5) score += 5;
  else if (lead.rating >= 4.0) score += 3;
  if (lead.reviewCount >= 100) score += 5;
  else if (lead.reviewCount >= 50) score += 3;
  
  // ── Data completeness bonus ──
  const completeness = lead.dataCompleteness || 0;
  if (completeness >= 80) score += 10;
  else if (completeness >= 60) score += 5;
  
  score = Math.min(Math.max(score, 0), 100);
  
  // Determine suggested service
  let suggested = "Digital Upgrade";
  if (!lead.websiteUrl || lead.websiteUrl === 'N/A') suggested = "New Website Development";
  else if (lead.mobileFriendly === false || lead.https === false) suggested = "Website Redesign";
  else if (!lead.instagramUrl || lead.igDaysInactive > 60) suggested = "Social Media Management";
  else if (lead.copyrightYear && lead.copyrightYear < new Date().getFullYear() - 2) suggested = "Website Modernization";
  else suggested = "SEO & Growth Package";
  
  return {
    score: score,
    painPoints: pp,
    evidence: buildEvidence(lead),
    suggested: suggested,
  };
}

function buildEvidence(lead) {
  const parts = [];
  if (lead.email && lead.email !== 'N/A') parts.push('Email: ' + lead.email);
  if (lead.emailSource) parts.push('Source: ' + lead.emailSource);
  if (lead.dataSources) parts.push('Scraped: ' + lead.dataSources);
  if (lead.dataCompleteness) parts.push('Completeness: ' + lead.dataCompleteness + '%');
  return parts.join(' | ');
}

// =================================================================================
// 9. ROW BUILDER
// =================================================================================
function buildRawRow(lead, score) {
  return [
    lead.id || Utilities.getUuid(),
    new Date().toISOString(),
    lead.businessName,
    lead.category,
    lead.phone + (lead.secondaryPhones ? ', ' + lead.secondaryPhones : ''),
    lead.email + (lead.secondaryEmails ? ', ' + lead.secondaryEmails : ''),
    lead.emailSource || '',
    lead.websiteUrl,
    lead.address,
    lead.city,
    lead.state,
    lead.country,
    lead.rating,
    lead.reviewCount,
    lead.placeId,
    lead.instagramUrl,
    lead.facebookUrl,
    lead.linkedinUrl,
    lead.whatsappUrl,
    lead.websitePlatform || lead.websiteTechnology,
    lead.loadTime || lead.webLoadTime,
    lead.copyrightYear,
    lead.mobileFriendly,
    lead.igFollowers,
    lead.igDaysInactive,
    lead.fbLikes,
    lead.fbDaysInactive,
    score.score,
    score.painPoints.join("<li>"),
    score.painPoints[0] || '',
    score.evidence,
    score.suggested,
    lead.harvestStatus || 'Partial',
    // New smart scraping columns
    lead.dataCompleteness || 0,
    lead.dataSources || '',
    lead.secondaryEmails || '',
    lead.secondaryPhones || '',
    lead.websiteQuality || '',
    lead.websiteDescription || lead.businessDescription || '',
    lead.services || '',
    lead.foundedYear || lead.fbEstablishedYear || '',
    lead.teamMembers || '',
    lead.founderName || '',
    lead.founderLinkedin || '',
    lead.fbFollowers || 0,
    lead.fbOverview || '',
    lead.fbEstablishedYear || '',
    lead.igCategory || '',
    lead.igIsBusiness || false,
    lead.emailConfidenceScore || 0,
    lead.scrapeDate || new Date().toISOString().split('T')[0],
  ];
}

// =================================================================================
// 10. HELPER FUNCTIONS
// =================================================================================

function normalizePhone(phone) {
  if (!phone || phone === 'N/A') return '';
  let digits = phone.toString().replace(/\D/g, '');
  if (digits.startsWith('0')) digits = digits.substring(1);
  if (digits.startsWith('91') && digits.length > 10) digits = digits.substring(2);
  return digits.slice(-10);
}

function normalizeName(name) {
  if (!name) return '';
  return name.toString().toLowerCase().replace(/[^\w\s]/g, '').trim();
}

function extractDomain(url) {
  if (!url || url === 'N/A') return '';
  try {
    let domain = url.toString().toLowerCase().replace('www.', '');
    if (domain.includes('//')) domain = domain.split('//')[1];
    if (domain.includes('/')) domain = domain.split('/')[0];
    if (domain.includes('?')) domain = domain.split('?')[0];
    return domain;
  } catch (e) { return ''; }
}

function fuzzyNameSimilarity(name1, name2) {
  if (!name1 || !name2) return 0;
  if (name1 === name2) return 100;
  if (name1.includes(name2) || name2.includes(name1)) return 85;
  
  // Levenshtein distance
  const maxLen = Math.max(name1.length, name2.length);
  if (maxLen === 0) return 100;
  const dist = levenshteinDist(name1, name2);
  return Math.round((1 - dist / maxLen) * 100);
}

function levenshteinDist(s, t) {
  const m = s.length, n = t.length;
  const d = [];
  for (let i = 0; i <= m; i++) { d[i] = [i]; }
  for (let j = 0; j <= n; j++) { d[0][j] = j; }
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }
  return d[m][n];
}

function findRowByField(sheet, colIndex, value) {
  if (!value || value === 'N/A') return null;
  try {
    const data = sheet.getRange(2, colIndex + 1, sheet.getLastRow() - 1, 1).getValues();
    const normalized = value.toString().toLowerCase().trim();
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString().toLowerCase().trim() === normalized) {
        return i + 2;
      }
    }
  } catch (e) {}
  return null;
}

function findRowByDomain(sheet, colIndex, domain) {
  if (!domain) return null;
  try {
    const data = sheet.getRange(2, colIndex + 1, sheet.getLastRow() - 1, 1).getValues();
    for (let i = 0; i < data.length; i++) {
      if (data[i][0]) {
        const existingDomain = extractDomain(data[i][0].toString());
        if (existingDomain === domain) return i + 2;
      }
    }
  } catch (e) {}
  return null;
}

function logActivity(action, details) {
  try {
    const db = SpreadsheetApp.openById(CONFIG.DB_SHEET_ID);
    const logSheet = db.getSheetByName(CONFIG.DB_TABS.ACTIVITY_LOG);
    if (logSheet) {
      logSheet.appendRow([new Date().toISOString(), action, details]);
    }
  } catch (e) {
    // Silently fail — logging shouldn't break the main flow
  }
}


