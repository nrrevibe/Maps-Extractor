import React, { useState } from 'react';
import {
  Search,
  Download,
  Filter,
  Sparkles,
  Eye,
  Trash2,
  CheckSquare,
  Square,
  Flame,
  Globe,
  Mail,
  Phone,
  Star,
  ExternalLink,
  ChevronDown,
  RefreshCw,
  FileSpreadsheet,
  Check,
  CheckCircle2,
  Plus,
  Copy,
  DollarSign,
  Zap,
  Tag,
  ShieldAlert,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  StickyNote,
  MessageCircle,
  Instagram
} from 'lucide-react';
import { Lead, LeadStatus, EmailStatus, LeadPriority } from '../types';
import { calculateLeadScore } from '../utils/scoring';

interface LeadsCRMTableProps {
  leads: Lead[];
  onUpdateLead: (updatedLead: Lead) => void;
  onDeleteLead: (leadId: string) => void;
  onSelectLeadForModal: (lead: Lead) => void;
  onRunBatchAIAudit: (selectedLeadIds: string[]) => void;
  onAddLeads?: (leads: Lead[]) => void;
  settings: any;
}

export const LeadsCRMTable: React.FC<LeadsCRMTableProps> = ({
  leads,
  onUpdateLead,
  onDeleteLead,
  onSelectLeadForModal,
  onRunBatchAIAudit,
  onAddLeads,
  settings,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [quickChipFilter, setQuickChipFilter] = useState<string>('All');
  
  // Added Filters
  const [opportunityFilter, setOpportunityFilter] = useState<string>('All');
  const [contactInfoFilter, setContactInfoFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [copiedTSV, setCopiedTSV] = useState(false);
  const [isAddLeadModalOpen, setIsAddLeadModalOpen] = useState(false);

  // Batch Append Note Modal State
  const [isBatchNoteModalOpen, setIsBatchNoteModalOpen] = useState(false);
  const [batchNoteInput, setBatchNoteInput] = useState('');
  const [noteSuccessToast, setNoteSuccessToast] = useState<string | null>(null);

  // Header Sorting State
  type SortField = 'score' | 'rating' | 'reviews' | 'name' | 'city' | 'status' | 'date';
  type SortDirection = 'asc' | 'desc';
  const [sortField, setSortField] = useState<SortField | null>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleHeaderSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'desc') {
        setSortDirection('asc');
      } else {
        setSortField(null);
        setSortDirection('desc');
      }
    } else {
      setSortField(field);
      setSortDirection(field === 'score' || field === 'rating' || field === 'reviews' || field === 'date' ? 'desc' : 'asc');
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400 group-hover:text-indigo-600 transition-colors" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-indigo-600 font-extrabold" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-indigo-600 font-extrabold" />
    );
  };

  // Custom Lead Form State
  const [newLeadForm, setNewLeadForm] = useState({
    businessName: '',
    category: 'Website Development',
    city: 'New York',
    phone: '',
    email: '',
    websiteUrl: '',
    rating: 4.5,
    reviewCount: 85,
    notes: 'Manually added custom client prospect.',
  });

  // Filtering Logic
  const filteredLeads = leads.filter(lead => {
    const matchesSearch =
      lead.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.websiteUrl || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesPriority = priorityFilter === 'All' || lead.leadPriority === priorityFilter;
    const matchesStatus = statusFilter === 'All' || lead.leadStatus === statusFilter;

    let matchesChip = true;
    if (quickChipFilter === 'hot') matchesChip = lead.leadScore >= 80;
    else if (quickChipFilter === 'no-website') matchesChip = !lead.websiteUrl || lead.websiteStatus === 'No Website';
    else if (quickChipFilter === 'unsecure') matchesChip = Boolean(lead.websiteUrl && !lead.https);
    else if (quickChipFilter === 'mobile-broken') matchesChip = lead.mobileFriendly === false;
    else if (quickChipFilter === 'approved-queue') matchesChip = lead.emailStatus === 'Approved' || lead.leadStatus === 'Approved';
    else if (quickChipFilter === 'today-follow-up') {
      const todayStr = new Date().toISOString().split('T')[0];
      matchesChip = lead.followUpDate === todayStr;
    }

    const matchesCategory = categoryFilter === 'All' || lead.category === categoryFilter;

    let matchesOpportunity = true;
    if (opportunityFilter === 'Website') {
      matchesOpportunity = lead.opportunityType === 'Website' || lead.opportunityType === 'New Website';
    } else if (opportunityFilter === 'Redesign') {
      matchesOpportunity = lead.opportunityType === 'Redesign' || lead.opportunityType === 'SEO';
    } else if (opportunityFilter === 'Social Media') {
      matchesOpportunity = lead.opportunityType === 'Social Media';
    } else if (opportunityFilter === 'Both') {
      matchesOpportunity = lead.opportunityType === 'Both';
    }
    
    let matchesContact = true;
    if (contactInfoFilter === 'Has Phone') matchesContact = Boolean(lead.phone && lead.phone !== 'N/A');
    else if (contactInfoFilter === 'Has Email') matchesContact = Boolean(lead.email && lead.email !== 'N/A');
    else if (contactInfoFilter === 'Has Instagram') matchesContact = Boolean(lead.instagramUrl);

    return matchesSearch && matchesPriority && matchesStatus && matchesChip && matchesOpportunity && matchesContact && matchesCategory;
  });

  // Sorting Logic
  const sortedLeads = React.useMemo(() => {
    if (!sortField) return filteredLeads;

    return [...filteredLeads].sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;

      if (sortField === 'score') {
        valA = a.leadScore ?? 0;
        valB = b.leadScore ?? 0;
      } else if (sortField === 'rating') {
        valA = a.rating ?? 0;
        valB = b.rating ?? 0;
      } else if (sortField === 'reviews') {
        valA = a.reviewCount ?? 0;
        valB = b.reviewCount ?? 0;
      } else if (sortField === 'name') {
        valA = (a.businessName || '').toLowerCase();
        valB = (b.businessName || '').toLowerCase();
      } else if (sortField === 'city') {
        valA = (a.city || '').toLowerCase();
        valB = (b.city || '').toLowerCase();
      } else if (sortField === 'status') {
        valA = (a.leadStatus || '').toLowerCase();
        valB = (b.leadStatus || '').toLowerCase();
      } else if (sortField === 'date') {
        valA = a.collectedDate ? new Date(a.collectedDate).getTime() : 0;
        valB = b.collectedDate ? new Date(b.collectedDate).getTime() : 0;
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredLeads, sortField, sortDirection]);

  // Helper to render beautiful suggested service badges
  const renderSuggestedServiceBadge = (serviceStr: string) => {
    const s = (serviceStr || '').toLowerCase();
    
    if (s.includes('new web') || s.includes('development')) {
      return (
        <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg shadow-sm">
          <Globe className="w-3.5 h-3.5 text-emerald-600" />
          <span className="text-[10px] font-bold">New Website</span>
        </div>
      );
    }
    if (s.includes('redesign')) {
      return (
        <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg shadow-sm">
          <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
          <span className="text-[10px] font-bold">Web Redesign</span>
        </div>
      );
    }
    if (s.includes('social') || s.includes('instagram')) {
      return (
        <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200 rounded-lg shadow-sm">
          <Instagram className="w-3.5 h-3.5 text-fuchsia-600" />
          <span className="text-[10px] font-bold">Social Media</span>
        </div>
      );
    }
    if (s.includes('seo') || s.includes('optimization')) {
      return (
        <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg shadow-sm">
          <Search className="w-3.5 h-3.5 text-amber-600" />
          <span className="text-[10px] font-bold">Local SEO</span>
        </div>
      );
    }
    if (s.includes('both') || s.includes('combined') || s.includes('growth')) {
      return (
        <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-gradient-to-r from-indigo-500 to-purple-500 text-white border border-indigo-600 rounded-lg shadow-sm">
          <Zap className="w-3.5 h-3.5 text-yellow-300 fill-yellow-300" />
          <span className="text-[10px] font-bold">Growth Package</span>
        </div>
      );
    }
    
    // Default fallback
    return (
      <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg shadow-sm">
        <Sparkles className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-[10px] font-bold">{serviceStr || 'Unknown'}</span>
      </div>
    );
  };

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, priorityFilter, statusFilter, quickChipFilter, opportunityFilter, contactInfoFilter, pageSize]);

  const totalPages = Math.ceil(sortedLeads.length / pageSize) || 1;
  const paginatedLeads = sortedLeads.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Select / Deselect All
  const toggleSelectAll = () => {
    if (selectedLeadIds.size === sortedLeads.length) {
      setSelectedLeadIds(new Set());
    } else {
      setSelectedLeadIds(new Set(sortedLeads.map(l => l.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedLeadIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedLeadIds(next);
  };

  // Copy Table TSV for direct Google Sheets paste
  const handleCopyTSV = () => {
    const headers = ['ID', 'Business Name', 'Category', 'City', 'Phone', 'Email', 'Website', 'Rating', 'Reviews', 'Score', 'Priority', 'Revenue Potential', 'Suggested Service', 'Status'];
    const rows = sortedLeads.map(l => [
      l.id, l.businessName, l.category, l.city, l.phone, l.email, l.websiteUrl || 'NO WEBSITE', l.rating, l.reviewCount, l.leadScore, l.leadPriority, l.revenuePotential || '$3,000', l.suggestedService, l.leadStatus
    ]);

    const tsvText = [headers.join('\t'), ...rows.map(r => r.join('\t'))].join('\n');
    navigator.clipboard.writeText(tsvText);
    setCopiedTSV(true);
    setTimeout(() => setCopiedTSV(false), 2000);
  };

  // Export to CSV
  const handleExportCSV = () => {
    setIsExporting(true);
    const headers = [
      'Lead ID', 'Business Name', 'Category', 'Google Maps URL', 'Website URL', 'Website Status',
      'Technology', 'Quality', 'HTTPS', 'Mobile Friendly', 'Phone', 'Email', 'Email Source',
      'Verified', 'Address', 'City', 'State', 'Rating', 'Reviews', 'Instagram', 'Facebook',
      'Social Status', 'Lead Score', 'Priority', 'Revenue Potential', 'Opportunity Type', 'Pain Point', 'Suggested Service',
      'Lead Status', 'Email Status', 'Last Contact', 'Follow-up Date', 'Notes', 'Collected Date'
    ];

    const rows = leads.map(l => [
      l.id, `"${l.businessName.replaceAll('"', '""')}"`, `"${l.category}"`, `"${l.googleMapsUrl}"`,
      `"${l.websiteUrl || ''}"`, l.websiteStatus, l.websiteTechnology || '', l.websiteQuality,
      l.https ? 'Yes' : 'No', l.mobileFriendly ? 'Yes' : 'No', `"${l.phone}"`, `"${l.email}"`,
      l.emailSource, l.emailVerified ? 'Yes' : 'No', `"${l.address.replaceAll('"', '""')}"`,
      `"${l.city}"`, `"${l.state}"`, l.rating, l.reviewCount, `"${l.instagramUrl || ''}"`,
      `"${l.facebookUrl || ''}"`, l.socialStatus, l.leadScore, l.leadPriority, `"${l.revenuePotential || '$3,000'}"`, l.opportunityType,
      `"${(l.painPoint || '').replaceAll('"', '""')}"`, `"${(l.suggestedService || '').replaceAll('"', '""')}"`,
      l.leadStatus, l.emailStatus, l.lastContactDate || '', l.followUpDate || '',
      `"${(l.notes || '').replaceAll('"', '""')}"`, l.collectedDate
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `NR_Revibe_GoogleMaps_Leads_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsExporting(false);
  };

  const handleStatusChange = (lead: Lead, newStatus: LeadStatus) => {
    onUpdateLead({ ...lead, leadStatus: newStatus });
  };

  // Batch Operations
  const handleBatchMoveToApproved = () => {
    selectedLeadIds.forEach(id => {
      const lead = leads.find(l => l.id === id);
      if (lead) {
        onUpdateLead({
          ...lead,
          leadStatus: 'Approved',
          emailStatus: 'Approved',
        });
      }
    });
  };

  const handleBatchApplyCampaign = () => {
    selectedLeadIds.forEach(id => {
      const lead = leads.find(l => l.id === id);
      if (lead) {
        onUpdateLead({
          ...lead,
          leadStatus: 'Approved',
          emailStatus: 'Draft',
        });
      }
    });
  };

  const handleBatchChangeStatus = (newStatus: LeadStatus) => {
    if (!newStatus) return;
    selectedLeadIds.forEach(id => {
      const lead = leads.find(l => l.id === id);
      if (lead) {
        onUpdateLead({ ...lead, leadStatus: newStatus });
      }
    });
  };

  // Real Sync to Google Sheets Web App Backend
  const [isSyncingSheets, setIsSyncingSheets] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  const handleSyncToGoogleSheets = async () => {
    if (!settings.googleAppsScriptUrl) {
      alert("Please configure the Google Apps Script Web App URL in the Settings modal first.");
      return;
    }
    
    setIsSyncingSheets(true);
    setSyncStatusMsg("Connecting and pushing leads to Google Sheets database...");
    
    try {
      const selectedLeadsList = leads.filter(l => selectedLeadIds.has(l.id));
      const response = await fetch(settings.googleAppsScriptUrl, {
        method: "POST",
        mode: "no-cors", // Allow cross-domain post requests to Google Apps Script
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync_leads",
          leads: selectedLeadsList
        })
      });

      // Update local lead status as pushed
      selectedLeadsList.forEach(lead => {
        onUpdateLead({
          ...lead,
          notes: `${lead.notes || ""}\n[SYNC] Synced to Google Sheets DB on ${new Date().toLocaleDateString()}`
        });
      });

      setSyncStatusMsg(`Successfully triggered sync for ${selectedLeadIds.size} leads! Check your Google Sheet.`);
      setTimeout(() => setSyncStatusMsg(null), 4000);
      setSelectedLeadIds(new Set());
    } catch (err: any) {
      console.error(err);
      alert(`Sync failed: ${err.message || err}`);
    } finally {
      setIsSyncingSheets(false);
    }
  };

  const handleBatchDelete = () => {
    if (window.confirm(`Are you sure you want to delete ${selectedLeadIds.size} selected lead(s)?`)) {
      selectedLeadIds.forEach(id => onDeleteLead(id));
      setSelectedLeadIds(new Set());
    }
  };

  const handleBatchAppendNote = (noteText: string) => {
    const textToAppend = noteText.trim();
    if (!textToAppend) return;

    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const formattedNote = `[${today}] ${textToAppend}`;

    let count = 0;
    selectedLeadIds.forEach(id => {
      const lead = leads.find(l => l.id === id);
      if (lead) {
        const existing = lead.notes ? lead.notes.trim() : '';
        const updatedNotes = existing ? `${existing} • ${formattedNote}` : formattedNote;
        onUpdateLead({ ...lead, notes: updatedNotes });
        count++;
      }
    });

    setNoteSuccessToast(`Appended note to ${count} lead(s)!`);
    setTimeout(() => setNoteSuccessToast(null), 3500);
    setIsBatchNoteModalOpen(false);
    setBatchNoteInput('');
  };

  // Submit New Custom Lead
  const handleSaveCustomLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadForm.businessName.trim()) return;

    const newId = `CUSTOM-${Date.now().toString().slice(-4)}`;
    const domainSlug = newLeadForm.businessName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const hasWebsite = Boolean(newLeadForm.websiteUrl.trim());

    const rawLead: Partial<Lead> = {
      id: newId,
      businessName: newLeadForm.businessName.trim(),
      category: newLeadForm.category.trim(),
      googleMapsUrl: `https://maps.google.com/?q=${encodeURIComponent(newLeadForm.businessName + ' ' + newLeadForm.city)}`,
      websiteUrl: hasWebsite ? newLeadForm.websiteUrl.trim() : undefined,
      websiteStatus: hasWebsite ? 'Active' : 'No Website',
      websiteTechnology: hasWebsite ? 'Custom Website' : 'None',
      websiteQuality: hasWebsite ? 'Average' : 'N/A',
      https: hasWebsite ? newLeadForm.websiteUrl.startsWith('https') : false,
      mobileFriendly: true,
      phone: newLeadForm.phone || '+1 555-0199',
      email: newLeadForm.email || `contact@${domainSlug || 'business'}.com`,
      emailType: 'Business',
      emailSource: 'Manual',
      emailVerified: true,
      emailConfidenceScore: 90,
      address: `100 Central Way`,
      city: newLeadForm.city || 'New York',
      state: 'State',
      country: 'USA',
      postalCode: '10001',
      rating: Number(newLeadForm.rating) || 4.5,
      reviewCount: Number(newLeadForm.reviewCount) || 50,
      socialStatus: 'Missing',
      leadStatus: 'New',
      emailStatus: 'Not Sent',
      contactAttempts: 0,
      notes: newLeadForm.notes,
      collectedDate: new Date().toISOString().split('T')[0],
      collectedBy: 'Manual Input',
    };

    const audit = calculateLeadScore(rawLead);
    const completeLead: Lead = {
      ...(rawLead as Lead),
      leadScore: audit.score,
      leadPriority: audit.priority,
      opportunityType: audit.opportunityType,
      painPoint: audit.painPoints.join(' • ') || 'Manual entry prospect',
      suggestedService: audit.suggestedService,
      revenuePotential: audit.revenuePotential,
      aiConversionProbability: audit.aiConversionProbability,
      customTags: audit.customTags,
    };

    if (onAddLeads) {
      onAddLeads([completeLead]);
    } else {
      onUpdateLead(completeLead);
    }

    setIsAddLeadModalOpen(false);
    setNewLeadForm({
      businessName: '',
      category: 'Website Development',
      city: 'New York',
      phone: '',
      email: '',
      websiteUrl: '',
      rating: 4.5,
      reviewCount: 85,
      notes: 'Manually added custom client prospect.',
    });
  };

  return (
    <div className="space-y-4">
      {syncStatusMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold px-4 py-3 rounded-xl flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <span>{syncStatusMsg}</span>
          <button onClick={() => setSyncStatusMsg(null)} className="text-emerald-500 hover:text-emerald-700">✕</button>
        </div>
      )}

      {/* Quick Action Filter Chips & Header Toolbar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-slate-900">Google Sheets CRM Lead Database</h2>
            <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-700 font-bold text-xs rounded-full">
              {filteredLeads.length} Leads
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Copy TSV button */}
            <button
              onClick={handleCopyTSV}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-2 rounded-xl text-xs flex items-center space-x-1.5 transition-all"
              title="Copy formatted table rows to paste directly into Google Sheets or Excel"
            >
              {copiedTSV ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
              <span>{copiedTSV ? 'Copied to Clipboard!' : 'Copy for Google Sheets'}</span>
            </button>

            {/* Export CSV button */}
            <button
              onClick={handleExportCSV}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center space-x-1.5 transition-all shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export CSV</span>
            </button>

            {/* Add Custom Lead button */}
            <button
              onClick={() => setIsAddLeadModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center space-x-1.5 transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Custom Lead</span>
            </button>
          </div>
        </div>

        {/* Quick Filter Chip Row */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <span className="font-bold text-slate-500 text-[11px]">Quick Filters:</span>
          {[
            { id: 'All', label: `All (${leads.length})` },
            { id: 'hot', label: `🔥 Hot Leads (${leads.filter(l => l.leadScore >= 80).length})` },
            { id: 'no-website', label: `🌐 No Website (${leads.filter(l => !l.websiteUrl || l.websiteStatus === 'No Website').length})` },
            { id: 'unsecure', label: `🔓 Unsecure HTTP (${leads.filter(l => l.websiteUrl && !l.https).length})` },
            { id: 'mobile-broken', label: `📱 Broken Mobile (${leads.filter(l => l.mobileFriendly === false).length})` },
            { id: 'approved-queue', label: `✉️ Approved Queue (${leads.filter(l => l.emailStatus === 'Approved').length})` },
            { id: 'today-follow-up', label: `📅 Today's Follow-Ups (${leads.filter(l => l.followUpDate === new Date().toISOString().split('T')[0]).length})` },
          ].map(chip => (
            <button
              key={chip.id}
              onClick={() => setQuickChipFilter(chip.id)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                quickChipFilter === chip.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Search bar & Dropdowns */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          {/* Search bar */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search leads by business name, city, category, or domain..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            />
          </div>

          {/* Priority filter */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:border-indigo-500 font-medium"
            >
              <option value="All">All Categories</option>
              {Array.from(new Set(leads.map(l => l.category))).filter(Boolean).sort().map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            <select
              value={opportunityFilter}
              onChange={e => setOpportunityFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:border-indigo-500 font-medium"
            >
              <option value="All">All Opportunities</option>
              <option value="Website">New Website Needed</option>
              <option value="Redesign">Website Redesign & SEO</option>
              <option value="Social Media">Social Media Management</option>
              <option value="Both">Combined Package (Both)</option>
            </select>

            <select
              value={contactInfoFilter}
              onChange={e => setContactInfoFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:border-indigo-500 font-medium"
            >
              <option value="All">All Contact Info</option>
              <option value="Has Phone">Has Phone</option>
              <option value="Has Email">Has Email</option>
              <option value="Has Instagram">Has Instagram</option>
            </select>

            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
            >
              <option value="All">All Priorities</option>
              <option value="Hot Lead">🔥 Hot Lead (80-100)</option>
              <option value="High Priority">⚡ High Priority (60-79)</option>
              <option value="Medium Priority">Medium Priority (40-59)</option>
              <option value="Low Priority">Low Priority (0-39)</option>
            </select>

            {/* Lead Status filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
            >
              <option value="All">All Statuses</option>
              <option value="New">New</option>
              <option value="Needs Review">Needs Review</option>
              <option value="Approved">Approved</option>
              <option value="Contacted">Contacted</option>
              <option value="Replied">Replied</option>
              <option value="Won">Won</option>
            </select>
          </div>
        </div>

      {/* Floating Action Dock for Batch Operations */}
      {selectedLeadIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-slate-100 border border-slate-700/80 rounded-2xl shadow-2xl p-3 px-5 flex flex-wrap items-center gap-3 backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center space-x-2 font-bold text-xs">
            <span className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-xs font-black shadow-sm">
              {selectedLeadIds.size} Selected
            </span>
            <button
              onClick={() => setSelectedLeadIds(new Set())}
              className="text-slate-400 hover:text-slate-200 p-1 transition-colors"
              title="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="h-5 w-px bg-slate-700" />

          {/* Move to Approved */}
          <button
            onClick={handleBatchMoveToApproved}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs flex items-center space-x-1.5 transition-all shadow-sm"
            title="Approve selected leads for outreach"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Move to Approved</span>
          </button>

          {/* Apply Campaign */}
          <button
            onClick={handleBatchApplyCampaign}
            className="bg-sky-600 hover:bg-sky-500 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs flex items-center space-x-1.5 transition-all shadow-sm"
            title="Prepare campaign email drafts"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Apply Campaign</span>
          </button>

          {/* AI Audit */}
          <button
            onClick={() => onRunBatchAIAudit(Array.from(selectedLeadIds))}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs flex items-center space-x-1.5 transition-all shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Run Gemini AI Audit</span>
          </button>

          {/* Append Batch Note */}
          <button
            onClick={() => setIsBatchNoteModalOpen(true)}
            className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs flex items-center space-x-1.5 transition-all shadow-sm"
            title="Append a common note to selected leads"
          >
            <StickyNote className="w-3.5 h-3.5" />
            <span>Append Note</span>
          </button>

          {/* Batch Status Select */}
          <div className="flex items-center space-x-1">
            <select
              onChange={e => {
                handleBatchChangeStatus(e.target.value as LeadStatus);
                e.target.value = '';
              }}
              defaultValue=""
              className="bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="" disabled>Set Status...</option>
              <option value="New">Set to New</option>
              <option value="Needs Review">Set to Needs Review</option>
              <option value="Approved">Set to Approved</option>
              <option value="Contacted">Set to Contacted</option>
              <option value="Replied">Set to Replied</option>
              <option value="Won">Set to Won</option>
            </select>
          </div>

          {/* Sync to Google Sheets */}
          <button
            onClick={handleSyncToGoogleSheets}
            disabled={isSyncingSheets}
            className="bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs flex items-center space-x-1.5 transition-all shadow-sm disabled:opacity-50"
            title="Sync selected leads to Google Sheets database via Web App"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{isSyncingSheets ? 'Syncing...' : 'Sync to Sheets'}</span>
          </button>

          <div className="h-5 w-px bg-slate-700" />

          {/* Delete */}
          <button
            onClick={handleBatchDelete}
            className="bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1 transition-all"
            title="Delete selected leads"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>Delete</span>
          </button>
        </div>
      )}
      </div>

      {/* Main CRM Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto max-h-[620px] overflow-y-auto">
          <table className="w-full text-left text-xs text-slate-700 relative">
            <thead className="bg-slate-50 text-slate-500 font-bold text-[10px] uppercase tracking-wider sticky top-0 z-20 border-b border-slate-200 select-none">
              <tr>
                {/* Checkbox Header */}
                <th className="py-3.5 px-3 w-12 rounded-tl-xl">
                  <button
                    onClick={toggleSelectAll}
                    className="text-slate-400 hover:text-slate-700 flex items-center justify-center w-full"
                    title={selectedLeadIds.size === sortedLeads.length ? 'Deselect All' : 'Select All'}
                  >
                    {selectedLeadIds.size === sortedLeads.length && sortedLeads.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-indigo-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>

                <th className="py-3.5 px-3 w-28 text-left">
                  <button
                    onClick={() => handleHeaderSort('date')}
                    className="flex items-center space-x-1.5 hover:text-indigo-600 transition-colors group text-left"
                    title="Click to sort by Date Found"
                  >
                    <span>Lead ID & Date</span>
                    {renderSortIcon('date')}
                  </button>
                </th>

                {/* Score Header */}
                <th className="py-3.5 px-3 w-32">
                  <button
                    onClick={() => handleHeaderSort('score')}
                    className="flex items-center space-x-1.5 hover:text-indigo-600 transition-colors group text-left"
                    title="Click to sort by Lead Score"
                  >
                    <span>Lead Score & Value</span>
                    {renderSortIcon('score')}
                  </button>
                </th>

                {/* Business Name Header */}
                <th className="py-3.5 px-3 min-w-[180px]">
                  <button
                    onClick={() => handleHeaderSort('name')}
                    className="flex items-center space-x-1.5 hover:text-indigo-600 transition-colors group text-left"
                    title="Click to sort by Business Name"
                  >
                    <span>Business Name & Category</span>
                    {renderSortIcon('name')}
                  </button>
                </th>

                {/* City Header */}
                <th className="py-3.5 px-3 min-w-[240px]">
                  <button
                    onClick={() => handleHeaderSort('city')}
                    className="flex items-center space-x-1.5 hover:text-indigo-600 transition-colors group text-left"
                    title="Click to sort by City"
                  >
                    <span>City & Contact Info</span>
                    {renderSortIcon('city')}
                  </button>
                </th>

                <th className="py-3.5 px-3 w-28">Website & Tech</th>

                {/* Rating & Reviews Header */}
                <th className="py-3.5 px-3 min-w-[160px]">
                  <div className="flex flex-col items-start gap-1">
                    <span>Rating & Reviews</span>
                    <div className="flex items-center space-x-1 text-[9px] lowercase">
                      <button
                        onClick={() => handleHeaderSort('rating')}
                        className={`px-1.5 py-0.5 rounded font-bold transition-all ${
                          sortField === 'rating' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                        }`}
                        title="Sort by Rating"
                      >
                        ★ rating {sortField === 'rating' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </button>
                      <button
                        onClick={() => handleHeaderSort('reviews')}
                        className={`px-1.5 py-0.5 rounded font-bold transition-all ${
                          sortField === 'reviews' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                        }`}
                        title="Sort by Review Count"
                      >
                        💬 count {sortField === 'reviews' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </button>
                    </div>
                  </div>
                </th>

                <th className="py-3.5 px-3 min-w-[220px]">Identified Pain Point</th>
                <th className="py-3.5 px-3 min-w-[160px]">Suggested Service</th>

                {/* Lead Status Header */}
                <th className="py-3.5 px-3 w-28">
                  <button
                    onClick={() => handleHeaderSort('status')}
                    className="flex items-center space-x-1.5 hover:text-indigo-600 transition-colors group text-left"
                    title="Click to sort by Lead Status"
                  >
                    <span>Lead Status</span>
                    {renderSortIcon('status')}
                  </button>
                </th>

                <th className="py-3.5 px-3 w-24">Email Status</th>
                <th className="py-3.5 px-3 w-20 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedLeads.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-500 font-medium">
                    No leads found matching your criteria. Use the Google Maps Scraper tab to extract new leads!
                  </td>
                </tr>
              ) : (
                paginatedLeads.map(lead => {
                  const isSelected = selectedLeadIds.has(lead.id);
                  return (
                    <tr
                      key={lead.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? 'bg-indigo-50/40' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3">
                        <button
                          onClick={() => toggleSelectOne(lead.id)}
                          className="text-slate-400 hover:text-slate-700"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Lead ID & Date */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-mono text-[10px] text-slate-500 mb-1">
                          {lead.id}
                        </div>
                        <div className="text-[9px] text-slate-400 font-medium">
                          {lead.collectedDate ? new Date(lead.collectedDate).toLocaleDateString() : 'Unknown Date'}
                        </div>
                      </td>

                      {/* Score & Revenue Potential */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="space-y-1">
                          <div className="flex flex-col items-start gap-1">
                            <span
                              className={`px-2 py-0.5 rounded font-bold text-xs inline-block ${
                                lead.leadScore >= 80
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : lead.leadScore >= 60
                                  ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                  : 'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}
                            >
                              {lead.leadScore}/100
                            </span>
                            <span className="text-[10px] font-bold text-slate-600">
                              {lead.leadPriority}
                            </span>
                          </div>
                          {lead.revenuePotential && (
                            <div className="text-[10px] text-emerald-700 font-bold flex items-center space-x-1">
                              <DollarSign className="w-3 h-3 text-emerald-600" />
                              <span>Value: {lead.revenuePotential}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Business Name & Category */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900 text-sm hover:text-indigo-600 transition-colors">
                          {lead.businessName}
                        </div>
                        <div className="text-[11px] text-indigo-600 font-semibold">{lead.category}</div>
                        {lead.customTags && lead.customTags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {lead.customTags.slice(0, 2).map((tg, idx) => (
                              <span key={idx} className="text-[9px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded font-medium">
                                {tg}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Contact Info */}
                      <td className="py-3 px-3">
                        <div className="text-slate-800 font-bold max-w-[190px] truncate" title={lead.city !== 'N/A' ? `${lead.city}, ${lead.state}` : lead.address}>
                          {lead.city && lead.city !== 'N/A' 
                            ? `${lead.city}${lead.state && lead.state !== 'N/A' ? ', ' + lead.state : ''}` 
                            : (lead.address && lead.address !== 'N/A' ? lead.address : 'Location N/A')}
                        </div>
                        {lead.address && lead.address !== 'N/A' && lead.city && lead.city !== 'N/A' && (
                          <div className="text-[10px] text-slate-500 max-w-[190px] truncate mt-0.5 font-medium" title={lead.address}>
                            {lead.address}
                          </div>
                        )}
                        {lead.phone && lead.phone !== 'N/A' ? (
                          <div className="text-[11px] text-slate-600 flex items-center space-x-2 mt-1 font-medium">
                            <div className="flex items-center space-x-1">
                              <Phone className="w-3 h-3 text-indigo-500" />
                              <span>{lead.phone}</span>
                            </div>
                            <button 
                              onClick={() => {
                                const phone = String(lead.phone).replace(/[^\d]/g, '');
                                const url = `https://web.whatsapp.com/send?phone=${phone}`;
                                let ackReceived = false;
                                const ackListener = (event: MessageEvent) => {
                                  if (event.data && event.data.type === 'WHATSAPP_TAB_ACK') {
                                    ackReceived = true;
                                    window.removeEventListener('message', ackListener);
                                  }
                                };
                                window.addEventListener('message', ackListener);
                                window.postMessage({ type: 'OPEN_WHATSAPP_TAB', url }, '*');
                                setTimeout(() => {
                                  if (!ackReceived) {
                                    window.removeEventListener('message', ackListener);
                                    window.open(url, 'whatsapp_dm');
                                  }
                                }, 800);

                                const noteAppend = `\n\n[OUTREACH LOG] Opened WhatsApp DM on ${new Date().toLocaleString()}`;
                                handleUpdateLead({
                                  ...lead,
                                  notes: `${lead.notes || ''}${noteAppend}`,
                                  leadStatus: lead.leadStatus === 'New' ? 'Contacted' : lead.leadStatus
                                });
                              }} 
                              className="text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.5 rounded flex items-center space-x-1 transition-colors"
                              title="WhatsApp DM"
                            >
                              <MessageCircle className="w-3 h-3" />
                              <span className="text-[9px] font-bold">WA</span>
                            </button>
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-400 flex items-center space-x-1 mt-1 font-medium italic">
                            <Phone className="w-3 h-3 text-slate-300" />
                            <span>No Phone</span>
                          </div>
                        )}
                        {lead.email && lead.email !== 'N/A' ? (
                          <div className="text-[10px] text-slate-600 flex items-center space-x-1 mt-0.5 font-medium">
                            <Mail className="w-3 h-3 text-indigo-500" />
                            <span className="truncate max-w-[140px]">{lead.email}</span>
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-400 flex items-center space-x-1 mt-0.5 font-medium italic">
                            <Mail className="w-3 h-3 text-slate-300" />
                            <span>No Email</span>
                          </div>
                        )}
                        {/* Hours */}
                        {lead.hours && lead.hours !== 'N/A' && (
                          <div className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-1.5 py-0.5 mt-1 font-semibold max-w-[190px] truncate" title={lead.hours}>
                            🕐 {lead.hours}
                          </div>
                        )}
                        {/* Social links row */}
                        {(lead.instagramUrl || lead.facebookUrl || (lead as any).twitterUrl || (lead as any).linkedinUrl || (lead as any).youtubeUrl) && (
                          <div className="flex items-center gap-1 mt-1 flex-wrap">
                            {lead.instagramUrl && (
                              <a href={lead.instagramUrl} target="_blank" rel="noreferrer" className="flex items-center space-x-1 text-[9px] px-1.5 py-0.5 bg-gradient-to-r from-pink-500 to-purple-500 text-white border border-pink-100 rounded font-bold hover:opacity-90 transition-opacity" title="Instagram Profile / DM">
                                <Instagram className="w-3 h-3" />
                                <span>DM</span>
                              </a>
                            )}
                            {lead.facebookUrl && (
                              <a href={lead.facebookUrl} target="_blank" rel="noreferrer" className="text-[9px] px-1.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded font-bold hover:bg-blue-100 transition-colors" title={lead.facebookUrl}>FB</a>
                            )}
                            {(lead as any).twitterUrl && (
                              <a href={(lead as any).twitterUrl} target="_blank" rel="noreferrer" className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded font-bold hover:bg-slate-200 transition-colors" title={(lead as any).twitterUrl}>𝕏</a>
                            )}
                            {(lead as any).linkedinUrl && (
                              <a href={(lead as any).linkedinUrl} target="_blank" rel="noreferrer" className="text-[9px] px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded font-bold hover:bg-blue-100 transition-colors" title={(lead as any).linkedinUrl}>in</a>
                            )}
                            {(lead as any).youtubeUrl && (
                              <a href={(lead as any).youtubeUrl} target="_blank" rel="noreferrer" className="text-[9px] px-1.5 py-0.5 bg-red-50 text-red-600 border border-red-100 rounded font-bold hover:bg-red-100 transition-colors" title={(lead as any).youtubeUrl}>YT</a>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Website & Tech */}
                      <td className="py-3 px-3">
                        {lead.websiteUrl ? (
                          <div>
                            <a
                              href={lead.websiteUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-indigo-600 hover:underline flex items-center space-x-1 font-semibold text-[11px]"
                            >
                              <span className="truncate max-w-[130px]">
                                {lead.websiteUrl.replace('https://', '').replace('http://', '')}
                              </span>
                              <ExternalLink className="w-3 h-3 flex-shrink-0" />
                            </a>
                            <div className="text-[10px] text-slate-500 mt-0.5 font-medium flex items-center space-x-1">
                              <span>{lead.websiteTechnology || 'Custom'}</span>
                              {!lead.https && (
                                <span className="text-rose-600 font-bold text-[9px] bg-rose-50 px-1 rounded">HTTP</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded text-[10px] font-bold">
                            No Website
                          </span>
                        )}
                      </td>

                      {/* Rating & Reviews */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center space-x-1 font-bold text-amber-600">
                          <Star className="w-3.5 h-3.5 fill-current" />
                          <span>{lead.rating}</span>
                          <span className="text-slate-500 font-normal">({lead.reviewCount})</span>
                        </div>
                      </td>

                      {/* Pain Point */}
                      <td className="py-3 px-3 max-w-xs">
                        <p className="text-[11px] text-slate-600 line-clamp-2 font-medium">
                          {lead.painPoint}
                        </p>
                        {lead.notes && (
                          <div className="text-[10px] text-amber-800 bg-amber-50/90 border border-amber-200/80 rounded px-1.5 py-0.5 mt-1 font-semibold flex items-center space-x-1 truncate max-w-[210px]" title={`Notes: ${lead.notes}`}>
                            <StickyNote className="w-3 h-3 text-amber-600 flex-shrink-0" />
                            <span className="truncate">{lead.notes}</span>
                          </div>
                        )}
                      </td>

                      {/* Suggested Service */}
                      <td className="py-3 px-3">
                        {renderSuggestedServiceBadge(lead.suggestedService)}
                      </td>

                      {/* Lead Status Dropdown */}
                      <td className="py-3 px-3">
                        <select
                          value={lead.leadStatus}
                          onChange={e => handleStatusChange(lead, e.target.value as LeadStatus)}
                          className={`text-[11px] font-bold px-2 py-1 rounded-lg border focus:outline-none ${
                            lead.leadStatus === 'New'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : lead.leadStatus === 'Approved'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : lead.leadStatus === 'Contacted'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : lead.leadStatus === 'Replied'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          <option value="New">New</option>
                          <option value="Needs Review">Needs Review</option>
                          <option value="Approved">Approved</option>
                          <option value="Contacted">Contacted</option>
                          <option value="Replied">Replied</option>
                          <option value="Won">Won</option>
                        </select>
                      </td>

                      {/* Email Status Badge */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full ${
                            lead.emailStatus === 'Sent'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : lead.emailStatus === 'Draft'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : lead.emailStatus === 'Approved'
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {lead.emailStatus}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => onSelectLeadForModal(lead)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-indigo-600 rounded-lg transition-colors"
                            title="Inspect Lead & Run AI Audit"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteLead(lead.id)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-red-600 rounded-lg transition-colors"
                            title="Delete Lead"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary & Pagination */}
        <div className="bg-slate-50 border-t border-slate-200 rounded-b-xl flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
          <div className="text-xs text-slate-500 font-medium">
            Showing {sortedLeads.length > 0 ? ((currentPage - 1) * pageSize) + 1 : 0} to {Math.min(currentPage * pageSize, sortedLeads.length)} of {sortedLeads.length} leads
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium hidden sm:inline">Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="text-xs border border-slate-200 rounded px-2 py-1 text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed bg-white"
              >
                Prev
              </button>
              <div className="px-3 text-xs font-bold text-slate-700 whitespace-nowrap">
                Page {currentPage} of {totalPages}
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed bg-white"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        <div className="bg-slate-100/50 px-4 py-3 border-t border-slate-200 text-xs text-slate-600 flex flex-wrap justify-between items-center gap-2 font-medium rounded-b-xl">
          <div className="flex items-center space-x-4">
            <span>🔥 Hot Leads: <strong className="text-amber-600">{leads.filter(l => l.leadScore >= 80).length}</strong></span>
            <span>📧 Approved Outreach: <strong className="text-emerald-600">{leads.filter(l => l.emailStatus === 'Approved' || l.emailStatus === 'Sent').length}</strong></span>
          </div>
        </div>
      </div>

      {/* Manual Add Lead Modal */}
      {isAddLeadModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Plus className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-bold text-slate-900">Add New Custom Lead Prospect</h3>
              </div>
              <button
                onClick={() => setIsAddLeadModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomLead} className="space-y-4 text-xs font-medium">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Business Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Acme Fine Dining"
                    value={newLeadForm.businessName}
                    onChange={e => setNewLeadForm({ ...newLeadForm, businessName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Category / Niche</label>
                  <input
                    type="text"
                    placeholder="e.g. Restaurants"
                    value={newLeadForm.category}
                    onChange={e => setNewLeadForm({ ...newLeadForm, category: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">City / Location</label>
                  <input
                    type="text"
                    placeholder="e.g. New York"
                    value={newLeadForm.city}
                    onChange={e => setNewLeadForm({ ...newLeadForm, city: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Website URL (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. http://acmedining.com or leave empty"
                    value={newLeadForm.websiteUrl}
                    onChange={e => setNewLeadForm({ ...newLeadForm, websiteUrl: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Phone Number</label>
                  <input
                    type="text"
                    placeholder="e.g. +1 555-0199"
                    value={newLeadForm.phone}
                    onChange={e => setNewLeadForm({ ...newLeadForm, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Contact Email</label>
                  <input
                    type="email"
                    placeholder="e.g. owner@acme.com"
                    value={newLeadForm.email}
                    onChange={e => setNewLeadForm({ ...newLeadForm, email: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Google Rating (1-5)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="5"
                    value={newLeadForm.rating}
                    onChange={e => setNewLeadForm({ ...newLeadForm, rating: parseFloat(e.target.value) || 4.5 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Review Count</label>
                  <input
                    type="number"
                    min="0"
                    value={newLeadForm.reviewCount}
                    onChange={e => setNewLeadForm({ ...newLeadForm, reviewCount: parseInt(e.target.value) || 50 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Prospect Notes</label>
                <textarea
                  rows={2}
                  value={newLeadForm.notes}
                  onChange={e => setNewLeadForm({ ...newLeadForm, notes: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsAddLeadModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-sm"
                >
                  Calculate Score & Add Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Batch Note Success Toast */}
      {noteSuccessToast && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-900 text-emerald-100 border border-emerald-700/80 rounded-xl shadow-2xl px-4 py-3 flex items-center space-x-2 font-bold text-xs animate-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{noteSuccessToast}</span>
        </div>
      )}

      {/* Batch Note Modal */}
      {isBatchNoteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                  <StickyNote className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Batch Append Note</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Updating <span className="font-bold text-indigo-600">{selectedLeadIds.size}</span> selected lead(s)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsBatchNoteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700">
                Note Content <span className="text-slate-400 font-normal">(will be appended with date timestamp)</span>
              </label>
              <textarea
                rows={3}
                value={batchNoteInput}
                onChange={e => setBatchNoteInput(e.target.value)}
                placeholder="e.g. Followed up on social media, Left voicemail, Sent custom audit proposal..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
              />

              {/* Quick Note Presets */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Quick Note Presets:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Followed up on social',
                    'Left voicemail & sent follow-up email',
                    'Connected on LinkedIn',
                    'Interested in mobile optimization',
                    'Scheduled follow-up call',
                    'High intent prospect',
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setBatchNoteInput(preset)}
                      className="text-[11px] bg-slate-100 hover:bg-amber-100 hover:text-amber-900 text-slate-700 px-2.5 py-1 rounded-lg font-semibold border border-slate-200 transition-all text-left"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsBatchNoteModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleBatchAppendNote(batchNoteInput)}
                disabled={!batchNoteInput.trim()}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white transition-all shadow-sm flex items-center space-x-1.5"
              >
                <StickyNote className="w-3.5 h-3.5" />
                <span>Append Note to {selectedLeadIds.size} Leads</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
