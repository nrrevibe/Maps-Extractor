import express from 'express';
import { GoogleGenAI } from '@google/genai';
import nodemailer from 'nodemailer';

const app = express();
app.use(express.json());

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use((req: any, res: any, next: any) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

// ── Inline Lead Scoring (mirrors src/utils/scoring.ts) ───────────────────────
function calculateLeadScore(lead: any) {
  let score = 0;
  const painPoints: string[] = [];
  const customTags: string[] = [];

  if (!lead.websiteUrl || lead.websiteStatus === 'No Website') {
    score += 30; painPoints.push('No dedicated business website'); customTags.push('No Website');
  } else if (lead.websiteStatus === 'Broken') {
    score += 25; painPoints.push('Website link is broken or offline'); customTags.push('Broken Site');
  } else {
    if (!lead.https) { score += 15; painPoints.push('Website lacks HTTPS security SSL certificate'); customTags.push('Unsecure HTTP'); }
    if (lead.mobileFriendly === false) { score += 15; painPoints.push('Website is not mobile responsive'); customTags.push('Broken Mobile'); }
    if (lead.websiteQuality === 'Poor') { score += 10; painPoints.push('Outdated website layout & design'); customTags.push('Outdated Design'); }
  }

  if (lead.socialStatus === 'Missing' || (!lead.instagramUrl && !lead.facebookUrl)) {
    score += 20; painPoints.push('No active Instagram or Facebook presence'); customTags.push('Missing Social');
  } else if (lead.socialStatus === 'Inactive') {
    score += 15; painPoints.push('Social media profile inactive for over 90 days'); customTags.push('Inactive Social');
  }

  if ((lead.rating || 0) >= 4.0) score += 5;
  if ((lead.reviewCount || 0) >= 100) { score += 10; painPoints.push('High Google review count but weak online conversion path'); customTags.push('High Intent (100+ Reviews)'); }
  if ((lead.rating || 0) >= 3.5 && (lead.rating || 0) <= 4.8) score += 5;

  score = Math.min(100, Math.max(0, score));

  let priority = 'Low Priority';
  if (score >= 80) priority = 'Hot Lead';
  else if (score >= 60) priority = 'High Priority';
  else if (score >= 40) priority = 'Medium Priority';

  const hasWebIssue = !lead.websiteUrl || lead.websiteStatus === 'No Website' || lead.websiteStatus === 'Broken' || !lead.https || lead.mobileFriendly === false || lead.websiteQuality === 'Poor';
  const hasSocialIssue = lead.socialStatus === 'Missing' || lead.socialStatus === 'Inactive' || !lead.instagramUrl;

  let opportunityType = 'Both';
  if (hasWebIssue && hasSocialIssue) opportunityType = 'Both';
  else if (hasWebIssue) opportunityType = 'Website';
  else if (hasSocialIssue) opportunityType = 'Social Media';
  else opportunityType = 'SEO';

  let suggestedService = 'Complete Digital Growth Package';
  if (!lead.websiteUrl || lead.websiteStatus === 'No Website') {
    suggestedService = lead.socialStatus === 'Active' ? 'Website + Social Media Integration' : 'New Website Development';
  } else if (lead.websiteQuality === 'Poor') { suggestedService = 'Website Redesign'; }
  else if (lead.mobileFriendly === false) { suggestedService = 'Responsive Website Redesign'; }
  else if (hasSocialIssue && !hasWebIssue) { suggestedService = 'Social Media Management & Content Design'; }
  else if ((lead.reviewCount || 0) >= 100 && lead.websiteQuality !== 'Good') { suggestedService = 'Premium Website Package + Booking System'; }
  else if (!hasWebIssue && !hasSocialIssue) { suggestedService = 'Local SEO & Google Profile Optimization'; }

  let estimatedValueNum = 15000;
  if (score >= 80) estimatedValueNum = 25000 + ((lead.reviewCount || 0) * 50);
  else if (score >= 60) estimatedValueNum = 15000 + ((lead.reviewCount || 0) * 20);
  else estimatedValueNum = 8000;
  estimatedValueNum = Math.min(75000, Math.round(estimatedValueNum / 500) * 500);
  const revenuePotential = `₹${estimatedValueNum.toLocaleString('en-IN')}`;
  const aiConversionProbability = Math.min(98, Math.max(45, Math.round(score * 0.92 + ((lead.reviewCount || 0) > 100 ? 8 : 0))));

  return { score, priority, opportunityType, painPoints, suggestedService, revenuePotential, aiConversionProbability, customTags };
}

const API_KEY = 'nr-revibe-secure-key-2026';

// ── GET /api/leads ─────────────────────────────────────────────────────────────
app.get('/api/leads', async (req: any, res: any) => {
  const { scriptUrl } = req.query;
  if (!scriptUrl || typeof scriptUrl !== 'string') return res.json({ success: true, leads: [] });
  try {
    const response = await fetch(`${scriptUrl}?action=get_leads&apiKey=${API_KEY}`);
    const data = await response.json();
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── POST /api/leads ────────────────────────────────────────────────────────────
app.post('/api/leads', async (req: any, res: any) => {
  const { leads } = req.body;
  const { scriptUrl } = req.query;
  if (!leads || !Array.isArray(leads)) return res.status(400).json({ success: false, error: 'Invalid leads array' });

  const processed = leads.map((l: any) => {
    const audit = calculateLeadScore(l);
    return { ...l, leadScore: audit.score, leadPriority: audit.priority, opportunityType: audit.opportunityType, painPoint: audit.painPoints.join(' • ') || 'Digital presence refresh recommended', suggestedService: audit.suggestedService };
  });

  if (scriptUrl && typeof scriptUrl === 'string') {
    try {
      await fetch(scriptUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'sync_leads', apiKey: API_KEY, leads: processed }) });
    } catch (e) {}
  }
  res.json({ success: true, count: processed.length, leads: processed });
});

// ── PUT /api/leads/:id ─────────────────────────────────────────────────────────
app.put('/api/leads/:id', async (req: any, res: any) => {
  const { id } = req.params;
  const { lead } = req.body;
  const { scriptUrl } = req.query;
  if (!lead) return res.status(400).json({ success: false, error: 'Missing lead body' });
  if (scriptUrl && typeof scriptUrl === 'string') {
    try {
      const response = await fetch(scriptUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_lead', apiKey: API_KEY, lead: { ...lead, id } }) });
      const data = await response.json();
      return res.json(data);
    } catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
  }
  res.json({ success: true });
});

// ── DELETE /api/leads/:id ──────────────────────────────────────────────────────
app.delete('/api/leads/:id', async (req: any, res: any) => {
  const { id } = req.params;
  const { scriptUrl } = req.query;
  if (scriptUrl && typeof scriptUrl === 'string') {
    try {
      await fetch(scriptUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete_lead', apiKey: API_KEY, leadId: id }) });
    } catch (e: any) { console.error('Failed to delete lead from Google Sheets:', e.message); }
  }
  res.json({ success: true, message: `Lead ${id} delete request sent.` });
});

// ── GET /api/settings ──────────────────────────────────────────────────────────
app.get('/api/settings', async (req: any, res: any) => {
  const { scriptUrl } = req.query;
  if (!scriptUrl || typeof scriptUrl !== 'string') return res.json({ success: true, settings: {} });
  try {
    const response = await fetch(`${scriptUrl}?action=get_settings&apiKey=${API_KEY}`);
    const data = await response.json();
    res.json(data);
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

// ── POST /api/settings ─────────────────────────────────────────────────────────
app.post('/api/settings', async (req: any, res: any) => {
  const { settings } = req.body;
  const { scriptUrl } = req.query;
  if (scriptUrl && typeof scriptUrl === 'string') {
    try {
      const response = await fetch(scriptUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save_settings', settings }) });
      const data = await response.json();
      return res.json(data);
    } catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
  }
  res.json({ success: true });
});

// ── POST /api/send-email ───────────────────────────────────────────────────────
app.post('/api/send-email', async (req: any, res: any) => {
  const { to, subject, body, smtpSettings = {} } = req.body;
  if (!to || !subject || !body) return res.status(400).json({ success: false, error: 'Missing required parameters (to, subject, body)' });

  const smtpHost = smtpSettings.smtpHost || process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = Number(smtpSettings.smtpPort || process.env.SMTP_PORT || 465);
  const smtpUser = smtpSettings.smtpUser || process.env.SMTP_USER;
  const smtpPass = smtpSettings.smtpPass || process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) return res.status(400).json({ success: false, error: 'SMTP User and App Password must be configured.' });

  try {
    const transporter = nodemailer.createTransport({ host: smtpHost, port: smtpPort, secure: smtpPort === 465, auth: { user: smtpUser, pass: smtpPass } });
    const info = await transporter.sendMail({ from: `"${smtpSettings.senderName || 'NR Revibe'}" <${smtpUser}>`, to, subject, text: body, html: body.replace(/\n/g, '<br>') });
    res.json({ success: true, messageId: info.messageId });
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

// ── GET /api/health ────────────────────────────────────────────────────────────
app.get('/api/health', (_req: any, res: any) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── POST /api/ai-recommendation ────────────────────────────────────────────────
app.post('/api/ai-recommendation', async (req: any, res: any) => {
  try {
    const { lead, agencyName = 'NR Revibe' } = req.body;
    if (!lead) return res.status(400).json({ error: 'Lead object is required' });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      const fallbackAnalysis = `${lead.businessName} in ${lead.city} has a Google Rating of ${lead.rating} (${lead.reviewCount} reviews). Their primary opportunity is ${lead.suggestedService} because ${lead.painPoint}.`;
      const fallbackEmail = `Hi ${lead.businessName} Team,\n\nWe noticed your business in ${lead.city} and identified opportunities to grow your online presence.\n\nAt ${agencyName}, we specialize in Website Development & Social Media Management for local businesses.\n\nBest regards,\n${agencyName} Team`;
      return res.json({ success: true, aiAnalysis: fallbackAnalysis, personalizedEmail: fallbackEmail, isFallback: true });
    }

    const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
    const prompt = `You are the lead AI Digital Growth Consultant for "${agencyName}".\nAnalyze this lead:\n- Business: ${lead.businessName}\n- Category: ${lead.category}\n- City: ${lead.city}\n- Rating: ${lead.rating} (${lead.reviewCount} reviews)\n- Website: ${lead.websiteUrl || 'NO WEBSITE'}\n- Pain Point: ${lead.painPoint}\n- Suggested Service: ${lead.suggestedService}\n\nReturn JSON: { "aiAnalysis": "2-sentence executive summary", "personalizedEmail": "Subject: ...\\n\\nEmail body" }`;

    const response = await ai.models.generateContent({ model: 'gemini-2.0-flash', contents: prompt, config: { responseMimeType: 'application/json' } });
    const outputText = response.text || '';
    let parsed = { aiAnalysis: outputText, personalizedEmail: `Hi ${lead.businessName} Team,\n\nWe analyzed your digital presence in ${lead.city} and identified major growth opportunities.\n\nBest regards,\n${agencyName}` };
    try { parsed = JSON.parse(outputText); } catch {}

    res.json({ success: true, aiAnalysis: parsed.aiAnalysis, personalizedEmail: parsed.personalizedEmail, isFallback: false });
  } catch (err: any) {
    console.error('Gemini AI error:', err);
    res.status(500).json({ error: 'AI generation failed', message: err.message });
  }
});

export default app;
