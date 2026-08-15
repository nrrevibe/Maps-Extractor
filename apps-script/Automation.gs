/**
 * Automation.gs
 * 
 * Contains EmailService, FollowupService, Blacklist, Triggers, Reply tracking.
 */

// =================================================================================
// 1. EMAIL AUTOMATION
// =================================================================================
function sendApprovedBatch() {
  const s = getSettings();
  if (s.auto_send_enabled !== 'true') return;
  
  const h = new Date().getHours();
  if (h < parseInt(s.send_window_start||9) || h >= parseInt(s.send_window_end||18)) return;
  
  const wDb = SpreadsheetApp.openById(CONFIG.LEAD_SHEET_ID);
  const actSheet = wDb.getSheetByName(CONFIG.WORKSPACE_TABS.ACTIVE_LEADS);
  const data = actSheet.getDataRange().getValues();
  if (data.length <= 1) return;
  
  const col = { app: 0, id: 1, email: 4, stat: 5, sc: 6, lc: 7, fup: 8 };
  let sent = 0;
  
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (r[col.app] === true && r[col.stat] !== "Sent") {
      if (!r[col.email]) {
        actSheet.getRange(i+1, col.stat+1).setValue("Invalid");
        actSheet.getRange(i+1, col.app+1).setValue(false);
        continue;
      }

      // Handle multiple comma-separated emails
      const emails = r[col.email].toString().split(',').map(e => e.trim()).filter(e => e);
      const validEmails = emails.filter(e => !isBlacklisted(e));

      if (validEmails.length === 0) {
        actSheet.getRange(i+1, col.stat+1).setValue("Blacklisted");
        actSheet.getRange(i+1, col.app+1).setValue(false);
        continue;
      }
      
      try {
        GmailApp.sendEmail(validEmails.join(','), "Quick Question", "Hi,\nI noticed you don't have a website.", {
          htmlBody: "<p>Hi,</p><p>I noticed you don't have a website.</p>",
          name: s.sender_name || "NR Rvibe",
          replyTo: s.sender_email
        });
        
        actSheet.getRange(i+1, col.stat+1).setValue("Sent");
        actSheet.getRange(i+1, col.app+1).setValue(false);
        actSheet.getRange(i+1, col.sc+1).setValue(1);
        actSheet.getRange(i+1, col.lc+1).setValue(new Date().toISOString());
        
        sent++;
        if (sent >= 30) break;
      } catch (e) {
        actSheet.getRange(i+1, col.stat+1).setValue("Error");
      }
    }
  }
}

// =================================================================================
// 2. BLACKLIST & REPLY TRACKER
// =================================================================================
function isBlacklisted(email) {
  if (!email) return false;
  const mDb = SpreadsheetApp.openById(CONFIG.DB_SHEET_ID);
  const sheet = mDb.getSheetByName(CONFIG.DB_TABS.BLACKLIST);
  const data = sheet.getDataRange().getValues();
  for (let i=1; i<data.length; i++) {
    if (data[i][0] && data[i][0].toString().toLowerCase() === email.toLowerCase()) return true;
  }
  return false;
}

function handleUnsubscribe(e) {
  const email = e.parameter.email;
  if (email) {
    SpreadsheetApp.openById(CONFIG.DB_SHEET_ID).getSheetByName(CONFIG.DB_TABS.BLACKLIST).appendRow([email, "Unsubscribed", new Date().toISOString()]);
    return HtmlService.createHtmlOutput("<h2>Unsubscribed.</h2>");
  }
  return HtmlService.createHtmlOutput("<h2>Error.</h2>");
}

// =================================================================================
// 3. TRIGGERS & MENU
// =================================================================================
function createAllTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sendApprovedBatch').timeBased().everyHours(1).create();
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('NR Rvibe')
    .addItem('Send Approved Emails Now', 'sendApprovedBatch')
    .addItem('Setup Triggers', 'createAllTriggers')
    .addToUi();
}
