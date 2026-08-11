export type WebsiteStatus = 'Active' | 'No Website' | 'Broken' | 'Redirected' | 'Needs Review';
export type WebsiteQuality = 'Good' | 'Average' | 'Poor' | 'N/A';
export type SocialStatus = 'Active' | 'Inactive' | 'Missing';
export type LeadPriority = 'Hot Lead' | 'High Priority' | 'Medium Priority' | 'Low Priority' | 'Low Priority';
export type OpportunityType = 'Website' | 'Social Media' | 'Both' | 'SEO';

export type LeadStatus =
  | 'New'
  | 'Collected'
  | 'Needs Review'
  | 'Approved'
  | 'Contacted'
  | 'Replied'
  | 'Meeting Booked'
  | 'Proposal Sent'
  | 'Won'
  | 'Lost'
  | 'Not Interested'
  | 'Unsubscribed'
  | 'Invalid';

export type EmailStatus =
  | 'Not Sent'
  | 'Draft'
  | 'Approved'
  | 'Scheduled'
  | 'Sent'
  | 'Delivered'
  | 'Opened'
  | 'Clicked'
  | 'Replied'
  | 'Bounced'
  | 'Unsubscribed'
  | 'Failed';

export interface Lead {
  id: string;
  businessName: string;
  category: string;
  googleMapsUrl: string;
  googleBusinessProfileUrl?: string;
  websiteUrl?: string;
  websiteStatus: WebsiteStatus;
  websiteTechnology?: string;
  websiteQuality: WebsiteQuality;
  https: boolean;
  mobileFriendly: boolean;
  phone: string;
  email: string;
  emailType: 'Business' | 'Generic' | 'Personal' | 'Missing';
  emailSource: 'Website' | 'Maps' | 'Social' | 'Manual';
  emailVerified: boolean;
  emailConfidenceScore: number;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  rating: number;
  reviewCount: number;
  instagramUrl?: string;
  facebookUrl?: string;
  twitterUrl?: string;
  linkedinUrl?: string;
  youtubeUrl?: string;
  tiktokUrl?: string;
  socialStatus: SocialStatus;
  lastSocialPost?: string;
  businessHours?: string;
  hours?: string;
  leadScore: number;
  leadPriority: LeadPriority;
  opportunityType: OpportunityType;
  painPoint: string;
  suggestedService: string;
  leadStatus: LeadStatus;
  emailStatus: EmailStatus;
  lastContactDate?: string;
  followUpDate?: string;
  contactAttempts: number;
  notes: string;
  collectedDate: string;
  collectedBy: string;
  searchKeyword?: string;
  searchLocation?: string;
  aiAnalysis?: string;
  revenuePotential?: string;
  aiConversionProbability?: number;
  customTags?: string[];
  approvedTemplateId?: string;
  customWebsiteIssue?: string;
  customSocialIssue?: string;
  customService?: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string;
}

export interface AgencySettings {
  agencyName: string;
  senderName: string;
  senderEmail: string;
  agencyWebsite: string;
  agencyPhone?: string;
  agencyInstagram?: string;
  calendarLink: string;
  emailSignature: string;
  dailySendingLimit: number;
  followUpIntervalDays: number;
  googleSheetConnected: boolean;
  sheetName: string;
  sheetId: string;
  sendingMode: 'Manual' | 'Approval' | 'Campaign';
  googleAppsScriptUrl?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  customTemplates?: EmailTemplate[];
}

export interface ScraperFilter {
  category: string;
  location: string;
  scanCount: number;
  onlyNoWebsite: boolean;
  onlyLowRating: boolean;
  onlyInactiveSocial: boolean;
  onlyMissingHttps: boolean;
}
