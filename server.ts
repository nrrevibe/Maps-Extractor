import express from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { calculateLeadScore } from './src/utils/scoring';
import dbConnect from './src/lib/db';
import { Lead } from './src/models/Lead';
import nodemailer from 'nodemailer';

dotenv.config();

const app = express();
app.disable('etag');
const PORT = 8081;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Enable CORS for all domains (e.g. Vercel, Google Maps Extension)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

import { Settings } from './src/models/Settings';

// Get leads via DB
app.get('/api/leads', async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  try {
    await dbConnect();
    const skip = (Number(page) - 1) * Number(limit);
    const leads = await Lead.find().sort({ createdAt: -1 }).skip(skip).limit(Number(limit));
    const total = await Lead.countDocuments();
    res.json({ success: true, leads, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Bulk Insert/Update leads via Extension Push
app.post('/api/leads', async (req, res) => {
  const { leads, settings } = req.body;
  if (!leads || !Array.isArray(leads)) {
    return res.status(400).json({ success: false, error: 'Invalid leads array' });
  }

  try {
    await dbConnect();
    let added = 0;
    let duplicatesSkipped = 0;

    for (const lead of leads) {
      // Basic dedup by ID or Phone or Business Name based on your DB logic
      const existing = await Lead.findOne({ id: lead.id });
      if (existing) {
        if (settings?.updateExisting) {
          await Lead.updateOne({ id: lead.id }, { $set: lead });
          added++;
        } else {
          duplicatesSkipped++;
        }
      } else {
        await Lead.create(lead);
        added++;
      }
    }

    res.json({ success: true, data: { added, duplicatesSkipped } });
  } catch(e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Update a lead via DB
app.put('/api/leads/:id', async (req, res) => {
  const { id } = req.params;
  const { lead } = req.body;
  
  if (!lead) return res.status(400).json({ success: false, error: 'Missing lead body' });

  try {
    await dbConnect();
    const updated = await Lead.findOneAndUpdate({ id }, { $set: lead }, { new: true });
    if (!updated) return res.status(404).json({ success: false, error: 'Lead not found' });
    res.json({ success: true, lead: updated });
  } catch(e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Delete a local lead
app.delete('/api/leads/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await dbConnect();
    await Lead.findOneAndDelete({ id });
    res.json({ success: true, message: `Lead ${id} deleted.` });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Bulk Delete leads
app.post('/api/leads/bulk-delete', async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids)) {
    return res.status(400).json({ success: false, error: 'Invalid ids array' });
  }
  
  try {
    await dbConnect();
    const result = await Lead.deleteMany({ id: { $in: ids } });
    res.json({ success: true, deletedCount: result.deletedCount });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Get Settings
app.get('/api/settings', async (req, res) => {
  try {
    await dbConnect();
    const settingsDocs = await Settings.find();
    const settings = settingsDocs.reduce((acc, doc) => {
      acc[doc.key] = doc.value;
      return acc;
    }, {} as any);
    res.json({ success: true, settings });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Save Settings
app.post('/api/settings', async (req, res) => {
  const { settings } = req.body;
  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ success: false, error: 'Invalid settings object' });
  }

  try {
    await dbConnect();
    for (const [key, value] of Object.entries(settings)) {
      await Settings.findOneAndUpdate(
        { key },
        { key, value },
        { upsert: true, new: true }
      );
    }
    res.json({ success: true });
  } catch(e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Send Email via SMTP using App Password
app.post('/api/send-email', async (req, res) => {
  const { to, subject, body, smtpSettings = {} } = req.body;
  if (!to || !subject || !body) {
    return res.status(400).json({ success: false, error: 'Missing required parameters (to, subject, body)' });
  }

  const smtpHost = smtpSettings.smtpHost || process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = Number(smtpSettings.smtpPort || process.env.SMTP_PORT || 465);
  const smtpUser = smtpSettings.smtpUser || process.env.SMTP_USER;
  const smtpPass = smtpSettings.smtpPass || process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    return res.status(400).json({ success: false, error: 'SMTP User and App Password must be configured either in the settings UI or in the server .env file.' });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465, // true for 465, false for 587 or 25
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
</head>
<body style="font-family: Arial, sans-serif; font-size: 14px; color: #333333; line-height: 1.6;">
${body.replace(/\r?\n/g, '<br/>')}
</body>
</html>
    `.trim();

    const info = await transporter.sendMail({
      from: `"${smtpSettings.senderName || 'NR Rvibe Specialists'}" <${smtpUser}>`,
      to,
      subject,
      text: body,
      html: htmlContent,
    });

    res.json({ success: true, messageId: info.messageId });
  } catch (err: any) {
    console.error('SMTP Send Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Initialize server-side Gemini API client lazily or when key is present
function getGeminiClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return null;
  }
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Health Check API
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Extract Leads Endpoint (Now expects real-time extraction via Chrome Extension)
app.post('/api/extract', (req, res) => {
  const { keyword = 'Web Designer', location = 'New York' } = req.body;
  res.json({
    success: true,
    message: 'For real-time lead extraction, please use the NR Rvibe Chrome Extension directly on Google Maps.',
    count: 0,
    keyword,
    location,
    leads: [],
  });
});

// AI Recommendation & Personalization Endpoint using Gemini API
app.post('/api/ai-recommendation', async (req, res) => {
  try {
    const { lead, agencyName = 'NR Rvibe' } = req.body;
    if (!lead) {
      return res.status(400).json({ error: 'Lead object is required' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      // Fallback if GEMINI_API_KEY is not set
      const fallbackAnalysis = `${lead.businessName} in ${lead.city} has a Google Rating of ${lead.rating} (${lead.reviewCount} reviews). Their primary opportunity is ${lead.suggestedService} because ${lead.painPoint}. Recommended NR Rvibe strategy: build a modern responsive web app with high-converting CTA and integrate active Instagram Reels.`;
      const fallbackEmail = `Hi ${lead.businessName} Team,\n\nI was looking through local ${lead.category} businesses in ${lead.city} and noticed your Google Business Profile with ${lead.reviewCount} reviews. However, your online presence (${lead.painPoint}) could be losing you direct customer bookings.\n\nAt ${agencyName}, we specialize in Website Development & Social Media Management for local businesses. We can build you a high-converting website with mobile booking and handle your monthly social media content.\n\nWould you be open to seeing a 2-minute mockup concept for ${lead.businessName}?\n\nBest regards,\nNR Rvibe Team`;
      
      return res.json({
        success: true,
        aiAnalysis: fallbackAnalysis,
        personalizedEmail: fallbackEmail,
        isFallback: true,
      });
    }

    const prompt = `You are the lead AI Digital Growth Consultant for "${agencyName}", a premier Web Development and Social Media Agency.
Analyze this local business lead extracted from Google Maps:
- Business Name: ${lead.businessName}
- Category: ${lead.category}
- City: ${lead.city}
- Rating: ${lead.rating} stars (${lead.reviewCount} reviews)
- Website URL: ${lead.websiteUrl || 'NO WEBSITE'}
- Website Status: ${lead.websiteStatus} (${lead.websiteTechnology || 'N/A'})
- HTTPS Secure: ${lead.https ? 'Yes' : 'No'}
- Mobile Friendly: ${lead.mobileFriendly ? 'Yes' : 'No'}
- Social Media Status: ${lead.socialStatus}
- Pain Point: ${lead.painPoint}
- Recommended NR Rvibe Service: ${lead.suggestedService}

Tasks:
1. Provide a concise 2-sentence executive AI audit highlight summarizing why this business is losing customers online and how NR Rvibe can help.
2. Draft a highly persuasive, 3-paragraph cold outreach email to the business owner highlighting specific opportunities for ${lead.businessName}.

Return JSON in this format:
{
  "aiAnalysis": "Executive summary here",
  "personalizedEmail": "Subject: ... \\n\\nEmail body here"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const outputText = response.text || '';
    let parsed = { aiAnalysis: '', personalizedEmail: '' };
    try {
      parsed = JSON.parse(outputText);
    } catch {
      parsed = {
        aiAnalysis: outputText,
        personalizedEmail: `Hi ${lead.businessName} Team,\n\nWe analyzed your digital presence in ${lead.city} and identified major opportunities to grow your revenue via website and social media optimization.`,
      };
    }

    res.json({
      success: true,
      aiAnalysis: parsed.aiAnalysis,
      personalizedEmail: parsed.personalizedEmail,
      isFallback: false,
    });
  } catch (err: any) {
    console.error('Gemini AI error:', err);
    res.status(500).json({ error: 'AI generation failed', message: err.message });
  }
});

// ── Background Email Campaign Queue ───────────────────────────────────────────
interface CampaignTask {
  id: string;
  leads: any[];
  smtpSettings: any;
  scriptUrl: string;
  status: 'running' | 'completed' | 'failed';
  total: number;
  sent: number;
  errors: number;
  logs: string[];
}

const campaigns: Record<string, CampaignTask> = {};

app.post('/api/campaign/start', async (req, res) => {
  const { leads, smtpSettings, scriptUrl } = req.body;
  if (!leads || !Array.isArray(leads)) {
    return res.status(400).json({ error: 'Invalid leads array' });
  }

  const campaignId = 'camp_' + Date.now();
  campaigns[campaignId] = {
    id: campaignId,
    leads,
    smtpSettings,
    scriptUrl,
    status: 'running',
    total: leads.length,
    sent: 0,
    errors: 0,
    logs: [`[${new Date().toLocaleTimeString()}] Campaign ${campaignId} started for ${leads.length} leads`]
  };

  // Start background process (fire and forget)
  processCampaign(campaignId).catch(console.error);

  res.json({ success: true, campaignId });
});

app.get('/api/campaign/status/:id', (req, res) => {
  const campaign = campaigns[req.params.id];
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  res.json(campaign);
});

async function processCampaign(id: string) {
  const campaign = campaigns[id];
  
  const smtpHost = campaign.smtpSettings.smtpHost || process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = Number(campaign.smtpSettings.smtpPort || process.env.SMTP_PORT || 465);
  const smtpUser = campaign.smtpSettings.smtpUser || process.env.SMTP_USER;
  const smtpPass = campaign.smtpSettings.smtpPass || process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    campaign.status = 'failed';
    campaign.logs.push('[ERROR] SMTP User and App Password must be configured.');
    return;
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass }
  });
  
  for (const item of campaign.leads) {
    try {
      campaign.logs.push(`[${new Date().toLocaleTimeString()}] Preparing outreach email for ${item.lead.businessName} (${item.to})...`);
      
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
</head>
<body style="font-family: Arial, sans-serif; font-size: 14px; color: #333333; line-height: 1.6;">
${item.body.replace(/\r?\n/g, '<br/>')}
</body>
</html>
      `.trim();

      const mailOptions = {
        from: `"${campaign.smtpSettings.senderName || 'NR Rvibe'}" <${smtpUser}>`,
        to: item.to,
        subject: item.subject,
        text: item.body,
        html: htmlContent
      };
      
      await transporter.sendMail(mailOptions);
      campaign.sent++;
      campaign.logs.push(`[SUCCESS] Email successfully sent to ${item.to} via SMTP!`);
      
      // Update MongoDB Lead Status
      const today = new Date().toISOString().split('T')[0];
      const followUp = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]; // Default 3 days if not passed
      
      const updatedLead = {
        ...item.lead,
        emailStatus: 'Sent',
        leadStatus: 'Contacted',
        lastContactDate: today,
        followUpDate: followUp,
        contactAttempts: (item.lead.contactAttempts || 0) + 1,
      };
      
      try {
        await dbConnect();
        await Lead.findOneAndUpdate({ id: item.lead.id }, { $set: updatedLead });
      } catch (e) {
        console.error('Failed to update lead status in DB:', e);
      }

      // Delay to avoid SMTP rate limits (e.g. Google's 100/sec burst limit)
      await new Promise(r => setTimeout(r, 2000));
    } catch (e: any) {
      campaign.errors++;
      campaign.logs.push(`[ERROR] Failed to send to ${item.to}: ${e.message}`);
      
      try {
        await dbConnect();
        await Lead.findOneAndUpdate({ id: item.lead.id }, { $set: { emailStatus: 'Failed' } });
      } catch (err) {
        console.error('Failed to update lead failure status in DB:', err);
      }
    }
  }
  campaign.status = 'completed';
  campaign.logs.push(`[SUCCESS] Campaign run complete!`);
}

async function startServer() {
// Move routes above startServer to make them global

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NR Rvibe Lead Gen Server running on http://0.0.0.0:${PORT}`);
  });
  
  // Global error handler to prevent crashes
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Express Error:', err.message);
    if (err.type === 'entity.too.large') {
      res.status(413).json({ error: 'Payload too large. Please reduce the size of your request.' });
    } else {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
}

// Only start the server locally, not when deployed as a serverless function on Vercel
if (process.env.VERCEL !== '1') {
  startServer();
}

export default app;
