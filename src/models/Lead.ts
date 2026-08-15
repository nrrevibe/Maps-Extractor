import mongoose, { Document, Schema } from 'mongoose';

export interface ILead extends Document {
  id: string;
  businessName: string;
  phone?: string;
  email?: string;
  websiteUrl?: string;
  leadScore: number;
  leadPriority: string;
  opportunityType: string;
  painPoint: string;
  suggestedService: string;
  category?: string;
  rating?: string;
  reviewCount?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  instagramUrl?: string;
  facebookUrl?: string;
  linkedinUrl?: string;
  emailStatus?: string;
  contactAttempts?: number;
  createdAt: Date;
  updatedAt: Date;
}

const LeadSchema: Schema = new Schema({
  id: { type: String, required: true, unique: true },
  businessName: { type: String, required: true },
  phone: { type: String },
  email: { type: String, index: true },
  websiteUrl: { type: String },
  leadScore: { type: Number, default: 0 },
  leadPriority: { type: String },
  opportunityType: { type: String },
  painPoint: { type: String },
  suggestedService: { type: String },
  category: { type: String },
  rating: { type: String },
  reviewCount: { type: String },
  address: { type: String },
  city: { type: String },
  state: { type: String },
  country: { type: String },
  instagramUrl: { type: String },
  facebookUrl: { type: String },
  linkedinUrl: { type: String },
  emailStatus: { type: String, default: 'Not Sent' },
  contactAttempts: { type: Number, default: 0 }
}, {
  timestamps: true,
  strict: false // allow dynamic fields like secondaryEmails, fbFollowers, etc. from scraper
});

export const Lead = mongoose.models.Lead || mongoose.model<ILead>('Lead', LeadSchema);
