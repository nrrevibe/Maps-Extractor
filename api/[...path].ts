import express from 'express';
import { GoogleGenAI } from '@google/genai';
import nodemailer from 'nodemailer';
import dbConnect from '../src/lib/db';
import { Lead } from '../src/models/Lead';
import { Settings } from '../src/models/Settings';

const app = express();
app.disable('etag');

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use((req: any, res: any, next: any) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Get leads via DB
app.get(['/api/leads', '/leads'], async (req: any, res: any) => {
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
app.post(['/api/leads', '/leads'], async (req: any, res: any) => {
  const { leads, settings } = req.body;
  if (!leads || !Array.isArray(leads)) {
    return res.status(400).json({ success: false, error: 'Invalid leads array' });
  }

  try {
    await dbConnect();
    let added = 0;
    let duplicatesSkipped = 0;

    for (const lead of leads) {
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
app.put(['/api/leads/:id', '/leads/:id'], async (req: any, res: any) => {
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
app.delete(['/api/leads/:id', '/leads/:id'], async (req: any, res: any) => {
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
app.post(['/api/leads/bulk-delete', '/leads/bulk-delete'], async (req: any, res: any) => {
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
app.get(['/api/settings', '/settings'], async (req: any, res: any) => {
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
app.post(['/api/settings', '/settings'], async (req: any, res: any) => {
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
app.post(['/api/send-email', '/send-email'], async (req: any, res: any) => {
  const { to, subject, body, smtpSettings = {} } = req.body;
  if (!to || !subject || !body) {
    return res.status(400).json({ success: false, error: 'Missing required parameters (to, subject, body)' });
  }

  const smtpHost = smtpSettings.smtpHost || process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = Number(smtpSettings.smtpPort || process.env.SMTP_PORT || 465);
  const smtpUser = smtpSettings.smtpUser || process.env.SMTP_USER;
  const smtpPass = smtpSettings.smtpPass || process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    return res.status(400).json({ success: false, error: 'SMTP User and App Password must be configured.' });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
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
      from: `"${smtpSettings.senderName || 'NR Revibe Specialists'}" <${smtpUser}>`,
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

// Health Check API
app.get(['/api/health', '/health'], (req: any, res: any) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

// AI Recommendation & Personalization Endpoint using Gemini API
app.post(['/api/ai-recommendation', '/ai-recommendation'], async (req: any, res: any) => {
  try {
    const { lead, agencyName = 'NR Revibe' } = req.body;
    if (!lead) {
      return res.status(400).json({ error: 'Lead object is required' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      const fallbackAnalysis = `${lead.businessName} in ${lead.city} has a Google Rating of ${lead.rating} (${lead.reviewCount} reviews). Their primary opportunity is ${lead.suggestedService} because ${lead.painPoint}. Recommended ${agencyName} strategy: build a modern responsive web app with high-converting CTA.`;
      const fallbackEmail = `Hi ${lead.businessName} Team,\n\nI was looking through local ${lead.category} businesses in ${lead.city} and noticed your Google Business Profile with ${lead.reviewCount} reviews. However, your online presence (${lead.painPoint}) could be losing you direct customer bookings.\n\nAt ${agencyName}, we specialize in Website Development & Social Media Management for local businesses. We can build you a high-converting website with mobile booking and handle your monthly social media content.\n\nWould you be open to seeing a 2-minute mockup concept for ${lead.businessName}?\n\nBest regards,\n${agencyName} Team`;
      
      return res.json({
        success: true,
        aiAnalysis: fallbackAnalysis,
        personalizedEmail: fallbackEmail,
        isFallback: true,
      });
    }

    const prompt = `You are the lead AI Digital Growth Consultant for "${agencyName}".
Analyze this local business lead extracted from Google Maps:
- Business Name: ${lead.businessName}
- Category: ${lead.category}
- City: ${lead.city}
- Rating: ${lead.rating} stars (${lead.reviewCount} reviews)
- Website URL: ${lead.websiteUrl || 'NO WEBSITE'}
- Pain Point: ${lead.painPoint}
- Recommended Service: ${lead.suggestedService}

Tasks:
1. Provide a concise 2-sentence executive AI audit highlight summarizing why this business is losing customers online and how ${agencyName} can help.
2. Draft a highly persuasive, 3-paragraph cold outreach email to the business owner.

Return JSON in this format:
{
  "aiAnalysis": "Executive summary here",
  "personalizedEmail": "Subject: ... \\n\\nEmail body here"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash', // Match the model used in server.ts
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

// Background Email Campaign Queue
interface CampaignTask {
  id: string;
  leads: any[];
  smtpSettings: any;
  status: 'running' | 'completed' | 'failed';
  total: number;
  sent: number;
  errors: number;
  logs: string[];
}

const campaigns: Record<string, CampaignTask> = {};

app.post(['/api/campaign/start', '/campaign/start'], async (req: any, res: any) => {
  const { leads, smtpSettings } = req.body;
  if (!leads || !Array.isArray(leads)) {
    return res.status(400).json({ error: 'Invalid leads array' });
  }

  const campaignId = 'camp_' + Date.now();
  campaigns[campaignId] = {
    id: campaignId,
    leads,
    smtpSettings,
    status: 'running',
    total: leads.length,
    sent: 0,
    errors: 0,
    logs: [`[${new Date().toLocaleTimeString()}] Campaign ${campaignId} started for ${leads.length} leads`]
  };

  processCampaign(campaignId).catch(console.error);

  res.json({ success: true, campaignId });
});

app.get(['/api/campaign/status/:id', '/campaign/status/:id'], (req: any, res: any) => {
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
        from: `"${campaign.smtpSettings.senderName || 'NR Revibe'}" <${smtpUser}>`,
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
      const followUp = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];
      
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

      // Delay to avoid SMTP rate limits
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

export default app;
