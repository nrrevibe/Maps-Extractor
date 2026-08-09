import { Lead, LeadPriority, OpportunityType } from '../types';

export function calculateLeadScore(lead: Partial<Lead>): {
  score: number;
  priority: LeadPriority;
  opportunityType: OpportunityType;
  painPoints: string[];
  suggestedService: string;
  revenuePotential: string;
  aiConversionProbability: number;
  customTags: string[];
} {
  let score = 0;
  const painPoints: string[] = [];
  const customTags: string[] = [];

  // Website evaluation
  if (!lead.websiteUrl || lead.websiteStatus === 'No Website') {
    score += 30;
    painPoints.push('No dedicated business website');
    customTags.push('No Website');
  } else if (lead.websiteStatus === 'Broken') {
    score += 25;
    painPoints.push('Website link is broken or offline');
    customTags.push('Broken Site');
  } else {
    if (!lead.https) {
      score += 15;
      painPoints.push('Website lacks HTTPS security SSL certificate');
      customTags.push('Unsecure HTTP');
    }
    if (lead.mobileFriendly === false) {
      score += 15;
      painPoints.push('Website is not mobile responsive');
      customTags.push('Broken Mobile');
    }
    if (lead.websiteQuality === 'Poor') {
      score += 10;
      painPoints.push('Outdated website layout & design');
      customTags.push('Outdated Design');
    }
  }

  // Social Media evaluation
  if (lead.socialStatus === 'Missing' || (!lead.instagramUrl && !lead.facebookUrl)) {
    score += 20;
    painPoints.push('No active Instagram or Facebook presence');
    customTags.push('Missing Social');
  } else if (lead.socialStatus === 'Inactive') {
    score += 15;
    painPoints.push('Social media profile inactive for over 90 days');
    customTags.push('Inactive Social');
  }

  // Business potential
  if ((lead.rating || 0) >= 4.0) {
    score += 5;
  }
  if ((lead.reviewCount || 0) >= 100) {
    score += 10;
    painPoints.push('High Google review count but weak online conversion path');
    customTags.push('High Intent (100+ Reviews)');
  }
  if ((lead.rating || 0) >= 3.5 && (lead.rating || 0) <= 4.8) {
    score += 5; // Prime business sweet spot
  }

  // Cap score at 100
  score = Math.min(100, Math.max(0, score));

  // Determine Lead Priority
  let priority: LeadPriority = 'Low Priority';
  if (score >= 80) priority = 'Hot Lead';
  else if (score >= 60) priority = 'High Priority';
  else if (score >= 40) priority = 'Medium Priority';

  // Determine Opportunity Type
  let opportunityType: OpportunityType = 'Both';
  const hasWebIssue = !lead.websiteUrl || lead.websiteStatus === 'No Website' || lead.websiteStatus === 'Broken' || !lead.https || lead.mobileFriendly === false || lead.websiteQuality === 'Poor';
  const hasSocialIssue = lead.socialStatus === 'Missing' || lead.socialStatus === 'Inactive' || !lead.instagramUrl;

  if (hasWebIssue && hasSocialIssue) {
    opportunityType = 'Both';
  } else if (hasWebIssue) {
    opportunityType = 'Website';
  } else if (hasSocialIssue) {
    opportunityType = 'Social Media';
  } else {
    opportunityType = 'SEO';
  }

  // NR Rvibe Service Recommendation Mapping
  let suggestedService = 'Complete Digital Growth Package';
  if (!lead.websiteUrl || lead.websiteStatus === 'No Website') {
    if (lead.socialStatus === 'Active') {
      suggestedService = 'Website + Social Media Integration';
    } else {
      suggestedService = 'New Website Development';
    }
  } else if (lead.websiteQuality === 'Poor') {
    suggestedService = 'Website Redesign';
  } else if (lead.mobileFriendly === false) {
    suggestedService = 'Responsive Website Redesign';
  } else if (hasSocialIssue && !hasWebIssue) {
    suggestedService = 'Social Media Management & Content Design';
  } else if ((lead.reviewCount || 0) >= 100 && lead.websiteQuality !== 'Good') {
    suggestedService = 'Premium Website Package + Booking System';
  } else if (hasWebIssue && hasSocialIssue) {
    suggestedService = 'Complete Digital Growth Package';
  } else {
    suggestedService = 'Local SEO & Google Profile Optimization';
  }

  // Revenue Potential & AI Conversion Likelihood Calculation (INR)
  let estimatedValueNum = 15000;
  if (score >= 80) estimatedValueNum = 25000 + ((lead.reviewCount || 0) * 50);
  else if (score >= 60) estimatedValueNum = 15000 + ((lead.reviewCount || 0) * 20);
  else estimatedValueNum = 8000;

  // Cap max package estimate at ₹75,000 and round to nearest 500
  estimatedValueNum = Math.min(75000, Math.round(estimatedValueNum / 500) * 500);
  const revenuePotential = `₹${estimatedValueNum.toLocaleString('en-IN')}`;

  // AI Conversion Probability
  let aiConversionProbability = Math.min(98, Math.max(45, Math.round(score * 0.92 + ((lead.reviewCount || 0) > 100 ? 8 : 0))));

  return {
    score,
    priority,
    opportunityType,
    painPoints,
    suggestedService,
    revenuePotential,
    aiConversionProbability,
    customTags,
  };
}
