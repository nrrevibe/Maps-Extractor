# Google Maps to Google Sheets Lead Generation Extension

## For NR Rvibe – Website Development & Social Media Management

### Version 2.0 – With Google Apps Script Backend & Two-Sheet System

---

# 1. Project Overview

NR Rvibe ke liye ek Chrome Extension banaya jayega jo Google Maps se local business leads collect karega, data ko **Google Apps Script Web App** ke through Google Sheets mein save karega, website aur social media analysis karega, aur approved leads ko automatically personalized email bhejega.

Is version mein **backend server ki zarurat nahi** hai. Sara backend kaam **Google Apps Script** karega.

### Main Services

- Website Development
- Website Redesign
- Landing Page Development
- Social Media Management
- Social Media Content Creation
- Local SEO
- Google Business Profile Optimization
- Branding and Digital Marketing

---

# 2. Why Google Apps Script

Google Apps Script use karne ke fayde:

- Free hosting, koi server cost nahi
- Google Sheets ke saath direct native access
- Gmail se email sending built-in (MailApp / GmailApp)
- Time-based triggers se automatic follow-up
- OAuth complexity kam
- Chrome Extension se simple HTTP POST/GET requests
- Data ownership user ke apne Google account mein

### Limitations Jo Dhyan Rakhni Hain

```text
Gmail daily send limit: 100 emails (free), 1500 (Workspace)
Script execution time: 6 minutes per run
UrlFetch calls: 20,000 per day
Trigger runtime: 90 minutes per day (free)
Sheet max cells: 10 million
```

Isliye batch processing aur queue system design karna zaroori hai.

---

# 3. Two-Sheet Architecture

System mein **do alag Google Spreadsheets** use honge.

## Sheet 1: MASTER DATABASE (DB Sheet)

**Purpose:** Sara raw data, system data, logs, templates, settings, blacklist aur historical records yahan store honge. Ye sheet system-controlled hai, user isko rozana touch nahi karega.

**Spreadsheet Name:** `NRRvibe_Master_DB`

**Access:** Sirf admin/owner. Extension write karega, user manually edit nahi karega.

## Sheet 2: LEAD WORKSPACE (Lead Sheet)

**Purpose:** Clean, filtered, sales-ready leads. Ye sheet team ke liye hai. Yahan se leads review, approve aur email send hoti hain.

**Spreadsheet Name:** `NRRvibe_Lead_Workspace`

**Access:** Sales team, VA, ya agency staff. Editable hai.

---

## 3.1 Data Flow Between Two Sheets

```text
Chrome Extension
       ↓ (POST request)
Apps Script Web App (doPost)
       ↓
DB SHEET → Raw_Leads tab (sab kuch save)
       ↓
Duplicate check + Validation + Lead Scoring
       ↓
Agar lead qualified hai (score >= threshold)
       ↓
LEAD SHEET → Active_Leads tab (clean data push)
       ↓
User review kare aur "Approve" mark kare
       ↓
Apps Script Trigger email send kare
       ↓
Status update dono sheets mein sync ho
       ↓
DB SHEET → Email_Log tab (permanent record)
```

## 3.2 Why Two Sheets Instead of One

| Reason         | Explanation                                                        |
| -------------- | ------------------------------------------------------------------ |
| Performance    | DB sheet mein hazaron rows hongi, lead sheet light aur fast rahegi |
| Safety         | Team accidentally raw data delete nahi kar sakti                   |
| Clean UI       | Sales team ko sirf zaroori columns dikhenge                        |
| History        | DB mein rejected/duplicate leads bhi safe rahenge                  |
| Multi-campaign | Ek DB se multiple lead sheets banayi ja sakti hain                 |
| Backup         | DB sheet permanent archive ka kaam karegi                          |
| Client sharing | Lead sheet client ke saath share ki ja sakti hai, DB nahi          |

---

# 4. DB SHEET Structure (NRRvibe_Master_DB)

Is spreadsheet mein 8 tabs honge.

---

## Tab 1: `Raw_Leads`

Google Maps se aane wala har lead, chahe qualified ho ya na ho.

| Column | Field Name          | Description                      |
| ------ | ------------------- | -------------------------------- |
| A      | raw_id              | Auto ID – RAW00001               |
| B      | timestamp           | Collection date and time         |
| C      | business_name       | Business ka naam                 |
| D      | category            | Business category                |
| E      | maps_url            | Google Maps link                 |
| F      | place_id            | Google Place ID                  |
| G      | website_url         | Website link                     |
| H      | phone               | Phone number                     |
| I      | email               | Email address                    |
| J      | address             | Full address                     |
| K      | city                | City                             |
| L      | state               | State                            |
| M      | country             | Country                          |
| N      | postal_code         | Postal code                      |
| O      | latitude            | Latitude                         |
| P      | longitude           | Longitude                        |
| Q      | rating              | Google rating                    |
| R      | review_count        | Total reviews                    |
| S      | business_hours      | Opening hours                    |
| T      | business_status     | Open, Closed, Temporarily Closed |
| U      | instagram_url       | Instagram link                   |
| V      | facebook_url        | Facebook link                    |
| W      | linkedin_url        | LinkedIn link                    |
| X      | tiktok_url          | TikTok link                      |
| Y      | youtube_url         | YouTube link                     |
| Z      | whatsapp            | WhatsApp number                  |
| AA     | website_status      | Active, Broken, Missing          |
| AB     | website_tech        | WordPress, Wix, Custom           |
| AC     | https_enabled       | Yes/No                           |
| AD     | mobile_friendly     | Yes/No/Unknown                   |
| AE     | has_contact_form    | Yes/No                           |
| AF     | has_booking         | Yes/No                           |
| AG     | page_load_time      | Seconds                          |
| AH     | search_keyword      | Jis keyword se mila              |
| AI     | search_location     | Search location                  |
| AJ     | collected_by        | User email                       |
| AK     | lead_score          | 0–100                            |
| AL     | opportunity_type    | Website, Social, Both            |
| AM     | duplicate_flag      | Yes/No                           |
| AN     | duplicate_of        | Existing raw_id                  |
| AO     | validation_status   | Valid, Invalid, Needs Review     |
| AP     | pushed_to_leadsheet | Yes/No                           |
| AQ     | lead_sheet_row_id   | Lead sheet ka ID                 |
| AR     | raw_json            | Complete JSON backup             |

---

## Tab 2: `Email_Templates`

| Column | Field Name    | Description                             |
| ------ | ------------- | --------------------------------------- |
| A      | template_id   | TPL001                                  |
| B      | template_name | Website Missing Outreach                |
| C      | category      | Website / Social / Combined / Follow-up |
| D      | subject_line  | Subject with variables                  |
| E      | body_html     | HTML email body                         |
| F      | body_plain    | Plain text version                      |
| G      | sequence_step | 1, 2, 3                                 |
| H      | delay_days    | Follow-up delay                         |
| I      | active        | Yes/No                                  |
| J      | usage_count   | Kitni baar use hua                      |
| K      | reply_rate    | Performance metric                      |
| L      | created_date  | Date                                    |

---

## Tab 3: `Email_Log`

Har bheji gayi email ka permanent record.

| Column | Field Name      | Description           |
| ------ | --------------- | --------------------- |
| A      | log_id          | LOG00001              |
| B      | lead_id         | Lead reference        |
| C      | business_name   | Business name         |
| D      | recipient_email | Email address         |
| E      | template_id     | Which template        |
| F      | subject_sent    | Final subject         |
| G      | body_sent       | Final body            |
| H      | sent_timestamp  | Send date/time        |
| I      | sender_email    | From address          |
| J      | thread_id       | Gmail thread ID       |
| K      | message_id      | Gmail message ID      |
| L      | delivery_status | Sent, Bounced, Failed |
| M      | opened          | Yes/No                |
| N      | replied         | Yes/No                |
| O      | reply_date      | Reply timestamp       |
| P      | reply_snippet   | Reply preview text    |
| Q      | sequence_step   | 1, 2, 3               |
| R      | error_message   | Agar fail hua         |

---

## Tab 4: `Blacklist`

| Column | Field Name    | Description                                      |
| ------ | ------------- | ------------------------------------------------ |
| A      | blacklist_id  | BL001                                            |
| B      | email         | Blocked email                                    |
| C      | domain        | Blocked domain                                   |
| D      | phone         | Blocked phone                                    |
| E      | business_name | Business name                                    |
| F      | reason        | Unsubscribed, Bounced, Complaint, Not Interested |
| G      | added_date    | Date added                                       |
| H      | added_by      | Who added                                        |
| I      | permanent     | Yes/No                                           |

---

## Tab 5: `Settings`

| Column | Field Name    | Description |
| ------ | ------------- | ----------- |
| A      | setting_key   | Key name    |
| B      | setting_value | Value       |
| C      | description   | Explanation |

### Default Settings Rows

```text
agency_name              | NR Rvibe
agency_website           | https://nrrevibe.online/
sender_name              | Your Name
sender_email             | you@nrrevibe.online
reply_to_email           | you@nrrevibe.online
email_signature          | HTML signature block
calendar_link            | https://calendly.com/yourlink
daily_email_limit        | 40
hourly_email_limit       | 8
min_lead_score           | 50
followup_1_delay_days    | 3
followup_2_delay_days    | 7
max_followups            | 2
auto_send_enabled        | FALSE
approval_required        | TRUE
lead_sheet_id            | Lead spreadsheet ID
db_sheet_id              | DB spreadsheet ID
timezone                 | Asia/Kolkata
send_window_start        | 09
send_window_end          | 18
skip_weekends            | TRUE
```

---

## Tab 6: `Activity_Log`

| Column | Field Name       | Description                      |
| ------ | ---------------- | -------------------------------- |
| A      | log_id           | Auto ID                          |
| B      | timestamp        | Date/time                        |
| C      | action_type      | COLLECT, PUSH, SEND, ERROR, SYNC |
| D      | user             | User email                       |
| E      | records_affected | Count                            |
| F      | details          | Description                      |
| G      | status           | Success / Failed                 |
| H      | error_trace      | Error details                    |

---

## Tab 7: `Campaigns`

| Column | Field Name      | Description               |
| ------ | --------------- | ------------------------- |
| A      | campaign_id     | CMP001                    |
| B      | campaign_name   | Delhi Salons Website      |
| C      | target_niche    | Salons                    |
| D      | target_city     | Delhi                     |
| E      | search_keywords | Keywords used             |
| F      | template_id     | Default template          |
| G      | start_date      | Start                     |
| H      | end_date        | End                       |
| I      | total_leads     | Count                     |
| J      | emails_sent     | Count                     |
| K      | replies         | Count                     |
| L      | meetings        | Count                     |
| M      | clients_won     | Count                     |
| N      | status          | Active, Paused, Completed |

---

## Tab 8: `Dashboard`

Formula-based summary tab. Koi manual entry nahi.

```text
Total Leads Collected      =COUNTA(Raw_Leads!A2:A)
Qualified Leads            =COUNTIF(Raw_Leads!AP2:AP,"Yes")
Duplicates Removed         =COUNTIF(Raw_Leads!AM2:AM,"Yes")
Leads With Email           =COUNTIF(Raw_Leads!I2:I,"<>")
Emails Sent Today          =COUNTIFS(Email_Log!H2:H,">="&TODAY())
Total Emails Sent          =COUNTA(Email_Log!A2:A)
Total Replies              =COUNTIF(Email_Log!N2:N,"Yes")
Reply Rate                 =Replies/Sent
Bounce Count               =COUNTIF(Email_Log!L2:L,"Bounced")
Blacklisted                =COUNTA(Blacklist!A2:A)
```

---

# 5. LEAD SHEET Structure (NRRvibe_Lead_Workspace)

Is spreadsheet mein 5 tabs honge.

---

## Tab 1: `Active_Leads`

Sirf qualified leads. Clean aur sales-focused.

| Column | Field Name        | Editable | Description                 |
| ------ | ----------------- | -------- | --------------------------- |
| A      | lead_id           | No       | LEAD00001                   |
| B      | business_name     | No       | Business name               |
| C      | category          | No       | Category                    |
| D      | city              | No       | City                        |
| E      | phone             | No       | Phone                       |
| F      | email             | No       | Email                       |
| G      | website_url       | No       | Website                     |
| H      | maps_url          | No       | Maps link                   |
| I      | rating            | No       | Google rating               |
| J      | reviews           | No       | Review count                |
| K      | lead_score        | No       | 0–100                       |
| L      | priority          | No       | Hot, High, Medium, Low      |
| M      | opportunity       | No       | Website / Social / Both     |
| N      | pain_point        | No       | Main problem                |
| O      | suggested_service | No       | Recommended package         |
| P      | instagram         | No       | Instagram link              |
| Q      | facebook          | No       | Facebook link               |
| R      | social_status     | No       | Active / Inactive / Missing |
| S      | **approve**       | **Yes**  | Checkbox – approve to send  |
| T      | template_id       | Yes      | Dropdown of templates       |
| U      | lead_status       | Yes      | Dropdown status             |
| V      | email_status      | No       | Not Sent, Sent, Replied     |
| W      | emails_sent_count | No       | 0, 1, 2, 3                  |
| X      | last_contact_date | No       | Auto filled                 |
| Y      | followup_date     | No       | Auto calculated             |
| Z      | reply_received    | No       | Yes/No                      |
| AA     | assigned_to       | Yes      | Team member                 |
| AB     | notes             | Yes      | Manual notes                |
| AC     | deal_value        | Yes      | Expected value              |
| AD     | added_date        | No       | Date added                  |
| AE     | db_raw_id         | No       | DB reference link           |

### Data Validation Rules

**Column S (approve):** Checkbox

**Column U (lead_status) dropdown:**

```text
New
Reviewed
Approved
Contacted
Replied
Interested
Meeting Booked
Proposal Sent
Negotiation
Won
Lost
Not Interested
Do Not Contact
```

**Column T (template_id) dropdown:** Auto-populated from DB `Email_Templates` tab.

### Conditional Formatting

```text
Lead Score >= 80        → Green background
Lead Score 60–79        → Yellow background
Lead Score < 60         → Grey background
Email Status = Replied  → Blue bold text
Lead Status = Won       → Dark green
Lead Status = Lost      → Red strikethrough
Followup Date = Today   → Orange highlight
Approve = TRUE          → Light green row
```

---

## Tab 2: `Followups_Due`

Filter view of leads jinki follow-up date aa gayi hai.

| Column | Field Name          |
| ------ | ------------------- |
| A      | lead_id             |
| B      | business_name       |
| C      | email               |
| D      | last_contact_date   |
| E      | followup_date       |
| F      | sequence_step       |
| G      | next_template       |
| H      | send_now (checkbox) |
| I      | skip (checkbox)     |

Ye tab Apps Script se auto-refresh hota hai daily trigger par.

---

## Tab 3: `Replied_Leads`

Jin leads ne reply kiya. High priority action list.

| Column | Field Name                                             |
| ------ | ------------------------------------------------------ |
| A      | lead_id                                                |
| B      | business_name                                          |
| C      | email                                                  |
| D      | reply_date                                             |
| E      | reply_snippet                                          |
| F      | gmail_thread_link                                      |
| G      | response_type (Interested / Question / Not Interested) |
| H      | next_action                                            |
| I      | assigned_to                                            |
| J      | follow_up_call_date                                    |

---

## Tab 4: `Won_Clients`

| Column | Field Name      |
| ------ | --------------- |
| A      | client_id       |
| B      | business_name   |
| C      | contact_person  |
| D      | email           |
| E      | phone           |
| F      | service_sold    |
| G      | package_value   |
| H      | start_date      |
| I      | project_status  |
| J      | source_campaign |
| K      | notes           |

---

## Tab 5: `Quick_Stats`

Simple live dashboard for team.

```text
Total Active Leads
Hot Leads (80+)
Pending Approval
Emails Sent This Week
Replies This Week
Followups Due Today
Meetings Booked
Conversion Rate
```

---

# 6. Google Apps Script – Complete Structure

Apps Script project ko multiple `.gs` files mein organize karein.

```text
NRRvibe_Backend (Apps Script Project)
│
├── Config.gs              → Constants, IDs, settings loader
├── WebApp.gs              → doPost, doGet endpoints
├── DBService.gs           → DB sheet read/write functions
├── LeadService.gs         → Lead sheet operations
├── LeadScoring.gs         → Scoring algorithm
├── DuplicateCheck.gs      → Duplicate detection
├── EmailService.gs        → Email sending, templates
├── FollowupService.gs     → Follow-up automation
├── ReplyTracker.gs        → Gmail reply detection
├── Blacklist.gs           → Unsubscribe & block handling
├── Triggers.gs            → Time-based trigger setup
├── Utils.gs               → Helper functions
├── Logger.gs              → Activity logging
└── Menu.gs                → Custom sheet menu
```

---

## 6.1 Config.gs

**Purpose:** Sabhi constants aur configuration ek jagah.

**Contents:**

```text
DB_SHEET_ID          = "Master DB spreadsheet ID"
LEAD_SHEET_ID        = "Lead workspace spreadsheet ID"
API_SECRET_KEY       = "Secret token for extension auth"

TAB NAMES:
  DB_RAW_LEADS       = "Raw_Leads"
  DB_TEMPLATES       = "Email_Templates"
  DB_EMAIL_LOG       = "Email_Log"
  DB_BLACKLIST       = "Blacklist"
  DB_SETTINGS        = "Settings"
  DB_ACTIVITY        = "Activity_Log"
  DB_CAMPAIGNS       = "Campaigns"

  LS_ACTIVE          = "Active_Leads"
  LS_FOLLOWUP        = "Followups_Due"
  LS_REPLIED         = "Replied_Leads"
  LS_WON             = "Won_Clients"

FUNCTIONS:
  getSettings()      → Settings tab ko object mein convert kare
  getDB()            → DB spreadsheet object return kare
  getLeadSheet()     → Lead spreadsheet object return kare
  getTab(sheetObj, tabName)
```

---

## 6.2 WebApp.gs – API Endpoints

Apps Script ko **Web App** ke roop mein deploy karein. Chrome Extension yahan requests bhejegi.

### Deployment Settings

```text
Execute as        : Me (owner account)
Who has access    : Anyone
Deployment type   : Web app
```

Deploy karne par ek URL milega:

```text
https://script.google.com/macros/s/AKfycb.../exec
```

Ye URL extension ke settings mein save hoga.

### Endpoint Actions

| Action             | Method | Purpose                         |
| ------------------ | ------ | ------------------------------- |
| `ping`             | GET    | Connection test                 |
| `saveLeads`        | POST   | Extension se leads DB mein save |
| `getTemplates`     | GET    | Email templates list            |
| `getSettings`      | GET    | Agency settings                 |
| `getStats`         | GET    | Dashboard numbers               |
| `checkDuplicate`   | POST   | Duplicate check before save     |
| `sendEmail`        | POST   | Single email send               |
| `sendBatch`        | POST   | Approved leads batch send       |
| `updateLead`       | POST   | Lead status update              |
| `addBlacklist`     | POST   | Email blacklist mein add        |
| `getLeadsByFilter` | POST   | Filtered leads fetch            |

### Request Format

```text
POST Request Body (JSON):
{
  "action": "saveLeads",
  "apiKey": "your-secret-key",
  "user": "you@nrrevibe.online",
  "campaign": "CMP001",
  "searchKeyword": "salon in delhi",
  "searchLocation": "Delhi",
  "data": [
    {
      "business_name": "ABC Salon",
      "category": "Beauty Salon",
      "maps_url": "https://maps.google.com/...",
      "website_url": "",
      "phone": "+91XXXXXXXXXX",
      "email": "info@abcsalon.com",
      "address": "123 Street, Delhi",
      "city": "Delhi",
      "rating": 4.6,
      "review_count": 128,
      "instagram_url": "https://instagram.com/abcsalon",
      "website_status": "Missing",
      "https_enabled": "No",
      "mobile_friendly": "Unknown"
    }
  ]
}
```

### Response Format

```text
Success Response:
{
  "success": true,
  "action": "saveLeads",
  "received": 25,
  "saved": 25,
  "duplicates": 4,
  "qualified": 16,
  "pushedToLeadSheet": 16,
  "leadIds": ["LEAD00042", "LEAD00043"],
  "message": "16 qualified leads added to Lead Workspace",
  "timestamp": "2025-01-01T10:30:00Z"
}

Error Response:
{
  "success": false,
  "error": "INVALID_API_KEY",
  "message": "Authentication failed",
  "timestamp": "2025-01-01T10:30:00Z"
}
```

### Security Rules

```text
1. Har request mein apiKey verify karein
2. API key Script Properties mein store karein, code mein nahi
3. Rate limit: max 100 requests per minute per user
4. Payload size limit: max 200 leads per request
5. Invalid requests Activity_Log mein record karein
6. Sensitive data response mein return na karein
```

---

## 6.3 DBService.gs

**Purpose:** DB sheet ke saath saara interaction.

### Functions

| Function                       | Description                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------- |
| `saveRawLeads(dataArray)`      | Batch mein Raw_Leads tab mein rows append kare                                     |
| `generateRawId()`              | Next raw_id generate kare                                                          |
| `getExistingIdentifiers()`     | Sabhi phone, email, website, place_id ka Set banaye – fast duplicate check ke liye |
| `updateRawLead(rawId, fields)` | Specific row update kare                                                           |
| `getRawLeadById(rawId)`        | Single lead fetch                                                                  |
| `markAsPushed(rawId, leadId)`  | Lead sheet mein push hone ka flag set kare                                         |
| `logActivity(type, details)`   | Activity_Log mein entry                                                            |
| `getTemplateById(templateId)`  | Template fetch kare                                                                |
| `logEmail(emailData)`          | Email_Log mein record                                                              |
| `getSettings()`                | Settings object return kare                                                        |

### Performance Rules

```text
Kabhi bhi loop ke andar getRange().setValue() na karein
Hamesha batch operations use karein:
  sheet.getRange(row, col, numRows, numCols).setValues(array2D)

Read bhi batch mein:
  const data = sheet.getDataRange().getValues()

CacheService use karein frequently accessed data ke liye:
  CacheService.getScriptCache().put(key, value, 600)
```

---

## 6.4 LeadService.gs

**Purpose:** DB se qualified leads ko Lead Sheet mein push karna aur wahan se data read karna.

### Functions

| Function                                  | Description                                      |
| ----------------------------------------- | ------------------------------------------------ |
| `pushQualifiedLeads(rawLeadsArray)`       | Score check karke Lead Sheet mein append kare    |
| `generateLeadId()`                        | LEAD00001 format ID                              |
| `getApprovedLeads()`                      | Jin rows mein approve checkbox TRUE hai          |
| `updateLeadStatus(leadId, status)`        | Lead status change                               |
| `updateEmailStatus(leadId, status, date)` | Email status update                              |
| `syncToDB(leadId)`                        | Lead sheet changes DB mein sync kare             |
| `refreshFollowupsTab()`                   | Followups_Due tab rebuild kare                   |
| `refreshRepliedTab()`                     | Replied_Leads tab rebuild kare                   |
| `moveToWonClients(leadId)`                | Won client tab mein shift kare                   |
| `applyFormatting()`                       | Conditional formatting aur validation apply kare |

### Push Logic

```text
FOR each raw lead:
  IF lead_score >= min_lead_score (Settings se)
  AND email is not empty
  AND email is not blacklisted
  AND duplicate_flag == "No"
  THEN:
      generate lead_id
      map DB columns → Lead Sheet columns
      append row to Active_Leads
      set approve checkbox = FALSE
      set lead_status = "New"
      set email_status = "Not Sent"
      update DB: pushed_to_leadsheet = "Yes", lead_sheet_row_id = lead_id
  ELSE:
      update DB: pushed_to_leadsheet = "No"
      log reason in validation_status
```

---

## 6.5 LeadScoring.gs

**Purpose:** Har lead ko automatic score dena.

### Scoring Function Logic

```text
FUNCTION calculateLeadScore(lead):

  score = 0
  painPoints = []

  // ---- WEBSITE SIGNALS (max 70) ----
  IF website_url is empty:
      score += 30
      painPoints.push("No website")
  ELSE:
      IF website_status == "Broken":
          score += 25
          painPoints.push("Website not working")
      IF https_enabled == "No":
          score += 15
          painPoints.push("Website not secure")
      IF mobile_friendly == "No":
          score += 15
          painPoints.push("Not mobile friendly")
      IF website_tech in ["Wix", "Static HTML", "Old CMS"]:
          score += 10
          painPoints.push("Outdated website platform")
      IF has_contact_form == "No":
          score += 5
          painPoints.push("No contact form")
      IF has_booking == "No" AND category in bookingNiches:
          score += 8
          painPoints.push("No online booking")
      IF page_load_time > 4:
          score += 7
          painPoints.push("Slow website")

  // ---- SOCIAL MEDIA SIGNALS (max 45) ----
  IF instagram_url is empty AND facebook_url is empty:
      score += 20
      painPoints.push("No social media presence")
  ELSE:
      IF instagram_url is empty:
          score += 12
          painPoints.push("No Instagram")
      IF facebook_url is empty:
          score += 8
          painPoints.push("No Facebook page")
      IF social_status == "Inactive":
          score += 15
          painPoints.push("Social media inactive")

  // ---- BUSINESS QUALITY (max 40) ----
  IF rating >= 4.0: score += 5
  IF rating >= 4.5: score += 5
  IF review_count >= 50: score += 8
  IF review_count >= 150: score += 7
  IF category in highValueNiches: score += 15
  IF business_status == "Open": score += 5

  // ---- CONTACTABILITY (required) ----
  IF email is empty: score -= 25
  IF phone is empty: score -= 10
  IF email is generic (info@, hello@): score += 3
  IF email is personal gmail/yahoo: score -= 5

  // ---- NEGATIVE SIGNALS ----
  IF website_tech in ["Webflow", "Next.js", "React"]: score -= 15
  IF business is a marketing/web agency: score -= 40
  IF business_status == "Permanently Closed": score = 0
  IF review_count == 0: score -= 10

  score = clamp(score, 0, 100)

  RETURN { score, painPoints, priority, opportunity, suggestedService }
```

### Priority Mapping

```text
80–100  → Hot Lead        → Send immediately
65–79   → High Priority   → Send within 24 hours
50–64   → Medium Priority → Batch send weekly
35–49   → Low Priority    → Keep in DB only
0–34    → Reject          → Do not push to Lead Sheet
```

### High Value Niches Array

```text
Dentist, Clinic, Hospital, Lawyer, Law Firm, Real Estate,
Interior Designer, Wedding Planner, Photographer, Gym,
Fitness Studio, Salon, Spa, Restaurant, Cafe, Hotel,
Travel Agency, Car Dealer, Construction, Architect,
Coaching Institute, Event Management, Boutique, Jeweller
```

### Suggested Service Logic

```text
No website + No social          → Complete Digital Growth Package
No website + Active social      → Website Development
Old website + Good social       → Website Redesign
Good website + No social        → Social Media Management
No booking + Service business   → Booking Website + Local SEO
High reviews + Poor website     → Premium Website Package
Not mobile friendly             → Responsive Website Redesign
No Instagram + Visual business  → Social Media + Content Creation
```

---

## 6.6 DuplicateCheck.gs

### Duplicate Detection Fields

Priority order mein check:

```text
1. place_id          (100% match = definite duplicate)
2. maps_url          (exact match)
3. phone number      (normalized: remove +, spaces, dashes)
4. email address     (lowercase trim)
5. website domain    (root domain compare, ignore www/https)
6. business_name + city  (fuzzy match, 90%+ similarity)
```

### Functions

| Function                              | Description                                   |
| ------------------------------------- | --------------------------------------------- |
| `buildIdentifierCache()`              | Ek baar DB read karke Set banaye              |
| `isDuplicate(lead, cache)`            | Boolean + matched raw_id return kare          |
| `normalizePhone(phone)`               | Sirf digits, last 10 digits compare           |
| `extractDomain(url)`                  | Root domain nikale                            |
| `fuzzyMatch(str1, str2)`              | Levenshtein similarity percentage             |
| `mergeDuplicate(newLead, existingId)` | Missing fields update kare, new row na banaye |

### Merge Rule

Agar duplicate mila lekin new data mein extra info hai (jaise pehle email nahi tha, ab hai), to existing row ko update karein, new row na banayein.

---

## 6.7 EmailService.gs

**Purpose:** Templates process karna aur emails bhejna.

### Functions

| Function                               | Description                                |
| -------------------------------------- | ------------------------------------------ |
| `renderTemplate(templateId, leadData)` | Variables replace karke final subject/body |
| `sendSingleEmail(leadId, templateId)`  | Ek email bheje                             |
| `sendApprovedBatch()`                  | Sabhi approved leads ko bheje              |
| `canSendNow()`                         | Time window, daily limit, weekend check    |
| `getRemainingQuota()`                  | MailApp.getRemainingDailyQuota()           |
| `validateEmail(email)`                 | Format + blacklist + duplicate check       |
| `buildSignature()`                     | Settings se HTML signature                 |
| `addUnsubscribeFooter(body, leadId)`   | Unsubscribe link add kare                  |
| `createDraft(leadId, templateId)`      | Send ke bajay draft banaye                 |

### Sending Method Options

```text
Option 1: MailApp.sendEmail()
  - Simple, fast
  - No thread tracking
  - Quota: 100/day (free), 1500/day (Workspace)

Option 2: GmailApp.sendEmail()   [RECOMMENDED]
  - Thread ID milta hai
  - Reply tracking possible
  - Sent folder mein dikhta hai
  - Same quota

Option 3: GmailApp.createDraft()
  - Safest for starting
  - Manual review before send
  - No quota consumption until sent
```

### Send Function Flow

```text
FUNCTION sendApprovedBatch():

  settings = getSettings()

  // Pre-checks
  IF settings.auto_send_enabled == FALSE: EXIT
  IF NOT isWithinSendWindow(): EXIT
  IF settings.skip_weekends AND isWeekend(): EXIT

  quota = MailApp.getRemainingDailyQuota()
  sentToday = countEmailsSentToday()
  dailyLimit = settings.daily_email_limit

  available = MIN(quota, dailyLimit - sentToday)
  IF available <= 0:
      logActivity("SEND", "Daily limit reached")
      EXIT

  approvedLeads = getApprovedLeads()
  batch = approvedLeads.slice(0, available)

  FOR each lead in batch:

      // Validation gate
      IF lead.email is empty: SKIP, mark "No Email"
      IF isBlacklisted(lead.email): SKIP, mark "Blacklisted"
      IF alreadySentToday(lead.email): SKIP
      IF NOT isValidEmailFormat(lead.email): SKIP, mark "Invalid"

      TRY:
          template = getTemplateById(lead.template_id)
          rendered = renderTemplate(template, lead)

          GmailApp.sendEmail(
              lead.email,
              rendered.subject,
              rendered.plainBody,
              {
                  htmlBody: rendered.htmlBody,
                  name: settings.sender_name,
                  replyTo: settings.reply_to_email
              }
          )

          threadId = getLastSentThreadId()

          // Update DB
          logEmail({ leadId, email, template, subject, body, threadId })

          // Update Lead Sheet
          updateLeadRow(lead.lead_id, {
              email_status: "Sent",
              emails_sent_count: lead.emails_sent_count + 1,
              last_contact_date: TODAY,
              followup_date: TODAY + settings.followup_1_delay_days,
              lead_status: "Contacted",
              approve: FALSE          // uncheck to prevent resend
          })

          // Anti-spam delay
          Utilities.sleep(randomBetween(3000, 8000))

      CATCH error:
          logEmail({ leadId, status: "Failed", error: error.message })
          updateLeadRow(lead.lead_id, { email_status: "Failed" })

  logActivity("SEND", batch.length + " emails processed")
```

### Anti-Spam Best Practices

```text
1. Random delay 3–8 seconds between emails
2. Maximum 40 emails per day (start with 15–20)
3. Only send between 9 AM – 6 PM local time
4. Skip weekends
5. Never send same subject line to all
6. Rotate 3–4 subject line variations
7. Personalize first line with real business detail
8. Keep email under 150 words
9. Maximum 1 link in first email
10. Always include unsubscribe option
11. Use proper sender name, not "noreply"
12. Set up SPF, DKIM, DMARC on domain
13. Warm up new domain slowly (5 → 10 → 20 → 40)
14. Remove bounced emails immediately
```

---

## 6.8 FollowupService.gs

### Automatic Follow-up Logic

```text
FUNCTION processFollowups():   // Runs daily via trigger

  settings = getSettings()
  today = new Date()

  leads = getLeadsWhere({
      email_status: "Sent",
      reply_received: "No",
      followup_date: <= today,
      emails_sent_count: < settings.max_followups + 1,
      lead_status: NOT IN ["Not Interested", "Do Not Contact", "Won", "Lost"]
  })

  FOR each lead:
      step = lead.emails_sent_count + 1

      IF step > settings.max_followups + 1:
          updateLead(lead.lead_id, { lead_status: "Lost", email_status: "Sequence Complete" })
          CONTINUE

      template = getTemplateBySequenceStep(step, lead.opportunity)

      // Reply thread mein bhejein (better deliverability)
      previousThreadId = getLastThreadId(lead.lead_id)
      IF previousThreadId exists:
          thread = GmailApp.getThreadById(previousThreadId)
          thread.reply(renderedBody, { htmlBody: renderedHtml })
      ELSE:
          GmailApp.sendEmail(...)

      delay = (step == 2) ? settings.followup_1_delay_days : settings.followup_2_delay_days

      updateLead(lead.lead_id, {
          emails_sent_count: step,
          last_contact_date: today,
          followup_date: today + delay
      })

      logEmail({ ..., sequence_step: step })
      Utilities.sleep(randomBetween(4000, 9000))
```

### Follow-up Stop Conditions

```text
STOP sending if:
  - Reply received
  - Lead clicked unsubscribe
  - Email bounced
  - Lead status = "Not Interested"
  - Lead status = "Do Not Contact"
  - Max followups reached (default 2)
  - Email in blacklist
  - User manually unchecked approve
  - 30 days passed since first email
```

---

## 6.9 ReplyTracker.gs

**Purpose:** Gmail se automatically detect karna ki kisne reply kiya.

### Function Logic

```text
FUNCTION checkReplies():   // Runs every 2 hours via trigger

  // Recent sent emails ke thread IDs uthayein
  recentLogs = getEmailLogsWhere({
      sent_within_days: 30,
      replied: "No"
  })

  FOR each log in recentLogs:
      TRY:
          thread = GmailApp.getThreadById(log.thread_id)
          messages = thread.getMessages()

          IF messages.length > 1:
              lastMessage = messages[messages.length - 1]
              sender = lastMessage.getFrom()

              // Confirm ye humara bheja hua nahi hai
              IF NOT sender.includes(settings.sender_email):

                  snippet = lastMessage.getPlainBody().substring(0, 300)
                  replyDate = lastMessage.getDate()

                  // Update DB
                  updateEmailLog(log.log_id, {
                      replied: "Yes",
                      reply_date: replyDate,
                      reply_snippet: snippet
                  })

                  // Update Lead Sheet
                  updateLead(log.lead_id, {
                      reply_received: "Yes",
                      lead_status: "Replied",
                      email_status: "Replied"
                  })

                  // Auto-detect negative reply
                  IF snippet contains ["unsubscribe", "remove me", "not interested",
                                       "stop", "don't contact", "spam"]:
                      addToBlacklist(log.recipient_email, "Reply opt-out")
                      updateLead(log.lead_id, { lead_status: "Do Not Contact" })

                  // Push to Replied_Leads tab
                  addToRepliedTab(log.lead_id, snippet, thread.getPermalink())

                  // Notify agency
                  sendInternalAlert(log.business_name, snippet)

      CATCH: CONTINUE
```

### Bounce Detection

```text
FUNCTION checkBounces():

  threads = GmailApp.search('from:mailer-daemon OR subject:"Delivery Status Notification" newer_than:2d')

  FOR each thread:
      body = thread.getMessages()[0].getPlainBody()
      bouncedEmail = extractEmailFromBounce(body)

      IF bouncedEmail found:
          addToBlacklist(bouncedEmail, "Hard Bounce")
          updateEmailLogByEmail(bouncedEmail, { delivery_status: "Bounced" })
          updateLeadByEmail(bouncedEmail, {
              email_status: "Bounced",
              lead_status: "Invalid"
          })
```

---

## 6.10 Blacklist.gs

### Functions

| Function                        | Description                            |
| ------------------------------- | -------------------------------------- |
| `addToBlacklist(email, reason)` | Blacklist tab mein add                 |
| `isBlacklisted(email)`          | Fast check via cached Set              |
| `buildBlacklistCache()`         | CacheService mein 10 min ke liye store |
| `handleUnsubscribe(leadId)`     | Unsubscribe link click handler (doGet) |
| `blockDomain(domain, reason)`   | Pura domain block                      |

### Unsubscribe Link System

Email footer mein:

```text
https://script.google.com/macros/s/DEPLOY_ID/exec?action=unsubscribe&id=LEAD00042&t=hashtoken
```

`doGet` function is request ko handle kare:

```text
1. Token validate kare
2. Lead ID se email nikale
3. Blacklist mein add kare
4. Lead status = "Do Not Contact"
5. Simple HTML confirmation page return kare:
   "You have been unsubscribed successfully."
```

---

## 6.11 Triggers.gs

### Time-Based Triggers Setup

| Trigger Function      | Frequency              | Purpose              |
| --------------------- | ---------------------- | -------------------- |
| `sendApprovedBatch`   | Every 1 hour (9AM–6PM) | Approved emails send |
| `processFollowups`    | Daily at 10 AM         | Follow-up emails     |
| `checkReplies`        | Every 2 hours          | Reply detection      |
| `checkBounces`        | Daily at 8 AM          | Bounce handling      |
| `refreshFollowupsTab` | Daily at 7 AM          | Followup tab rebuild |
| `updateDashboard`     | Every 6 hours          | Stats refresh        |
| `cleanupOldLogs`      | Weekly Sunday          | Archive old data     |
| `syncLeadSheetToDB`   | Every 3 hours          | Two-way sync         |

### Setup Function

```text
FUNCTION createAllTriggers():
  deleteAllTriggers()   // Duplicates avoid karne ke liye

  ScriptApp.newTrigger('sendApprovedBatch').timeBased().everyHours(1).create()
  ScriptApp.newTrigger('processFollowups').timeBased().atHour(10).everyDays(1).create()
  ScriptApp.newTrigger('checkReplies').timeBased().everyHours(2).create()
  ScriptApp.newTrigger('checkBounces').timeBased().atHour(8).everyDays(1).create()
  ScriptApp.newTrigger('refreshFollowupsTab').timeBased().atHour(7).everyDays(1).create()
  ScriptApp.newTrigger('syncLeadSheetToDB').timeBased().everyHours(3).create()
```

---

## 6.12 Menu.gs – Custom Sheet Menu

Lead Sheet kholne par ek custom menu dikhe.

```text
FUNCTION onOpen():
  SpreadsheetApp.getUi()
    .createMenu('🚀 NR Rvibe')
    .addItem('📥 Pull New Leads from DB', 'pullFromDB')
    .addItem('✅ Send Approved Emails Now', 'sendApprovedBatch')
    .addItem('📧 Create Drafts Only', 'createDraftsForApproved')
    .addItem('🔄 Check Replies Now', 'checkReplies')
    .addItem('📅 Refresh Followups Tab', 'refreshFollowupsTab')
    .addSeparator()
    .addItem('🎯 Recalculate Lead Scores', 'recalculateAllScores')
    .addItem('🧹 Remove Duplicates', 'runDuplicateCleanup')
    .addItem('🚫 Add Selected to Blacklist', 'blacklistSelectedRows')
    .addSeparator()
    .addItem('📊 Refresh Dashboard', 'updateDashboard')
    .addItem('📤 Export Report', 'exportWeeklyReport')
    .addItem('⚙️ Setup Triggers', 'createAllTriggers')
    .addItem('🔧 Test Connection', 'testSetup')
    .addToUi()
```

---

# 7. Chrome Extension Structure

```text
nrrvibe-extension/
│
├── manifest.json              (Manifest V3)
├── popup/
│   ├── popup.html             UI
│   ├── popup.css              Styling
│   └── popup.js               Logic
├── content/
│   ├── maps-scraper.js        Google Maps DOM reading
│   └── scraper.css            Overlay styles
├── background/
│   └── service-worker.js      API calls, storage
├── options/
│   ├── options.html           Settings page
│   └── options.js             Settings logic
├── lib/
│   ├── api.js                 Apps Script API wrapper
│   ├── validator.js           Data validation
│   └── analyzer.js            Website/social analysis
└── assets/
    └── icons/
```

## 7.1 manifest.json Permissions

```text
permissions:
  - storage
  - activeTab
  - scripting
  - tabs

host_permissions:
  - https://www.google.com/maps/*
  - https://script.google.com/*

content_scripts:
  matches: ["https://www.google.com/maps/*"]
  js: ["content/maps-scraper.js"]
```

## 7.2 Extension Screens

### Screen 1: Setup / Connect

```text
Fields:
  - Apps Script Web App URL
  - API Secret Key
  - Your Email (collected_by)
  - [ Test Connection ] button

Status display:
  ✅ Connected to NRRvibe_Master_DB
  ✅ Connected to NRRvibe_Lead_Workspace
  📊 Total leads in DB: 1,240
  📧 Emails remaining today: 34
```

### Screen 2: Collector

```text
Auto-detected:
  Search Keyword: "salon in delhi"
  Location: Delhi, India
  Results visible: 20

Controls:
  Campaign: [dropdown from DB]
  Max leads to collect: [slider 10–200]
  [ ] Auto-scroll to load more
  [ ] Visit websites for email extraction (slower)
  [ ] Skip businesses with modern websites

  [ ▶ Start Collection ]  [ ⏸ Pause ]  [ ⏹ Stop ]

Progress:
  ████████░░░░░░░ 45 / 100 collected
  Emails found: 28
  Websites checked: 45
```

### Screen 3: Preview & Push

```text
Collected leads table (scrollable):
  ☑ | Business | Score | Email | Website | Issue

Actions:
  [ Select All ]  [ Select Score 60+ ]  [ Remove No-Email ]
  [ 📤 Push to Google Sheet ]

Summary before push:
  Total: 45
  Duplicates detected: 8
  With email: 28
  Qualified (score 50+): 22
  Will be pushed to Lead Sheet: 22
```

### Screen 4: Quick Stats

```text
Today's Collection: 45
This Week: 312
Total in DB: 1,240
Emails Sent Today: 18 / 40
Replies This Week: 7
Hot Leads Pending: 12

[ 🔗 Open Lead Sheet ]  [ 🔗 Open DB Sheet ]
```

---

# 8. Email Templates (Ready to Use)

Ye templates DB Sheet ke `Email_Templates` tab mein add karein.

---

## TPL001 – No Website (Step 1)

**Subject variations:**

```text
Quick website idea for {{business_name}}
{{business_name}} – website suggestion
Website for {{business_name}}?
```

**Body:**

```text
Hi {{business_name}} team,

I came across {{business_name}} on Google Maps while looking at {{category}}
businesses in {{city}}. Your {{rating}}-star rating with {{review_count}}
reviews really stands out.

I noticed you may not have a website yet. For a business with this kind of
local reputation, a simple website can help customers find your services,
check timings, and contact you directly instead of scrolling past.

At NR Rvibe we build clean, mobile-friendly websites for local businesses —
usually live within 7 days.

Would you like me to send a rough layout idea for {{business_name}}?
No cost, no obligation.

Best regards,
{{sender_name}}
NR Rvibe
{{agency_website}}
```

---

## TPL002 – Outdated Website (Step 1)

**Subject:**

```text
Noticed something on {{business_name}}'s website
```

**Body:**

```text
Hi {{business_name}} team,

I was looking at {{category}} businesses in {{city}} and found your website
at {{website_url}}.

I noticed {{website_issue}} — this can quietly cost enquiries, especially
since most visitors now browse on mobile.

With {{review_count}} reviews and a {{rating}} rating, your business clearly
has strong customer trust. A refreshed website would match that reputation
better.

We handle redesigns for local businesses at NR Rvibe, including mobile
optimization, enquiry forms and speed improvements.

Want me to send a short list of what I'd change? Takes 2 minutes to read.

Best regards,
{{sender_name}}
NR Rvibe
{{agency_website}}
```

---

## TPL003 – Social Media Inactive (Step 1)

**Subject:**

```text
Content idea for {{business_name}}
```

**Body:**

```text
Hi {{business_name}} team,

Found your business on Google Maps — {{rating}} stars from {{review_count}}
customers in {{city}} is impressive.

I checked your Instagram and noticed the last post was a while back. For
{{category}} businesses, regular content is one of the cheapest ways to stay
visible to local customers who are already searching for you.

At NR Rvibe we handle social media management for local businesses — content
planning, post design, reels and monthly reporting.

Would you like 3 free content ideas specific to {{business_name}}?
I'll send them over, no strings attached.

Best regards,
{{sender_name}}
NR Rvibe
```

---

## TPL004 – Both Missing (Step 1)

**Subject:**

```text
Online growth ideas for {{business_name}}
```

**Body:**

```text
Hi {{business_name}} team,

I found {{business_name}} while researching {{category}} businesses in {{city}}.

Two things stood out:
1. No website — customers can't learn about your services online
2. Limited social media presence — missing local visibility

Both are fixable, and for a business with {{review_count}} reviews, the
return usually shows up fast.

NR Rvibe helps local businesses with website development and social media
management, often as one combined package.

Can I send you a short growth plan for {{business_name}}?

Best regards,
{{sender_name}}
NR Rvibe
{{agency_website}}
```

---

## TPL005 – Follow-up 1 (Step 2, Day 3)

**Subject:** `Re: {{original_subject}}`

**Body:**

```text
Hi {{business_name}} team,

Just floating this back to the top of your inbox.

Happy to share those ideas for {{business_name}} whenever convenient —
takes 2 minutes to review.

Should I send them across?

{{sender_name}}
NR Rvibe
```

---

## TPL006 – Follow-up 2 / Final (Step 3, Day 10)

**Subject:** `Re: {{original_subject}}`

**Body:**

```text
Hi {{business_name}} team,

Last message from me on this.

If improving your website or social media isn't a priority right now,
completely understandable — I'll close this out.

If it ever becomes relevant, we're at {{agency_website}}.

Wishing {{business_name}} continued success.

{{sender_name}}
NR Rvibe
```

---

## Email Signature Block

```text
{{sender_name}}
NR Rvibe — Websites & Social Media for Local Businesses
{{agency_website}}
{{calendar_link}}

---
Not interested? Unsubscribe: {{unsubscribe_link}}
```

---

# 9. Template Variables Reference

| Variable                | Source           | Example                  |
| ----------------------- | ---------------- | ------------------------ |
| `{{business_name}}`     | Lead Sheet Col B | ABC Salon                |
| `{{category}}`          | Lead Sheet Col C | Beauty Salon             |
| `{{city}}`              | Lead Sheet Col D | Delhi                    |
| `{{rating}}`            | Lead Sheet Col I | 4.6                      |
| `{{review_count}}`      | Lead Sheet Col J | 128                      |
| `{{website_url}}`       | Lead Sheet Col G | abcsalon.com             |
| `{{website_issue}}`     | Lead Sheet Col N | not mobile friendly      |
| `{{pain_point}}`        | Lead Sheet Col N | No online booking        |
| `{{suggested_service}}` | Lead Sheet Col O | Website Redesign         |
| `{{opportunity}}`       | Lead Sheet Col M | Website                  |
| `{{sender_name}}`       | DB Settings      | Your Name                |
| `{{agency_name}}`       | DB Settings      | NR Rvibe                 |
| `{{agency_website}}`    | DB Settings      | https://nrrevibe.online/ |
| `{{calendar_link}}`     | DB Settings      | Calendly link            |
| `{{unsubscribe_link}}`  | Auto-generated   | Web app URL              |
| `{{original_subject}}`  | Email_Log        | Previous subject         |

---

# 10. Setup Instructions (Step by Step)

## Step 1: Create Two Spreadsheets

```text
1. Google Drive open karein
2. New → Google Sheets → Rename: "NRRvibe_Master_DB"
3. 8 tabs banayein: Raw_Leads, Email_Templates, Email_Log,
   Blacklist, Settings, Activity_Log, Campaigns, Dashboard
4. Har tab mein header row add karein (Section 4 ke hisaab se)

5. New → Google Sheets → Rename: "NRRvibe_Lead_Workspace"
6. 5 tabs banayein: Active_Leads, Followups_Due, Replied_Leads,
   Won_Clients, Quick_Stats
7. Har tab mein header row add karein (Section 5 ke hisaab se)

8. Dono spreadsheets ki ID URL se copy karein:
   https://docs.google.com/spreadsheets/d/[YE_HAI_ID]/edit
```

## Step 2: Apps Script Project Banayein

```text
1. NRRvibe_Lead_Workspace open karein
2. Extensions → Apps Script
3. Project rename: "NRRvibe_Backend"
4. Files banayein (Section 6 ke hisaab se) aur code paste karein
5. Config.gs mein dono Sheet IDs paste karein
```

## Step 3: Script Properties Set Karein

```text
Apps Script → Project Settings → Script Properties → Add:

DB_SHEET_ID       = your_db_spreadsheet_id
LEAD_SHEET_ID     = your_lead_spreadsheet_id
API_SECRET_KEY    = generate_random_32_char_string
SENDER_EMAIL      = you@nrrevibe.online
```

## Step 4: Web App Deploy Karein

```text
1. Apps Script → Deploy → New deployment
2. Type: Web app
3. Description: "NRRvibe Lead API v1"
4. Execute as: Me
5. Who has access: Anyone
6. Deploy → Authorize → Allow all permissions
7. Web App URL copy karein
```

## Step 5: Settings Tab Fill Karein

DB Sheet ke `Settings` tab mein Section 4.5 ke saare rows add karein apni values ke saath.

## Step 6: Email Templates Add Karein

DB Sheet ke `Email_Templates` tab mein Section 8 ke saare templates add karein.

## Step 7: Triggers Setup

```text
Lead Sheet open karein → 🚀 NR Rvibe menu → ⚙️ Setup Triggers
Ya Apps Script mein createAllTriggers() function manually run karein
```

## Step 8: Extension Install Karein

```text
1. chrome://extensions/ open karein
2. Developer mode ON
3. Load unpacked → extension folder select karein
4. Extension icon → Settings
5. Web App URL aur API Secret Key paste karein
6. Test Connection click karein
```

## Step 9: Test Run

```text
1. Google Maps par search karein: "salon in delhi"
2. Extension icon click karein
3. Max leads: 10 set karein
4. Start Collection
5. Preview check karein
6. Push to Google Sheet
7. Lead Sheet open karke verify karein
8. Ek lead approve karein
9. Menu → Create Drafts Only
10. Gmail Drafts check karein
```

## Step 10: Go Live

```text
1. Draft mode mein 20–30 emails manually review karein
2. Quality confirm hone par Settings mein auto_send_enabled = TRUE
3. daily_email_limit = 15 se start karein
4. Har week 5–10 increase karein
5. Reply rate aur bounce rate monitor karein
```

---

# 11. Two-Sheet Sync Rules

## DB → Lead Sheet (Push)

```text
Trigger: Extension push, ya manual "Pull New Leads" menu
Condition: lead_score >= min_lead_score AND email exists AND not duplicate
Direction: One-way (DB creates row in Lead Sheet)
Frequency: On demand
Fields copied: 20 clean fields (raw 44 se filtered)
```

## Lead Sheet → DB (Sync Back)

```text
Trigger: Time-based every 3 hours
Fields synced back:
  - lead_status
  - notes
  - assigned_to
  - deal_value
  - manual template selection
Direction: Lead Sheet updates DB row via db_raw_id
Purpose: DB permanent record maintain kare
```

## Email Actions (Both Sheets)

```text
Email sent →
  DB Email_Log: new row created
  Lead Sheet: email_status, last_contact_date, followup_date updated
  DB Raw_Leads: contact tracking updated

Reply received →
  DB Email_Log: replied = Yes
  Lead Sheet Active_Leads: lead_status = Replied
  Lead Sheet Replied_Leads: new row added
```

---

# 12. Compliance & Safety

## Data Collection Rules

```text
✅ Only publicly visible business information
✅ Business emails only (info@, contact@, hello@)
✅ Respect robots.txt where applicable
✅ Rate limit: max 1 request per 2 seconds to websites
✅ Random delays to avoid detection
✅ No automated Google Maps API abuse
✅ User agent honest, not spoofed

❌ No personal Gmail/Yahoo addresses of individuals
❌ No scraping behind login walls
❌ No storing personal identity data
❌ No aggressive parallel requests
```

## Email Compliance (CAN-SPAM / GDPR / DPDP)

```text
✅ Real sender name and business identity
✅ Valid physical business address in footer
✅ Working unsubscribe link in every email
✅ Honor opt-out within 24 hours
✅ Accurate subject lines, no deception
✅ Clear commercial intent
✅ Remove bounced emails immediately
✅ Maintain suppression list permanently

❌ No purchased email lists
❌ No misleading "Re:" on first email
❌ No hiding sender identity
❌ No sending after opt-out
❌ No mass blasting without approval
```

## Recommended Operating Model

```text
Automatic:  Data collection, scoring, deduplication, template rendering,
            follow-up scheduling, reply tracking

Manual:     Lead approval (checkbox), template selection,
            first-time campaign review

Result:     Fast + Safe + Professional
```

---

# 13. Development Roadmap

## Phase 1 – MVP (Week 1–2)

```text
[ ] Two Google Sheets create with all tabs
[ ] Apps Script: Config, WebApp, DBService, LeadService
[ ] Basic doPost endpoint working
[ ] Chrome Extension: manifest, popup, basic scraper
[ ] Google Maps name, category, phone, address, rating extraction
[ ] Push to DB Sheet working
[ ] Manual lead scoring
```

## Phase 2 – Intelligence (Week 3–4)

```text
[ ] Website URL detection and status check
[ ] Email extraction from websites
[ ] Social media link detection
[ ] Automatic lead scoring algorithm
[ ] Duplicate detection system
[ ] Auto-push qualified leads to Lead Sheet
[ ] Conditional formatting + data validation
```

## Phase 3 – Email Automation (Week 5–6)

```text
[ ] Email_Templates tab + rendering engine
[ ] Draft creation function
[ ] Approved batch sending
[ ] Email_Log recording
[ ] Daily limit + send window enforcement
[ ] Unsubscribe link + doGet handler
[ ] Blacklist system
```

## Phase 4 – Follow-up & Tracking (Week 7–8)

```text
[ ] Follow-up sequence automation
[ ] Time-based triggers setup
[ ] Reply detection via Gmail
[ ] Bounce detection
[ ] Followups_Due tab auto-refresh
[ ] Replied_Leads tab
[ ] Custom menu in Lead Sheet
```

## Phase 5 – Polish (Week 9–10)

```text
[ ] Dashboard with live stats
[ ] Campaign management
[ ] Weekly report email
[ ] Error handling + retry logic
[ ] Extension UI improvements
[ ] Documentation for team
```

## Phase 6 – Advanced (Future)

```text
[ ] AI-generated personalized first line
[ ] Website screenshot capture
[ ] Automated website audit PDF
[ ] Calendar booking integration
[ ] Multi-user team accounts
[ ] White-label version for reselling
[ ] Subscription billing system
```

---

# 14. Error Handling

## Common Errors and Solutions

| Error                             | Cause                     | Solution                                             |
| --------------------------------- | ------------------------- | ---------------------------------------------------- |
| `Exceeded maximum execution time` | Too many leads in one run | Batch process 50 at a time, use continuation token   |
| `Service invoked too many times`  | Gmail quota exceeded      | Check `MailApp.getRemainingDailyQuota()` before send |
| `Invalid API key`                 | Wrong secret in extension | Re-copy from Script Properties                       |
| `Cannot read property of null`    | Sheet tab renamed/missing | Validate tab existence on startup                    |
| `Authorization required`          | Deployment permissions    | Re-deploy with proper scopes                         |
| Duplicate rows appearing          | Cache not refreshed       | Rebuild identifier cache before each batch           |
| Emails going to spam              | Domain not warmed         | Set SPF/DKIM/DMARC, reduce daily volume              |
| Scraper returns empty             | Google Maps DOM changed   | Update selectors in content script                   |

## Retry Logic

```text
FUNCTION withRetry(fn, maxAttempts = 3):
  FOR attempt = 1 to maxAttempts:
      TRY:
          RETURN fn()
      CATCH error:
          IF attempt == maxAttempts:
              logActivity("ERROR", error.message)
              THROW error
          Utilities.sleep(1000 * Math.pow(2, attempt))   // exponential backoff
```

---

# 15. Weekly Report Automation

Har Monday subah automatic email report:

```text
FUNCTION sendWeeklyReport():

  stats = {
      leadsCollected: countThisWeek(Raw_Leads),
      qualified: countQualifiedThisWeek(),
      emailsSent: countEmailsThisWeek(),
      replies: countRepliesThisWeek(),
      replyRate: replies / emailsSent * 100,
      bounces: countBouncesThisWeek(),
      meetings: countMeetingsThisWeek(),
      topCity: getMostProductiveCity(),
      topNiche: getBestPerformingNiche(),
      bestTemplate: getHighestReplyRateTemplate()
  }

  htmlReport = buildReportHTML(stats)

  GmailApp.sendEmail(
      settings.sender_email,
      "NR Rvibe Weekly Lead Report – " + weekRange,
      "",
      { htmlBody: htmlReport }
  )
```

---

# 16. Final System Summary

```text
┌─────────────────────────────────────────────────────┐
│              CHROME EXTENSION                        │
│   Google Maps se data collect kare                   │
│   Website + Social analyze kare                      │
└──────────────────┬──────────────────────────────────┘
                   │ HTTPS POST (JSON + API Key)
                   ▼
┌─────────────────────────────────────────────────────┐
│        GOOGLE APPS SCRIPT WEB APP                    │
│   doPost() → Validate → Score → Dedupe               │
└──────────────────┬──────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
┌───────────────────┐  ┌──────────────────────┐
│  DB SHEET         │  │  LEAD SHEET          │
│  Master Database  │─▶│  Sales Workspace     │
│                   │  │                      │
│  • Raw_Leads      │  │  • Active_Leads      │
│  • Email_Templates│  │  • Followups_Due     │
│  • Email_Log      │  │  • Replied_Leads     │
│  • Blacklist      │  │  • Won_Clients       │
│  • Settings       │  │  • Quick_Stats       │
│  • Activity_Log   │  │                      │
│  • Campaigns      │  │  [Approve Checkbox]  │
│  • Dashboard      │  │                      │
└───────────────────┘  └──────────┬───────────┘
        ▲                         │
        │                         ▼
        │              ┌──────────────────────┐
        │              │  TIME TRIGGERS       │
        └──────────────│  • Send emails       │
                       │  • Follow-ups        │
                       │  • Reply check       │
                       │  • Bounce check      │
                       └──────────┬───────────┘
                                  ▼
                       ┌──────────────────────┐
                       │      GMAIL           │
                       │  Send + Track        │
                       └──────────────────────┘
```

**Final Goal:** NR Rvibe ke liye ek complete, self-hosted, zero-cost lead generation pipeline — Google Maps research se leke email outreach, follow-up aur client conversion tak — sab kuch Google ecosystem ke andar, do organized sheets ke saath.
