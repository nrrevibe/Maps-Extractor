import React, { useState } from 'react';
import {
  X,
  Sparkles,
  MapPin,
  Globe,
  Phone,
  Mail,
  Star,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Copy,
  Send,
  Calendar,
  Flame,
  FileText,
  MessageCircle,
  Instagram
} from 'lucide-react';
import { Lead, AgencySettings } from '../types';
import { renderEmailTemplate, DEFAULT_EMAIL_TEMPLATES, DEFAULT_WHATSAPP_TEMPLATES, getTemplateVariables } from '../utils/templates';

interface LeadDetailModalProps {
  lead: Lead | null;
  onClose: () => void;
  onUpdateLead: (updatedLead: Lead) => void;
  settings: AgencySettings;
}

export const LeadDetailModal: React.FC<LeadDetailModalProps> = ({
  lead,
  onClose,
  onUpdateLead,
  settings,
}) => {
  if (!lead) return null;

  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isCheckingPageSpeed, setIsCheckingPageSpeed] = useState(false);
  const [pageSpeedScore, setPageSpeedScore] = useState<number | null>(null);
  const [pageSpeedError, setPageSpeedError] = useState<string | null>(null);
  const [outreachType, setOutreachType] = useState<'Email' | 'WhatsApp'>('Email');
  const [selectedTemplateId, setSelectedTemplateId] = useState(DEFAULT_EMAIL_TEMPLATES[0].id);
  const [editedNotes, setEditedNotes] = useState(lead.notes || '');
  const [editedFollowUp, setEditedFollowUp] = useState(lead.followUpDate || '');
  const [copied, setCopied] = useState(false);

  // Render template preview
  const templatesToUse = outreachType === 'Email' ? DEFAULT_EMAIL_TEMPLATES : DEFAULT_WHATSAPP_TEMPLATES;
  const currentTemplate = templatesToUse.find(t => t.id === selectedTemplateId) || templatesToUse[0];
  const renderedEmail = renderEmailTemplate(currentTemplate, lead, settings);
  const evaluatedVariables = getTemplateVariables(lead, settings);

  const handleRunAIAudit = async () => {
    setIsGeneratingAI(true);
    try {
      const res = await fetch('/api/ai-recommendation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead,
          agencyName: settings.agencyName,
        }),
      });

      const data = await res.json();
      if (data.success) {
        onUpdateLead({
          ...lead,
          aiAnalysis: data.aiAnalysis,
          notes: `${editedNotes}\n\n[GEMINI AI RECOMMENDATION]\n${data.aiAnalysis}`,
        });
        setEditedNotes(prev => `${prev}\n\n[GEMINI AI RECOMMENDATION]\n${data.aiAnalysis}`);
      }
    } catch (err: any) {
      console.error('AI audit error:', err);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleRunPageSpeed = async () => {
    if (!lead.websiteUrl) return;
    setIsCheckingPageSpeed(true);
    setPageSpeedError(null);
    try {
      const targetUrl = lead.websiteUrl.startsWith('http') ? lead.websiteUrl : `https://${lead.websiteUrl}`;
      const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(targetUrl)}&strategy=mobile&category=performance`);
      
      if (res.status === 429) {
        setPageSpeedError('Google API Rate Limit Reached. Please try again in a few minutes.');
        setIsCheckingPageSpeed(false);
        return;
      }

      const data = await res.json();
      
      if (data.error) {
        setPageSpeedError(data.error.message || 'Failed to analyze website. Ensure the URL is accessible.');
        setIsCheckingPageSpeed(false);
        return;
      }

      if (data.lighthouseResult && data.lighthouseResult.categories && data.lighthouseResult.categories.performance) {
        const score = Math.round(data.lighthouseResult.categories.performance.score * 100);
        setPageSpeedScore(score);
        
        const noteAppend = `\n\n[PAGESPEED INSIGHTS (MOBILE)]\nPerformance Score: ${score}/100`;
        onUpdateLead({
          ...lead,
          notes: `${editedNotes}${noteAppend}`,
        });
        setEditedNotes(prev => `${prev}${noteAppend}`);
      } else {
        setPageSpeedError('Could not calculate performance score for this website.');
      }
    } catch (err) {
      console.error('PageSpeed check failed:', err);
      setPageSpeedError('Network error while checking PageSpeed.');
    } finally {
      setIsCheckingPageSpeed(false);
    }
  };

  const handleSaveModal = () => {
    onUpdateLead({
      ...lead,
      notes: editedNotes,
      followUpDate: editedFollowUp,
    });
    onClose();
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(`Subject: ${renderedEmail.subject}\n\n${renderedEmail.body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    
    // Log interaction
    const noteAppend = `\n\n[OUTREACH LOG] Copied Email/Message Text on ${new Date().toLocaleString()}`;
    onUpdateLead({ ...lead, notes: `${editedNotes}${noteAppend}` });
    setEditedNotes(prev => `${prev}${noteAppend}`);
  };

  const handleWhatsAppDM = () => {
    if (!lead.phone || lead.phone === 'N/A') return;
    const phone = String(lead.phone).replace(/[^\d]/g, '');
    const text = encodeURIComponent(renderedEmail.body);
    const url = `https://web.whatsapp.com/send?phone=${phone}&text=${text}`;

    let ackReceived = false;
    const ackListener = (event: MessageEvent) => {
      if (event.data && event.data.type === 'WHATSAPP_TAB_ACK') {
        ackReceived = true;
        window.removeEventListener('message', ackListener);
      }
    };
    window.addEventListener('message', ackListener);

    // Tell the Chrome extension to reuse the WhatsApp tab
    window.postMessage({ type: 'OPEN_WHATSAPP_TAB', url }, '*');

    // Fallback: If extension doesn't respond in 300ms, open manually
    setTimeout(() => {
      if (!ackReceived) {
        window.removeEventListener('message', ackListener);
        window.open(url, 'whatsapp_dm');
      }
    }, 800);

    // Log interaction
    const noteAppend = `\n\n[OUTREACH LOG] Opened WhatsApp DM on ${new Date().toLocaleString()}`;
    onUpdateLead({ ...lead, notes: `${editedNotes}${noteAppend}` });
    setEditedNotes(prev => `${prev}${noteAppend}`);
  };

  const handleInstagramDM = () => {
    if (!lead.instagramUrl) return;
    navigator.clipboard.writeText(renderedEmail.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    window.open(lead.instagramUrl, '_blank');

    // Log interaction
    const noteAppend = `\n\n[OUTREACH LOG] Opened Instagram DM on ${new Date().toLocaleString()}`;
    onUpdateLead({ ...lead, notes: `${editedNotes}${noteAppend}` });
    setEditedNotes(prev => `${prev}${noteAppend}`);
  };

  const handleApproveEmail = () => {
    onUpdateLead({
      ...lead,
      emailStatus: 'Approved',
      leadStatus: 'Approved',
      notes: editedNotes,
      followUpDate: editedFollowUp,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-xl text-slate-800">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 flex items-start justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-sm">
              {lead.businessName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold text-slate-900">{lead.businessName}</h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    lead.leadScore >= 80
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                  }`}
                >
                  Score: {lead.leadScore}/100 ({lead.leadPriority})
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {lead.category} • {lead.city && lead.city !== 'N/A' ? `${lead.city}${lead.state && lead.state !== 'N/A' ? ', ' + lead.state : ''}` : (lead.address && lead.address !== 'N/A' ? lead.address : 'Location N/A')} • Collected: {lead.collectedDate}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Grid */}
        <div className="p-6 space-y-6">
          {/* Key Indicators Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
              <span className="text-xs text-slate-500 font-medium">Google Rating</span>
              <div className="flex items-center space-x-1 text-lg font-bold text-amber-600">
                <Star className="w-4 h-4 fill-current" />
                <span>{lead.rating}</span>
                <span className="text-xs text-slate-500 font-normal">({lead.reviewCount} reviews)</span>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
              <span className="text-xs text-slate-500 font-medium">Website Status</span>
              <div className="text-sm font-bold text-slate-900 flex items-center space-x-1">
                {lead.websiteUrl ? (
                  <>
                    {lead.https ? (
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 text-rose-600" />
                    )}
                    <span className="truncate max-w-[130px]">{lead.websiteStatus}</span>
                  </>
                ) : (
                  <span className="text-rose-600 font-bold">No Website</span>
                )}
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
              <span className="text-xs text-slate-500 font-medium">Mobile Responsive</span>
              <div className="text-sm font-bold text-slate-900 flex items-center space-x-1">
                <Smartphone className="w-4 h-4 text-indigo-600" />
                <span>{lead.mobileFriendly ? 'Yes (Responsive)' : 'No (Broken Layout)'}</span>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
              <span className="text-xs text-slate-500 font-medium">Suggested Service</span>
              <div className="text-xs font-bold text-indigo-700 truncate">
                {lead.suggestedService}
              </div>
            </div>
          </div>

          {/* PageSpeed & Tech Banner */}
          {lead.websiteUrl && lead.websiteUrl !== 'N/A' && (
            <div className="bg-emerald-50/70 border border-emerald-100 p-5 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Smartphone className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-bold text-slate-900 text-sm">
                    Website Performance Audit (Google PageSpeed)
                  </h3>
                </div>
                
                {pageSpeedScore === null && (
                  <button
                    onClick={handleRunPageSpeed}
                    disabled={isCheckingPageSpeed}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center space-x-1.5 transition-all shadow-sm"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>{isCheckingPageSpeed ? 'Checking Speed...' : 'Run Background Check'}</span>
                  </button>
                )}
              </div>

              {pageSpeedScore !== null ? (
                <div className="flex items-center space-x-4 bg-white p-3.5 rounded-lg border border-emerald-100">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-xl border-4 ${pageSpeedScore >= 90 ? 'border-emerald-500 text-emerald-600' : pageSpeedScore >= 50 ? 'border-amber-500 text-amber-600' : 'border-rose-500 text-rose-600'}`}>
                    {pageSpeedScore}
                  </div>
                  <div>
                    <div className="font-bold text-slate-800">Mobile Performance Score</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {pageSpeedScore >= 90 ? 'Excellent performance. Focus pitch on SEO and social media.' : pageSpeedScore >= 50 ? 'Average speed. Pitch mobile optimization and caching.' : 'Poor speed. Massive opportunity for a website rebuild pitch!'}
                    </div>
                  </div>
                </div>
              ) : pageSpeedError ? (
                <div className="bg-rose-50 p-3.5 rounded-lg border border-rose-100 flex items-start space-x-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-rose-700 font-medium">
                    {pageSpeedError}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic font-medium">
                  Run a background check against Google's PageSpeed Insights API to get a real mobile performance score for {lead.websiteUrl}.
                </p>
              )}
            </div>
          )}

          {/* Gemini AI Recommendation Engine Banner */}
          <div className="bg-indigo-50/70 border border-indigo-100 p-5 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Gemini AI Executive Audit & Strategy Report
                </h3>
              </div>

              <button
                onClick={handleRunAIAudit}
                disabled={isGeneratingAI}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center space-x-1.5 transition-all shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isGeneratingAI ? 'Analyzing...' : 'Generate AI Report'}</span>
              </button>
            </div>

            {lead.aiAnalysis ? (
              <p className="text-xs text-slate-700 bg-white p-3.5 rounded-lg border border-indigo-100 leading-relaxed font-mono">
                {lead.aiAnalysis}
              </p>
            ) : (
              <p className="text-xs text-slate-500 italic font-medium">
                Click "Generate AI Report" above to run Gemini AI analysis on this lead's Google Business Profile and website data.
              </p>
            )}
          </div>

          {/* Contact Details & Links */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Business Info</h4>
              <div className="space-y-2 text-xs">
                <div className="flex items-center space-x-2 text-slate-700 font-medium">
                  <Phone className="w-4 h-4 text-indigo-600" />
                  <span>Phone: <strong className="text-slate-900">{lead.phone}</strong></span>
                </div>
                <div className="flex items-center space-x-2 text-slate-700 font-medium">
                  <Mail className="w-4 h-4 text-indigo-600" />
                  <span>Email: <strong className="text-slate-900">{lead.email}</strong> ({lead.emailType})</span>
                </div>
                <div className="flex items-center space-x-2 text-slate-700 font-medium">
                  <MapPin className="w-4 h-4 text-indigo-600" />
                  <span>Address: <strong className="text-slate-900">{lead.address}</strong></span>
                </div>
                <div className="flex items-center space-x-2 text-slate-700 font-medium">
                  <Globe className="w-4 h-4 text-indigo-600" />
                  <span>Website: </span>
                  {lead.websiteUrl ? (
                    <a href={lead.websiteUrl} target="_blank" rel="noreferrer" className="text-indigo-600 underline font-semibold flex items-center space-x-1">
                      <span>{lead.websiteUrl}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="text-slate-400">None</span>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Social Presence & Tech</h4>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-slate-500 font-medium">Social Status: </span>
                  <strong className={lead.socialStatus === 'Active' ? 'text-emerald-700' : 'text-amber-700'}>
                    {lead.socialStatus}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Technology Stack: </span>
                  <strong className="text-slate-800">{lead.websiteTechnology || 'N/A'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Identified Pain Points: </span>
                  <p className="text-amber-800 text-[11px] font-bold mt-1">{lead.painPoint}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Email Draft Preview & Template Selection */}
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <Mail className="w-4 h-4 text-indigo-600" />
                <h4 className="font-bold text-slate-900 text-sm">Personalized Outreach Draft</h4>
                <div className="flex bg-slate-200 rounded-lg p-0.5 ml-2">
                  <button
                    onClick={() => { setOutreachType('Email'); setSelectedTemplateId(DEFAULT_EMAIL_TEMPLATES[0].id); }}
                    className={`px-3 py-1 text-[10px] font-bold rounded-md transition-colors ${outreachType === 'Email' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                  >
                    Email
                  </button>
                  <button
                    onClick={() => { setOutreachType('WhatsApp'); setSelectedTemplateId(DEFAULT_WHATSAPP_TEMPLATES[0].id); }}
                    className={`px-3 py-1 text-[10px] font-bold rounded-md transition-colors ${outreachType === 'WhatsApp' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                  >
                    WhatsApp
                  </button>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-500 font-medium">Template:</span>
                <select
                  value={selectedTemplateId}
                  onChange={e => setSelectedTemplateId(e.target.value)}
                  className="bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                >
                  {templatesToUse.map(tmpl => (
                    <option key={tmpl.id} value={tmpl.id}>{tmpl.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Side: Raw Template */}
              <div className="bg-white border border-slate-200 p-4 rounded-xl text-xs space-y-3 shadow-sm flex flex-col">
                <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
                  <span className="font-bold text-slate-700">Raw Template (Dynamic Tags)</span>
                </div>
                {outreachType === 'Email' && (
                  <div className="border-b border-slate-100 pb-2 text-slate-500">
                    <span className="font-medium">Subject: </span>
                    <span className="font-mono text-[10px] bg-slate-50 px-1 rounded">{currentTemplate.subject}</span>
                  </div>
                )}
                <div className="whitespace-pre-wrap text-slate-600 leading-relaxed font-mono text-[10px] flex-grow overflow-y-auto max-h-60 bg-slate-50 p-2 rounded border border-slate-100">
                  {currentTemplate.body}
                </div>
              </div>

              {/* Right Side: Rendered Output */}
              <div className="bg-white border border-indigo-200 p-4 rounded-xl text-xs space-y-3 shadow-sm flex flex-col relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                <div className="border-b border-slate-100 pb-2 flex justify-between items-center pl-2">
                  <span className="font-bold text-indigo-700">Live Hydrated Output</span>
                </div>
                {outreachType === 'Email' && (
                  <div className="border-b border-slate-100 pb-2 pl-2">
                    <span className="text-slate-500 font-medium">Subject: </span>
                    <strong className="text-indigo-900 font-bold">{renderedEmail.subject}</strong>
                  </div>
                )}
                <div className="whitespace-pre-wrap text-slate-800 leading-relaxed font-sans font-medium pl-2 flex-grow overflow-y-auto max-h-60">
                  {renderedEmail.body}
                </div>
              </div>
            </div>

            {/* Dynamic Tag Reference */}
            <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm mt-3">
              <div className="text-xs font-bold text-slate-700 mb-2 flex items-center space-x-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-500" />
                <span>Available Dynamic Tags</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(evaluatedVariables).map(([tag, value]) => (
                  <span key={tag} className="text-[9px] font-mono bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded shadow-sm hover:bg-slate-200 hover:text-slate-900 transition-colors cursor-help" title={`Current Value: ${value || '(empty)'}`}>
                    {tag} <span className="opacity-40 ml-1">→</span> <span className="text-indigo-600 font-bold ml-1 truncate max-w-[100px] inline-block align-bottom">{value || '(empty)'}</span>
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <button
                    onClick={handleCopyEmail}
                    className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 px-3 py-2 rounded-lg font-bold flex items-center space-x-1.5 transition-colors shadow-sm"
                  >
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>{copied ? 'Copied!' : 'Copy Text'}</span>
                  </button>

                  {lead.phone && lead.phone !== 'N/A' && (
                    <button
                      onClick={handleWhatsAppDM}
                      className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 px-3 py-2 rounded-lg font-bold flex items-center space-x-1.5 transition-colors shadow-sm"
                      title="Send this template via WhatsApp"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp DM</span>
                    </button>
                  )}

                  {lead.instagramUrl && (
                    <button
                      onClick={handleInstagramDM}
                      className="bg-pink-50 hover:bg-pink-100 border border-pink-200 text-pink-700 px-3 py-2 rounded-lg font-bold flex items-center space-x-1.5 transition-colors shadow-sm"
                      title="Copies text to clipboard and opens Instagram"
                    >
                      <Instagram className="w-3.5 h-3.5" />
                      <span>IG DM</span>
                    </button>
                  )}
                </div>

                <button
                  onClick={handleApproveEmail}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-lg flex items-center space-x-1.5 transition-all shadow-sm text-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Approve & Queue</span>
                </button>
              </div>
            </div>
          </div>

          {/* Notes & Follow-up Scheduler */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1">
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                <span>Internal Notes</span>
              </label>
              <textarea
                value={editedNotes}
                onChange={e => setEditedNotes(e.target.value)}
                rows={3}
                placeholder="Add custom notes about this business..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>Next Follow-Up Date</span>
              </label>
              <input
                type="date"
                value={editedFollowUp}
                onChange={e => setEditedFollowUp(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 flex justify-end space-x-3 bg-slate-50 sticky bottom-0 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveModal}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
