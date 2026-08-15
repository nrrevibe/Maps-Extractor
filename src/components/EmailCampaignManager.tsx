import React, { useState } from 'react';
import {
  Mail,
  Send,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Sparkles,
  Users,
  Clock,
  ShieldCheck,
  Edit3,
  Copy,
  ExternalLink,
  Flame,
  FileText,
  Columns,
  Eye,
  X,
  Check,
  Tag,
  Code,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { Lead, EmailTemplate, AgencySettings } from '../types';
import { getAvailableTemplates, renderEmailTemplate } from '../utils/templates';

import { useLeadStore } from '../store/useLeadStore';

export const EmailCampaignManager: React.FC = () => {
  const { leads, handleUpdateLead: onUpdateLead, settings } = useLeadStore();
  const availableTemplates = getAvailableTemplates(settings);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(availableTemplates[0]?.id || '');
  const currentSelectedTemplate = availableTemplates.find(t => t.id === selectedTemplateId) || availableTemplates[0];
  const [selectedLeadId, setSelectedLeadId] = useState<string>(leads[0]?.id || '');
  const [sendingProgress, setSendingProgress] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [isSplitViewOpen, setIsSplitViewOpen] = useState(false);
  const [copiedModalText, setCopiedModalText] = useState(false);
  const [copiedVariableTag, setCopiedVariableTag] = useState<string | null>(null);
  const [showVarSidebar, setShowVarSidebar] = useState(true);
  const [isApprovedQueueOpen, setIsApprovedQueueOpen] = useState(false);

  const selectedLead = leads.find(l => l.id === selectedLeadId) || leads[0];

  // Dynamic Variable Helper definitions for the selected lead
  const variableList = selectedLead
    ? [
        { tag: '{{business_name}}', label: 'Business Name', value: selectedLead.businessName },
        { tag: '{{city}}', label: 'City Location', value: selectedLead.city },
        { tag: '{{category}}', label: 'Niche Category', value: selectedLead.category },
        { tag: '{{website_issue}}', label: 'Identified Audit Gap', value: selectedLead.painPoint || 'Needs mobile optimization & HTTPS' },
        { tag: '{{google_rating}}', label: 'Google Rating', value: `${selectedLead.rating || 4.5} ★` },
        { tag: '{{review_count}}', label: 'Google Review Count', value: `${selectedLead.reviewCount || 25} reviews` },
        { tag: '{{recommended_service}}', label: 'Suggested Service', value: selectedLead.suggestedService },
        { tag: '{{revenue_potential}}', label: 'Pipeline Value', value: selectedLead.revenuePotential || '$3,000' },
        { tag: '{{sender_name}}', label: 'Sender Name', value: settings.senderName || 'NR Rvibe Specialist' },
        { tag: '{{agency_website}}', label: 'Agency Website', value: settings.agencyWebsite || 'https://www.nrrevibe.online' },
        { tag: '{{calendar_link}}', label: 'Calendar Link', value: settings.calendarLink || 'https://www.nrrevibe.online/#contact' },
      ]
    : [];

  const handleCopyTag = (tag: string) => {
    navigator.clipboard.writeText(tag);
    setCopiedVariableTag(tag);
    setTimeout(() => setCopiedVariableTag(null), 1800);
  };

  // Pipeline lists
  const approvedLeads = leads.filter(l => l.emailStatus === 'Approved');
  const sentLeads = leads.filter(l => l.emailStatus === 'Sent' || l.emailStatus === 'Delivered');
  const repliedLeads = leads.filter(l => l.emailStatus === 'Replied' || l.leadStatus === 'Replied');

  const previewTemplate = selectedLead?.approvedTemplateId
    ? availableTemplates.find(t => t.id === selectedLead.approvedTemplateId) || currentSelectedTemplate
    : currentSelectedTemplate;

  const renderedPreview = selectedLead
    ? renderEmailTemplate(previewTemplate, selectedLead, settings)
    : { subject: '', body: '' };

  const handleStartCampaignDispatch = async () => {
    if (approvedLeads.length === 0) return;
    setSendingProgress(true);
    setLogs([`[${new Date().toLocaleTimeString()}] Submitting ${approvedLeads.length} leads to Background Email Server Queue...`]);

    const mappedLeads = approvedLeads.map(current => {
       const leadTemplate = availableTemplates.find(t => t.id === current.approvedTemplateId) || currentSelectedTemplate;
       const emailContent = renderEmailTemplate(leadTemplate, current, settings);
       return {
         lead: current,
         to: current.email,
         subject: emailContent.subject,
         body: emailContent.body
       };
    });

    try {
      const res = await fetch('/api/campaign/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leads: mappedLeads,
          smtpSettings: {
            smtpHost: settings.smtpHost,
            smtpPort: settings.smtpPort,
            smtpUser: settings.smtpUser,
            smtpPass: settings.smtpPass,
            senderName: settings.senderName,
          }
        })
      });
      const data = await res.json();
      
      if (data.success && data.campaignId) {
        setLogs(prev => [...prev, `[SUCCESS] Campaign ${data.campaignId} started in background. You can safely close this window.`]);
        
        // Start polling for live logs
        const pollInterval = setInterval(async () => {
           try {
             const statusRes = await fetch(`/api/campaign/status/${data.campaignId}`);
             const statusData = await statusRes.json();
             
             if (statusData && statusData.logs) {
               setLogs(statusData.logs);
             }
             
             if (statusData && statusData.status !== 'running') {
               clearInterval(pollInterval);
               setSendingProgress(false);
               // Trigger a sync from Sheets to fetch the updated statuses
               if (statusData.status === 'completed') {
                 useLeadStore.getState().handleFetchLeadsFromDB();
               }
             }
           } catch(e) {
             clearInterval(pollInterval);
             setSendingProgress(false);
           }
        }, 3000);
      } else {
        setLogs(prev => [...prev, `[ERROR] Failed to start campaign queue: ${data.error}`]);
        setSendingProgress(false);
      }
    } catch (err: any) {
      setLogs(prev => [...prev, `[ERROR] Server connection error: ${err.message}`]);
      setSendingProgress(false);
    }
  };

  const handleOpenGmailDraft = (lead: Lead) => {
    const rendered = renderEmailTemplate(currentSelectedTemplate, lead, settings);
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(lead.email)}&su=${encodeURIComponent(rendered.subject)}&body=${encodeURIComponent(rendered.body)}`;
    window.open(gmailUrl, '_blank');
  };

  const handleCopyRenderedText = () => {
    if (!renderedPreview.body) return;
    navigator.clipboard.writeText(`Subject: ${renderedPreview.subject}\n\n${renderedPreview.body}`);
    setCopiedModalText(true);
    setTimeout(() => setCopiedModalText(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Campaign Overview Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 p-5 rounded-2xl flex items-center space-x-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">Total Qualified Leads</span>
            <div className="text-2xl font-extrabold text-slate-900">{leads.length}</div>
          </div>
        </div>

        <div 
          onClick={() => approvedLeads.length > 0 && setIsApprovedQueueOpen(true)}
          className={`bg-white border border-slate-200 p-5 rounded-2xl flex items-center space-x-4 shadow-sm transition-all ${approvedLeads.length > 0 ? 'hover:border-amber-400 hover:shadow-md cursor-pointer group' : ''}`}
        >
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 group-hover:bg-amber-100 transition-colors">
            <Clock className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500 font-medium group-hover:text-amber-700 transition-colors">Approved Queue</span>
              {approvedLeads.length > 0 && <Eye className="w-3.5 h-3.5 text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />}
            </div>
            <div className="text-2xl font-extrabold text-amber-600">{approvedLeads.length}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-2xl flex items-center space-x-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <Send className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">Emails Dispatched</span>
            <div className="text-2xl font-extrabold text-emerald-600">{sentLeads.length}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-2xl flex items-center space-x-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">Replies & Meetings</span>
            <div className="text-2xl font-extrabold text-purple-600">{repliedLeads.length}</div>
          </div>
        </div>
      </div>

      {/* Main Campaign Builder Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Template & Variable Selector */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <Mail className="w-5 h-5 text-indigo-600" />
              <h3 className="text-lg font-bold text-slate-900">1. Select Email Template</h3>
            </div>

            <button
              onClick={() => setIsSplitViewOpen(true)}
              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center space-x-1.5 transition-all border border-indigo-200"
              title="Open full split-view template editor & live preview"
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Split-View Inspector</span>
            </button>
          </div>

          <div className="space-y-3">
            {availableTemplates.map(tmpl => (
              <button
                key={tmpl.id}
                onClick={() => {
                  setSelectedTemplateId(tmpl.id);
                  if (selectedLead) onUpdateLead({ ...selectedLead, approvedTemplateId: tmpl.id });
                }}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  previewTemplate.id === tmpl.id
                    ? 'bg-indigo-50/70 border-indigo-500 text-slate-900 shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-indigo-700">{tmpl.name}</span>
                  <span className="text-[10px] px-2 py-0.5 bg-slate-200/60 text-slate-600 rounded-full font-mono font-semibold">
                    {tmpl.category}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 line-clamp-1 font-medium">{tmpl.subject}</p>
              </button>
            ))}
          </div>

          {/* Interactive Variable Helper Sidebar Panel */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Tag className="w-4 h-4 text-indigo-600" />
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                  Variable Helper Sidebar
                </h4>
              </div>
              <button
                onClick={() => setShowVarSidebar(!showVarSidebar)}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center space-x-1"
              >
                <span>{showVarSidebar ? 'Collapse' : 'Expand'}</span>
                {showVarSidebar ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            </div>

            {showVarSidebar && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5">
                <div className="flex items-center justify-between text-[11px] text-slate-500 pb-2 border-b border-slate-200">
                  <span>Click tag to copy • Live values for selected lead:</span>
                  {selectedLead && (
                    <strong className="text-slate-800 font-bold truncate max-w-[140px]">
                      {selectedLead.businessName}
                    </strong>
                  )}
                </div>

                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {variableList.map(v => (
                    <div
                      key={v.tag}
                      className="bg-white border border-slate-200 p-2 rounded-lg flex items-center justify-between gap-2 hover:border-indigo-300 transition-all group"
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center space-x-1.5">
                          <code className="text-indigo-700 font-mono font-bold text-[11px] bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                            {v.tag}
                          </code>
                          <span className="text-[10px] text-slate-500 font-semibold truncate">{v.label}</span>
                        </div>
                        <div className="text-[11px] text-slate-800 font-medium truncate pl-0.5">
                          {v.value || <span className="text-slate-400 italic">N/A</span>}
                        </div>
                      </div>

                      <button
                        onClick={() => handleCopyTag(v.tag)}
                        className={`p-1.5 rounded-md font-bold text-[10px] flex items-center space-x-1 transition-all ${
                          copiedVariableTag === v.tag
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 hover:bg-indigo-100 text-slate-600 hover:text-indigo-700'
                        }`}
                        title={`Copy ${v.tag}`}
                      >
                        {copiedVariableTag === v.tag ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span className="hidden group-hover:inline">Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Email Personalization & Dispatch */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <h3 className="text-lg font-bold text-slate-900">2. Live Personalized Email Inspector</h3>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsSplitViewOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center space-x-1.5 transition-all shadow-sm"
              >
                <Columns className="w-3.5 h-3.5" />
                <span>Open Split-View Modal</span>
              </button>

              {/* Select Target Lead */}
              <div className="flex items-center space-x-1.5 pl-2 border-l border-slate-200">
                <span className="text-xs text-slate-500 font-medium">Lead:</span>
                <select
                  value={selectedLeadId}
                  onChange={e => setSelectedLeadId(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[180px] truncate font-semibold"
                >
                  {leads.slice(0, 100).map(l => (
                    <option key={l.id} value={l.id}>
                      {l.businessName} ({l.city})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Live Rendered Email Box */}
          {selectedLead ? (
            <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4">
              <div className="border-b border-slate-200 pb-3 flex justify-between items-center text-xs">
                <div>
                  <span className="text-slate-500 font-medium">To: </span>
                  <strong className="text-slate-900">{selectedLead.email}</strong>
                </div>
                <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-md text-[10px] font-bold">
                  {selectedLead.suggestedService}
                </span>
              </div>

              <div className="border-b border-slate-200 pb-3 text-xs">
                <span className="text-slate-500 font-medium">Subject: </span>
                <strong className="text-indigo-900 font-bold">{renderedPreview.subject}</strong>
              </div>

              <div className="whitespace-pre-wrap text-xs text-slate-700 leading-relaxed font-sans max-h-72 overflow-y-auto font-medium">
                {renderedPreview.body}
              </div>

              {/* Quick Actions */}
              <div className="pt-3 border-t border-slate-200 flex flex-wrap justify-between items-center gap-3 text-xs">
                <button
                  onClick={() => handleOpenGmailDraft(selectedLead)}
                  className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg font-bold flex items-center space-x-1.5 transition-colors shadow-sm"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                  <span>Open in Gmail Draft</span>
                </button>

                <button
                  onClick={() => {
                    onUpdateLead({ ...selectedLead, emailStatus: 'Approved', leadStatus: 'Approved', approvedTemplateId: previewTemplate.id });
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all shadow-sm"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Approve Lead Email</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs">
              No lead selected. Extract leads from Google Maps to view email personalization.
            </div>
          )}

          {/* Dispatch Approved Queue Button & Automation Log */}
          <div className="pt-4 border-t border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">3. Campaign Dispatch Controls</h4>
                <p className="text-xs text-slate-500 font-medium">
                  Daily Limit: {settings.dailySendingLimit} emails • Mode: {settings.sendingMode}
                </p>
              </div>

              <button
                onClick={handleStartCampaignDispatch}
                disabled={sendingProgress || approvedLeads.length === 0}
                className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-2 transition-all shadow-sm ${
                  sendingProgress || approvedLeads.length === 0
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                {sendingProgress ? (
                  <>
                    <RotateCcw className="w-4 h-4 animate-spin text-slate-400" />
                    <span>Dispatching Queue...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Dispatch {approvedLeads.length} Approved Emails</span>
                  </>
                )}
              </button>
            </div>

            {/* Log Output */}
            {logs.length > 0 && (
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 font-mono text-[11px] text-emerald-400 max-h-36 overflow-y-auto space-y-1">
                {logs.map((log, idx) => (
                  <div key={idx}>{log}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Split-View Modal: Raw Email Template vs Live Rendered Lead View */}
      {isSplitViewOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-6xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-800">
            {/* Modal Header */}
            <div className="p-5 px-6 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-4 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-indigo-600 rounded-xl text-white">
                  <Columns className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center space-x-2">
                    <span>Email Template vs. Live Lead Render Split-View</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Compare raw template dynamic tags on the left with instant lead variable hydration on the right.
                  </p>
                </div>
              </div>

              {/* Controls Header Row */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Select Lead */}
                <div className="flex items-center space-x-2 bg-slate-800 p-1.5 px-3 rounded-xl border border-slate-700">
                  <span className="text-xs text-slate-300 font-medium">Selected Lead:</span>
                  <select
                    value={selectedLeadId}
                    onChange={e => setSelectedLeadId(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold max-w-[200px] truncate"
                  >
                    {leads.slice(0, 100).map(l => (
                      <option key={l.id} value={l.id}>
                        {l.businessName} ({l.city})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => setIsSplitViewOpen(false)}
                  className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Split View Body */}
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 overflow-y-auto flex-1">
              {/* LEFT SIDE: RAW TEMPLATE WITH TAG HIGHLIGHTS */}
              <div className="p-6 bg-slate-50/50 space-y-4 overflow-y-auto">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    <h4 className="font-bold text-slate-900 text-sm">Template Blueprint (Raw Tags)</h4>
                  </div>
                  <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 rounded-full text-[10px] font-bold">
                    {previewTemplate.category}
                  </span>
                </div>

                {/* Template Selector Tabs */}
                <div className="flex flex-wrap gap-1.5">
                  {availableTemplates.map(tmpl => (
                    <button
                      key={tmpl.id}
                      onClick={() => {
                        setSelectedTemplateId(tmpl.id);
                        if (selectedLead) onUpdateLead({ ...selectedLead, approvedTemplateId: tmpl.id });
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        previewTemplate.id === tmpl.id
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {tmpl.name}
                    </button>
                  ))}
                </div>

                {/* Subject Blueprint */}
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Subject Line Tag Pattern</span>
                  <div className="bg-white border border-slate-200 p-3 rounded-xl font-mono text-xs text-indigo-900 font-semibold shadow-sm">
                    {previewTemplate.subject}
                  </div>
                </div>

                {/* Body Blueprint */}
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Email Body Blueprint Text</span>
                  <div className="bg-white border border-slate-200 p-4 rounded-xl font-mono text-xs text-slate-800 leading-relaxed whitespace-pre-wrap shadow-sm max-h-[340px] overflow-y-auto">
                    {currentSelectedTemplate.body}
                  </div>
                </div>

                {/* Interactive Variable Helper Legend in Split-View */}
                <div className="bg-indigo-50/60 border border-indigo-100 p-3.5 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-900 text-[11px] uppercase tracking-wider flex items-center space-x-1">
                      <Tag className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Variable Helper Tag Reference</span>
                    </span>
                    <span className="text-[10px] text-indigo-700 font-semibold">Click tag to copy</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pt-1">
                    {variableList.map(v => (
                      <button
                        key={v.tag}
                        onClick={() => handleCopyTag(v.tag)}
                        className="bg-white border border-indigo-100 hover:border-indigo-300 p-1.5 rounded-lg text-left flex items-center justify-between transition-all group"
                        title={`Copy ${v.tag}`}
                      >
                        <div className="truncate">
                          <code className="text-indigo-700 font-bold font-mono text-[10px]">
                            {v.tag}
                          </code>
                          <div className="text-[10px] text-slate-500 truncate font-medium">
                            {v.value || 'N/A'}
                          </div>
                        </div>
                        <span className="text-[9px] font-bold text-indigo-600 opacity-80 group-hover:opacity-100 ml-1">
                          {copiedVariableTag === v.tag ? 'Copied!' : 'Copy'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* RIGHT SIDE: LIVE RENDERED PREVIEW FOR SELECTED LEAD */}
              <div className="p-6 bg-white space-y-4 overflow-y-auto flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <div className="flex items-center space-x-2">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <h4 className="font-bold text-slate-900 text-sm">Live Hydrated Outreach Output</h4>
                    </div>
                    {selectedLead && (
                      <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold">
                        Target: {selectedLead.businessName}
                      </span>
                    )}
                  </div>

                  {selectedLead ? (
                    <div className="space-y-3">
                      {/* Recipient & Metadata Bar */}
                      <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl space-y-1.5 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">To: <strong className="text-slate-900">{selectedLead.email}</strong></span>
                          <span className="text-slate-500">Phone: <strong className="text-slate-800">{selectedLead.phone}</strong></span>
                        </div>
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-500">Service Goal: <strong className="text-indigo-700">{selectedLead.suggestedService}</strong></span>
                          <span className="text-slate-500">Lead Score: <strong className="text-amber-700">{selectedLead.leadScore}/100</strong></span>
                        </div>
                      </div>

                      {/* Rendered Subject */}
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Hydrated Subject</span>
                        <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-bold text-indigo-900 shadow-sm">
                          {renderedPreview.subject}
                        </div>
                      </div>

                      {/* Rendered Body */}
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Hydrated Body Copy</span>
                        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-xs text-slate-800 leading-relaxed font-sans whitespace-pre-wrap shadow-sm max-h-[280px] overflow-y-auto font-medium">
                          {renderedPreview.body}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      Please select a lead to view live rendering.
                    </div>
                  )}
                </div>

                {/* Footer Action Bar for Split View */}
                {selectedLead && (
                  <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <button
                      onClick={handleCopyRenderedText}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3.5 py-2 rounded-xl flex items-center space-x-1.5 transition-all"
                    >
                      {copiedModalText ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
                      <span>{copiedModalText ? 'Copied to Clipboard!' : 'Copy Hydrated Email'}</span>
                    </button>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleOpenGmailDraft(selectedLead)}
                        className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold px-3.5 py-2 rounded-xl flex items-center space-x-1.5 transition-all shadow-sm"
                      >
                        <ExternalLink className="w-4 h-4 text-slate-500" />
                        <span>Gmail Draft</span>
                      </button>

                      <button
                        onClick={() => {
                          onUpdateLead({ ...selectedLead, emailStatus: 'Approved', leadStatus: 'Approved', approvedTemplateId: previewTemplate.id });
                          setIsSplitViewOpen(false);
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl flex items-center space-x-1.5 transition-all shadow-sm"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Approve & Close</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approved Queue Modal */}
      {isApprovedQueueOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-xl">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-amber-50 rounded-t-2xl">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-slate-800">Approved Queue ({approvedLeads.length})</h3>
              </div>
              <button onClick={() => setIsApprovedQueueOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-amber-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-2 flex-1">
              {approvedLeads.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">
                  Your approved queue is empty.
                </div>
              ) : (
                <>
                  {approvedLeads.slice(0, 100).map(lead => (
                    <div key={lead.id} className="bg-slate-50 border border-slate-200 p-3 rounded-xl hover:border-indigo-300 hover:shadow-sm transition-all flex justify-between items-center cursor-pointer group"
                      onClick={() => {
                        setSelectedLeadId(lead.id);
                        setIsApprovedQueueOpen(false);
                      }}
                    >
                      <div>
                        <div className="font-bold text-slate-800 text-sm group-hover:text-indigo-700 transition-colors">{lead.businessName}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {lead.email || 'No Email'} • Template: {availableTemplates.find(t => t.id === lead.approvedTemplateId)?.name || 'Default'}
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-[10px] font-bold">
                          Ready to Send
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                      </div>
                    </div>
                  ))}
                  {approvedLeads.length > 100 && (
                    <div className="text-center py-2 text-xs text-slate-500 font-medium">
                      + {approvedLeads.length - 100} more leads in queue
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

