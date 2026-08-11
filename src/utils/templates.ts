import { EmailTemplate, Lead, AgencySettings } from '../types';

export const getAvailableTemplates = (settings: AgencySettings): EmailTemplate[] => {
  if (!settings.customTemplates || settings.customTemplates.length === 0) {
    return DEFAULT_EMAIL_TEMPLATES;
  }
  return settings.customTemplates;
};

export const DEFAULT_EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'tmpl-1',
    name: 'Website Improvement',
    category: 'Website Improvement',
    subject: 'A few ideas for {{business_name}} online',
    body: `Hi {{business_name}} Team,

I came across your profile while searching for top-rated {{category}} businesses in {{city}}. First off, congratulations on your {{google_rating}} star rating—it's clear your customers love what you do!

While checking out your online presence, I noticed that {{website_issue}}. In my experience, a modern, fully optimized website makes a massive difference in converting local traffic into actual paying customers. 

At {{agency_name}}, we specialize in helping businesses like yours upgrade their digital footprint to get more direct bookings and calls. 

Would you be open to a quick, no-pressure chat to see some examples of what we could do for {{business_name}}?

Best regards,

{{sender_name}}
{{agency_name}}
{{agency_website}}
{{agency_phone}}`,
  },
  {
    id: 'tmpl-2',
    name: 'No Website Lead',
    category: 'No Website',
    subject: 'Missing out on local searches in {{city}}?',
    body: `Hi {{business_name}} Team,

I was looking for a {{category}} in {{city}} and found your Google Maps listing. While your local reputation looks solid, I noticed that you don't currently have a dedicated website linked to your profile.

Right now, when people search for your services, a clean, mobile-friendly website is often the deciding factor in whether they call you or a competitor. 

At {{agency_name}}, we build affordable, high-converting websites specifically for local businesses. A proper site will allow your customers to easily find your services, view your pricing, and contact you directly.

I'd love to share a quick mock-up of a website design tailored for {{business_name}}. Are you free for a quick 10-minute call this week? 

You can grab a time that works for you right here: {{calendar_link}}

Best regards,

{{sender_name}}
{{agency_name}}
{{agency_website}}
{{agency_phone}}`,
  },
  {
    id: 'tmpl-3',
    name: 'Social Media Management',
    category: 'Social Media',
    subject: 'Growing {{business_name}}\'s online presence',
    body: `Hi {{business_name}} Team,

I've been following your work and really love what you're doing in the {{city}} area! 

While looking at your online footprint, I noticed that you have {{social_media_issue}}. For a local {{category}} business, an active and engaging social media presence is one of the most effective ways to build trust and stay top-of-mind with your community.

At {{agency_name}}, we take the heavy lifting off your plate. We handle content creation, daily posting, and audience engagement so you can focus entirely on running your business. 

Would you be open to seeing a quick, custom content strategy we put together for {{business_name}}? 

Best regards,

{{sender_name}}
{{agency_name}}
{{agency_website}}
{{agency_instagram}}`,
  },
  {
    id: 'tmpl-4',
    name: 'Combined Growth Package',
    category: 'Combined Growth',
    subject: 'Scaling {{business_name}} this quarter',
    body: `Hi {{business_name}} Team,

I was doing some research on the top {{category}} businesses in {{city}} and was really impressed by your {{review_count}} positive reviews! 

However, I did notice a few missed opportunities online—specifically that {{website_issue}} and you have {{social_media_issue}}. 

At {{agency_name}}, we provide a complete digital growth package that fixes exactly this. We help local businesses upgrade their websites, optimize their Google Business Profiles, and manage their social media to drive consistent, predictable revenue.

I’d love to show you how our {{recommended_service}} could bring more direct leads to {{business_name}}. 

Do you have 10 minutes this week for a quick introduction? 

Best regards,

{{sender_name}}
{{agency_name}}
{{agency_website}}
{{agency_phone}}`,
  },
  {
    id: 'tmpl-5',
    name: 'Follow-Up 1 (3 Days)',
    category: 'Follow-Up 1',
    subject: 'Re: A few ideas for {{business_name}} online',
    body: `Hi {{business_name}} Team,

I know things get incredibly busy, so I just wanted to quickly float this to the top of your inbox. 

I firmly believe there is a lot of untapped potential for {{business_name}} online, and I'd love to share a few actionable strategies with you. 

If you have a quick 5 minutes, you can pick a time on my calendar here: {{calendar_link}}

Speak soon!

{{sender_name}}
{{agency_name}}
{{agency_website}}`,
  },
  {
    id: 'tmpl-6',
    name: 'Follow-Up 2 (7 Days)',
    category: 'Follow-Up 2',
    subject: 'Checking in - {{business_name}}',
    body: `Hi {{business_name}} Team,

I haven't heard back, so I'll assume that upgrading your digital presence isn't a priority right now, which is completely fine! 

I'll stop reaching out, but please keep my contact information handy. If you ever need help with a website, SEO, or social media to help grow your {{category}} business, {{agency_name}} is always here to help.

Wishing you the best of luck with the business!

Best regards,

{{sender_name}}
{{agency_name}}
{{agency_website}}
{{agency_phone}}`,
  },
];

export const DEFAULT_WHATSAPP_TEMPLATES: EmailTemplate[] = [
  {
    id: 'wa-1',
    name: 'Quick Intro (General)',
    category: 'General Intro',
    subject: '',
    body: `Hi {{business_name}} Team 👋,\n\nI'm {{sender_name}} from {{agency_name}}. I noticed your local business on Google Maps in {{city}}.\n\nWe help businesses like yours get more customers through better websites and social media.\n\nWould you be open to a quick chat? Let me know!\n\nWebsite: {{agency_website}}`,
  },
  {
    id: 'wa-2',
    name: 'Website Pitch',
    category: 'Website Pitch',
    subject: '',
    body: `Hey {{business_name}}! 🚀\n\nI saw your profile on Google Maps. I noticed that {{website_issue}}.\n\nWe specialize in creating affordable, modern websites that drive bookings. Want me to send over a quick mock-up of what we could do for you?\n\n- {{sender_name}}`,
  },
  {
    id: 'wa-3',
    name: 'Social Media Growth',
    category: 'Social Media',
    subject: '',
    body: `Hi {{business_name}}! 📱\n\nI was checking out your business online and noticed that you have {{social_media_issue}}.\n\nWe help {{category}} businesses in {{city}} grow their online presence and get more leads through Instagram and Facebook.\n\nWould you be open to a quick 5-min chat this week? Let me know!\n\nBest, {{sender_name}} from {{agency_name}}`,
  },
  {
    id: 'wa-4',
    name: 'Leverage High Reviews',
    category: 'Review Management',
    subject: '',
    body: `Hey there! 👋\n\nAmazing job on your {{google_rating}} rating with {{review_count}} reviews on Google Maps! That's huge for a local business in {{city}}.\n\nSince you already have great word-of-mouth, a solid website and booking system could double your inbound leads.\n\nWe handle exactly this at {{agency_name}}. Want to see a quick example of what we can do?`,
  },
  {
    id: 'wa-5',
    name: 'Direct Call / Meeting',
    category: 'Meeting Booking',
    subject: '',
    body: `Hi {{business_name}} Team! 🗓️\n\nI'm {{sender_name}} with {{agency_name}}.\n\nWe provide {{recommended_service}} for businesses in your area. I'd love to jump on a quick 10-minute call to see if we'd be a good fit to help you scale.\n\nYou can pick a time on my calendar here: {{calendar_link}}\n\nTalk soon!`,
  },
  {
    id: 'wa-6',
    name: 'No Website Lead',
    category: 'No Website',
    subject: '',
    body: `Hi {{business_name}}! 👋\n\nI couldn't find a website for your business on Google Maps in {{city}}.\n\nHaving a simple mobile-friendly site helps customers book you directly. We build these specifically for {{category}} businesses.\n\nWant to see a quick mock-up of what it could look like? Let me know!\n\n- {{sender_name}}`,
  },
  {
    id: 'wa-7',
    name: 'Combined Growth Package',
    category: 'Combined Growth',
    subject: '',
    body: `Hey {{business_name}} Team 🚀\n\nI saw your profile on Google Maps. We help {{category}} businesses get more customers by fixing {{website_issue}} and managing social media.\n\nWe do everything from websites to Instagram growth. Open to seeing a quick free report on how you can improve your online presence?`,
  },
  {
    id: 'wa-8',
    name: 'Follow-Up 1 (3 Days)',
    category: 'Follow-Up 1',
    subject: '',
    body: `Hi again! 👋 Just bubbling this up to the top of your messages.\n\nWould love to chat about getting {{business_name}} more leads through a better online presence when you have a minute!`,
  },
  {
    id: 'wa-9',
    name: 'Follow-Up 2 (7 Days)',
    category: 'Follow-Up 2',
    subject: '',
    body: `Hey {{business_name}} Team - I know you're super busy running the business! 🏃‍♂️\n\nThis will be my last message, but if you ever need help with a website or social media to grow your {{category}} business, you have my number!\n\nWebsite: {{agency_website}}`,
  }
];

export function getTemplateVariables(lead: Lead, settings: AgencySettings): Record<string, string> {
  let issueText = lead.customWebsiteIssue;
  if (!issueText) {
    if (lead.websiteStatus === 'No Website' || !lead.websiteUrl || lead.websiteUrl === 'N/A') {
      issueText = "you don't currently have a dedicated website";
    } else if (!lead.mobileFriendly && !lead.https) {
      issueText = 'your website lacks mobile optimization and a secure connection (HTTPS)';
    } else if (!lead.mobileFriendly) {
      issueText = 'your website lacks mobile optimization';
    } else if (!lead.https) {
      issueText = 'your website is missing a secure connection (HTTPS)';
    } else if (lead.websiteQuality === 'Poor') {
      issueText = 'your website could use a modern redesign to improve conversions';
    } else {
      issueText = 'your website could be optimized to bring in more direct leads';
    }
  }

  let socialIssueText = lead.customSocialIssue;
  if (!socialIssueText) {
    if (lead.socialStatus === 'Inactive') {
      socialIssueText = 'some inactive social media profiles';
    } else if (lead.socialStatus === 'Missing' || (!lead.instagramUrl && !lead.facebookUrl)) {
      socialIssueText = 'missing links to your social media profiles';
    } else {
      socialIssueText = 'room to grow your social media presence';
    }
  }

  let recService = lead.customService;
  if (!recService) {
     if (lead.suggestedService) {
        recService = lead.suggestedService;
     } else if (lead.websiteStatus === 'No Website' || !lead.websiteUrl || lead.websiteUrl === 'N/A') {
        recService = 'Custom Website Development';
     } else if (socialIssueText.includes('inactive') || socialIssueText.includes('missing')) {
        recService = 'Website Optimization & Social Media Management';
     } else {
        recService = 'our Complete Digital Growth Package';
     }
  }

  return {
    '{{business_name}}': lead.businessName || 'Business',
    '{{owner_name}}': 'Team',
    '{{city}}': lead.city || 'your area',
    '{{category}}': lead.category || 'local',
    '{{website_url}}': lead.websiteUrl || 'N/A',
    '{{website_issue}}': issueText,
    '{{social_media_issue}}': socialIssueText,
    '{{google_rating}}': (lead.rating || 4.5).toString(),
    '{{review_count}}': (lead.reviewCount || 25).toString(),
    '{{recommended_service}}': recService,
    '{{sender_name}}': settings.senderName || 'NR Rvibe Specialist',
    '{{agency_name}}': settings.agencyName || 'NR Rvibe',
    '{{agency_website}}': settings.agencyWebsite || 'https://www.nrrevibe.online',
    '{{agency_phone}}': settings.agencyPhone || '',
    '{{agency_instagram}}': settings.agencyInstagram || '',
    '{{calendar_link}}': settings.calendarLink || 'https://www.nrrevibe.online/#contact',
  };
}

export function renderEmailTemplate(
  template: EmailTemplate,
  lead: Lead,
  settings: AgencySettings
): { subject: string; body: string } {
  let subject = template.subject;
  let body = template.body;

  const variables = getTemplateVariables(lead, settings);

  for (const [key, value] of Object.entries(variables)) {
    subject = subject.replaceAll(key, value);
    body = body.replaceAll(key, value);
  }

  return { subject, body };
}
