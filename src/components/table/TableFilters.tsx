import React from 'react';
import { Search, Copy, Check, FileSpreadsheet, Plus } from 'lucide-react';
import { Lead } from '../../types';
import { groupCategories } from '../../utils/categoryGrouping';

interface TableFiltersProps {
  leads: Lead[];
  filteredLeadsCount: number;
  
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  
  priorityFilter: string;
  setPriorityFilter: (val: string) => void;
  
  statusFilter: string;
  setStatusFilter: (val: string) => void;
  
  quickChipFilter: string;
  setQuickChipFilter: (val: string) => void;
  
  opportunityFilter: string;
  setOpportunityFilter: (val: string) => void;
  
  contactInfoFilter: string;
  setContactInfoFilter: (val: string) => void;
  
  categoryFilter: string;
  setCategoryFilter: (val: string) => void;

  handleCopyTSV: () => void;
  copiedTSV: boolean;
  handleExportCSV: () => void;
  setIsAddLeadModalOpen: (val: boolean) => void;
}

export const TableFilters: React.FC<TableFiltersProps> = ({
  leads,
  filteredLeadsCount,
  searchTerm, setSearchTerm,
  priorityFilter, setPriorityFilter,
  statusFilter, setStatusFilter,
  quickChipFilter, setQuickChipFilter,
  opportunityFilter, setOpportunityFilter,
  contactInfoFilter, setContactInfoFilter,
  categoryFilter, setCategoryFilter,
  handleCopyTSV, copiedTSV,
  handleExportCSV, setIsAddLeadModalOpen
}) => {
  return (
    <div className="bg-white/80 backdrop-blur-md border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <h2 className="text-lg font-bold text-slate-900">Lead CRM Database</h2>
          <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-700 font-bold text-xs rounded-full">
            {filteredLeadsCount} Leads
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleCopyTSV}
            className="bg-slate-100/50 hover:bg-slate-200 text-slate-700 font-bold px-3 py-2 rounded-xl text-xs flex items-center space-x-1.5 transition-all"
            title="Copy formatted table rows to paste directly into Excel"
          >
            {copiedTSV ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
            <span>{copiedTSV ? 'Copied to Clipboard!' : 'Copy for Export'}</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="bg-emerald-600/90 hover:bg-emerald-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center space-x-1.5 transition-all shadow-sm backdrop-blur-sm"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setIsAddLeadModalOpen(true)}
            className="bg-indigo-600/90 hover:bg-indigo-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center space-x-1.5 transition-all shadow-sm backdrop-blur-sm"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Custom Lead</span>
          </button>
        </div>
      </div>

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
          { id: 'duplicates', label: `🔁 Duplicates (${leads.filter(l => l.customTags?.some(t => String(t).includes('Duplicate of'))).length})` },
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

      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search leads by business name, city, category, or domain..."
            className="w-full bg-slate-50/50 backdrop-blur-sm border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="text-xs bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:border-indigo-500 font-medium"
          >
            <option value="All">All Categories</option>
            {Object.entries(groupCategories(Array.from(new Set(leads.map(l => l.category))).filter(Boolean))).sort().map(([mainCat, subCats]) => (
              <optgroup key={mainCat} label={mainCat}>
                <option value={`MAIN:${mainCat}`} className="font-bold">📁 All {mainCat}</option>
                {subCats.sort().map(cat => (
                  <option key={cat} value={cat}>↳ {cat}</option>
                ))}
              </optgroup>
            ))}
          </select>

          <select
            value={opportunityFilter}
            onChange={e => setOpportunityFilter(e.target.value)}
            className="text-xs bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:border-indigo-500 font-medium"
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
            className="text-xs bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:border-indigo-500 font-medium"
          >
            <option value="All">All Contact Info</option>
            <option value="Has Phone">Has Phone</option>
            <option value="Has Email">Has Email</option>
            <option value="Has Instagram">Has Instagram</option>
          </select>

          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            className="bg-slate-50/50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
          >
            <option value="All">All Priorities</option>
            <option value="Hot Lead">🔥 Hot Lead (80-100)</option>
            <option value="High Priority">⚡ High Priority (60-79)</option>
            <option value="Medium Priority">Medium Priority (40-59)</option>
            <option value="Low Priority">Low Priority (0-39)</option>
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-slate-50/50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
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
    </div>
  );
};
